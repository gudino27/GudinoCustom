// The island body: one closed solid with the basin pocket, and the polygon
// helpers it is laid out with.
import { ShapeUtils, Vector2 } from 'three'
import { makePart } from '../core/part.js'
import { edgeNormal, offsetPolygon, pointInPoly } from '../core/polygon.js'

/**
 * offsetPolygon with a distance per edge (outward positive): edge i's line
 * moves `d[i]` along its outward normal, corners are where neighbouring lines
 * meet. With every distance equal it IS offsetPolygon.
 */
export function offsetEdges(poly, d) {
  if (d.every((x) => x === d[0])) return offsetPolygon(poly, d[0])
  const n = poly.length
  const lines = []
  for (let i = 0; i < n; i += 1) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % n]
    const [nx, ny] = edgeNormal(poly, i)
    const L = Math.hypot(x1 - x0, y1 - y0)
    lines.push([x0 + nx * d[i], y0 + ny * d[i], (x1 - x0) / L, (y1 - y0) / L])
  }
  const out = []
  for (let i = 0; i < n; i += 1) {
    const [ax, ay, adx, ady] = lines[(i - 1 + n) % n]
    const [bx, by, bdx, bdy] = lines[i]
    const den = adx * bdy - ady * bdx
    if (Math.abs(den) < 1e-9) {
      out.push([bx, by])
      continue
    }
    const t = ((bx - ax) * bdy - (by - ay) * bdx) / den
    out.push([ax + adx * t, ay + ady * t])
  }
  return out
}

/** Throw unless every edge of `inner` still runs the same way as in `outer` (no edge swallowed). */
export function assertEdgesSurvive(outer, inner, what) {
  const n = outer.length
  for (let i = 0; i < n; i += 1) {
    const a = outer[i]
    const b = outer[(i + 1) % n]
    const c = inner[i]
    const e = inner[(i + 1) % n]
    const dot = (b[0] - a[0]) * (e[0] - c[0]) + (b[1] - a[1]) * (e[1] - c[1])
    if (!(dot > 1e-6)) {
      throw new Error(`island: ${what} edge ${i} vanishes (insets too large for the outline)`)
    }
  }
}

/** True when every corner of `hole` lies inside `poly`. */
export const holeInside = (poly, hole) => hole.every(([x, y]) => pointInPoly(poly, x, y))

// Newell normal of a planar polygon, plan space
function newell(verts, face) {
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < face.length; i += 1) {
    const a = verts[face[i]]
    const b = verts[face[(i + 1) % face.length]]
    nx += (a[1] - b[1]) * (a[2] + b[2])
    ny += (a[2] - b[2]) * (a[0] + b[0])
    nz += (a[0] - b[0]) * (a[1] + b[1])
  }
  return [nx, ny, nz]
}

// wind `face` so its plan-space normal points along `want`
function orient(verts, face, want) {
  const n = newell(verts, face)
  return n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0 ? [...face].reverse() : face
}

const v2 = (ring) => ring.map(([x, y]) => new Vector2(x, y))

/**
 * The island carcass as ONE closed solid: the body polygon from z0 to z1,
 * with an open-topped pocket (the sink's `body` cutout) from zp up through
 * the top. Faces: bottom cap, outer walls, top cap with the pocket's outline
 * as a hole, the pocket's four walls and its floor. This replaces the
 * Python's boolean of a box out of the top of the body.
 *
 * @param {string} name
 * @param {number[][]} poly    body outline
 * @param {number[][]|null} pocket  the pocket's plan outline (inside `poly`), or null
 * @param {number} z0
 * @param {number} z1
 * @param {number} zp          pocket floor (z0 < zp < z1)
 * @param {string} material
 * @param {Object} [opts]      makePart options (tags)
 */
export function bodySolid(name, poly, pocket, z0, z1, zp, material, opts = {}) {
  const n = poly.length
  const verts = [
    ...poly.map(([x, y]) => [x, y, z0]), // 0 .. n-1       outer bottom
    ...poly.map(([x, y]) => [x, y, z1]), // n .. 2n-1      outer top
  ]
  const faces = []
  const up = [0, 0, 1]
  const down = [0, 0, -1]

  for (const tri of ShapeUtils.triangulateShape(v2(poly), [])) {
    faces.push(orient(verts, tri, down))
  }
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    const [nx, ny] = edgeNormal(poly, i)
    faces.push(orient(verts, [i, j, n + j, n + i], [nx, ny, 0]))
  }

  if (!pocket) {
    for (const tri of ShapeUtils.triangulateShape(v2(poly), [])) {
      faces.push(orient(verts, tri.map((k) => n + k), up))
    }
    return makePart(name, verts, faces, material, { bevel: false, ...opts })
  }

  const m = pocket.length
  const ht = 2 * n // pocket rim, at z1
  const hb = 2 * n + m // pocket floor, at zp
  verts.push(...pocket.map(([x, y]) => [x, y, z1]), ...pocket.map(([x, y]) => [x, y, zp]))
  // triangulateShape indexes the outer ring then the hole
  const topIndex = (k) => (k < n ? n + k : ht + (k - n))
  for (const tri of ShapeUtils.triangulateShape(v2(poly), [v2(pocket)])) {
    faces.push(orient(verts, tri.map(topIndex), up))
  }
  for (let k = 0; k < m; k += 1) {
    const l = (k + 1) % m
    const [nx, ny] = edgeNormal(pocket, k)
    // the solid is outside the pocket: its walls face into it
    faces.push(orient(verts, [ht + k, ht + l, hb + l, hb + k], [-nx, -ny, 0]))
  }
  faces.push(orient(verts, [...Array(m).keys()].map((k) => hb + k), up))
  return makePart(name, verts, faces, material, { bevel: false, ...opts })
}
