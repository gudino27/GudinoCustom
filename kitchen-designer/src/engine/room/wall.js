// Walls with their openings, without booleans.
//
// A wall is drawn in its own elevation plane: s along the wall, z up, extruded
// through its thickness along v (see room/schema.js). Openings are rectangles
// in that plane. The solid wall is the wall rectangle less the openings, traced
// as outlines with holes, so a window becomes a real hole and a door that
// reaches the floor becomes a notch in the outline.
import { ShapeUtils, Vector2 } from 'three'
import { makePart } from '../core/part.js'
import { Run } from '../core/run.js'
import { ROOM_DEFAULTS } from './schema.js'

const EPS = 1e-6
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

/** `a`, `b`, ..., `z`, `aa`, ... */
export const letter = (i) => (i < 26 ? LETTERS[i] : letter(Math.floor(i / 26) - 1) + LETTERS[i % 26])

/**
 * The wall's local frame. `pt(s, v)` is the plan point; `box` draws an
 * axis-aligned box in (s, v, z).
 * @param {import('./schema.js').Wall} wall
 * @param {number} roomHeight
 */
export function wallFrame(wall, roomHeight) {
  const [ax, ay] = wall.from
  const [bx, by] = wall.to
  const length = Math.hypot(bx - ax, by - ay)
  if (!(length > EPS)) throw new Error(`wall "${wall.name}" has no length`)
  const dx = (bx - ax) / length
  const dy = (by - ay) / length
  const side = wall.side || ROOM_DEFAULTS.wall.side
  if (!['right', 'left', 'center'].includes(side)) throw new Error(`wall "${wall.name}": side must be right, left or center`)
  // right-hand normal on a y-down plan: heading east (1, 0) -> south (0, 1)
  const front = side === 'left' ? [dy, -dx] : [-dy, dx]
  // Run.pt(u, v) = a + d u - n v, so the wall's v (toward the room) is -v of the run
  const run = new Run(ax, ay, bx - ax, by - ay, front[0], front[1])
  const thickness = wall.thickness ?? ROOM_DEFAULTS.wall.thickness
  const [e0, e1] = wall.extend || [0, 0]
  const base = wall.base ?? 0
  const top = wall.height ?? roomHeight
  if (!(top > base)) throw new Error(`wall "${wall.name}": height must be above its base`)
  return {
    wall,
    name: wall.name,
    length,
    dir: [dx, dy],
    front,
    thickness,
    vBack: side === 'center' ? -thickness / 2 : -thickness,
    vFront: side === 'center' ? thickness / 2 : 0,
    sA: -e0,
    sB: length + e1,
    z0: base,
    z1: top,
    material: wall.material || ROOM_DEFAULTS.wall.material,
    pt: (s, v) => run.pt(s, -v),
    box: (name, s0, s1, v0, v1, z0, z1, material, opts) => run.box(name, s0, s1, -v0, -v1, z0, z1, material, opts),
    raisedPanel: (name, s0, s1, z0, z1, vBack, vFront, inset, material, opts) =>
      run.raisedPanel(name, s0, s1, z0, z1, -vBack, -vFront, inset, material, opts),
  }
}

/**
 * Openings with their resolved rectangle in the wall plane: s0, s1 and the
 * cut's z0, z1 (clipped to the wall). Throws on openings that overlap each
 * other or leave the wall.
 */
