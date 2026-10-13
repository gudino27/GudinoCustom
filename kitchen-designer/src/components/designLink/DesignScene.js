import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import ContextRelease from '../three/studio/ContextRelease';
import {
  allRoomsBox,
  completeRoom,
  cutAway,
  halfDiagonal,
  sunPlacement,
  viewFov,
} from './designLinkManifest';

// The 3D half of the design-link page (/view/:token). The model is Studio's
// scene.glb (Contract C4) and every light comes from the manifest (C5), which
// DesignLinkViewer has already cleaned with normalizeManifest.
//
// Phones freeze for a second or more whenever three.js recompiles every
// material, which happens when the number of lights, a light's castShadow or
// an object's visible flag changes on a light. So the lights are made once,
// after the model loads, and a preset or a light toggle only changes
// intensities and colours.

// Module constants, so a re-render does not re-apply them to the renderer
const GL_PROPS = { antialias: true, toneMapping: THREE.NeutralToneMapping };
const SHADOWS = { type: THREE.PCFShadowMap };
const DPR = [1, 1.5];

let rectAreaReady = false;
function ensureRectAreaLights() {
  if (rectAreaReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaReady = true;
}

// r3f 8 re-throws errors from inside the Canvas (a 404/410 or a parse error
// from useGLTF) to the Canvas's parent, so the boundary sits outside it and
// draws a DOM card.
class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // name only: a loader message can contain the model URL (the token)
    console.error('Design view could not load the 3D model:', error?.name || 'Error');
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// RoomEnvironment, prefiltered (sigma 0.04), as scene.environment; copied
// from the homepage's StudioEnvironment, including its dispose
function SceneEnvironment({ intensity }) {
  const { gl, scene, invalidate } = useThree();

  useEffect(() => {
    const previous = scene.environment;
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new RoomEnvironment();
    const target = pmrem.fromScene(envScene, 0.04);
    scene.environment = target.texture;
    invalidate();

    return () => {
      scene.environment = previous;
      target.dispose();
      pmrem.dispose();
      envScene.traverse((child) => {
        if (child.geometry) child.geometry.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
        else child.material?.dispose?.();
      });
    };
  }, [gl, scene, invalidate]);

  // separate, so changing the intensity does not rebuild the PMREM
  useEffect(() => {
    scene.environmentIntensity = intensity;
    invalidate();
  }, [scene, intensity, invalidate]);

  return null;
}

// Exposure and the clear colour of the active preset
function PresetSettings({ exposure, background }) {
  const { gl, scene, invalidate } = useThree();

  useEffect(() => {
    gl.toneMappingExposure = exposure;
    invalidate();
  }, [gl, exposure, invalidate]);

  useEffect(() => {
    scene.background = new THREE.Color(background);
    invalidate();
  }, [scene, background, invalidate]);

  return null;
}

// Once per loaded model: strip lights and cameras, set shadows, collect the
// glow materials per group and find each room's nodes
function prepareModel(root, manifest) {
  const strip = [];
  root.traverse((o) => {
    if (o.isLight || o.isCamera) strip.push(o);
  });
  strip.forEach((o) => o.removeFromParent());

  const glow = new Map();
  root.traverse((o) => {
    if (o.isMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      // glass must not block the sun
      o.castShadow = !mats.some((m) => m?.transparent);
      o.receiveShadow = true;
    }
    const group = o.userData?.gv?.glow;
    if (typeof group === 'string') {
      const set = glow.get(group) || new Set();
      o.traverse((c) => {
        if (!c.isMesh) return;
        (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => {
          if (m && 'emissiveIntensity' in m) set.add(m);
        });
      });
      glow.set(group, set);
    }
  });
  root.updateMatrixWorld(true);

  const boxOf = (obj) => {
    const box = new THREE.Box3().setFromObject(obj);
    return box.isEmpty() ? null : { min: box.min.toArray(), max: box.max.toArray() };
  };
  const rooms = manifest.rooms.map((r) => {
    const object = root.getObjectByName(r.node) || null;
    // bounds that were not usable: the room node's box, else the model's
    const room = r.bounds ? r : completeRoom(r, boxOf(object || root) || { min: [-2, 0, -2], max: [2, 2.4, 2] });
    const parts = new Map();
    [room.ceilingNode, ...room.walls.map((w) => w.node)].forEach((name) => {
      const obj = name && root.getObjectByName(name);
      if (obj) parts.set(name, obj);
    });
    return { ...room, object, parts };
  });

  return { glow, rooms };
}

function makeLight(f) {
  const color = new THREE.Color(f.color);
  if (f.type === 'spot') {
    const light = new THREE.SpotLight(color, 0, f.distance, f.angle, f.penumbra, f.decay);
    light.position.fromArray(f.position);
    light.target.position.set(
      f.position[0] + f.direction[0],
      f.position[1] + f.direction[1],
      f.position[2] + f.direction[2],
    );
    return light;
  }
  if (f.type === 'point') {
    const light = new THREE.PointLight(color, 0, f.distance, f.decay);
    light.position.fromArray(f.position);
    return light;
  }
  ensureRectAreaLights();
  const light = new THREE.RectAreaLight(color, 0, f.width, f.height);
  light.position.fromArray(f.position);
  const { x, y, z } = f.basis;
  light.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z),
  ));
  return light;
}

