import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  ContextRelease,
  IN,
  STUDIO_LOW,
  studioCanvasProps,
  StudioEnvironment,
  StudioLighting,
  StudioEffects,
  ExteriorView,
  getTextures,
  applyMaterialLook,
  castsShadow,
  adoptEnvironment,
} from '../three/studio'
import { useLanguage } from '../../contexts/LanguageContext'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'

// The kitchen is authored to the dimensions on the client's KCD elevation drawing (kept outside the repo)
// by scripts/build_kitchen.py and exported to this GLB. Every mesh carries glTF
// `extras` (-> userData):
//   build_static : 1 = room shell (always visible), 0 = builds in on scroll
//   build_order  : reveal step, 1..35 (meshes of one cabinet share a step)
//   build_group  : room | base | counter | upper | tall | appliance | island | trim
const MODEL_URL = `${process.env.PUBLIC_URL || ''}/models/kitchen.glb`

// The GLB is fetched and parsed once per page load: the canvas unmounts when
// the section is far off screen (to free the GPU) and a remount clones the
// cached scene instead of downloading and parsing it again.
let gltfPromise = null
function loadKitchenGLB() {
  if (!gltfPromise) {
    gltfPromise = new Promise((resolve, reject) => {
      new GLTFLoader().load(MODEL_URL, resolve, undefined, reject)
    }).catch((err) => {
      gltfPromise = null
      throw err
    })
  }
  return gltfPromise
}

// Unmount the canvas once the section is this many viewport heights past
// the edge of the screen, and mount it again when it comes back within
// REMOUNT_VIEWPORTS (the gap keeps a scroll at the edge from flapping; the
// remount happens well before the canvas can be seen, so the first frame is
// drawn off screen and nothing pops in).
const UNMOUNT_VIEWPORTS = 2
const REMOUNT_VIEWPORTS = 1.5

// The builder's plan coordinates survive the glTF axis conversion intact:
// three.js (x, y, z) = (plan east, height, plan south) in inches.
const at = (east, south, up) => [east * IN, up * IN, south * IN]

const TRAVEL = 0.26 // metres each part moves into place

// Phones and small tablets get smaller shadow maps and cheaper AO.
const LOW = STUDIO_LOW
// shadows (see STUDIO_SHADOWS), dpr and the renderer options every studio
// canvas shares
const CANVAS_PROPS = studioCanvasProps({ low: LOW })

// Each run builds while its own transparent gap holds the screen. The gap
// positions depend on viewport height and on how the content reflows, so they
// are measured from the DOM at runtime rather than hard-coded — that is what
// keeps the timing right on a phone in portrait, a tablet, and a wide desktop.
const FALLBACK_WINDOW = {
  back: [0.05, 0.19],
  right: [0.26, 0.40],
  island: [0.54, 0.78],
}
const ZONE_ORDER = ['back', 'right', 'island']

// The island's gap is the last place the kitchen shows, so it carries the
// finish as well as the island: build, square up on the panelled fronts, then
// pull back so the finished room is on screen when the content closes over it.
// Fractions of that gap's on-screen span.
const FINALE = {
  build: 0.52, // island parts land by here
  hold: 0.6, // ...a beat on the finished working face
  product: 0.9, // round the island and out to the whole room; held from here
}

// Uppers, counters and trim settle down onto what is already there; everything
// that stands on the floor rises up into place.
const FALLS = new Set(['upper', 'trim', 'counter'])

// ---------------------------------------------------------------------------
// math helpers
// ---------------------------------------------------------------------------
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3)
const easeInOut = (v) => {
  const t = clamp01(v)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
const lerp = (a, b, t) => a + (b - a) * t

function vlerp(out, a, b, t) {
  out.set(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t))
  return out
}

// ---------------------------------------------------------------------------
// camera: an establishing wide shot that settles into the PDF's page-1 view —
// south-west of the island looking north-east, oven wall on the right.
// ---------------------------------------------------------------------------
// The PDF render is framed at roughly a 24 mm lens. three.js `fov` is vertical,
// so on a wide viewport a fixed value swings the horizontal framing wide open
// and the kitchen shrinks. Lock the horizontal angle instead and derive fov.
const HFOV = 74
function fovForAspect(aspect) {
  const h = (HFOV * Math.PI) / 180
  const v = 2 * Math.atan(Math.tan(h / 2) / Math.max(0.55, aspect))
  return Math.min(62, Math.max(34, (v * 180) / Math.PI))
}

