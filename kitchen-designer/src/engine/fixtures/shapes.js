// Shared helpers for the bathroom fixtures: rounded plan outlines, a solid
// with a sloped pocket (tub, shower pan, basin), and the fixture tags.
//
// Fixtures are authored in the appliances' wall frame [u, y, z] (u along the
// run, y out from the wall plane, z up) and mapped onto the run with
// appliances/local.js `place`.
import { ShapeUtils, Vector2 } from 'three'
import { makePart } from '../core/part.js'
import { polyArea } from '../core/polygon.js'

/** The tags every fixture part carries. */
export function fixtureTags(opts = {}) {
  const tags = { role: 'fixture' }
  if (opts.cabinet !== undefined && opts.cabinet !== null) tags.cabinet = String(opts.cabinet)
  return tags
}

/**
 * Ellipse of `n` sides, counter-clockwise (positive polyArea). `egg` narrows
 * the +y half (the front of a toilet bowl, which faces away from the wall).
 */
export function ellipse(cx, cy, rx, ry, n = 20, egg = 0) {
  const out = []
  for (let i = 0; i < n; i += 1) {
    const a = (2 * Math.PI * i) / n
    const s = Math.sin(a)
    out.push([cx + rx * Math.cos(a) * (1 - egg * s), cy + ry * s])
  }
  return out
}

/** Rectangle with rounded corners (`seg` segments per corner), counter-clockwise. */
export function roundedRect(x0, y0, x1, y1, r, seg = 3) {
  const rr = Math.max(0, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01))
  if (rr <= 0) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const corners = [
    [x1 - rr, y0 + rr, -Math.PI / 2],
    [x1 - rr, y1 - rr, 0],
    [x0 + rr, y1 - rr, Math.PI / 2],
    [x0 + rr, y0 + rr, Math.PI],
  ]
  const out = []
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= seg; k += 1) {
      const a = a0 + (Math.PI / 2) * (k / seg)
      out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)])
    }
  }
  return out
}

export const translate = (poly, dx, dy) => poly.map(([x, y]) => [x + dx, y + dy])

/**
 * One closed solid with a pocket sunk into its top: a tub (apron and deck
 * with the basin), a shower pan (curb and floor), a vanity basin (rim and
 * bowl). No booleans: the deck is the outer outline with the rim as a hole,
 * the pocket walls run from the rim down to the floor.
 *
 *   outer     plan outline at zTop           outerBot  same vertex count, at z0 (default: outer)
 *   rim       pocket outline at zTop         floor     same vertex count, at zFloor
 *
 * Keep `floor` a translated inward offset of `rim` (offsetPolygon) so the
 * pocket walls stay planar.
 */
export function pocketSolid(name, { outer, outerBot = outer, rim, floor, z0, zTop, zFloor }, material, opts = {}) {
  let oT = outer
  let oB = outerBot
  let rT = rim
  let fB = floor
  if (polyArea(oT) < 0) { oT = [...oT].reverse(); oB = [...oB].reverse() }
  if (polyArea(rT) < 0) { rT = [...rT].reverse(); fB = [...fB].reverse() }
  const m = oT.length
  const n = rT.length
  const verts = [
    ...oB.map(([x, y]) => [x, y, z0]),
    ...oT.map(([x, y]) => [x, y, zTop]),
    ...rT.map(([x, y]) => [x, y, zTop]),
    ...fB.map(([x, y]) => [x, y, zFloor]),
  ]
  const OT = m
  const R = 2 * m
  const F = 2 * m + n
  // Everything below is wound outward in plan space (right-handed x, y, z);
  // makePart turns the whole solid over if three.js space disagrees.
  const faces = [[...Array(m).keys()].reverse()] // underside, facing down
  for (let i = 0; i < m; i += 1) { // outer walls: outward is right of a CCW edge
    const j = (i + 1) % m
    faces.push([i, j, OT + j, OT + i])
  }
  const flat = [...oT, ...rT]
  const tris = ShapeUtils.triangulateShape(
    oT.map(([x, y]) => new Vector2(x, y)),
    [rT.map(([x, y]) => new Vector2(x, y))],
  )
  const idx = (k) => (k < m ? OT + k : R + (k - m))
  for (const [a, b, c] of tris) { // deck, facing up (counter-clockwise from above)
    const cross = (flat[b][0] - flat[a][0]) * (flat[c][1] - flat[a][1])
      - (flat[b][1] - flat[a][1]) * (flat[c][0] - flat[a][0])
    faces.push(cross > 0 ? [idx(a), idx(b), idx(c)] : [idx(a), idx(c), idx(b)])
  }
  for (let i = 0; i < n; i += 1) { // pocket walls: out of the solid = into the pocket
    const j = (i + 1) % n
    faces.push([F + j, F + i, R + i, R + j])
  }
  faces.push([...Array(n).keys()].map((i) => F + i)) // pocket floor, facing up
  return makePart(name, verts, faces, material, { bevel: false, ...opts })
}
