// Rooms inside the room: partition walls drawn with the designer's custom
// walls (a walk-in or butler's pantry), as the 3D camera needs them.
//
//   interiorWalls   the custom walls that stand inside the room (not ones
//                   that replace an outer wall), with their openings
//   pushOutOfWalls  keep a camera point out of a partition's thickness
//   wallsInView     the partitions between the camera and what it looks at
//                   (the view fades them, like a dollhouse cutaway)
//   hasLineOfSight  no partition between two points
//   enclosedSpaces  the spaces the partitions close off with the outer walls,
//                   each with a doorway view for the toolbar's Pantry button
//
// Plan inches, points [x, y] (x east, y south; three.js x and z over IN).
// Designer data: roomData.customWalls [{ id, wallNumber, x1, y1, x2, y2
// (plan px), thickness, group?, groupName? / name? }], roomData.doors
// [{ wallNumber, position (% along the wall), width, type }],
// roomData.walls (the active wall numbers).
//
// No React, no three: runs under `node --test`.
import { DESIGNER_DOOR_HEIGHT, fitScale, roomSize } from '../../../engine/adapters/designerToJob.js'

const DEFAULT_THICKNESS = 4
const CLEARANCE = 6 // inches the camera keeps from a partition face
const TOUCH = 3 // inches: an end this close to another end or an outer wall joins it
const EYE = 60 // camera height standing in a doorway
const LOOK = 40 // what it looks at inside

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1]
const cross = (a, b) => a[0] * b[1] - a[1] * b[0]
const len = (a) => Math.hypot(a[0], a[1])

/**
 * The partitions: custom walls in the active wall list whose middle stands
 * clear of the outer walls. Returns [{ id, wallNumber, name ('w<n>'), a, b,
 * length, thickness, height, group, label, openings: [{ s0, s1, head }] }]
 * (s0 / s1 inches along a -> b).
 */
export function interiorWalls(roomData, { scale } = {}) {
  if (!roomData) return []
  const s = scale || fitScale(roomData.dimensions)
  const { width: W, depth: D, height: H } = roomSize(roomData.dimensions)
  const active = new Set(roomData.walls || [1, 2, 3, 4])
  const out = []
  for (const cw of roomData.customWalls || []) {
    if (!active.has(cw.wallNumber)) continue
    const a = [num(cw.x1) / s, num(cw.y1) / s]
    const b = [num(cw.x2) / s, num(cw.y2) / s]
    if (![...a, ...b].every(Number.isFinite)) continue
    const length = len(sub(b, a))
    if (length < 1) continue
    const thickness = num(cw.thickness) || DEFAULT_THICKNESS
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const edge = Math.min(mid[0], W - mid[0], mid[1], D - mid[1])
    if (edge <= thickness + TOUCH) continue // on the outline: an outer wall
    const openings = (roomData.doors || [])
      .filter((d) => d.wallNumber === cw.wallNumber)
      .map((d) => {
        const w = num(d.width) || 32
        const c = ((num(d.position) ?? 50) / 100) * length
        return { s0: Math.max(0, c - w / 2), s1: Math.min(length, c + w / 2), head: DESIGNER_DOOR_HEIGHT }
      })
    out.push({
      id: cw.id,
      wallNumber: cw.wallNumber,
      name: `w${cw.wallNumber}`,
      a,
      b,
      length,
      thickness,
      height: H,
      group: cw.group ?? cw.groupId ?? null,
      label: cw.groupName || cw.name || null,
      openings,
    })
  }
  return out
}

/** Nearest point of segment a-b to p: { t (inches along), d (signed distance, + left of a->b), point }. */
function nearest(p, a, b) {
  const ab = sub(b, a)
  const L = len(ab)
  const u = [ab[0] / L, ab[1] / L]
  const t = Math.min(L, Math.max(0, dot(sub(p, a), u)))
  const point = [a[0] + u[0] * t, a[1] + u[1] * t]
  return { t, d: cross(u, sub(p, a)), point, u, L }
}

const inOpening = (wall, t, height) => wall.openings.some((o) => t >= o.s0 && t <= o.s1 && height < o.head)

/**
 * Move a camera point [x, y] (plan inches) at `height` inches out of every
 * partition's thickness plus `clearance`, to the side it is already on (the
 * nearer face). A doorway lets it through below its head.
 */
export function pushOutOfWalls(point, walls, { height = EYE, clearance = CLEARANCE } = {}) {
  let p = point
  for (const wall of walls || []) {
    if (height >= wall.height) continue // above the partition: nothing to hit
    const { t, d, point: q, u, L } = nearest(p, wall.a, wall.b)
    const reach = wall.thickness / 2 + clearance
    const off = sub(p, q)
    const dist = len(off)
    if (dist >= reach) continue
    if (inOpening(wall, t, height)) continue
    if (t > 0 && t < L) {
      const n = [-u[1], u[0]] // left normal
      const side = d >= 0 ? 1 : -1
      p = [q[0] + n[0] * reach * side, q[1] + n[1] * reach * side]
    } else if (dist > 1e-9) {
      p = [q[0] + (off[0] / dist) * reach, q[1] + (off[1] / dist) * reach]
    } else {
      const n = [-u[1], u[0]]
      p = [q[0] + n[0] * reach, q[1] + n[1] * reach]
    }
  }
  return p
}