// Build steps are grouped by zone (back wall, oven wall, island), so the camera
// moves with the work: settle on the run being built, swap to the next, finish
// on the island front, then pull back for the product shot.
// The build opens already in progress on wall 1 — an empty establishing shot
// just reads as a blank page. The pull-back happens inside the island's gap:
// once the content closes over the canvas nobody sees the camera any more, so
// a product shot scheduled after that only ever showed through stray seams.
// The island's doors and drawers face north-east, into the kitchen; its south
// and west sides are the raised-panel back. So the island builds watched from
// the corner by the hallway: first along the sink run, then the drawer run.
const CAM_ZONE = {
  back: [{ pos: at(196, 208, 68), look: at(244, 8, 50) },
         { pos: at(224, 226, 66), look: at(262, 8, 48) }],
  right: [{ pos: at(235, 212, 72), look: at(401, 150, 52) },
          { pos: at(246, 232, 68), look: at(401, 152, 48) }],
  // (stood 30" off wall 1: any closer and the end of the fridge run looms in
  // the right edge of the frame like a dark pillar)
  island: [{ pos: at(364, 30, 78), look: at(214, 112, 28) },
           { pos: at(372, 30, 80), look: at(262, 146, 26) }],
}
// Far enough back that nothing clips the frame edge — the previous product
// shot cut the oven wall off on the right, so it never read as the whole room.
// On a portrait phone the whole room only fits as a thin strip across the
// middle of the screen, so there it stops closer (fitCap) and lets the far
// ends crop: island, hood and fridge big enough to read.
const CAM_PRODUCT = { pos: at(86, 392, 84), look: at(262, 86, 50), fitCap: 1.15 }
// From the working face to the product shot the camera has to get round the
// island. It walks the aisle past the island's east end and swings out
// south — a straight line would skim the counter looking straight down.
const CAM_ORBIT = [
  { pos: at(352, 150, 88), look: at(240, 150, 30) },
  { pos: at(318, 290, 92), look: at(240, 130, 34) },
  { pos: at(200, 360, 90), look: at(255, 100, 44) },
]
const ORBIT_CURVE = (() => {
  const pts = [CAM_ZONE.island[1], ...CAM_ORBIT, CAM_PRODUCT]
  const curve = (key) => new THREE.CatmullRomCurve3(
    pts.map((k) => new THREE.Vector3(...k[key])), false, 'centripetal')
  return { pos: curve('pos'), look: curve('look') }
})()

function buildCamKeys(win, build) {
  const keys = []
  ZONE_ORDER.forEach((zone) => {
    const [w0] = win[zone]
    const [, b1] = build[zone]
    const [a, b] = CAM_ZONE[zone]
    keys.push({ p: Math.max(0, w0 - 0.012), ...a })
    keys.push({ p: zone === 'island' ? b1 : b1 + 0.012, ...b })
  })
  const [i0, i1] = win.island
  const span = i1 - i0
  keys.push({ p: i0 + span * FINALE.hold, ...CAM_ZONE.island[1] })
  keys.push({ p: i0 + span * FINALE.product, ...CAM_PRODUCT, curve: ORBIT_CURVE })
  keys.push({ p: 1, ...CAM_PRODUCT })
  keys[0] = { ...keys[0], p: 0 }
  for (let i = 1; i < keys.length; i += 1) {
    if (keys[i].p <= keys[i - 1].p) keys[i].p = keys[i - 1].p + 0.001
  }
  return keys
}

// win: where each gap holds the screen. build: when each run's parts land —
// the walls use their whole gap, the island only the front of its gap.
function deriveTiming(win) {
  const [i0, i1] = win.island
  const build = { ...win, island: [i0, i0 + (i1 - i0) * FINALE.build] }
  return { win, build, camKeys: buildCamKeys(win, build) }
}

