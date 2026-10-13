// Camera presets for the engine view (inches in, metres out). The camera
// stays inside the room (the bird's eye view rises above the open-topped
// walls); the wall views are front-on elevations.
//
// No React: runs under `node --test`.
import { IN } from '../../../engine/index.js'
import { footprint } from '../../../utils/designer/rotation.js'
import { hasLineOfSight } from './interior.js'

export const CAMERA_FOV = 60 // wider than DesignEditor3D's 45: the camera stands inside the room
const CORNER_INSET = 12 // inches from each wall for the opening shot
const WALL_MARGIN = 6 // inches the camera keeps from walls, floor and ceiling
const LOOK_HEIGHT = 36 // inches, counter height
const DEFAULT_CEILING = 96
const FOCUS_PULL = 0.6
const OPENING_EYE = 78 // inches: a little above eye level, so nearby base cabinets don't fill the frame

/**
 * Where the design's items are, as a plan point in inches [x, y] (the centre
 * of their footprints), or null for an empty room. Designer elements store
 * x / y in plan px (inches times `scale`).
 */
export function layoutFocus(elements, scale = 1) {
  if (!elements || !elements.length || !(scale > 0)) return null
  let sx = 0
  let sy = 0
  for (const el of elements) {
    const fp = footprint(el, 1)
    sx += el.x / scale + fp.width / 2
    sy += el.y / scale + fp.depth / 2
  }
  return [sx / elements.length, sy / elements.length]
}

/**
 * The opening camera, orbit target, clip planes, floor grid and the box the
 * camera may move in, for a width x depth room (plan inches). The camera
 * stands inside the room at eye height in the corner farthest from `focus`
 * (layoutFocus: where the items are) and looks toward them; with no focus it
 * stands in the south-east corner and looks at wall 1. It never goes outside
 * the walls. Lengths come out in metres; pass { unit: 1 } for inches
 * (DesignEditor3D).
 */
export function cameraSetup({ width, depth, ceiling }, { unit = IN, focus = null, walls = [], spaces = [] } = {}) {
  const m = (v) => v.map((x) => x * unit)
  const W = Math.max(width, 1)
  const D = Math.max(depth, 1)
  const H = ceiling > 0 ? ceiling : DEFAULT_CEILING
  const span = Math.max(W, D)
  const far = Math.max(60 * (unit / IN), span * 8 * unit)
  const inset = Math.min(CORNER_INSET, W / 4, D / 4)
  const margin = Math.min(WALL_MARGIN, W / 4, D / 4)
  const eye = Math.min(OPENING_EYE, H - WALL_MARGIN)
  let target = [W * 0.5, LOOK_HEIGHT, D * 0.3]
  if (focus) {
    const [fx, fy] = focus
    // partway from the room centre to the items, so the shot takes in the room
    target = [W / 2 + (fx - W / 2) * FOCUS_PULL, LOOK_HEIGHT, D / 2 + (fy - D / 2) * FOCUS_PULL]
  }
  // The corner to stand in: the one farthest from the items (with no items,
  // the south-east one), but never one inside a pantry or one with a
  // partition between it and what it looks at.
  const corners = [[W - inset, D - inset], [inset, inset], [W - inset, inset], [inset, D - inset]]
  const look = [target[0], target[2]]
  const inSpace = (c) => spaces.some(({ box }) => c[0] > box.x0 && c[0] < box.x1 && c[1] > box.y0 && c[1] < box.y1)
  const score = (c, i) => {
    let v = focus ? Math.hypot(c[0] - focus[0], c[1] - focus[1]) : -i
    if (inSpace(c)) v -= 2e6
    if (walls.length && !hasLineOfSight(c, look, walls, { height: eye })) v -= 1e6
    return v
  }
  const best = corners.reduce((a, c, i) => (score(c, i) > a.v ? { c, v: score(c, i) } : a), { c: corners[0], v: -Infinity })
  const position = [best.c[0], eye, best.c[1]]
  return {
    position: m(position),
    target: m(target),
    fov: CAMERA_FOV,
    near: 0.05 * (unit / IN),
    far,
    minDistance: 0.3 * (unit / IN),
    maxDistance: Math.hypot(W, D, H) * unit,
    grid: { size: span * 2 * unit, divisions: 40, position: m([W / 2, -1.2, D / 2]) },
    bounds: {
      min: m([margin, WALL_MARGIN, margin]),
      max: m([W - margin, H - WALL_MARGIN, D - margin]),
    },
  }
}

