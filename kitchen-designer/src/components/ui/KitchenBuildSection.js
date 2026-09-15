import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useLanguage } from '../../contexts/LanguageContext'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'

// The kitchen is authored to the dimensions on the client's KCD elevation drawing (kept outside the repo)
// by scripts/build_kitchen.py and exported to this GLB. Every mesh carries glTF
// `extras` (-> userData):
//   build_static : 1 = room shell (always visible), 0 = builds in on scroll
//   build_order  : reveal step, 1..35 (meshes of one cabinet share a step)
//   build_group  : room | base | counter | upper | tall | appliance | island | trim
const MODEL_URL = `${process.env.PUBLIC_URL || ''}/models/kitchen.glb`

const IN = 0.0254
// The builder's plan coordinates survive the glTF axis conversion intact:
// three.js (x, y, z) = (plan east, height, plan south) in inches.
const at = (east, south, up) => [east * IN, up * IN, south * IN]

const TRAVEL = 0.26 // metres each part moves into place

// Phones and small tablets get smaller shadow maps and cheaper AO.
const LOW = typeof window !== 'undefined' && window.innerWidth < 820

// Passed as <Canvas shadows>. R3F re-applies this on every render of the
// Canvas and sets shadowMap.enabled from it, so switching shadows on inside a
// component is undone the first time the caption changes — which is how the
// scene ended up rendering with no shadows at all.
//   PCF (not PCFSoft) honours shadow.radius, so each light sets its own
//   penumbra; the maps are redrawn on demand (KitchenModel flags it), not
//   every frame, since the scene only changes while parts move.
const SHADOWS = { type: THREE.PCFShadowMap, autoUpdate: false }

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

