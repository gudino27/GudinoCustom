// Counter tops. `counterRun` is the straight top along a wall run (the
// Python's w1_counter_l / w1_counter_r / w5_counter); `counterPolygon` any
// plan outline (islands, L-shaped corners). Holes (sinks, cooktops) are built
// into the solid with prismWithHoles: no booleans.
import { pointInPoly, polyArea } from '../core/polygon.js'
import { prism, prismWithHoles } from '../core/part.js'

const EPS = 1e-6
const counterMaterial = (ctx) => ctx.style?.counter || 'granite'
const tags = (cabinet) => ({ tags: cabinet === undefined || cabinet === null ? { role: 'counter' } : { role: 'counter', cabinet: String(cabinet) } })

const centroid = (poly) => {
  let x = 0
  let y = 0
  for (const [px, py] of poly) { x += px; y += py }
  return [x / poly.length, y / poly.length]
}

/** Clockwise / counter-clockwise does not matter to prismWithHoles, but a hole must wind opposite its outer. */
const wound = (poly, sign) => (Math.sign(polyArea(poly)) === sign ? poly : [...poly].reverse())

/** Names of `n` pieces of one counter: `name`; `_l` / `_r`; or `_0.._n-1`. */
export function pieceNames(name, n) {
  if (n === 1) return [name]
  if (n === 2) return [`${name}_l`, `${name}_r`]
  return [...Array(n).keys()].map((i) => `${name}_${i}`)
}

/** [u0, u1] less the gaps, as sorted segments. */
export function splitSpan(u0, u1, gaps = []) {
  let segs = [[u0, u1]]
  for (const g of [...gaps].sort((p, q) => p.u0 - q.u0)) {
    const next = []
    for (const [a, b] of segs) {
      if (g.u1 <= a + EPS || g.u0 >= b - EPS) { next.push([a, b]); continue }
      if (g.u0 - a > EPS) next.push([a, g.u0])
      if (b - g.u1 > EPS) next.push([g.u1, b])
    }
    segs = next
  }
  return segs
}

/**
 * Counter over any plan polygon, `standards.counterThickness` thick on top of
 * `z` (default standards.baseHeight). `cutouts` are plan polygons (e.g.
 * sinkCutout(...).top) that become holes.
 */
export function counterPolygon(ctx, name, polygon, { cutouts = [], z, thickness, cabinet } = {}) {
  const st = ctx.standards
  const z0 = z ?? st.baseHeight
  const z1 = z0 + (thickness ?? st.counterThickness)
  const outer = wound(polygon, 1)
  const holes = cutouts.filter((h) => pointInPoly(polygon, ...centroid(h))).map((h) => wound(h, -1))
  if (holes.length === 0) return [prism(name, polygon, z0, z1, counterMaterial(ctx), tags(cabinet))]
  return [prismWithHoles(name, outer, holes, z0, z1, counterMaterial(ctx), tags(cabinet))]
}

/**
 * Straight counter along a run: from the wall (v = depth, default run.front)
 * to `overhang` in front of the door faces, u0..u1 plus any end overhangs.
 * `gaps` ([{ u0, u1 }], e.g. a slide-in range's opening) split it into
 * pieces named by pieceNames (the reference's `w1_counter_l` / `_r`);
 * `cutouts` (plan polygons) become holes in whichever piece contains them.
 *
 * @param {Object} [o]
 * @param {number[][][]} [o.cutouts]
 * @param {{u0:number,u1:number}[]} [o.gaps]
 * @param {number} [o.depth]          wall to door face (default run.front)
 * @param {number} [o.overhang]       past the door face (default standards.counterOverhang)
 * @param {number} [o.overhangStart]  past u0 (default 0: against a wall or the next cabinet)
 * @param {number} [o.overhangEnd]    past u1
 * @param {number} [o.z]              underside (default standards.baseHeight)
 */
export function counterRun(ctx, run, name, u0, u1, o = {}) {
  const st = ctx.standards
  const depth = o.depth ?? run.front
  const oh = o.overhang ?? st.counterOverhang
  const z0 = o.z ?? st.baseHeight
  const z1 = z0 + (o.thickness ?? st.counterThickness)
  const segs = splitSpan(u0 - (o.overhangStart || 0), u1 + (o.overhangEnd || 0), o.gaps || [])
  const names = pieceNames(name, segs.length)
  return segs.map(([a, b], i) => {
    const outer = [run.pt(a, -oh), run.pt(b, -oh), run.pt(b, depth), run.pt(a, depth)]
    const holes = (o.cutouts || []).filter((h) => pointInPoly(outer, ...centroid(h)))
    if (holes.length === 0) return run.box(names[i], a, b, -oh, depth, z0, z1, counterMaterial(ctx), tags(o.cabinet))
    return prismWithHoles(names[i], wound(outer, 1), holes.map((h) => wound(h, -1)), z0, z1, counterMaterial(ctx), tags(o.cabinet))
  })
}