// Every light the page will ever use, made once. Off = intensity 0.
function buildRig(fixtures) {
  const group = new THREE.Group();
  group.name = 'design-link-lights';

  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.012;
  sun.shadow.radius = 3;
  // three.js tracks a target's matrix only when it is in the scene
  group.add(sun, sun.target);

  const sky = new THREE.HemisphereLight(0xffffff, 0xbfb6a4, 0);
  const ambient = new THREE.AmbientLight(0xffffff, 0);
  group.add(sky, ambient);

  const fixtureLights = fixtures.map((f) => {
    const light = makeLight(f);
    light.castShadow = false; // fixtures cast no shadows
    group.add(light);
    if (light.target) group.add(light.target);
    return { fixture: f, light };
  });

  return { group, sun, sky, ambient, fixtureLights };
}

function disposeObject(root) {
  root.traverse((o) => {
    o.geometry?.dispose?.();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.());
  });
}

function DesignModel({ url, manifest, presetId, groupsOn, roomId, viewIndex, viewSeq, reducedMotion, onLoaded }) {
  const gltf = useGLTF(url, false, false); // no Draco or Meshopt: nothing fetched from gstatic
  const { camera, gl, invalidate } = useThree();
  const size = useThree((s) => s.size);
  const controlsRef = useRef(null);

  const prepared = useMemo(() => prepareModel(gltf.scene, manifest), [gltf, manifest]);
  const rig = useMemo(() => buildRig(manifest.fixtures), [manifest]);
  const groupGlow = useMemo(
    () => new Map(manifest.fixtureGroups.map((g) => [g.id, g.glow])),
    [manifest],
  );

  const room = prepared.rooms.find((r) => r.id === roomId) || prepared.rooms[0];
  // a room whose node is not in the file: show the whole model
  const wholeModel = !room.object;
  const view = room.cameras[viewIndex] || room.cameras[0];

  // free the model and its cache entry when it goes (or a new revision comes)
  useEffect(() => () => {
    disposeObject(gltf.scene);
    useGLTF.clear(url);
  }, [gltf, url]);

  useEffect(() => () => {
    rig.group.traverse((o) => o.dispose?.());
  }, [rig]);

  // rooms: show the chosen one, or all of them when its node is missing
  useLayoutEffect(() => {
    prepared.rooms.forEach((r) => {
      if (r.object) r.object.visible = wholeModel || r.id === room.id;
    });
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [prepared, room, wholeModel, gl, invalidate]);

  // lights and glow for the preset, toggles and room
  useLayoutEffect(() => {
    const preset = manifest.presets[presetId] || manifest.presets[manifest.defaultPreset];
    const { sun, sky, ambient, fixtureLights } = rig;

    sun.color.set(preset.sun.color);
    sun.intensity = preset.sun.on ? preset.sun.intensity : 0;
    const place = sunPlacement(room.center, room.bounds, preset.sun.direction);
    sun.position.fromArray(place.position);
    sun.target.position.fromArray(place.target);
    sun.target.updateMatrixWorld();
    const cam = sun.shadow.camera;
    cam.left = -place.extent;
    cam.right = place.extent;
    cam.top = place.extent;
    cam.bottom = -place.extent;
    cam.near = place.near;
    cam.far = place.far;
    cam.updateProjectionMatrix();

    sky.color.set(preset.sky.color);
    sky.groundColor.set(preset.sky.ground);
    sky.intensity = preset.sky.intensity;
    ambient.color.set(preset.ambient.color);
    ambient.intensity = preset.ambient.intensity;

    fixtureLights.forEach(({ fixture, light }) => {
      const roomShown = wholeModel || fixture.room === room.id;
      light.intensity = groupsOn[fixture.group] && roomShown ? fixture.intensity : 0;
    });
    prepared.glow.forEach((mats, groupId) => {
      const on = groupGlow.has(groupId) && groupsOn[groupId];
      mats.forEach((m) => {
        m.emissiveIntensity = on ? groupGlow.get(groupId) : 0;
      });
    });

    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [manifest, presetId, groupsOn, room, wholeModel, rig, prepared, groupGlow, gl, invalidate]);

  // C4 cut-away: outside the room, hide the ceiling and the walls between
  // the camera and the room; inside, hide nothing. Other rooms' parts are
  // reset so they are whole when picked again.
  const applyCutAway = useCallback(() => {
    const p = camera.position;
    const hidden = cutAway(room, [p.x, p.y, p.z]);
    let changed = false;
    prepared.rooms.forEach((r) => {
      r.parts.forEach((obj, name) => {
        const visible = r !== room || !hidden.has(name);
        if (obj.visible !== visible) {
          obj.visible = visible;
          changed = true;
        }
      });
    });
    if (changed) gl.shadowMap.needsUpdate = true;
  }, [camera, room, prepared, gl]);

  // C5 cameras rule: a wider vertical fov on portrait screens
  useLayoutEffect(() => {
    const fov = viewFov(view.fov, size.width / Math.max(1, size.height));
    if (Math.abs(camera.fov - fov) > 0.001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      invalidate();
    }
  }, [camera, view, size, invalidate]);

  // Views: the first one is a cut, later ones glide unless motion is reduced
  const placed = useRef(false);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const smooth = placed.current && !reducedMotion;
    placed.current = true;
    controls.setLookAt(...view.position, ...view.target, smooth);
    applyCutAway();
    invalidate();
  }, [view, viewSeq, reducedMotion, applyCutAway, invalidate]);

  const distanceLimit = useMemo(() => {
    const box = allRoomsBox(prepared.rooms);
    return box ? halfDiagonal(box) * 4 + 5 : 50;
  }, [prepared]);

  useEffect(() => {
    onLoaded?.();
  }, [prepared, onLoaded]);

  return (
    <>
      <primitive object={gltf.scene} />
      <primitive object={rig.group} />
      <CameraControls
        ref={controlsRef}
        makeDefault
        minDistance={0.2}
        maxDistance={distanceLimit}
        onChange={applyCutAway}
      />
    </>
  );
}