// ---------------------------------------------------------------------------
// procedural textures — the GLB ships flat colours and metre-scale box UVs, so
// one canvas texture per material reads at a consistent size across the room.
// ---------------------------------------------------------------------------
function graniteTexture() {
  const s = 1024
  const c = document.createElement('canvas')
  c.width = c.height = s
  const x = c.getContext('2d')
  x.fillStyle = '#d9d9d4'
  x.fillRect(0, 0, s, s)

  // soft mineral blotches
  for (let i = 0; i < 300; i += 1) {
    const cx = Math.random() * s
    const cy = Math.random() * s
    const r = Math.random() * 60 + 18
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r)
    const dark = Math.random() < 0.45
    g.addColorStop(0, dark ? 'rgba(84,84,88,0.30)' : 'rgba(250,250,248,0.34)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.beginPath()
    x.arc(cx, cy, r, 0, Math.PI * 2)
    x.fill()
  }

  // the dense black / white speckle that gives the stone its grain
  for (let i = 0; i < 46000; i += 1) {
    const r = Math.random()
    if (r < 0.34) x.fillStyle = `rgba(28,28,32,${Math.random() * 0.75 + 0.2})`
    else if (r < 0.62) x.fillStyle = `rgba(252,252,250,${Math.random() * 0.8 + 0.2})`
    else if (r < 0.85) x.fillStyle = `rgba(126,128,132,${Math.random() * 0.5 + 0.15})`
    else x.fillStyle = `rgba(150,136,118,${Math.random() * 0.35 + 0.1})`
    const w = Math.random() * 3.4 + 0.7
    x.fillRect(Math.random() * s, Math.random() * s, w, w * (Math.random() * 0.8 + 0.5))
  }

  // faint veining
  for (let i = 0; i < 7; i += 1) {
    x.strokeStyle = `rgba(96,96,102,${Math.random() * 0.12 + 0.05})`
    x.lineWidth = Math.random() * 5 + 1.5
    x.beginPath()
    let px = -30
    let py = Math.random() * s
    x.moveTo(px, py)
    while (px < s) {
      px += 70 + Math.random() * 90
      py += (Math.random() - 0.5) * 150
      x.lineTo(px, py)
    }
    x.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(0.85, 0.85) // UVs are metres; one tile ≈ 1.2 m of slab
  tex.anisotropy = 8
  return tex
}

function oakTexture() {
  const s = 1024
  const c = document.createElement('canvas')
  c.width = c.height = s
  const x = c.getContext('2d')
  x.fillStyle = '#e3c684'
  x.fillRect(0, 0, s, s)

  const plank = 146 // ≈ 7" boards at one tile per 1.2 m
  for (let row = 0; row * plank < s; row += 1) {
    const y = row * plank
    const t = (Math.random() - 0.5) * 26
    x.fillStyle = `rgb(${226 + t},${197 + t * 0.7},${132 + t * 0.5})`
    x.fillRect(0, y, s, plank - 2)
    for (let i = 0; i < 90; i += 1) {
      x.strokeStyle = `rgba(150,110,60,${Math.random() * 0.09 + 0.02})`
      x.lineWidth = Math.random() * 1.5 + 0.2
      const ly = y + Math.random() * plank
      x.beginPath()
      x.moveTo(0, ly)
      for (let xx = 0; xx <= s; xx += 40) x.lineTo(xx, ly + Math.sin(xx * 0.017 + row) * 1.8)
      x.stroke()
    }
    x.strokeStyle = 'rgba(126,92,46,0.55)'
    x.lineWidth = 2.2
    x.beginPath()
    x.moveTo(0, y)
    x.lineTo(s, y)
    x.stroke()
    // staggered end joints
    const seam = Math.random() * s
    x.beginPath()
    x.moveTo(seam, y)
    x.lineTo(seam, y + plank - 2)
    x.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(0.82, 0.82)
  tex.anisotropy = 8
  return tex
}

function woodTexture(base, grain) {
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const x = c.getContext('2d')
  x.fillStyle = base
  x.fillRect(0, 0, s, s)
  for (let i = 0; i < 200; i += 1) {
    x.strokeStyle = `${grain}${Math.floor(Math.random() * 30 + 8).toString(16).padStart(2, '0')}`
    x.lineWidth = Math.random() * 2.4 + 0.3
    x.beginPath()
    const p0 = Math.random() * s
    x.moveTo(0, p0)
    for (let xx = 0; xx <= s; xx += 26) x.lineTo(xx, p0 + Math.sin(xx * 0.02 + i) * 3)
    x.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1.2, 1.2)
  return tex
}

// A faint blotch map. Used as a roughnessMap it stops painted doors reading as
// one flat plastic sheet — highlights break up the way real lacquer does.
function sheenTexture() {
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const x = c.getContext('2d')
  x.fillStyle = '#d8d8d8'
  x.fillRect(0, 0, s, s)
  for (let i = 0; i < 240; i += 1) {
    const cx = Math.random() * s
    const cy = Math.random() * s
    const r = Math.random() * 90 + 25
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r)
    const v = Math.random() < 0.5 ? 255 : 180
    g.addColorStop(0, `rgba(${v},${v},${v},0.14)`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = g
    x.beginPath()
    x.arc(cx, cy, r, 0, Math.PI * 2)
    x.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1.5, 1.5)
  return tex
}

let _TEX = null
function getTextures() {
  if (!_TEX) {
    _TEX = {
      granite: graniteTexture(),
      oak: oakTexture(),
      beam: woodTexture('#6f4a2b', '#3a2412'),
      sheen: sheenTexture(),
    }
  }
  return _TEX
}

// ---------------------------------------------------------------------------
// Give each GLB material its finish. Names are set in build_kitchen.py.
// ---------------------------------------------------------------------------
function applyMaterialLook(m, tex) {
  if (!m || m.userData.__styled) return
  m.userData.__styled = true
  const name = (m.name || '').toLowerCase()

  // envMapIntensity only counts when a material carries its own envMap —
  // otherwise three uses scene.environmentIntensity. The shiny finishes are
  // flagged here and handed the environment once it exists (KitchenModel).
  if (/^(granite|stainless|metal|glass|cast_iron)/.test(name)) m.userData.ownEnv = true

  if (name.startsWith('granite')) {
    m.map = tex.granite
    m.color.setRGB(1, 1, 1)
    m.roughness = 0.22
    m.metalness = 0.0
    m.envMapIntensity = 0.65
  } else if (name.startsWith('oak')) {
    m.map = tex.oak
    // honey oak — at full white the texture read as a pale yellow sheet
    m.color.setRGB(0.8, 0.74, 0.66)
    m.roughness = 0.62
    m.envMapIntensity = 0.22
  } else if (name.startsWith('can_lens')) {
    // the lit diffuser of each recessed can
    m.emissive.set('#fff3e2')
    m.emissiveIntensity = 1.4
  } else if (name.startsWith('beam')) {
    m.map = tex.beam
    m.color.setRGB(0.8, 0.78, 0.76)
    m.roughness = 0.72
    m.envMapIntensity = 0.4
  } else if (name.startsWith('paint') || name.startsWith('cabinterior')) {
    // painted white cabinetry: a touch of sheen, no texture
    m.roughness = 0.5
    m.roughnessMap = tex.sheen
    m.metalness = 0.0
    m.envMapIntensity = 0.32
    // no shadow pass, so the inset panels need colour separation to read
    if (name.startsWith('paint_white_panel')) m.color.multiplyScalar(0.9)
  } else if (name.startsWith('glass_oven')) {
    m.transparent = true
    m.opacity = 0.86
    m.roughness = 0.12
    m.metalness = 0.35
    m.color.set('#23272a')
  } else if (name.startsWith('glass_window')) {
    // clear window glass: the view outside, with a faint reflection
    m.transparent = true
    m.opacity = 0.1
    m.roughness = 0.04
    m.metalness = 0.0
    m.envMapIntensity = 1.0
  } else if (name.startsWith('glass')) {
    // frosted cabinet glass — you should read the shelves through it, softly
    m.transparent = true
    m.opacity = 0.34
    m.roughness = 0.22
    m.metalness = 0.0
    m.color.set('#e2eaee')
    m.envMapIntensity = 1.6
  } else if (name.startsWith('stainless_dark')) {
    // graphite appliance panels. Metalness kills the diffuse term and there is
    // no real environment behind these, so a metallic setting renders black —
    // keep it mostly diffuse and let the env map supply the sheen.
    m.color.multiplyScalar(1.35)
    m.roughness = 0.40
    m.metalness = 0.18
    m.envMapIntensity = 1.4
  } else if (name.startsWith('stainless')) {
    m.roughness = 0.28
    m.metalness = 0.8
    m.envMapIntensity = 1.8
  } else if (name.startsWith('cast_iron')) {
    // matte cast-iron grates: almost no sheen, so they read as mass
    m.roughness = 0.82
    m.metalness = 0.15
    m.envMapIntensity = 0.5
  } else if (name.startsWith('metal_black')) {
    m.roughness = 0.32
    m.metalness = 0.85
    m.envMapIntensity = 1.2
  } else if (name.startsWith('wall') || name.startsWith('ceiling')) {
    m.roughness = 0.95
    m.metalness = 0.0
    m.envMapIntensity = 0.18
  } else if (name.startsWith('toe')) {
    m.roughness = 0.7
  }
  m.needsUpdate = true
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
// environment + renderer setup
// ---------------------------------------------------------------------------
function SceneEnvironment() {
  const { gl, scene } = useThree()

  useEffect(() => {
    // shadow-map settings live on <Canvas shadows> (see SHADOWS); just make
    // sure the first frame draws the maps
    gl.shadowMap.needsUpdate = true

    const previous = scene.environment
    const previousIntensity = scene.environmentIntensity
    const pmrem = new THREE.PMREMGenerator(gl)
    const envScene = new RoomEnvironment()
    const target = pmrem.fromScene(envScene, 0.04)
    scene.environment = target.texture
    // At 1.0 the environment out-lit the sun ~5x and washed every shadow out;
    // it is a soft fill now, and the lights do the modelling.
    scene.environmentIntensity = 0.42

    return () => {
      scene.environment = previous
      scene.environmentIntensity = previousIntensity
      target.dispose()
      pmrem.dispose()
      envScene.traverse((child) => {
        if (child.geometry) child.geometry.dispose?.()
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.())
        else child.material?.dispose?.()
      })
    }
  }, [gl, scene])

  return null
}

// A light aimed at a fixed point on the floor plan. three.js only tracks a
// target's matrix when it is in the scene, so it is added alongside.
function useAimedLight(ref, aim) {
  const { scene } = useThree()
  const [e, s, u] = aim
  useEffect(() => {
    const light = ref.current
    if (!light) return undefined
    const target = new THREE.Object3D()
    target.position.set(...at(e, s, u))
    scene.add(target)
    light.target = target
    return () => { scene.remove(target) }
  }, [ref, scene, e, s, u])
}

// Low sun through the three Win48s on wall 9. The walls and ceiling cast, so
// it only gets in through the openings: bright patches with the mullions'
// shadows across the floor and up the island's panelled side.
// The shadow box is centred on the room (plan box x 0..401, y -72..300,
// z 0..120 projected along the sun) and sized to cover all of it: anything
// outside it counts as fully sunlit, which lit the top of the east wall white.
// The position sits back along the same sun direction as before.
function KeyLight() {
  const ref = useRef()
  useAimedLight(ref, [230, 121, 45])
  const size = LOW ? 1024 : 2048
  return (
    <directionalLight
      ref={ref}
      position={at(-45, 52, 183)}
      intensity={6}
      color="#fff5e6"
      castShadow
      shadow-mapSize-width={size}
      shadow-mapSize-height={size}
      shadow-camera-near={0.5}
      shadow-camera-far={34}
      shadow-camera-left={-6.3}
      shadow-camera-right={6.3}
      shadow-camera-top={4.5}
      shadow-camera-bottom={-4.5}
      shadow-bias={-0.0003}
      shadow-normalBias={0.012}
      shadow-radius={3}
    />
  )
}

// Recessed cans, where the plan puts them, as downward spots: pools of light
// on the counters and floor rather than a flat wash. Three of them throw
// shadow — the two over wall 1 (the dark band under the uppers, the hood and
// fridge shadows) and the one over the island (its shadow on the floor).
const CANS = [
  { e: 92, s: 46 }, { e: 196, s: 46, shadow: true }, { e: 286, s: 46, shadow: !LOW },
  { e: 150, s: 128 }, { e: 256, s: 128, shadow: true }, { e: 196, s: 216 },
  { e: 352, s: 104 }, { e: 352, s: 180 },
]

function CanLight({ e, s, shadow }) {
  const ref = useRef()
  useAimedLight(ref, [e, s, 0])
  const size = LOW ? 512 : 1024
  return (
    <spotLight
      ref={ref}
      position={at(e, s, 117.4)}
      angle={0.6}
      penumbra={0.85}
      intensity={9}
      decay={2}
      color="#fff1dc"
      castShadow={Boolean(shadow)}
      shadow-mapSize-width={size}
      shadow-mapSize-height={size}
      shadow-camera-near={0.2}
      shadow-camera-far={4}
      shadow-bias={-0.0004}
      shadow-normalBias={0.01}
      shadow-radius={4}
    />
  )
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.08} color="#ffffff" />
      <hemisphereLight args={['#ffffff', '#bfb6a4', 0.12]} />
      <KeyLight />
      {CANS.map((c) => <CanLight key={`${c.e},${c.s}`} {...c} />)}
      {/* the hallway is a recess the window light cannot reach — without its
          own fixture it reads as a dark grey slot. Short reach, so it does
          not shine through wall 1 into the kitchen. */}
      <pointLight position={at(362, -36, 100)} intensity={2.4} color="#fff4e4" distance={2.6} decay={2} />
      {/* the bright spot the PDF render shows inside the hood */}
      <pointLight position={at(231, 30, 58)} intensity={0.6} color="#ffeccc" distance={2.4} decay={2} />
    </>
  )
}

