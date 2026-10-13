// The designer's 3D view drawn by the cabinet engine: real cabinetry,
// appliances and fixtures, lit like the homepage kitchen. The designer's
// default 3D view; a drop-in for DesignEditor3D (same props; Designer3D picks
// one with the renderer switch, see engine3d/rendererFlag.js).
//
// Units: the engine's, metres, y up, plan x east -> three x, plan y south ->
// three z. Camera presets, the orbit target, the room clamp and the grid are
// DesignEditor3D's inch values times IN (engine3d/camera.js, engine3d/pose.js).
//
// Geometry is built off the render path and cached (engine3d/sceneBuild.js):
// the room shell only when the room changes, one group per element only when
// its size / type / colour changes. Moving or turning an element only changes
// its group's matrix.
//
// If the engine throws for a design, the classic DesignEditor3D is shown
// instead and the reason is logged.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerformanceMonitor, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { IN, createMaterials, designerToJob } from '../../engine/index.js'
import { housedPairs } from '../../utils/designer/housing.js'
import {
  ContextRelease,
  StudioEffects,
  StudioEnvironment,
  StudioLighting,
  applyMaterialLook,
  getTextures,
  roomLighting,
  studioCanvasProps,
} from '../three/studio'
import { FINISHES, getMaterialById } from '../../constants/materials'
import DesignEditor3D from './DesignEditor3D'
import { useLanguage } from '../../contexts/LanguageContext'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'
import CameraToolbar from './engine3d/CameraToolbar.js'
import EngineErrorBoundary from './engine3d/EngineErrorBoundary.js'
import { DESIGNER_ANCHOR } from './engine3d/arExport.js'
import { cameraSetup, clampInside, easeInOut, layoutFocus, outerWallsFacing, presetView, transitionMs } from './engine3d/camera.js'
import { lowQuality, pixelRatio } from './engine3d/quality.js'
import { enclosedSpaces, interiorWalls, pushOutOfWalls, wallsInView } from './engine3d/interior.js'
import {
  clampObjectXZ,
  liveTransform,
  poseMatrix,
  poseToObject,
  writeBack,
  yawFromQuaternion,
} from './engine3d/pose.js'
import {
  adoptEnvironmentDeep,
  applyFinish,
  applyShadowFlags,
  disposeGroup,
  outerWallGroups,
  partitionGroups,
  placeGroup,
  releaseGroup,
  setFaded,
  setHighlight,
  syncScene,
} from './engine3d/sceneBuild.js'

const DEV = process.env.NODE_ENV !== 'production'
const BACKGROUND = '#eef0ef'
const SELECT_COLOR = '#4a90e2'
// phones, and machines reporting few cores / little memory, get the cheaper
// shadows, AO and pixel ratio (engine3d/quality.js)
const LOW = lowQuality()
// preserveDrawingBuffer: the quote flow reads the canvas with toDataURL
// (pdfService capture3DViews) and so does the Photo button; the composer's
// last pass draws to the canvas, so what they read is the finished picture
const CANVAS_PROPS = studioCanvasProps({ low: LOW, gl: { preserveDrawingBuffer: true } })
// a click that travelled further than this (px) was a drag: orbiting, or the
// gizmo, which must not select or deselect what the pointer ends over
const CLICK_SLOP = 4
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))