const CAM_START = CAM_ZONE.back[0]

function sampleCam(keys, p, outPos, outLook) {
  let i = 0
  while (i < keys.length - 2 && p > keys[i + 1].p) i += 1
  const a = keys[i]
  const b = keys[i + 1]
  const t = easeInOut(clamp01((p - a.p) / (b.p - a.p || 1)))
  // how far a narrow viewport may back this shot off (see fitScale)
  const cap = lerp(a.fitCap || FIT_MAX, b.fitCap || FIT_MAX, t)
  if (b.curve) {
    // one easing over the whole path, so it does not stop at each waypoint
    b.curve.pos.getPoint(t, outPos)
    b.curve.look.getPoint(t, outLook)
    return cap
  }
  vlerp(outPos, a.pos, b.pos, t)
  vlerp(outLook, a.look, b.look, t)
  return cap
}

// A tall portrait viewport sees far less horizontally at a fixed angle, so the
// run would crop. Pull the camera back along its view vector instead.
const FIT_MAX = 2.3
function fitScale(aspect) {
  return Math.min(FIT_MAX, Math.max(1, 1.34 / Math.max(0.3, aspect)))
}

// Where the camera can stand with no solid wall between it and the kitchen:
// in the room, up the hallway, or out past the south end (the walls closing
// it off only render from inside). Plan inches, like `at`.
function cameraClear(v) {
  const east = v.x / IN
  const south = v.z / IN
  const up = v.y / IN
  if (up > 112) return false // above the ceiling
  if (south < 6) return east > 330 && east < 395 && south > -66 && up < 90 // hallway
  if (east < 6 && south < 206) return false // behind wall 9
  if (east > 395 && south < 214) return false // behind the oven wall
  if (east > 372 && south > 70 && south < 214) return false // in its cabinets
  if (south < 30 && east > 140 && east < 330) return false // in wall 1's run
  return true
}

// 35 build steps: back wall (1-13), oven wall (14-23), island (24-35). The
// caption follows the measured build windows, so it stays in step with what
// is on screen at any viewport size. Returns a translations.js key.
function buildLabelKey(p, timing) {
  const { win, build } = timing
  const phase = (w) => (p - w[0]) / (w[1] - w[0] || 1)
  if (p < win.right[0]) {
    const f = phase(build.back)
    if (f < 0.5) return 'home.build.wall1Bases'
    return f < 1 ? 'home.build.wall1Uppers' : 'home.build.wall1Done'
  }
  if (p < win.island[0]) {
    const f = phase(build.right)
    if (f < 0.5) return 'home.build.ovenBases'
    return f < 1 ? 'home.build.ovenTower' : 'home.build.twoWalls'
  }
  const f = phase(build.island)
  if (f < 0.5) return 'home.build.island'
  return f < 1 ? 'home.build.islandTop' : 'home.build.done'
}

// ---------------------------------------------------------------------------
// lighting: the shared studio rig, placed for this room
// ---------------------------------------------------------------------------
// Low sun through the three Win48s on wall 9. The walls and ceiling cast, so
// it only gets in through the openings: bright patches with the mullions'
// shadows across the floor and up the island's panelled side.
// The shadow box is centred on the room (plan box x 0..401, y -72..300,
// z 0..120 projected along the sun) and sized to cover all of it: anything
// outside it counts as fully sunlit, which lit the top of the east wall white.
// The position sits back along the same sun direction as before.
const SUN = {
  position: at(-45, 52, 183),
  target: at(230, 121, 45),
  intensity: 6,
  color: '#fff5e6',
  shadowBox: { near: 0.5, far: 34, left: -6.3, right: 6.3, top: 4.5, bottom: -4.5 },
}

// Recessed cans, where the plan puts them, as downward spots: pools of light
// on the counters and floor rather than a flat wash. Three of them throw
// shadow — the two over wall 1 (the dark band under the uppers, the hood and
// fridge shadows) and the one over the island (its shadow on the floor).
const CANS = [
  { e: 92, s: 46 }, { e: 196, s: 46, shadow: true }, { e: 286, s: 46, shadow: !LOW },
  { e: 150, s: 128 }, { e: 256, s: 128, shadow: true }, { e: 196, s: 216 },
  { e: 352, s: 104 }, { e: 352, s: 180 },
].map(({ e, s, shadow }) => ({ position: at(e, s, 117.4), target: at(e, s, 0), shadow }))