/**
 * Pull a point (metres, [x, y, z]) back inside `bounds` from cameraSetup.
 * Returns a new array, or the same one when it is already inside.
 */
export function clampInside(point, { min, max }) {
  const out = point.map((v, i) => Math.min(max[i], Math.max(min[i], v)))
  return out.every((v, i) => v === point[i]) ? point : out
}

const DEG = Math.PI / 180
const FIT_MARGIN = 1.06 // a little air round a framed wall or room

/** Horizontal half field of view (radians) for a vertical fov (degrees) and aspect. */
const halfWidthAngle = (fov, aspect) => Math.atan(Math.tan((fov * DEG) / 2) * aspect)

/**
 * The camera distance that fits a `across` x `high` rectangle (inches) seen
 * front-on, for a vertical `fov` (degrees) and a canvas `aspect`.
 */
export function fitDistance(across, high, { fov = CAMERA_FOV, aspect = 16 / 10 } = {}) {
  const a = aspect > 0 ? aspect : 16 / 10
  const byWidth = across / 2 / Math.tan(halfWidthAngle(fov, a))
  const byHeight = high / 2 / Math.tan((fov * DEG) / 2)
  return Math.max(byWidth, byHeight) * FIT_MARGIN
}

/**
 * setWallView(n): a front-on elevation of wall n (1 north, 2 east, 3 south,
 * 4 west) from inside the room: the camera stands on the wall's centre line
 * at half the wall height and looks straight at it (no keystone), as far
 * back as it needs to frame the whole wall, but never closer than the
 * opposite wall's margin. Used by the toolbar's Walls 1-4 and by the quote
 * PDF (pdfService).
 * Returns { position, target } in metres (pass { unit: 1 } for inches), or
 * null for other walls.
 */
export function wallView(wallNumber, { width, depth, ceiling }, { fov = CAMERA_FOV, aspect, unit = IN } = {}) {
  const W = Math.max(width, 1)
  const D = Math.max(depth, 1)
  const H = ceiling > 0 ? ceiling : DEFAULT_CEILING
  const margin = Math.min(WALL_MARGIN, W / 4, D / 4)
  const y = H / 2
  const at = (along, across) => Math.min(Math.max(fitDistance(across, H, { fov, aspect }), along * 0.25), along - margin)
  const s = (v) => v.map((x) => x * unit)
  switch (wallNumber) {
    case 1: return { position: s([W / 2, y, at(D, W)]), target: s([W / 2, y, 0]) }
    case 2: return { position: s([W - at(W, D), y, D / 2]), target: s([W, y, D / 2]) }
    case 3: return { position: s([W / 2, y, D - at(D, W)]), target: s([W / 2, y, D]) }
    case 4: return { position: s([at(W, D), y, D / 2]), target: s([0, y, D / 2]) }
    default: return null
  }
}

/**
 * Bird's eye: straight down on the whole floor, north (wall 1) at the top.
 * The camera rises above the walls as far as it needs to frame the room (the
 * designer view has no ceiling); `height` is that camera height in inches,
 * for the orbit limits.
 */
export function topView({ width, depth }, { fov = CAMERA_FOV, aspect, unit = IN } = {}) {
  const W = Math.max(width, 1)
  const D = Math.max(depth, 1)
  const height = fitDistance(W, D, { fov, aspect })
  const s = (v) => v.map((x) => x * unit)
  // a hair south of straight down, so "up" on screen is north and the orbit
  // controls have a direction to turn from
  return { position: s([W / 2, height, D / 2 + 0.01]), target: s([W / 2, 0, D / 2]), height }
}

const OVERVIEW_ELEVATION = 35 // degrees above the floor
const OVERVIEW_MARGIN = 1.02

/**
 * Overview: the whole room from outside and above one corner, like a
 * dollhouse (the view hides the room walls between the camera and the room).
 * It stands off the corner farthest from `focus` (with no items, the
 * south-east one), far enough back that the room's bounding sphere fits the
 * frame. `distance` is that camera distance in inches, for the orbit limits.
 */