// ---------------------------------------------------------------------------
// camera control: the toolbar's views (eased), the quote PDF's wall views
// (instant: pdfService calls setWallView 1-4 and captures right after) and
// the Photo button
// ---------------------------------------------------------------------------
const CameraController = forwardRef(function CameraController({
  orbitRef, room, focus, setup, camState, reducedMotion, setClean, setPhoto, onView, walls, spaces,
}, ref) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)

  const viewFor = useCallback((name) => presetView(name, room, {
    focus, fov: camera.fov, aspect: size.width / Math.max(1, size.height), walls, spaces,
  }), [room, focus, camera, size, walls, spaces])

  // the orbit limits that go with a view: the bird's eye stands above the
  // walls, the overview outside them (orbiting from there stays outside)
  const limitsFor = useCallback((name, view) => {
    const controls = orbitRef.current
    const top = name === 'top'
    const overview = name === 'overview'
    camState.current.topY = top ? view.position[1] : 0
    camState.current.outside = overview
    if (controls) {
      const dist = Math.hypot(...view.position.map((v, i) => v - view.target[i]))
      controls.maxDistance = top ? Math.max(setup.maxDistance, dist * 1.01)
        : overview ? Math.max(setup.maxDistance, dist * 1.6)
          : setup.maxDistance
    }
  }, [orbitRef, camState, setup])

  const jump = useCallback((name, view) => {
    camState.current.anim = null
    camState.current.view = name
    limitsFor(name, view)
    camera.position.set(...view.position)
    camera.lookAt(...view.target)
    camera.updateMatrixWorld()
    const controls = orbitRef.current
    if (controls) {
      controls.target.set(...view.target)
      controls.update()
    }
  }, [camera, orbitRef, camState, limitsFor])

  const goTo = useCallback((name) => {
    const view = viewFor(name)
    if (!view) return
    setClean(false)
    onView(name)
    camState.current.view = name
    const controls = orbitRef.current
    const ms = transitionMs(camera.position.toArray(), view.position, { reducedMotion })
    if (!ms || !controls) {
      jump(name, view)
      return
    }
    // while moving, the clamp allows both ends (the bird's eye is above the walls)
    camState.current.topY = Math.max(camState.current.topY || 0, name === 'top' ? view.position[1] : 0)
    camState.current.outside = camState.current.outside || name === 'overview'
    camState.current.anim = {
      name,
      view,
      start: performance.now(),
      ms,
      fromP: camera.position.clone(),
      fromT: controls.target.clone(),
      toP: new THREE.Vector3(...view.position),
      toT: new THREE.Vector3(...view.target),
    }
  }, [viewFor, setClean, onView, orbitRef, camera, reducedMotion, jump, camState])

  // runs before OrbitControls.update (priority -1)
  useFrame(() => {
    const a = camState.current.anim
    const controls = orbitRef.current
    if (!a || !controls) return
    const t = (performance.now() - a.start) / a.ms
    const e = easeInOut(t)
    camera.position.lerpVectors(a.fromP, a.toP, e)
    controls.target.lerpVectors(a.fromT, a.toT, e)
    if (t >= 1) {
      camState.current.anim = null
      limitsFor(a.name, a.view)
    }
  }, -2)

  useImperativeHandle(ref, () => ({
    // the quote PDF: an elevation of wall n, no selection outline or gizmo
    setWallView: (wallNumber) => {
      const name = `wall${wallNumber}`
      const view = viewFor(name)
      if (!view) return
      setClean(true)
      onView(name)
      jump(name, view)
    },
    goTo,
    // a PNG of the current view at twice its on-screen size (no selection
    // outline or gizmo); resolves to a Blob, or null
    takePhoto: async () => {
      const target = pixelRatio({ photo: true, cssWidth: size.width, cssHeight: size.height })
      setClean(true)
      setPhoto({ width: size.width, height: size.height })
      try {
        for (let i = 0; i < 60 && Math.abs(gl.getPixelRatio() - target) > 1e-3; i++) await nextFrame()
        // the composer resizes, then a full frame is drawn
        for (let i = 0; i < 3; i++) await nextFrame()
        return await new Promise((resolve) => gl.domElement.toBlob(resolve, 'image/png'))
      } finally {
        setPhoto(null)
        setClean(false)
      }
    },
    getCamera: () => camera,
    getControls: () => orbitRef.current,
  }), [camera, gl, size, orbitRef, viewFor, jump, goTo, setClean, setPhoto, onView])
  return null
})

// The effect composer sizes its buffers from the canvas size only, so a
// pixel-ratio change (Photo, or the frame-rate downgrade) would leave it
// drawing at the old resolution; re-announce the same size to resize it.
function DprSync() {
  const dpr = useThree((s) => s.viewport.dpr)
  const get = useThree((s) => s.get)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const { size, setSize } = get()
    setSize(size.width, size.height, size.updateStyle, size.top, size.left)
  }, [dpr, get])
  return null
}

// ---------------------------------------------------------------------------
// shadow redraws and the shiny finishes' environment
// ---------------------------------------------------------------------------
function SceneUpkeep({ built }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  // shadows are drawn on demand (STUDIO_SHADOWS.autoUpdate = false): redraw
  // whenever an element is built, moved, added or removed, or the room changes
  useEffect(() => {
    gl.shadowMap.needsUpdate = true
  }, [gl, built])

  useFrame(() => {
    const env = scene.environment
    if (!env || !built) return
    const adopt = (group) => {
      if (group.userData.envFor !== env && adoptEnvironmentDeep(group, env)) group.userData.envFor = env
    }
    adopt(built.shell.group)
    built.cabinets.forEach((entry) => adopt(entry.group))
  })
  return null
}

