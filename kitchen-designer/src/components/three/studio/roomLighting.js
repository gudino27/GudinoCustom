// Lighting layout for an arbitrary rectangular room, in the shape
// <StudioLighting sun cans /> takes. Pure: no React / three imports, so it runs
// under `node --test`.
import { IN, planToWorld } from './units.js'

// The homepage sun, as (plan east, plan south, up) from its target to the
// light: low (about 26 degrees), in through the west window wall, skewed a
// little along the wall. Stored relative to the window wall so any wall works:
// OUT is along the wall's outward normal, ALONG is the normal turned 90
// degrees (for the west wall, towards plan north).
const SUN_OUT = 275
const SUN_ALONG = 69
const SUN_UP = 138

// Outward normals in plan (east, south). Plan north is south = 0.
const WALL_NORMALS = {
  west: [-1, 0],
  east: [1, 0],
  north: [0, -1],
  south: [0, 1],
}

const CAN_SPACING = 72 // about 6 ft between recessed cans
const CAN_DROP = 2.6 // lens sits this far below the ceiling (homepage: 117.4 under 120)
const SHADOW_PAD = 6 // inches of slack round the shadow box

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

// The axes of a directional light's shadow camera, in world space. three puts
// that camera at the light, looking at the target, with world up (0, 1, 0) as
// its up — Object3D.lookAt's convention. x: box left/right, y: bottom/top,
// z: back towards the light (depth is measured along -z).
export function lightFrame(position, target) {
  const z = norm(sub(position, target))
  let x = cross([0, 1, 0], z)
  // straight overhead: any horizontal axis will do
  if (Math.hypot(x[0], x[1], x[2]) < 1e-6) x = [1, 0, 0]
  x = norm(x)
  const y = cross(z, x)
  return { x, y, z }
}

// A world point in the light's frame: [right, up, distance in front].
export function toLightSpace(point, position, frame) {
  const d = sub(point, position)
  return [dot(d, frame.x), dot(d, frame.y), -dot(d, frame.z)]
}

function windowWall(windows) {
  if (!windows || !windows.length) return 'west'
  // the wall with the most window width gets the sun
  const total = {}
  windows.forEach((w) => {
    const wall = typeof w === 'string' ? w : w.wall
    if (!WALL_NORMALS[wall]) return
    total[wall] = (total[wall] || 0) + (typeof w === 'string' ? 1 : w.width || 1)
  })
  const walls = Object.keys(total)
  if (!walls.length) return 'west'
  return walls.sort((a, b) => total[b] - total[a])[0]
}

/**
 * Sun, cans and shadow box for a width x depth x ceiling room (plan inches,
 * plan origin at the north-west floor corner; width runs east, depth south).
 *
 * windows: [{ wall: 'north' | 'south' | 'east' | 'west', width? }] (or bare
 * wall names). The sun comes in through the wall with the most glazing.
 * unit: world units per inch (IN for a metre scene, 1 for an inch scene).
 * low: small screens — fewer shadowed cans.
 * maxShadowed: how many cans (nearest the middle) throw shadow; default 3
 * (2 when low). Every shadowed can holds its own shadow map on the GPU.
 */
export function roomLighting({ width, depth, ceiling = 96, windows = [], unit = IN, low = false, maxShadowed } = {}) {
  const w = (e, s, u) => planToWorld(e, s, u, unit)

  // --- sun -----------------------------------------------------------------
  const [nx, ns] = WALL_NORMALS[windowWall(windows)]
  const [ax, as] = [-ns, nx] // the normal turned 90 degrees
  const dir = [SUN_OUT * nx + SUN_ALONG * ax, SUN_OUT * ns + SUN_ALONG * as, SUN_UP]
  const dirLen = Math.hypot(dir[0], dir[1], dir[2])

  const aim = [width / 2, depth / 2, Math.min(45, ceiling * 0.4)]
  // back far enough that the light stands clear of the whole room
  const reach = Math.hypot(width, depth, ceiling) / 2 + 60
  const from = [aim[0] + (dir[0] / dirLen) * reach, aim[1] + (dir[1] / dirLen) * reach, aim[2] + (dir[2] / dirLen) * reach]

  const position = w(...from)
  const target = w(...aim)

  // Shadow box. A directional light's shadow camera is an orthographic box in
  // the light's own frame: x/y across the beam, depth along it. Anything
  // outside that box is treated as fully lit — no shadow at all — which is how
  // the homepage once lit the top of a wall white. So project every corner of
  // the room's bounding box into the light's frame and take the extents: the
  // box then covers the whole room whatever the sun angle, and no more (a
  // bigger box only spreads the same shadow-map texels thinner).
  const frame = lightFrame(position, target)
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  ;[0, width].forEach((e) => [0, depth].forEach((s) => [0, ceiling].forEach((u) => {
    const p = toLightSpace(w(e, s, u), position, frame)
    for (let i = 0; i < 3; i += 1) {
      lo[i] = Math.min(lo[i], p[i])
      hi[i] = Math.max(hi[i], p[i])
    }
  })))
  const pad = SHADOW_PAD * unit
  const shadowBox = {
    left: lo[0] - pad,
    right: hi[0] + pad,
    bottom: lo[1] - pad,
    top: hi[1] + pad,
    near: Math.max(0.01 * unit / IN, lo[2] - pad),
    far: hi[2] + pad,
  }

  // --- cans ----------------------------------------------------------------
  const cols = Math.max(1, Math.round(width / CAN_SPACING))
  const rows = Math.max(1, Math.round(depth / CAN_SPACING))
  const height = ceiling - CAN_DROP
  const grid = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      grid.push([((c + 0.5) * width) / cols, ((r + 0.5) * depth) / rows])
    }
  }
  // shadow maps are the expensive part: only the cans nearest the middle of
  // the room (where the island / most of the work sits) throw shadow
  const shadowedCans = Number.isFinite(maxShadowed) ? Math.max(0, maxShadowed) : low ? 2 : 3
  const shadowed = new Set(
    grid
      .map(([e, s], i) => ({ i, d: Math.hypot(e - width / 2, s - depth / 2) }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, shadowedCans)
      .map((c) => c.i),
  )
  const cans = grid.map(([e, s], i) => ({
    position: w(e, s, height),
    target: w(e, s, 0),
    shadow: shadowed.has(i),
  }))

  return { sun: { position, target, shadowBox }, cans }
}