const POINTS = [
  // the hallway is a recess the window light cannot reach — without its
  // own fixture it reads as a dark grey slot. Short reach, so it does
  // not shine through wall 1 into the kitchen.
  { position: at(362, -36, 100), intensity: 2.4, color: '#fff4e4', distance: 2.6, decay: 2 },
  // the bright spot the PDF render shows inside the hood
  { position: at(231, 30, 58), intensity: 0.6, color: '#ffeccc', distance: 2.4, decay: 2 },
]

// ---------------------------------------------------------------------------
// the kitchen model: static shell stays put, tagged parts build in on scroll
// ---------------------------------------------------------------------------
// Construction systems the ?engine= switch can show (see KitchenModel).
const ENGINE_VARIANTS = {
  inset: { system: 'face-frame', fit: 'inset' },
  beaded: { system: 'face-frame', fit: 'inset', frame: { bead: true } },
  overlay: { system: 'face-frame', fit: 'full-overlay' },
  partial: { system: 'face-frame', fit: 'partial-overlay' },
  'frameless-inset': { system: 'frameless', fit: 'inset' },
}

function KitchenModel({ progressRef, timingRef }) {
  const gl = useThree((s) => s.gl)
  const rootScene = useThree((s) => s.scene)
  const envFor = useRef(null)
  const [scene, setScene] = useState(null)
  useEffect(() => {
    let active = true
    // ?engine in the URL builds the same kitchen live from the cabinet engine
    // (src/engine) instead of loading the published model: a side-by-side
    // check that the two are interchangeable. The engine is loaded on demand,
    // so visitors never download it.
    // ?engine=inset | beaded | overlay | partial | frameless-inset rebuilds it in
    // that construction system; &door=shaker | slab changes the door style.
    const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    if (query && query.has('engine')) {
      import('../../engine/index.js').then(({ buildJob, buildScene, homepageKitchen }) => {
        if (!active) return
        const job = { ...homepageKitchen }
        const construction = ENGINE_VARIANTS[query.get('engine')]
        if (construction) job.construction = construction
        if (query.get('door')) job.style = { ...(job.style || {}), door: query.get('door') }
        setScene(buildScene(buildJob(job).parts, { groupBy: 'step' }))
      })
      return () => { active = false }
    }
    loadKitchenGLB().then((gltf) => {
      if (active) setScene(gltf.scene)
    }).catch((err) => console.error('[KitchenBuildSection] could not load the kitchen model', err))
    return () => { active = false }
  }, [])

  const model = useMemo(() => (scene ? scene.clone(true) : null), [scene])

  // The clone shares the cached scene's static materials. Their envMap is
  // this canvas's environment, which goes with the canvas: drop it on
  // unmount so a remounted canvas hands them its own (adoptEnvironment).
  useEffect(() => () => {
    if (!model) return
    model.traverse((o) => {
      if (!o.isMesh) return
      const list = Array.isArray(o.material) ? o.material : [o.material]
      list.forEach((m) => {
        if (m && m.userData.ownEnv && m.envMap) {
          m.envMap = null
          m.needsUpdate = true
        }
      })
    })
  }, [model])

  const parts = useMemo(() => {
    if (!model) return []
    const tex = getTextures()

    // meshes may hang under a node that carries the extras, so look upwards
    const prop = (o, key) => {
      for (let n = o; n; n = n.parent) {
        const v = n.userData ? n.userData[key] : undefined
        if (v !== undefined) return v
      }
      return undefined
    }

    // group the reveal steps by zone so each run builds inside its own window
    const byZone = new Map()
    model.traverse((o) => {
      if (!o.isMesh) return
      if (Number(prop(o, 'build_static')) === 1) return
      const zone = String(prop(o, 'build_zone') || 'back')
      if (!byZone.has(zone)) byZone.set(zone, new Set())
      byZone.get(zone).add(Number(prop(o, 'build_order')) || 0)
    })
    // index within its zone; the absolute window is resolved per frame from the
    // measured gap positions, so a resize retimes the build without a reload
    const slotOf = new Map()
    byZone.forEach((set, zone) => {
      const sorted = [...set].sort((a, b) => a - b)
      sorted.forEach((order, i) => {
        slotOf.set(`${zone}:${order}`, [i, sorted.length])
      })
    })

    const list = []
    model.traverse((o) => {
      if (!o.isMesh) return
      const isStatic = Number(prop(o, 'build_static')) === 1

      const baseMats = Array.isArray(o.material) ? o.material : [o.material]
      baseMats.forEach((m) => applyMaterialLook(m, tex))

      // everything receives; everything solid casts (see castsShadow)
      o.receiveShadow = true
      o.castShadow = castsShadow(baseMats[0]?.name)

      if (isStatic) return

      // clone materials so per-part opacity is independent of shared materials;
      // anything naturally transparent stays in the transparent pass, the rest
      // flips back to opaque once built (keeps overdraw off the hot path).
      const mats = baseMats.map((m) => {
        const c = m.clone()
        const target = c.opacity != null ? c.opacity : 1
        c.userData = { ...c.userData, targetOpacity: target, naturallyTransparent: m.transparent === true }
        c.transparent = true
        c.depthWrite = false
        return c
      })
      o.material = Array.isArray(o.material) ? mats : mats[0]

      // The shadow pass ignores material opacity, so a part 1% faded in
      // would already cast a full shadow. Its own depth material, alpha-hashed
      // at the part's opacity, lets the shadow fade in with it.
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaHash: true })
      o.customDepthMaterial = depth

      const zone = String(prop(o, 'build_zone') || 'back')
      const key = `${zone}:${Number(prop(o, 'build_order')) || 0}`
      const [slot, slotCount] = slotOf.get(key) || [0, 1]
      const group = String(prop(o, 'build_group') || '')

      o.visible = false
      list.push({
        mesh: o,
        origY: o.position.y,
        dir: FALLS.has(group) ? 1 : -1,
        zone,
        slot,
        slotCount,
        mats,
        depth,
        built: false,
      })
    })
    return list
  }, [model])

  useEffect(() => {
    if (parts.length) gl.shadowMap.needsUpdate = true
  }, [parts, gl])

  useFrame(() => {
    // the shiny finishes get the environment as their own envMap, so their
    // envMapIntensity applies instead of the scene's (deliberately low) one
    if (model && envFor.current !== model && adoptEnvironment(model, rootScene)) {
      envFor.current = model
    }

    const p = progressRef.current.value
    // Redraw the shadow maps only while a part is appearing, moving or
    // landing — not for camera-only moves (the orbit, the product hold).
    let dirty = false
    const build = timingRef.current.build
    for (let k = 0; k < parts.length; k += 1) {
      const part = parts[k]
      const [w0, w1] = build[part.zone] || [0.05, 0.95]
      const span = w1 - w0
      const start = w0 + span * (part.slot / part.slotCount)
      const end = w0 + span * ((part.slot + 1) / part.slotCount) + span * 0.3 / part.slotCount
      const e = easeOut(clamp01((p - start) / (end - start || 1)))
      const visible = e > 0.002
      if (visible !== part.mesh.visible) dirty = true
      part.mesh.visible = visible
      if (!visible) {
        part.built = false
        continue
      }
      const done = e > 0.999
      if (!done) dirty = true
      part.depth.opacity = done ? 1 : e
      part.mesh.position.y = done ? part.origY : part.origY + part.dir * (1 - e) * TRAVEL
      if (done && !part.built) {
        dirty = true
        part.built = true
        for (let m = 0; m < part.mats.length; m += 1) {
          const mat = part.mats[m]
          mat.opacity = mat.userData.targetOpacity
          if (!mat.userData.naturallyTransparent) {
            mat.transparent = false
            mat.depthWrite = true
            mat.needsUpdate = true
          }
        }
      } else if (!done) {
        if (part.built) {
          part.built = false
          for (let m = 0; m < part.mats.length; m += 1) {
            const mat = part.mats[m]
            if (!mat.userData.naturallyTransparent) {
              mat.transparent = true
              mat.depthWrite = false
              mat.needsUpdate = true
            }
          }
        }
        for (let m = 0; m < part.mats.length; m += 1) {
          part.mats[m].opacity = e * part.mats[m].userData.targetOpacity
        }
      }
    }
    if (dirty) gl.shadowMap.needsUpdate = true
  })

  if (!model) return null
  return <primitive object={model} />
}