// ---------------------------------------------------------------------------
// the selected element: highlight, outline, move / rotate gizmo, write-back
// ---------------------------------------------------------------------------
function Selection({
  entry, interactive, transformMode, room, scale, onUpdateElement, onTransformChange,
}) {
  const gl = useThree((s) => s.gl)
  const [proxy, setProxy] = useState(null)
  const group = entry ? entry.group : null
  const placement = entry ? entry.placement : null
  const pose = entry ? entry.pose : null
  const pose0 = entry ? entry.pose0 : null

  // a blue tint on this element's own copies of its materials
  useLayoutEffect(() => {
    if (!group) return undefined
    setHighlight(group, true)
    return () => setHighlight(group, false)
  }, [group])

  // the proxy stands where the element is (centre of its footprint, at its
  // bottom, turned like it): TransformControls drags the proxy, the element's
  // group follows through its matrix
  useLayoutEffect(() => {
    if (!proxy || !pose) return
    const { position, rotationY } = poseToObject(pose)
    proxy.position.set(...position)
    proxy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
    proxy.updateMatrix()
  }, [proxy, pose])

  const inverse0 = useMemo(() => (pose0 ? poseMatrix(pose0).invert() : null), [pose0])

  const w = placement ? placement.width : 0
  const d = placement ? placement.depth : 0
  const h = placement ? placement.height : 0
  const outline = useMemo(() => {
    if (!w || !d || !h) return null
    const pad = 0.5 * IN
    const box = new THREE.BoxGeometry(w * IN + pad, h * IN + pad, d * IN + pad)
    box.translate(0, (h * IN) / 2, 0)
    const edges = new THREE.EdgesGeometry(box)
    box.dispose()
    return edges
  }, [w, d, h])
  useEffect(() => () => { if (outline) outline.dispose() }, [outline])

  const onObjectChange = useCallback(() => {
    if (!proxy || !entry || !inverse0) return
    const yaw = yawFromQuaternion(proxy.quaternion)
    const [x, z] = clampObjectXZ([proxy.position.x, proxy.position.z], yaw, entry.placement, room)
    proxy.position.set(x, entry.pose.bottom * IN, z)
    proxy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    proxy.updateMatrix()
    entry.group.matrix.multiplyMatrices(proxy.matrix, inverse0)
    entry.group.matrixWorldNeedsUpdate = true
    gl.shadowMap.needsUpdate = true
    if (onTransformChange) {
      onTransformChange(entry.placement.id, liveTransform({ position: proxy.position.toArray(), rotationY: yaw }))
    }
  }, [proxy, entry, inverse0, room, gl, onTransformChange])

  const onMouseUp = useCallback(() => {
    if (!proxy || !entry || !onUpdateElement) return
    const updates = writeBack(
      { position: proxy.position.toArray(), rotationY: yawFromQuaternion(proxy.quaternion) },
      entry.placement,
      { scale, anchor: DESIGNER_ANCHOR, mode: transformMode },
    )
    // false: the designer declined the move (a refrigerator cabinet may not
    // leave its fridge behind, ...): put the item and the gizmo back
    if (onUpdateElement(entry.placement.id, updates) === false) {
      const { position, rotationY } = poseToObject(entry.pose)
      proxy.position.set(...position)
      proxy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
      proxy.updateMatrix()
      placeGroup(entry.group, entry.pose, entry.pose0)
      gl.shadowMap.needsUpdate = true
      if (onTransformChange) onTransformChange(entry.placement.id, liveTransform({ position, rotationY }))
    }
  }, [proxy, entry, scale, transformMode, onUpdateElement, onTransformChange, gl])

  if (!entry) return null
  return (
    <>
      <group ref={setProxy}>
        {outline ? (
          <lineSegments geometry={outline}>
            <lineBasicMaterial color={SELECT_COLOR} toneMapped={false} />
          </lineSegments>
        ) : null}
      </group>
      {interactive && proxy ? (
        <TransformControls
          object={proxy}
          size={1}
          mode={transformMode}
          rotationSnap={Math.PI / 12} // 15 degrees, as DesignEditor3D
          showX={transformMode === 'translate'}
          showZ={transformMode === 'translate'}
          showY={transformMode === 'rotate'} // turn about the vertical only
          onObjectChange={onObjectChange}
          onMouseUp={onMouseUp}
        />
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// the dollhouse cutaway: partitions between the camera and what it looks at
// turn see-through. Orbiting uses a narrow wedge round the sight line; the
// wall views (and the PDF's) a wide one, so an elevation of wall 1 is never
// hidden behind a pantry.
// ---------------------------------------------------------------------------
const WALL_VIEW_WEDGE = 0.75 // radians either side
const ORBIT_WEDGE = 0.22

// The overview stands outside the room: the room walls between the camera and
// the room are hidden, like a dollhouse with its near walls lifted off.
function OuterCutaway({ shell, room }) {
  const camera = useThree((s) => s.camera)
  const last = useRef('')
  const groups = useMemo(() => outerWallGroups(shell), [shell])
  useEffect(() => { last.current = '' }, [groups])

  useFrame(() => {
    if (!groups.size) return
    const fade = outerWallsFacing([camera.position.x / IN, camera.position.z / IN], room)
    const key = fade.join(',')
    if (key === last.current) return
    last.current = key
    groups.forEach((g, n) => { g.visible = !fade.includes(n) })
  })
  return null
}

function Cutaway({ shell, walls, camState, orbitRef }) {
  const camera = useThree((s) => s.camera)
  const last = useRef('')
  const groups = useMemo(() => partitionGroups(shell), [shell])
  // a rebuilt shell starts solid
  useEffect(() => { last.current = '' }, [groups])

  useFrame(() => {
    const controls = orbitRef.current
    if (!walls.length || !groups.size || !controls) return
    const view = camState.current.view
    const wide = typeof view === 'string' && view.startsWith('wall')
    const p = camera.position
    const t = controls.target
    const key = `${wide}|${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}|${t.x.toFixed(3)},${t.y.toFixed(3)},${t.z.toFixed(3)}`
    if (key === last.current) return
    last.current = key
    const fade = new Set(wallsInView(
      [p.x / IN, p.z / IN, p.y / IN],
      [t.x / IN, t.z / IN, t.y / IN],
      walls,
      { halfAngle: wide ? WALL_VIEW_WEDGE : ORBIT_WEDGE },
    ))
    groups.forEach((g, name) => setFaded(g, fade.has(name)))
  })
  return null
}

// ---------------------------------------------------------------------------
// everything inside the Canvas
// ---------------------------------------------------------------------------
function EngineScene({
  built, job, interactive, selectedId, setSelectedId, transformMode,
  onUpdateElement, onTransformChange, cameraRef, orbitRef, focus,
  reducedMotion, setPhoto, onView, onDecline, walls, spaces,
}) {
  const { width, depth, ceiling } = job.meta.room
  const setup = useMemo(
    () => cameraSetup({ width, depth, ceiling }, { focus, walls, spaces }),
    [width, depth, ceiling, focus, walls, spaces],
  )
  // shadows: the sun plus the two cans nearest the middle (one on low-end
  // devices); each shadowed can holds its own shadow map on the GPU
  const light = useMemo(
    () => roomLighting({ width, depth, ceiling, low: LOW, maxShadowed: LOW ? 1 : 2 }),
    [width, depth, ceiling],
  )
  const room = useMemo(() => ({ width, depth }), [width, depth])
  const shape = useMemo(() => ({ width, depth, ceiling }), [width, depth, ceiling])
  // the camera's view state, shared by the controller and the orbit clamp:
  // anim (a move between views), topY (the bird's eye stands above the walls),
  // outside (the overview: the camera may leave the room),
  // view (the toolbar view the camera is at, or null once the user moves it)
  const camState = useRef({ anim: null, topY: 0, outside: false, view: 'room' })
  // no selection outline / gizmo: the quote PDF's shots and the Photo button
  const [clean, setClean] = useState(false)
  useEffect(() => { setClean(false) }, [selectedId, interactive])
  const entries = useMemo(() => [...built.cabinets.values()], [built])
  // a fridge inside a refrigerator cabinet is built with the cabinet: selecting
  // it selects the cabinet's group (moving that moves both)
  const housingOf = useMemo(() => {
    const out = new Map()
    for (const [hid, aid] of Object.entries(job.meta.housed || {})) out.set(String(aid), hid)
    return out
  }, [job])
  const selected = selectedId !== null && selectedId !== undefined
    ? built.cabinets.get(String(selectedId)) || built.cabinets.get(housingOf.get(String(selectedId)) ?? '') || null
    : null

  // one handler for the room and every element: the nearest hit wins, so a
  // wall in front of a cabinet is what gets clicked
  const onClick = useCallback((e) => {
    if (!interactive) return
    // a faded partition is seen through: let the click reach what is behind it
    for (let p = e.object; p; p = p.parent) if (p.userData?.faded) return
    e.stopPropagation()
    // the end of an orbit or gizmo drag, not a click
    if (e.delta > CLICK_SLOP) return
    // climb from the mesh hit to its top-level group (the shell, or one
    // element's group: userData.cabinet = the element id)
    let o = e.object
    while (o && o.parent && o.parent !== e.eventObject) o = o.parent
    const entry = o && !o.userData?.shell ? built.cabinets.get(String(o.userData?.cabinet)) : null
    // the floor or a wall is empty space
    setSelectedId(entry ? entry.placement.id : null)
  }, [interactive, built, setSelectedId])

  // the camera and what it orbits stay inside the walls: orbiting, zooming
  // and panning stop at the room's edge instead of going outside it
  const keepInside = useCallback((e) => {
    const controls = e?.target
    if (!controls || camState.current.anim) return
    const { object: camera, target } = controls
    const { topY, outside } = camState.current
    if (outside) {
      // the overview: the camera may stand outside the walls, not under the
      // floor; what it orbits stays in the room
      const inside = clampInside(target.toArray(), setup.bounds)
      target.fromArray(inside)
      if (camera.position.y < setup.bounds.min[1]) camera.position.y = setup.bounds.min[1]
      return
    }
    const bounds = topY > setup.bounds.max[1]
      ? { min: setup.bounds.min, max: [setup.bounds.max[0], topY, setup.bounds.max[2]] }
      : setup.bounds
    for (const v of [camera.position, target]) {
      const now = v.toArray()
      const inside = clampInside(now, bounds)
      if (inside !== now) v.fromArray(inside)
    }
    // and out of a partition's thickness, on the side it is on (a doorway
    // lets it through)
    if (walls.length) {
      const p = camera.position
      const plan = [p.x / IN, p.z / IN]
      const out = pushOutOfWalls(plan, walls, { height: p.y / IN })
      if (out !== plan) {
        p.x = out[0] * IN
        p.z = out[1] * IN
      }
    }
  }, [setup, walls])

  // the user takes the camera: stop any move between views, the toolbar
  // shows no view as current
  const onStart = useCallback(() => {
    camState.current.anim = null
    camState.current.view = null
    setClean(false)
    onView(null)
  }, [onView])

  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <fog attach="fog" args={[BACKGROUND, Math.max(width, depth) * 3 * IN, Math.max(width, depth) * 6 * IN]} />
      <StudioEnvironment />
      <StudioLighting {...light} low={LOW} />

      <OrbitControls
        ref={orbitRef}
        target={setup.target}
        maxPolarAngle={Math.PI / 2} // not below the floor
        minDistance={setup.minDistance}
        maxDistance={setup.maxDistance}
        onChange={keepInside}
        onStart={onStart}
        makeDefault
      />
      <CameraController
        ref={cameraRef}
        orbitRef={orbitRef}
        room={shape}
        focus={focus}
        setup={setup}
        camState={camState}
        reducedMotion={reducedMotion}
        setClean={setClean}
        setPhoto={setPhoto}
        onView={onView}
        walls={walls}
        spaces={spaces}
      />
      <Cutaway shell={built.shell.group} walls={walls} camState={camState} orbitRef={orbitRef} />
      <OuterCutaway shell={built.shell.group} room={room} />
      <DprSync />
      {/* a sagging frame rate drops the pixel ratio to 1 (once) */}
      <PerformanceMonitor onDecline={onDecline} flipflops={1} />

      <gridHelper args={[setup.grid.size, setup.grid.divisions, 0xdddddd, 0xeeeeee]} position={setup.grid.position} />

      <group onClick={onClick}>
        <primitive object={built.shell.group} dispose={null} />
        {entries.map((entry) => (
          <primitive key={entry.group.uuid} object={entry.group} dispose={null} />
        ))}
      </group>

      <Selection
        entry={interactive && !clean ? selected : null}
        interactive={interactive}
        transformMode={transformMode}
        room={room}
        scale={job.meta.scale}
        onUpdateElement={onUpdateElement}
        onTransformChange={onTransformChange}
      />
      <SceneUpkeep built={built} />
      <StudioEffects low={LOW} />
      <ContextRelease />
    </>
  )
}

// ---------------------------------------------------------------------------
// the component Designer3D renders
// ---------------------------------------------------------------------------
const EngineRoom3D = (props) => {
  const {
    roomData,
    elementTypes,
    scale = 1,
    roomType = 'kitchen',
    interactive = false,
    selectedElement: parentSelectedElement,
    setSelectedElement: parentSetSelectedElement,
    onUpdateElement,
    onTransformChange,
    cameraRef,
  } = props
  const [transformMode, setTransformMode] = useState('translate')
  const [internalSelectedId, setInternalSelectedId] = useState(null)
  const selectedId = parentSelectedElement !== undefined ? parentSelectedElement : internalSelectedId
  const setSelectedId = parentSetSelectedElement || setInternalSelectedId
  const [crash, setCrash] = useState(null)
  const { t } = useLanguage()
  const reducedMotion = usePrefersReducedMotion()
  const [activeView, setActiveView] = useState('room')
  // { width, height } while the Photo button renders at twice the size
  const [photo, setPhoto] = useState(null)
  const [degraded, setDegraded] = useState(false)
  const onDecline = useCallback(() => setDegraded(true), [])
  const dpr = useMemo(() => (photo
    ? pixelRatio({ photo: true, cssWidth: photo.width, cssHeight: photo.height })
    : pixelRatio({ low: LOW, degraded })), [photo, degraded])
  // where the items are when the view opens: the opening shot looks at them
  // from the far corner, and does not follow later edits
  const [focus] = useState(() => layoutFocus(roomData?.elements, scale))
  // partitions (a pantry) and the spaces they close off, for the camera: the
  // orbit clamp, the cutaway, the opening corner and the Pantry buttons
  const customWalls = roomData?.customWalls
  const doors = roomData?.doors
  const activeWalls = roomData?.walls
  const dimensions = roomData?.dimensions
  const walls = useMemo(
    () => interiorWalls({ customWalls, doors, walls: activeWalls, dimensions }, { scale }),
    [customWalls, doors, activeWalls, dimensions, scale],
  )
  const spaces = useMemo(
    () => enclosedSpaces({ dimensions }, { walls }),
    [dimensions, walls],
  )
  const orbitRef = useRef()
  const internalCameraRef = useRef()
  const cacheRef = useRef({})
  const loggedRef = useRef('')

  // one material set per view, styled like the homepage; elements with a
  // colour of their own get copies (sceneBuild.applyFinish)
  const materials = useMemo(() => {
    const tex = getTextures()
    const set = createMaterials()
    Object.values(set).forEach((m) => applyMaterialLook(m, tex))
    return set
  }, [])

  const result = useMemo(() => {
    if (!roomData) return null
    try {
      const job = designerToJob(roomData, {
        elementTypes, roomType, scale, anchor: DESIGNER_ANCHOR, materialLookup: getMaterialById,
        // a fridge in a refrigerator cabinet is built by the cabinet
        housed: housedPairs(roomData.elements || [], elementTypes, scale),
      })
      const tex = getTextures()
      const prepare = (group, placement) => {
        applyShadowFlags(group, { shell: !placement })
        if (placement) applyFinish(group, placement.options?.finish, { finishes: FINISHES, lookup: getMaterialById, tex })
        if (placement?.options?.housedFinish) {
          applyFinish(group, placement.options.housedFinish, { finishes: FINISHES, lookup: getMaterialById, tex })
        }
      }
      const built = syncScene(cacheRef.current, job, { materials, prepare })
      return { job, built }
    } catch (error) {
      return { error }
    }
  }, [roomData, elementTypes, roomType, scale, materials])

  // commit: free what the new scene no longer uses, remember what it uses
  useEffect(() => {
    if (!result) return
    if (result.error) {
      console.error('[EngineRoom3D] the cabinet engine could not build this design; showing the classic 3D view.', result.error)
      return
    }
    const { built, job } = result
    for (const entry of built.dropped) disposeGroup(entry.group)
    if (built.droppedShell) disposeGroup(built.droppedShell)
    cacheRef.current = built
    if (DEV) {
      const notes = [...(job.meta.warnings || []), ...built.notes]
      const text = notes.join('\n')
      if (notes.length && text !== loggedRef.current) console.info('[EngineRoom3D] engine notes:\n' + text)
      loggedRef.current = text
    }
  }, [result])

  // unmount: free the GPU side (StrictMode remounts with the same objects,
  // which three re-uploads on demand)
  // The engine cache is dropped too (a StrictMode remount re-runs the commit
  // effect above, which puts it back).
  useEffect(() => () => {
    const cache = cacheRef.current
    if (cache.shell) releaseGroup(cache.shell.group)
    if (cache.cabinets) cache.cabinets.forEach((entry) => releaseGroup(entry.group))
    cacheRef.current = {}
    Object.values(materials).forEach((m) => m.dispose())
  }, [materials])

  // development only: the renderer for memory checks (renderer.info)
  // and a way to draw frames by hand while the tab is hidden
  const onCreated = useCallback((state) => {
    if (!DEV || typeof window === 'undefined') return
    window.__designer3d = {
      gl: state.gl,
      scene: state.scene,
      step: (n = 1) => {
        for (let i = 0; i < n; i += 1) state.advance(performance.now() + i * 16, true)
      },
    }
  }, [])
  useEffect(() => () => {
    if (DEV && typeof window !== 'undefined') delete window.__designer3d
  }, [])

  const onCrash = useCallback((error) => {
    console.error('[EngineRoom3D] the engine view crashed; showing the classic 3D view.', error)
    setCrash(error)
  }, [])

  if (!roomData) return null
  if (crash || !result || result.error) return <DesignEditor3D {...props} />

  const { job, built } = result
  // the opening shot; R3F only re-applies it when the room size changes
  const setup = cameraSetup(job.meta.room, { focus, walls, spaces })
  const camRef = cameraRef || internalCameraRef

  return (
    <div className="w-full h-full bg-gray-100 relative" data-designer3d="engine">
      <EngineErrorBoundary onError={onCrash}>
        <Canvas
          {...CANVAS_PROPS}
          dpr={dpr}
          camera={{ position: setup.position, fov: setup.fov, near: setup.near, far: setup.far }}
          onPointerMissed={() => interactive && setSelectedId(null)}
          onCreated={onCreated}
        >
          <EngineScene
            built={built}
            job={job}
            interactive={interactive}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            transformMode={transformMode}
            onUpdateElement={onUpdateElement}
            onTransformChange={onTransformChange}
            cameraRef={camRef}
            orbitRef={orbitRef}
            focus={focus}
            reducedMotion={reducedMotion}
            setPhoto={setPhoto}
            onView={setActiveView}
            onDecline={onDecline}
            walls={walls}
            spaces={spaces}
          />
        </Canvas>
      </EngineErrorBoundary>

      {/* camera views and the photo, top right */}
      <div className="absolute top-2 right-2 left-2 sm:left-auto flex justify-end pointer-events-none">
        <CameraToolbar
          t={t}
          active={activeView}
          roomType={roomType}
          spaces={spaces}
          onView={(name) => camRef.current?.goTo?.(name)}
          onPhoto={() => camRef.current?.takePhoto?.()}
        />
      </div>

      {/* move / rotate for the selected item, and how the mouse works */}
      <div className="absolute bottom-3 right-3 left-3 sm:left-auto flex flex-col gap-2 items-end pointer-events-none">
        {interactive && selectedId !== null && selectedId !== undefined && (
          <div
            role="group"
            aria-label={t('designer.view3d.gizmoMode')}
            className="bg-white/90 backdrop-blur shadow-lg rounded-lg p-1 pointer-events-auto flex gap-1"
          >
            {[['translate', t('designer.view3d.move')], ['rotate', t('designer.view3d.rotate')]].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTransformMode(mode)}
                aria-pressed={transformMode === mode}
                className={`h-9 px-3 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${transformMode === mode ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <p className="hidden sm:block bg-white/85 backdrop-blur px-3 py-1 rounded text-xs text-gray-700">
          {t('designer.view3d.hint')}{interactive ? ` • ${t('designer.view3d.hintSelect')}` : ''}
        </p>
      </div>
    </div>
  )
}

export default EngineRoom3D