/** Do segments p1-p2 and q1-q2 cross (touching counts)? */
export function segmentsCross(p1, p2, q1, q2) {
  const r = sub(p2, p1)
  const s = sub(q2, q1)
  const den = cross(r, s)
  const qp = sub(q1, p1)
  if (Math.abs(den) < 1e-12) {
    // parallel: cross only if collinear and overlapping
    if (Math.abs(cross(qp, r)) > 1e-9) return null
    const rr = dot(r, r) || 1
    const t0 = dot(qp, r) / rr
    const t1 = t0 + dot(s, r) / rr
    return Math.max(t0, t1) >= 0 && Math.min(t0, t1) <= 1 ? { t: Math.max(0, Math.min(t0, t1)), u: 0 } : null
  }
  const t = cross(qp, s) / den
  const u = cross(qp, r) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { t, u } : null
}

/** Is `wall` crossed by the sight line from p to q (not through one of its openings)? */
function blocks(wall, p, q, height) {
  const hit = segmentsCross(p, q, wall.a, wall.b)
  if (!hit) return false
  return !inOpening(wall, hit.u * wall.length, height)
}

/** No partition between plan points p and q (at `height` inches). */
export function hasLineOfSight(p, q, walls, { height = EYE } = {}) {
  return !(walls || []).some((w) => blocks(w, p, q, height))
}

/**
 * The partitions standing between the camera and what it looks at: any that
 * crosses the wedge from the camera to the target, `halfAngle` radians
 * either side of the sight line (plan view). Camera / target are [x, y, z]
 * in plan inches with z the height; returns the walls' names.
 */
export function wallsInView(camera, target, walls, { halfAngle = 0.25 } = {}) {
  if (!walls || !walls.length) return []
  const c = [camera[0], camera[1]]
  const tg = [target[0], target[1]]
  const dir = sub(tg, c)
  const dist = len(dir)
  const out = []
  if (dist < 1e-6) return out
  // the wedge as three rays, reaching a little past the target
  const reach = dist * 1.02
  const rays = [0, -halfAngle, halfAngle].map((a) => {
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const d = [(dir[0] * ca - dir[1] * sa) / dist, (dir[0] * sa + dir[1] * ca) / dist]
    return [c[0] + d[0] * reach / Math.max(ca, 0.2), c[1] + d[1] * reach / Math.max(ca, 0.2)]
  })
  const height = Math.min(camera[2] ?? EYE, target[2] ?? EYE)
  for (const wall of walls) {
    // a camera looking down over a partition's top sees past it
    if ((camera[2] ?? 0) > wall.height + 12 && (target[2] ?? 0) < wall.height) {
      const near = nearest(c, wall.a, wall.b)
      if (len(sub(c, near.point)) > wall.thickness) continue
    }
    const hitRay = rays.some((r) => {
      const hit = segmentsCross(c, r, wall.a, wall.b)
      return hit && !inOpening(wall, hit.u * wall.length, height)
    })
    // or the wall lies wholly inside the wedge
    const inside = !hitRay && [wall.a, wall.b].every((p) => {
      const v = sub(p, c)
      const along = dot(v, dir) / dist
      if (along <= 0 || along > reach) return false
      return Math.abs(Math.atan2(cross(dir, v) / dist, along)) <= halfAngle
    })
    if (hitRay || inside) out.push(wall.name)
  }
  return out
}

// an end joins another wall when it lands on it (the pantry feature runs its
// north / south partitions over the corners, so an east / west end meets the
// other wall half a thickness in from that wall's end)
const touches = (p, wall) => len(sub(p, nearest(p, wall.a, wall.b).point)) <= TOUCH + wall.thickness / 2
const onOutline = (p, W, D) => Math.min(p[0], W - p[0], p[1], D - p[1]) <= TOUCH + DEFAULT_THICKNESS

/**
 * Group partitions into chains: by `group` when the designer gives one,
 * otherwise walls whose ends touch.
 */
function chains(walls) {
  const byGroup = new Map()
  const loose = []
  for (const w of walls) {
    if (w.group !== null && w.group !== undefined) {
      if (!byGroup.has(w.group)) byGroup.set(w.group, [])
      byGroup.get(w.group).push(w)
    } else loose.push(w)
  }
  const out = [...byGroup.values()]
  const seen = new Set()
  for (const w of loose) {
    if (seen.has(w)) continue
    const chain = [w]
    seen.add(w)
    for (let i = 0; i < chain.length; i++) {
      for (const o of loose) {
        if (seen.has(o)) continue
        const c = chain[i]
        if ([c.a, c.b].some((p) => touches(p, o)) || [o.a, o.b].some((p) => touches(p, c))) {
          chain.push(o)
          seen.add(o)
        }
      }
    }
    out.push(chain)
  }
  return out
}