export function resolveOpenings(frame) {
  const list = (frame.wall.openings || []).map((o, i) => {
    const kind = o.kind
    if (!['door', 'window', 'cased-opening'].includes(kind)) throw new Error(`wall "${frame.name}": unknown opening kind "${kind}"`)
    if (!(o.width > 0)) throw new Error(`wall "${frame.name}": opening ${i} needs a width`)
    const s0 = o.at !== undefined ? o.at : (o.center ?? NaN) - o.width / 2
    if (!Number.isFinite(s0)) throw new Error(`wall "${frame.name}": opening ${i} needs \`at\` or \`center\``)
    const s1 = s0 + o.width
    let bottom
    let head
    if (kind === 'window') {
      bottom = o.sill ?? ROOM_DEFAULTS.window.sill
      head = o.head ?? ROOM_DEFAULTS.window.head
    } else {
      bottom = frame.z0
      head = o.head ?? (kind === 'door' ? ROOM_DEFAULTS.door.head : ROOM_DEFAULTS.casedOpening.head)
    }
    if (!(head > bottom)) throw new Error(`wall "${frame.name}": opening ${i} has its head below its bottom`)
    const cutTop = kind === 'cased-opening' && o.header ? frame.z1 : Math.min(head, frame.z1)
    return { ...o, kind, order: i, s0, s1, bottom, head, cut: { s0, s1, z0: Math.max(bottom, frame.z0), z1: cutTop } }
  })
  for (const o of list) {
    if (o.s0 < frame.sA - EPS || o.s1 > frame.sB + EPS) {
      throw new Error(`wall "${frame.name}": opening ${o.order} (s ${o.s0}..${o.s1}) runs off the wall (${frame.sA}..${frame.sB})`)
    }
  }
  const sorted = [...list].sort((a, b) => a.s0 - b.s0)
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1]
    const b = sorted[i]
    const zOverlap = Math.min(a.cut.z1, b.cut.z1) - Math.max(a.cut.z0, b.cut.z0) > EPS
    if (b.s0 < a.s1 - EPS && zOverlap) throw new Error(`wall "${frame.name}": openings ${a.order} and ${b.order} overlap`)
  }
  return list
}

const uniqSorted = (vals) => {
  const out = []
  for (const v of [...vals].sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1] > EPS) out.push(v)
  return out
}

const signedArea2 = (ring) => {
  let a = 0
  for (let i = 0; i < ring.length; i += 1) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[(i + 1) % ring.length]
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

const insideRing = (ring, px, py) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > py) !== (yj > py) && px < xj + ((py - yj) * (xi - xj)) / (yi - yj)) inside = !inside
  }
  return inside
}

const dropCollinear = (ring) => {
  let pts = ring
  let changed = true
  while (changed && pts.length > 3) {
    changed = false
    const out = []
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[(i - 1 + pts.length) % pts.length]
      const c = pts[i]
      const n = pts[(i + 1) % pts.length]
      const cross = (c[0] - p[0]) * (n[1] - c[1]) - (c[1] - p[1]) * (n[0] - c[0])
      if (Math.abs(cross) < EPS) changed = true
      else out.push(c)
    }
    pts = out
  }
  return pts
}

/**
 * The wall rectangle [sA, sB] x [zA, zB] less the cut rectangles, as regions
 * `{ outer, holes }` in (s, z). Every ring keeps the solid on its left: outers
 * counter-clockwise, holes clockwise. Works on the grid of every edge
 * coordinate, so notches at the floor, top or ends, openings that cut the wall
 * in two, and openings that touch each other all come out right.
 */
