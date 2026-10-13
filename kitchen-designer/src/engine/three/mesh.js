// Polygon meshes in three.js space (metres, y up) and the vector helpers the
// bevel and the triangulation share. A "polymesh" is { verts: [x, y, z][],
// faces: index[][] } with planar, possibly concave faces.
import { ShapeUtils, Vector2 } from 'three'
import { toThree } from '../core/units.js'

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const length = (a) => Math.hypot(a[0], a[1], a[2])
export const normalize = (a) => {
  const l = length(a)
  return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]
}

/** Newell normal of a polygon given as points (not normalised: length = 2 x area). */
export function newell(points) {
  let nx = 0
  let ny = 0
  let nz = 0
  const n = points.length
  for (let i = 0; i < n; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % n]
    nx += (a[1] - b[1]) * (a[2] + b[2])
    ny += (a[2] - b[2]) * (a[0] + b[0])
    nz += (a[0] - b[0]) * (a[1] + b[1])
  }
  return [nx, ny, nz]
}

export const faceNormal = (verts, face) => newell(face.map((i) => verts[i]))

/** Six times the signed volume (positive = faces point outward). */
export function signedVolume6(verts, faces) {
  let v6 = 0
  for (const f of faces) {
    const a = verts[f[0]]
    for (let i = 1; i < f.length - 1; i += 1) v6 += dot(a, cross(verts[f[i]], verts[f[i + 1]]))
  }
  return v6
}

/** A part as a polymesh in three.js space; closed parts are checked and turned outward if needed. */
export function partToPolymesh(part) {
  const verts = part.verts.map(toThree)
  let faces = part.faces.map((f) => [...f])
  if (part.closed !== false && signedVolume6(verts, faces) < 0) faces = faces.map((f) => f.reverse())
  return { verts, faces }
}

/**
 * Triangulate one planar polygon (convex or concave) in its own plane.
 * Returns triangles as triples of positions in `points`, wound to agree with
 * the polygon's own (Newell) normal. Degenerate polygons give [].
 */
export function triangulatePolygon(points, normal = newell(points)) {
  const n = points.length
  if (n < 3) return []
  const nl = length(normal)
  if (nl < 1e-18) return []
  if (n === 3) return [[0, 1, 2]]
  const nn = scale(normal, 1 / nl)
  // an orthonormal basis of the face plane, right-handed about the normal
  const helper = Math.abs(nn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const e1 = normalize(cross(helper, nn))
  const e2 = cross(nn, e1)
  const contour = points.map((p) => new Vector2(dot(p, e1), dot(p, e2)))
  // (e1, e2, n) is right-handed, so the polygon is counter-clockwise in 2D
  const tris = ShapeUtils.triangulateShape(contour, [])
  const out = []
  for (const [a, b, c] of tris) {
    const pa = contour[a]
    const pb = contour[b]
    const pc = contour[c]
    const area2 = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x)
    if (Math.abs(area2) < 1e-20) continue
    out.push(area2 > 0 ? [a, b, c] : [a, c, b])
  }
  return out
}