/**
 * The spaces the partitions close off: a chain of partitions whose free ends
 * all land on the outer walls encloses the box they span (a straight wall
 * from wall to wall encloses the smaller side). Axis-aligned boxes: fine for
 * the rectangular pantries the designer draws.
 *
 * @returns [{ id, label, walls: [names], box: { x0, y0, x1, y1 }, center,
 *   door: { position, target } | null }] positions / targets [x, y, z] in
 *   plan inches (z = height): standing in the doorway, just outside, looking in.
 */
export function enclosedSpaces(roomData, { scale, walls } = {}) {
  const list = walls || interiorWalls(roomData, { scale })
  if (!list.length) return []
  const { width: W, depth: D } = roomSize(roomData.dimensions)
  const spaces = []
  for (const chain of chains(list)) {
    const ends = chain.flatMap((w) => [w.a, w.b])
    const free = chain.flatMap((w) => [w.a, w.b].filter((p) => !chain.some((o) => o !== w && touches(p, o))))
    if (!free.every((p) => onOutline(p, W, D))) continue
    let x0 = Math.min(...ends.map((p) => p[0]))
    let x1 = Math.max(...ends.map((p) => p[0]))
    let y0 = Math.min(...ends.map((p) => p[1]))
    let y1 = Math.max(...ends.map((p) => p[1]))
    // snap to the outline where the chain meets it
    const snap = (v, max) => (v <= TOUCH + DEFAULT_THICKNESS ? 0 : v >= max - TOUCH - DEFAULT_THICKNESS ? max : v)
    x0 = snap(x0, W); x1 = snap(x1, W); y0 = snap(y0, D); y1 = snap(y1, D)
    // a single straight wall: the smaller side
    if (x1 - x0 < TOUCH) {
      if (x0 < W - x0) { x1 = x0; x0 = 0 } else { x1 = W }
    }
    if (y1 - y0 < TOUCH) {
      if (y0 < D - y0) { y1 = y0; y0 = 0 } else { y1 = D }
    }
    const area = (x1 - x0) * (y1 - y0)
    if (!(area > 0) || area >= W * D * 0.9) continue
    const center = [(x0 + x1) / 2, (y0 + y1) / 2]
    spaces.push({
      id: String(chain[0].group ?? chain.map((w) => w.id).join('+')),
      label: chain.find((w) => w.label)?.label || null,
      walls: chain.map((w) => w.name),
      box: { x0, y0, x1, y1 },
      center,
      door: doorwayView(chain, center),
    })
  }
  return spaces
}

/** Stand in the first opening of the chain, just outside, looking in. */
function doorwayView(chain, center) {
  for (const wall of chain) {
    const o = wall.openings[0]
    if (!o) continue
    const u = [(wall.b[0] - wall.a[0]) / wall.length, (wall.b[1] - wall.a[1]) / wall.length]
    const mid = (o.s0 + o.s1) / 2
    const at = [wall.a[0] + u[0] * mid, wall.a[1] + u[1] * mid]
    // the normal pointing away from the space
    let n = [-u[1], u[0]]
    if (dot(n, sub(center, at)) > 0) n = [-n[0], -n[1]]
    const back = wall.thickness / 2 + CLEARANCE
    const position = [at[0] + n[0] * back, at[1] + n[1] * back, EYE]
    // look through the doorway, toward the far side of the space
    const inward = [-n[0], -n[1]]
    const depth = Math.max(12, dot(sub(center, at), inward) * 2)
    const target = [at[0] + inward[0] * depth, at[1] + inward[1] * depth, LOOK]
    return { position, target }
  }
  return null
}

/**
 * Button labels for the enclosed spaces: their own name, else `fallback`
 * ("Pantry", translated; the pantry feature's default groupName 'Pantry'
 * counts as no name), numbered when several share one.
 */
export function spaceLabels(spaces, fallback) {
  const base = spaces.map((sp) => (sp.label && sp.label.trim().toLowerCase() !== 'pantry' ? sp.label : fallback))
  const total = new Map()
  base.forEach((l) => total.set(l, (total.get(l) || 0) + 1))
  const seen = new Map()
  return base.map((l) => {
    if (total.get(l) < 2) return l
    seen.set(l, (seen.get(l) || 0) + 1)
    return `${l} ${seen.get(l)}`
  })
}

/** Inches -> the three.js [x, y, z] metres the views use (z = height -> y). */
export const planToView = ([x, y, z], unit) => [x * unit, z * unit, y * unit]
/** The inverse: three.js metres -> plan [x, y, z] inches. */
export const viewToPlan = ([x, y, z], unit) => [x / unit, z / unit, y / unit]