export function elevationRegions(sA, sB, zA, zB, cuts) {
  const clip = cuts
    .map((c) => ({ s0: Math.max(c.s0, sA), s1: Math.min(c.s1, sB), z0: Math.max(c.z0, zA), z1: Math.min(c.z1, zB) }))
    .filter((c) => c.s1 - c.s0 > EPS && c.z1 - c.z0 > EPS)
  const S = uniqSorted([sA, sB, ...clip.flatMap((c) => [c.s0, c.s1])])
  const Z = uniqSorted([zA, zB, ...clip.flatMap((c) => [c.z0, c.z1])])
  const ni = S.length - 1
  const nj = Z.length - 1
  const solid = (i, j) => {
    if (i < 0 || j < 0 || i >= ni || j >= nj) return false
    const sm = (S[i] + S[i + 1]) / 2
    const zm = (Z[j] + Z[j + 1]) / 2
    return !clip.some((c) => sm > c.s0 && sm < c.s1 && zm > c.z0 && zm < c.z1)
  }
  // boundary edges, solid on the left
  const out = new Map()
  const key = (i, j) => `${i},${j}`
  const add = (a, b) => {
    const k = key(...a)
    if (!out.has(k)) out.set(k, [])
    out.get(k).push({ a, b, used: false })
  }
  for (let i = 0; i < ni; i += 1) {
    for (let j = 0; j < nj; j += 1) {
      if (!solid(i, j)) continue
      if (!solid(i, j - 1)) add([i, j], [i + 1, j])
      if (!solid(i + 1, j)) add([i + 1, j], [i + 1, j + 1])
      if (!solid(i, j + 1)) add([i + 1, j + 1], [i, j + 1])
      if (!solid(i - 1, j)) add([i, j + 1], [i, j])
    }
  }
  const loops = []
  for (const edges of out.values()) {
    for (const first of edges) {
      if (first.used) continue
      const loop = []
      let e = first
      while (e && !e.used) {
        e.used = true
        loop.push(e.a)
        const din = [e.b[0] - e.a[0], e.b[1] - e.a[1]]
        const next = (out.get(key(...e.b)) || []).filter((x) => !x.used || x === first)
        // at a pinch point, turn left: it keeps regions that touch at a corner apart
        next.sort((x, y) => {
          const turn = (q) => {
            const d = [q.b[0] - q.a[0], q.b[1] - q.a[1]]
            const cr = din[0] * d[1] - din[1] * d[0]
            return cr > 0 ? 0 : cr === 0 ? 1 : 2
          }
          return turn(x) - turn(y)
        })
        e = next[0] === first ? null : next[0]
      }
      loops.push(dropCollinear(loop.map(([i, j]) => [S[i], Z[j]])))
    }
  }
  const outers = loops.filter((l) => signedArea2(l) > 0).map((outer) => ({ outer, holes: [] }))
  for (const hole of loops.filter((l) => signedArea2(l) < 0)) {
    // a point just to the left of the hole's first edge lies in the solid around it
    const [p, q] = hole
    const L = Math.hypot(q[0] - p[0], q[1] - p[1])
    const mx = (p[0] + q[0]) / 2 - ((q[1] - p[1]) / L) * 1e-3
    const my = (p[1] + q[1]) / 2 + ((q[0] - p[0]) / L) * 1e-3
    const owner = outers.find((r) => insideRing(r.outer, mx, my))
    if (owner) owner.holes.push(hole)
  }
  // west to east, so split names run along the wall
  outers.sort((a, b) => Math.min(...a.outer.map((p) => p[0])) - Math.min(...b.outer.map((p) => p[0])))
  return outers
}

/**
 * Earcut happily draws a diagonal straight through vertices that are collinear
 * with it (the three window sills of wall 9 all sit at z 36), which leaves
 * T-junctions: the solid is closed in space but not edge to edge, and cracks
 * can show once it is rendered. Split every triangle at any ring vertex lying
 * inside one of its edges, then drop the zero-area slivers.
 */
function conformTriangles(tris, pts) {
  const onEdge = (a, b, p) => {
    const ex = pts[b][0] - pts[a][0]
    const ez = pts[b][1] - pts[a][1]
    const px = pts[p][0] - pts[a][0]
    const pz = pts[p][1] - pts[a][1]
    const L2 = ex * ex + ez * ez
    const t = ex * px + ez * pz
    return Math.abs(ex * pz - ez * px) <= 1e-9 * L2 && t > 1e-9 * L2 && t < L2 * (1 - 1e-9)
  }
  const area2 = ([a, b, c]) => (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1])
    - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0])
  const todo = tris.map((t) => [...t])
  const out = []
  while (todo.length) {
    const tri = todo.pop()
    let split = false
    for (let e = 0; e < 3 && !split; e += 1) {
      const a = tri[e]
      const b = tri[(e + 1) % 3]
      const c = tri[(e + 2) % 3]
      for (let p = 0; p < pts.length; p += 1) {
        if (p === a || p === b || p === c || !onEdge(a, b, p)) continue
        todo.push([a, p, c], [p, b, c])
        split = true
        break
      }
    }
    if (!split) out.push(tri)
  }
  const scale = Math.max(...pts.map(([s, z]) => Math.abs(s) + Math.abs(z)), 1)
  return out.filter((t) => Math.abs(area2(t)) > 1e-12 * scale * scale)
}

/**
 * Extrude an elevation region (outer ring + holes in (s, z), solid on the left
 * of every ring) through the wall from vBack to vFront. Caps are
 * triangulated; side faces stay quads.
 */