// What you see through wall 9's windows (see ExteriorView). Plan: 5' outside
// wall 9, spanning the three windows with room to spare.
const EXTERIOR = { position: at(-60, 105, 70), rotation: [0, Math.PI / 2, 0], size: [340 * IN, 280 * IN] }

function CameraRig({ progressRef, timingRef }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(...CAM_START.look))
  const tmpPos = useRef(new THREE.Vector3())
  const tmpLook = useRef(new THREE.Vector3())
  const tmpFit = useRef(new THREE.Vector3())

  useFrame(() => {
    const p = progressRef.current.value
    const cap = sampleCam(timingRef.current.camKeys, p, tmpPos.current, tmpLook.current)
    // on a tall/narrow viewport, back off along the view vector so the run
    // fits — but only as far as the room allows. The island shots stand in the
    // corner by the hallway; backed off blindly they end up behind a wall.
    const fit = Math.min(cap, fitScale(camera.aspect))
    if (fit > 1.001) {
      const out = tmpFit.current
      let k = fit
      for (let i = 0; i < 8; i += 1) {
        out.copy(tmpPos.current).sub(tmpLook.current).multiplyScalar(k).add(tmpLook.current)
        if (cameraClear(out)) break
        k = 1 + (k - 1) * 0.6
      }
      if (cameraClear(out)) tmpPos.current.copy(out)
    }

    // snap on the first frame (and whenever progress is set directly) so
    // entering the section mid-scroll doesn't glide in from the wide shot
    const fov = fovForAspect(camera.aspect)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    const k = progressRef.current.snap ? 1 : 0.08
    progressRef.current.snap = false
    camera.position.lerp(tmpPos.current, k)
    look.current.lerp(tmpLook.current, k)
    camera.lookAt(look.current)
  })

  return null
}