function LoadingOverlay({ label, loaded }) {
  const { active, progress } = useProgress();
  if (loaded && !active) return null;
  const pct = Number.isFinite(progress) && progress > 0 && progress < 100 ? Math.round(progress) : null;
  return (
    <div className="design-link__loading" role="status">
      <div className="design-link__spinner" aria-hidden="true" />
      <p>{pct === null ? label : `${label} ${pct}%`}</p>
    </div>
  );
}

export default function DesignScene({
  url,
  manifest,
  presetId,
  groupsOn,
  roomId,
  viewIndex,
  viewSeq,
  reducedMotion,
  onLoaded,
  fallback,
  loadingLabel,
  canvasLabel,
}) {
  const [loaded, setLoaded] = useState(false);
  const preset = manifest.presets[presetId] || manifest.presets[manifest.defaultPreset];
  const first = manifest.rooms.find((r) => r.id === roomId) || manifest.rooms[0];
  const startView = first.cameras[0];

  const handleLoaded = useCallback(() => {
    setLoaded(true);
    onLoaded?.();
  }, [onLoaded]);

  const camera = useMemo(() => ({
    position: startView ? startView.position : [6, 3, 6],
    fov: startView ? startView.fov : 50,
    near: 0.05,
    far: 500,
  }), [startView]);

  return (
    <SceneErrorBoundary key={url} fallback={fallback}>
      <div className="design-link__scene" style={{ background: preset.background }}>
        <Canvas
          dpr={DPR}
          frameloop="demand"
          gl={GL_PROPS}
          shadows={SHADOWS}
          camera={camera}
          aria-label={canvasLabel}
          role="img"
        >
          <PresetSettings exposure={preset.exposure} background={preset.background} />
          <SceneEnvironment intensity={preset.environmentIntensity} />
          <Suspense fallback={null}>
            <DesignModel
              url={url}
              manifest={manifest}
              presetId={presetId}
              groupsOn={groupsOn}
              roomId={roomId}
              viewIndex={viewIndex}
              viewSeq={viewSeq}
              reducedMotion={reducedMotion}
              onLoaded={handleLoaded}
            />
          </Suspense>
          <ContextRelease />
        </Canvas>
        <LoadingOverlay label={loadingLabel} loaded={loaded} />
      </div>
    </SceneErrorBoundary>
  );
}