export function elevationSolid(name, frame, region, vBack, vFront, material, opts = {}) {
  const rings = [region.outer, ...region.holes]
  const flat = rings.flat()
  const n = flat.length
  const verts = [
    ...flat.map(([s, z]) => [...frame.pt(s, vFront), z]),
    ...flat.map(([s, z]) => [...frame.pt(s, vBack), z]),
  ]
  const tris = conformTriangles(ShapeUtils.triangulateShape(
    region.outer.map(([s, z]) => new Vector2(s, z)),
    region.holes.map((h) => h.map(([s, z]) => new Vector2(s, z))),
  ), flat)
  // earcut winds every triangle the same way; turn them all counter-clockwise
  // in (s, z) at once (per-triangle tests would misjudge its sliver triangles)
  let sum = 0
  for (const [a, b, c] of tris) {
    sum += (flat[b][0] - flat[a][0]) * (flat[c][1] - flat[a][1])
      - (flat[b][1] - flat[a][1]) * (flat[c][0] - flat[a][0])
  }
  const faces = []
  for (const [a, b, c] of tris) {
    const ccw = sum > 0 ? [a, b, c] : [a, c, b]
    faces.push(ccw) // front cap
    faces.push([ccw[0] + n, ccw[2] + n, ccw[1] + n]) // back cap
  }
  let start = 0
  for (const ring of rings) {
    const m = ring.length
    for (let i = 0; i < m; i += 1) {
      const a = start + i
      const b = start + ((i + 1) % m)
      // the front cap runs a -> b along this edge, so the side runs b -> a
      faces.push([b, a, a + n, b + n])
    }
    start += m
  }
  return makePart(name, verts, faces, material, { bevel: false, ...opts })
}

/**
 * The wall body, as one solid with its openings (default) or as boxes around
 * them (`split: true`). Headers of cased openings come out here too.
 * @returns {import('../core/part.js').Part[]}
 */
export function buildWallBody(frame, openings) {
  const { name, vBack, vFront, material } = frame
  const tags = { tags: { role: 'wall' } }
  const parts = []
  if (frame.wall.split) {
    const sorted = [...openings].sort((a, b) => a.s0 - b.s0)
    const heads = sorted.filter((o) => o.cut.z1 < frame.z1 - EPS)
    const belows = sorted.filter((o) => o.cut.z0 > frame.z0 + EPS)
    let cursor = frame.sA
    let pier = 0
    const addPier = (s0, s1) => {
      if (s1 - s0 <= EPS) return
      parts.push(frame.box(`${name}_${letter(pier)}`, s0, s1, vBack, vFront, frame.z0, frame.z1, material, { bevel: false, ...tags }))
      pier += 1
    }
    for (const o of sorted) {
      addPier(cursor, o.s0)
      if (o.cut.z1 < frame.z1 - EPS) {
        const hn = o.headName || (heads.length === 1 ? `${name}_head` : `${name}_head${heads.indexOf(o)}`)
        parts.push(frame.box(hn, o.s0, o.s1, vBack, vFront, o.cut.z1, frame.z1, material, { bevel: false, ...tags }))
      }
      if (o.cut.z0 > frame.z0 + EPS) {
        const bn = o.belowName || (belows.length === 1 ? `${name}_below` : `${name}_below${belows.indexOf(o)}`)
        parts.push(frame.box(bn, o.s0, o.s1, vBack, vFront, frame.z0, o.cut.z0, material, { bevel: false, ...tags }))
      }
      cursor = Math.max(cursor, o.s1)
    }
    addPier(cursor, frame.sB)
  } else {
    const regions = elevationRegions(frame.sA, frame.sB, frame.z0, frame.z1, openings.map((o) => o.cut))
    regions.forEach((r, i) => {
      const pn = regions.length === 1 ? name : `${name}_${letter(i)}`
      parts.push(elevationSolid(pn, frame, r, vBack, vFront, material, tags))
    })
  }
  for (const o of openings) {
    if (o.kind !== 'cased-opening' || !o.header || !(o.head < frame.z1)) continue
    const h = o.header === true ? {} : o.header
    const over = h.overhang ?? 0
    parts.push(frame.box(h.name || `${name}_header`, o.s0 - over, o.s1 + over, vBack, vFront, o.head, frame.z1,
      h.material || material, { bevel: false, ...tags }))
  }
  return parts
}