// Test hook: drive the build without scrolling, and step frames by hand when
// the page is not painting (a hidden tab suspends requestAnimationFrame).
function TestBridge({ progressRef }) {
  const store = useThree((s) => s)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    window.__kbApi = {
      setProgress: (v) => {
        progressRef.current.value = clamp01(v)
        progressRef.current.snap = true
      },
      step: (n = 1) => {
        for (let i = 0; i < n; i += 1) store.advance(performance.now() + i * 16, true, store)
      },
      state: store,
    }
    return () => { delete window.__kbApi }
  }, [store, progressRef])
  return null
}

function KitchenScene({ progressRef, timingRef }) {
  return (
    <>
      <StudioEnvironment intensity={0.42} />
      <color attach="background" args={['#eef0ef']} />
      <fog attach="fog" args={['#eef0ef', 16, 34]} />
      <StudioLighting sun={SUN} cans={CANS} points={POINTS} low={LOW} />
      <CameraRig progressRef={progressRef} timingRef={timingRef} />
      <TestBridge progressRef={progressRef} />
      <KitchenModel progressRef={progressRef} timingRef={timingRef} />
      <ExteriorView {...EXTERIOR} />
      <StudioEffects low={LOW} />
      <ContextRelease />
    </>
  )
}

// ---------------------------------------------------------------------------
// scroll-driven section. Progress lives in a ref (no per-frame React renders);
// only the caption uses state, updated when the phase label changes.
// ---------------------------------------------------------------------------
export default function KitchenBuildSection({ children }) {
  const { t } = useLanguage()
  // Reduced motion: no build and no camera moves — the finished room (the
  // CAM_PRODUCT view) is shown as a still, whatever the scroll position.
  const reduceMotion = usePrefersReducedMotion()
  const sectionRef = useRef(null)
  const progressRef = useRef({ value: reduceMotion ? 1 : 0, snap: true })
  const timingRef = useRef(deriveTiming(FALLBACK_WINDOW))
  const [labelKey, setLabelKey] = useState(() => buildLabelKey(reduceMotion ? 1 : 0, timingRef.current))
  // only run the WebGL loop while the section is on (or near) screen
  const [active, setActive] = useState(false)
  // keep the canvas (and its WebGL context) only while the section is near
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    let lastLabel = null
    let lastActive = null
    let lastMounted = true

    // Progress and on-screen state both come straight off the section's rect.
    // (An IntersectionObserver is not reliable here — it can go quiet while the
    // page is not painting, which leaves the canvas blank.)
    // Where each transparent gap sits in the scroll, as a 0..1 progress range.
    // Viewport height and content reflow move these, so they are re-derived on
    // resize and orientation change rather than assumed.
    const retime = (section, top, scrollable) => {
      const gaps = section.querySelectorAll('.kitchen-gap')
      if (gaps.length < ZONE_ORDER.length || scrollable <= 0) return
      const vh = window.innerHeight
      const win = {}
      ZONE_ORDER.forEach((zone, i) => {
        const r = gaps[i].getBoundingClientRect()
        const elTop = r.top + window.scrollY
        // from when the gap fills the viewport to when it starts leaving,
        // nudged out either side so a run starts and ends on screen
        const p0 = (elTop - top) / scrollable - 0.012
        const p1 = (elTop + r.height - vh - top) / scrollable + 0.012
        win[zone] = p1 > p0 ? [clamp01(p0), clamp01(p1)] : FALLBACK_WINDOW[zone]
      })
      timingRef.current = deriveTiming(win)
    }

    const measure = () => {
      const section = sectionRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()
      const top = rect.top + window.scrollY
      const scrollable = section.offsetHeight - window.innerHeight
      retime(section, top, scrollable)
      let p = scrollable <= 0 ? 0 : clamp01((window.scrollY - top) / scrollable)
      if (reduceMotion) {
        // pinned at the end; snap so a resize re-frames it without a glide
        p = 1
        progressRef.current.snap = true
      }
      progressRef.current.value = p

      const next = buildLabelKey(p, timingRef.current)
      if (next !== lastLabel) {
        lastLabel = next
        setLabelKey(next)
      }

      const onScreen = rect.bottom > -200 && rect.top < window.innerHeight + 200
      if (onScreen !== lastActive) {
        lastActive = onScreen
        setActive(onScreen)
      }

      const vh = window.innerHeight
      const away = Math.max(0, rect.top - vh, -rect.bottom) / vh
      const keep = lastMounted ? away <= UNMOUNT_VIEWPORTS : away <= REMOUNT_VIEWPORTS
      if (keep !== lastMounted) {
        lastMounted = keep
        // a fresh canvas starts its camera where the scroll is, no glide
        if (keep) progressRef.current.snap = true
        setMounted(keep)
      }
    }

    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    // iOS collapses/expands its toolbars without firing resize
    window.visualViewport?.addEventListener('resize', update)

    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.visualViewport?.removeEventListener('resize', update)
      cancelAnimationFrame(frame)
    }
  }, [reduceMotion])

  return (
    <div ref={sectionRef} className="kitchen-build-section kitchen-build-glb">
      {/* Decorative, caption included: hidden from assistive technology so the
          changing caption is never read out of context (and never make it live) */}
      <div className="kitchen-build-sticky" aria-hidden="true">
        {mounted ? (
          <Canvas
            // off screen but mounted: draw only when something changes, so a
            // remounted canvas renders (and compiles its shaders) once, ahead
            // of being seen
            frameloop={active ? 'always' : 'demand'}
            {...CANVAS_PROPS}
            camera={{ position: CAM_START.pos, fov: 50, near: 0.25, far: 42 }}
          >
            <KitchenScene progressRef={progressRef} timingRef={timingRef} />
          </Canvas>
        ) : null}
        <div className="kitchen-build-label">{t(labelKey)}</div>
      </div>
      {/* homepage content scrolls over the sticky canvas; the gaps between
          sections are where the build shows through */}
      {children ? <div className="kitchen-build-overlay">{children}</div> : null}
    </div>
  )
}