export function overviewView({ width, depth, ceiling }, { focus = null, fov = CAMERA_FOV, aspect, unit = IN } = {}) {
  const W = Math.max(width, 1)
  const D = Math.max(depth, 1)
  const H = ceiling > 0 ? ceiling : DEFAULT_CEILING
  const corners = [[W, D], [0, 0], [W, 0], [0, D]]
  const corner = focus
    ? corners.reduce((a, c) => (Math.hypot(c[0] - focus[0], c[1] - focus[1]) > Math.hypot(a[0] - focus[0], a[1] - focus[1]) ? c : a))
    : corners[0]
  const target = [W / 2, H * 0.4, D / 2]
  const dx = corner[0] - W / 2
  const dz = corner[1] - D / 2
  const flat = Math.hypot(dx, dz) || 1
  const a = aspect > 0 ? aspect : 16 / 10
  const half = Math.min((fov * DEG) / 2, halfWidthAngle(fov, a))
  const radius = Math.hypot(W, D, H) / 2
  const distance = (radius / Math.sin(half)) * OVERVIEW_MARGIN
  const up = OVERVIEW_ELEVATION * DEG
  const position = [
    target[0] + (dx / flat) * Math.cos(up) * distance,
    target[1] + Math.sin(up) * distance,
    target[2] + (dz / flat) * Math.cos(up) * distance,
  ]
  const s = (v) => v.map((x) => x * unit)
  return { position: s(position), target: s(target), distance }
}

/**
 * Room walls (1 north, 2 east, 3 south, 4 west) the camera is outside of, for
 * a camera at plan point [x, y] inches: those are the walls between it and
 * the room, which the overview hides.
 */
export function outerWallsFacing([x, y], { width, depth }) {
  const out = []
  if (y < 0) out.push(1)
  if (x > width) out.push(2)
  if (y > depth) out.push(3)
  if (x < 0) out.push(4)
  return out
}

/** The toolbar's views, in order. */
export const VIEW_PRESETS = ['room', 'overview', 'wall1', 'wall2', 'wall3', 'wall4', 'top']

/**
 * A pantry (enclosedSpaces) as { position, target } in metres: standing in
 * its doorway looking in, or, with no doorway, in its middle looking along
 * its long side.
 */
export function spaceView(space, { unit = IN } = {}) {
  if (!space) return null
  const s = ([x, y, z]) => [x * unit, z * unit, y * unit]
  if (space.door) return { position: s(space.door.position), target: s(space.door.target) }
  const { x0, y0, x1, y1 } = space.box
  const [cx, cy] = space.center
  const alongX = x1 - x0 >= y1 - y0
  const target = alongX ? [x1, cy, LOOK_HEIGHT] : [cx, y1, LOOK_HEIGHT]
  const position = alongX ? [x0 + Math.min(12, (x1 - x0) / 4), cy, 60] : [cx, y0 + Math.min(12, (y1 - y0) / 4), 60]
  return { position: s(position), target: s(target) }
}

/**
 * A toolbar view as { position, target } (metres): 'room' (the opening
 * corner shot), 'overview' (the whole room from outside), 'wall1'..'wall4' (elevations), 'top', or 'space:<id>' (a
 * pantry from `spaces`). Null for anything else.
 */
export function presetView(name, room, { focus = null, fov = CAMERA_FOV, aspect, walls = [], spaces = [] } = {}) {
  if (name === 'room') {
    const { position, target } = cameraSetup(room, { focus, walls, spaces })
    return { position, target }
  }
  if (typeof name === 'string' && name.startsWith('space:')) {
    return spaceView(spaces.find((sp) => `space:${sp.id}` === name))
  }
  if (name === 'top') return topView(room, { fov, aspect })
  if (name === 'overview') return overviewView(room, { focus, fov, aspect })
  const wall = /^wall([1-4])$/.exec(name || '')
  return wall ? wallView(Number(wall[1]), room, { fov, aspect }) : null
}

/** Ease in and out (cubic), t in [0, 1]. */
export const easeInOut = (t) => {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** How long a move between views takes (ms): longer for longer trips, 0 with reduced motion. */
export function transitionMs(from, to, { reducedMotion = false } = {}) {
  if (reducedMotion || !from || !to) return 0
  const d = Math.hypot(...to.map((v, i) => v - from[i]))
  return Math.round(Math.min(900, Math.max(450, 450 + d * 120)))
}