// ---------------------------------------------------------------------------
// the kitchen model: static shell stays put, tagged parts build in on scroll
// ---------------------------------------------------------------------------
function KitchenModel({ progressRef, timingRef }) {
  const gl = useThree((s) => s.gl)
  const rootScene = useThree((s) => s.scene)
  const envFor = useRef(null)
  const [scene, setScene] = useState(null)
  useEffect(() => {
    let active = true
    new GLTFLoader().load(MODEL_URL, (gltf) => {
      if (active) setScene(gltf.scene)
    })
    return () => { active = false }
  }, [])

  const model = useMemo(() => (scene ? scene.clone(true) : null), [scene])

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

      // Everything receives. Everything solid casts — walls and ceiling too,
      // so daylight only gets in through the window openings. Glass does
      // not (a frosted pane throwing a hard shadow is what made the window
      // light read backwards), and nothing sits under the floor.
      const matName = (baseMats[0]?.name || '').toLowerCase()
      o.receiveShadow = true
      o.castShadow = !(matName.startsWith('oak_floor') || matName.startsWith('glass') ||
        matName.startsWith('can_lens'))

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
    if (model && rootScene.environment && envFor.current !== model) {
      envFor.current = model
      model.traverse((o) => {
        if (!o.isMesh) return
        const list = Array.isArray(o.material) ? o.material : [o.material]
        list.forEach((m) => {
          if (m.userData.ownEnv && !m.envMap) {
            m.envMap = rootScene.environment
            m.needsUpdate = true
          }
        })
      })
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

// What you see through wall 9's windows. Without it the openings showed the
// room's own oak floor running on outside. A painted exterior — sky, a soft
// tree line, lawn — standing a few feet out, so it shifts behind the mullions
// as the camera moves the way a real view does.
function exteriorTexture() {
  const w = 1024
  const h = 768
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')
  const horizon = h * 0.58

  const sky = x.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#a9c8e4')
  sky.addColorStop(0.7, '#d6e6f1')
  sky.addColorStop(1, '#eef3f3')
  x.fillStyle = sky
  x.fillRect(0, 0, w, horizon)

  // soft clouds
  for (let i = 0; i < 26; i += 1) {
    const cx = Math.random() * w
    const cy = Math.random() * horizon * 0.55
    const r = Math.random() * 70 + 30
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(cx - r, cy - r, r * 2, r * 2)
  }

  // two bands of trees: distant and hazy, then nearer and darker
  const trees = (base, spread, rMin, rMax, colours, n) => {
    for (let i = 0; i < n; i += 1) {
      const cx = Math.random() * w
      const r = Math.random() * (rMax - rMin) + rMin
      const cy = base - Math.random() * spread
      x.fillStyle = colours[Math.floor(Math.random() * colours.length)]
      x.beginPath()
      x.arc(cx, cy, r, 0, Math.PI * 2)
      x.fill()
    }
  }
  trees(horizon + 6, 70, 18, 46, ['#8fa98f', '#9bb39a', '#86a087'], 150)
  trees(horizon + 30, 60, 26, 60, ['#58764f', '#4d6a45', '#62804f', '#6f8b58'], 120)

  const lawn = x.createLinearGradient(0, horizon + 20, 0, h)
  lawn.addColorStop(0, '#7f9d5c')
  lawn.addColorStop(1, '#6b8a4a')
  x.fillStyle = lawn
  x.fillRect(0, horizon + 20, w, h - horizon - 20)
  for (let i = 0; i < 5000; i += 1) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,84,40' : '150,176,110'},0.18)`
    x.fillRect(Math.random() * w, horizon + 20 + Math.random() * (h - horizon), 2, 3)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function ExteriorView() {
  const tex = useMemo(() => exteriorTexture(), [])
  useEffect(() => () => tex.dispose(), [tex])
  // plan: 5' outside wall 9, spanning the three windows with room to spare
  const [px, py, pz] = at(-60, 105, 70)
  return (
    <mesh position={[px, py, pz]} rotation={[0, Math.PI / 2, 0]} renderOrder={-1}>
      <planeGeometry args={[340 * IN, 280 * IN]} />
      {/* unlit: daylight outside is far brighter than anything in the room */}
      <meshBasicMaterial map={tex} fog={false} toneMapped />
    </mesh>
  )
}

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
      <SceneEnvironment />
      <color attach="background" args={['#eef0ef']} />
      <fog attach="fog" args={['#eef0ef', 16, 34]} />
      <Lighting />
      <CameraRig progressRef={progressRef} timingRef={timingRef} />
      <TestBridge progressRef={progressRef} />
      <KitchenModel progressRef={progressRef} timingRef={timingRef} />
      <ExteriorView />
      {/* Screen-space AO supplies the contact darkening a shadow map cannot:
          the crevices between doors, under the crown, inside the panel
          recesses. This is most of what separates "CG" from "photo".
          (N8AO rebuilds normals from depth, so no NormalPass — that was a
          second full scene render for nothing.) */}
      <EffectComposer multisampling={0}>
        {/* N8AO is far less noisy than the classic SSAO pass, which at this
            scene's scale speckled every wall junction with black. */}
        <N8AO
          aoRadius={0.4}
          distanceFalloff={1}
          intensity={1.8}
          aoSamples={LOW ? 8 : 16}
          denoiseSamples={4}
          denoiseRadius={10}
          halfRes={LOW}
          color="black"
        />
        {/* The composer switches the renderer's own tone mapping off, so the
            exposure on <Canvas> did nothing and highlights clipped per
            channel. Tone map here, where the HDR buffer actually is. */}
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <SMAA />
      </EffectComposer>
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

  useEffect(() => {
    let lastLabel = null
    let lastActive = null

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
        <Canvas
          frameloop={active ? 'always' : 'never'}
          shadows={SHADOWS}
          dpr={[1, LOW ? 1.4 : 1.75]}
          camera={{ position: CAM_START.pos, fov: 50, near: 0.25, far: 42 }}
          gl={{
            // SMAA does the anti-aliasing; the composer renders off-screen,
            // so a multisampled canvas would only cost memory
            antialias: false,
            alpha: false,
            powerPreference: 'high-performance',
            // read by the ToneMapping effect (the composer owns tone mapping)
            // exposed for the room, as an interior photographer would; the
            // sun patches are allowed to run bright
            toneMappingExposure: 1.3,
          }}
        >
          <KitchenScene progressRef={progressRef} timingRef={timingRef} />
        </Canvas>
        <div className="kitchen-build-label">{t(labelKey)}</div>
      </div>
      {/* homepage content scrolls over the sticky canvas; the gaps between
          sections are where the build shows through */}
      {children ? <div className="kitchen-build-overlay">{children}</div> : null}
    </div>
  )
}
