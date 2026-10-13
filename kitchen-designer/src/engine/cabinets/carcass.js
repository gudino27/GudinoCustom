// Cabinet boxes: the carcasses behind the fronts. Ports of base_carcass,
// upper_glass and upper_solid in scripts/build_kitchen.py, the oven tower built
// round its cutout (build_right_wall), plus the boxes the Python never needed
// (open shelves, L-shaped corners, finished backs).
//
// Everything is drawn on a Run whose `front` is the cabinet's depth: u along
// the face, v back from the door face (v = 0), z up. Where the body starts
// comes from the construction system (resolveFit): just behind the deepest of
// fronts and frame. Frameless inset has no frame, so the box's own edges show
// round the fronts: they are drawn as `sheet`-wide strips from the face back to
// the body (`${name}_edge-sl`, ... the keys layoutFronts reports).
import { prism } from '../core/part.js'
import { Run } from '../core/run.js'
import { layoutFronts, resolveFit } from './construction.js'

/** The Python's gap between neighbouring boxes (0.04" each side): no coplanar sides. */
export const BOX_INSET = 0.04
// the tower's white back laps into the stiles round the cutout
const TOWER_BACK_LAP = 0.3
// glass shelves stand this far behind the fronts
const SHELF_SETBACK = 0.3
const GLASS_SHELF_T = 0.5
// open shelves: the shelf's front edge sits this far behind the box edges
const OPEN_SHELF_SETBACK = 0.25
// target shelf spacing of a glass upper (the reference: 58" / 5)
const SHELF_PITCH = 11.6

export const finishOf = (ctx) => ctx.style?.finish || 'paint'
const tags = (role, cabinet) => ({ tags: cabinet === undefined || cabinet === null ? { role } : { role, cabinet: String(cabinet) } })
const isFramelessInset = (fit) => fit.system === 'frameless' && fit.fit === 'inset'

/** Where a box's sides start: the Python's FRONT_T for frameless overlay, the frame's back lap otherwise. */
export function sideStartV(ctx, fit = resolveFit(ctx)) {
  if (isFramelessInset(fit)) return fit.carcassEdgeV
  if (fit.hasFrame) return fit.carcassV
  return ctx.standards.frontThickness
}

/**
 * Frameless inset only: the strips of box edge that show round the fronts,
 * from the face back to where the body starts. Empty for every other system.
 */
export function insetEdges(ctx, run, name, bounds, openings, { a, b, cabinet, fit = resolveFit(ctx) } = {}) {
  if (!isFramelessInset(fit) || !openings || openings.length === 0) return []
  const { members } = layoutFronts(ctx, bounds, openings, fit)
  const out = []
  const lo = a ?? bounds.u0
  const hi = b ?? bounds.u1
  for (const m of members) {
    if (!m.key.startsWith('edge-')) continue
    const u0 = Math.max(m.u0, lo)
    const u1 = Math.min(m.u1, hi)
    if (u1 - u0 < 1e-6) continue
    out.push(run.box(`${name}_${m.key}`, u0, u1, fit.carcassEdgeV, fit.carcassV, m.z0, m.z1, finishOf(ctx), tags('carcass', cabinet)))
  }
  return out
}

/** Toe kick box `name`: recessed under a base, `height` tall. */
export function toeBox(ctx, run, name, u0, u1, { bottom = 0, height, recess, depth, cabinet } = {}) {
  const st = ctx.standards
  return run.box(name, u0, u1, recess ?? st.toeRecess, depth ?? run.front, bottom, bottom + (height ?? st.toeHeight),
    'toe', tags('toe', cabinet))
}

/**
 * A plain box carcass: optional toe kick and one body (`${name}_box`), plus
 * the visible edges for frameless inset. Port of base_carcass (with toe) and of
 * the upper_solid box (without).
 *
 * @param {Object} o
 * @param {number} o.z0              bottom of the body (top of the toe)
 * @param {number} o.z1              top of the body
 * @param {number} [o.depth]         default run.front
 * @param {Object|null} [o.toe]      { bottom, height, recess, inset: [l, r] } or null for none
 * @param {number[]} [o.inset]       [left, right] box inset from u0/u1 (default 0.04 each)
 * @param {Object} [o.bounds]        cabinet face for the frameless-inset edges
 * @param {Object[]} [o.openings]
 * @param {number} [o.vBack]         where the body stops (default depth)
 */
export function boxCarcass(ctx, run, name, u0, u1, o = {}) {
  const fit = resolveFit(ctx)
  const depth = o.depth ?? run.front
  const [il, ir] = o.inset || [BOX_INSET, BOX_INSET]
  const a = u0 + il
  const b = u1 - ir
  const out = []
  if (o.toe) {
    const [tl, tr] = o.toe.inset || [BOX_INSET, BOX_INSET]
    out.push(toeBox(ctx, run, `${name}_toe`, u0 + tl, u1 - tr, {
      bottom: o.toe.bottom ?? 0, height: o.toe.height, recess: o.toe.recess, depth: o.toe.depth ?? depth, cabinet: o.cabinet,
    }))
  }
  out.push(run.box(`${name}_box`, a, b, fit.carcassV, o.vBack ?? depth, o.z0, o.z1, finishOf(ctx), tags('carcass', o.cabinet)))
  if (o.bounds) out.push(...insetEdges(ctx, run, name, o.bounds, o.openings, { a, b, cabinet: o.cabinet, fit }))
  return out
}

/** Number of glass shelves in a glass upper `h` tall (4 in the reference's 58"). */
export const glassShelfCount = (h) => Math.max(0, Math.round(h / SHELF_PITCH) - 1)

/**
 * Glass-door upper's white interior: back, sides, bottom, top (`_bk _lf _rt
 * _bt _tp`) and 1/2" glass shelves `_sh1.._shN`. Port of upper_glass's box.
 */
export function glassUpperCarcass(ctx, run, name, u0, u1, z0, z1, { depth, shelves, cabinet } = {}) {
  const fit = resolveFit(ctx)
  const d = depth ?? run.front
  const t = ctx.construction?.sheet ?? 0.75
  const a = u0 + BOX_INSET
  const b = u1 - BOX_INSET
  const vs = sideStartV(ctx, fit)
  const m = 'cabint'
  const o = tags('carcass', cabinet)
  const out = [
    run.box(`${name}_bk`, a + t, b - t, d - t, d, z0 + t, z1 - t, m, o),
    run.box(`${name}_lf`, a, a + t, vs, d, z0, z1, m, o),
    run.box(`${name}_rt`, b - t, b, vs, d, z0, z1, m, o),
    run.box(`${name}_bt`, a + t, b - t, vs, d, z0, z0 + t, m, o),
    run.box(`${name}_tp`, a + t, b - t, vs, d, z1 - t, z1, m, o),
  ]
  const n = shelves ?? glassShelfCount(z1 - z0)
  const sv = Math.max(vs, ctx.standards.frontThickness, fit.frontV[1]) + SHELF_SETBACK
  for (let i = 1; i <= n; i += 1) {
    const zs = z0 + ((z1 - z0) * i) / (n + 1)
    out.push(run.box(`${name}_sh${i}`, a + t, b - t, sv, d - t, zs - GLASS_SHELF_T / 2, zs + GLASS_SHELF_T / 2,
      'glass', tags('shelf', cabinet)))
  }
  return out
}

/**
 * Open shelving: no fronts, so the box edges reach the face. Painted sides,
 * top and bottom, a white back and `shelves` painted shelves.
 */
export function openShelfCarcass(ctx, run, name, u0, u1, z0, z1, { depth, shelves = 2, cabinet } = {}) {
  const d = depth ?? run.front
  const t = ctx.construction?.sheet ?? 0.75
  const back = ctx.construction?.back ?? 0.25
  const st = ctx.construction?.shelf ?? 0.75
  const a = u0 + BOX_INSET
  const b = u1 - BOX_INSET
  const f = finishOf(ctx)
  const o = tags('carcass', cabinet)
  const out = [
    run.box(`${name}_bk`, a + t, b - t, d - back, d, z0 + t, z1 - t, 'cabint', o),
    run.box(`${name}_lf`, a, a + t, 0, d, z0, z1, f, o),
    run.box(`${name}_rt`, b - t, b, 0, d, z0, z1, f, o),
    run.box(`${name}_bt`, a + t, b - t, 0, d, z0, z0 + t, f, o),
    run.box(`${name}_tp`, a + t, b - t, 0, d, z1 - t, z1, f, o),
  ]
  const inner0 = z0 + t
  const inner1 = z1 - t
  for (let i = 1; i <= shelves; i += 1) {
    const zs = inner0 + ((inner1 - inner0) * i) / (shelves + 1)
    out.push(run.box(`${name}_sh${i}`, a + t, b - t, OPEN_SHELF_SETBACK, d - back, zs - st / 2, zs + st / 2, f, tags('shelf', cabinet)))
  }
  return out
}

/**
 * The oven tower's box, built round a real cutout: below it (`_lo`), above it
 * (`_hi`), a stile either side (`_sl _sr`), a white back that laps into them
 * (`_bk`) and the toe (`_toe`). From build_right_wall.
 *
 * @param {Object} o
 * @param {number} o.z0 o.z1        bottom of the body (top of the toe) and top of the tower
 * @param {{width:number, height:number, bottom:number}} o.cutout
 * @param {number[]} [o.inset]      [left, right] (the reference: [0, 0.04])
 * @param {number[]} [o.toeInset]   [left, right] (the reference: [0, 0])
 */
export function towerCarcass(ctx, run, name, u0, u1, o) {
  const fit = resolveFit(ctx)
  const depth = o.depth ?? run.front
  const [il, ir] = o.inset || [BOX_INSET, BOX_INSET]
  const [tl, tr] = o.toeInset || [BOX_INSET, BOX_INSET]
  const a = u0 + il
  const b = u1 - ir
  const uc = (u0 + u1) / 2
  const oa = uc - o.cutout.width / 2
  const ob = uc + o.cutout.width / 2
  const c0 = o.cutout.bottom
  const c1 = c0 + o.cutout.height
  const tb = fit.carcassV
  const f = finishOf(ctx)
  const t = tags('carcass', o.cabinet)
  const back = ctx.construction?.sheet ?? 0.75
  const out = [
    run.box(`${name}_lo`, a, b, tb, depth, o.z0, c0, f, t),
    run.box(`${name}_hi`, a, b, tb, depth, c1, o.z1, f, t),
    run.box(`${name}_sl`, a, oa, tb, depth, c0, c1, f, t),
    run.box(`${name}_sr`, ob, b, tb, depth, c0, c1, f, t),
    run.box(`${name}_bk`, oa - TOWER_BACK_LAP, ob + TOWER_BACK_LAP, depth - back, depth,
      c0 - TOWER_BACK_LAP, c1 + TOWER_BACK_LAP, 'cabint', t),
  ]
  if (o.toe !== false) {
    out.push(toeBox(ctx, run, `${name}_toe`, u0 + tl, u1 - tr, { bottom: o.bottom ?? 0, height: o.z0 - (o.bottom ?? 0), depth, cabinet: o.cabinet }))
  }
  if (o.bounds) out.push(...insetEdges(ctx, run, name, o.bounds, o.openings, { a, b, cabinet: o.cabinet, fit }))
  return out
}

// ---------------------------------------------------------------------------
// L-shaped corner cabinets
// ---------------------------------------------------------------------------

/**
 * The two faces of an L-shaped corner cabinet standing in a `width` x `depth`
 * square on `run` (the wall line) from u0. The main leg runs along the wall,
 * `legDepth` deep; the return leg runs out from the wall at the `returnSide`
 * end, along the adjacent wall. Their faces meet at the inside corner.
 *
 * @returns {{ faceA: {run: Run, u0: number, u1: number}, faceB: {run: Run, u0: number, u1: number},
 *            toPlan: (u:number, v:number) => number[] }}
 *   faceA/faceB: runs whose v = 0 is each face (front = legDepth) and the span of the face on it;
 *   toPlan: square-frame (u along the run, v back from the square's front line) to plan.
 */
export function cornerFaces(run, u0, width, depth, legDepth, returnSide = 'left') {
  const sq = run.withFront(depth)
  const u1 = u0 + width
  const left = returnSide !== 'right'
  const faceA = { run: run.withFront(legDepth), u0: left ? u0 + legDepth : u0, u1: left ? u1 : u1 - legDepth }
  const [dx, dy] = [run.dx, run.dy]
  let runB
  if (left) {
    // carcass back on the adjacent wall (u = u0) at the leg's front end; the
    // face runs back toward the wall and faces the notch (+u)
    const [px, py] = sq.pt(u0, 0)
    runB = new Run(px, py, dy, -dx, dx, dy, 0, legDepth)
  } else {
    // carcass back on the adjacent wall (u = u1) at the inside corner; the face
    // runs out to the leg's front end and faces the notch (-u)
    const [px, py] = sq.pt(u1, depth - legDepth)
    runB = new Run(px, py, -dy, dx, -dx, -dy, 0, legDepth)
  }
  const faceB = { run: runB, u0: 0, u1: depth - legDepth }
  return { faceA, faceB, toPlan: (u, v) => sq.pt(u, v), left }
}

/**
 * Plan polygon of an L-shaped footprint, `setback` behind both faces, with the
 * leg ends pulled in by `inset`. Square frame: v = 0 is the front line of the
 * square, v = depth the wall.
 */
export function cornerPolygon(run, u0, width, depth, legDepth, returnSide, { setback = 0, inset = BOX_INSET } = {}) {
  const sq = run.withFront(depth)
  const u1 = u0 + width
  const vA = depth - legDepth + setback // the main face line
  let pts
  if (returnSide !== 'right') {
    const uB = u0 + legDepth - setback // the return face line
    pts = [[u0, depth], [u1 - inset, depth], [u1 - inset, vA], [uB, vA], [uB, inset], [u0, inset]]
  } else {
    const uB = u1 - legDepth + setback
    pts = [[u0 + inset, depth], [u1, depth], [u1, inset], [uB, inset], [uB, vA], [u0 + inset, vA]]
  }
  return pts.map(([u, v]) => sq.pt(u, v))
}

/** L-shaped carcass `${name}_box` and toe `${name}_toe` (no toe when `toe` is null). */
export function cornerCarcass(ctx, run, name, u0, width, depth, legDepth, returnSide, { z0, z1, toe, cabinet } = {}) {
  const fit = resolveFit(ctx)
  const out = []
  if (toe) {
    const st = ctx.standards
    const poly = cornerPolygon(run, u0, width, depth, legDepth, returnSide, { setback: toe.recess ?? st.toeRecess })
    out.push(prism(`${name}_toe`, poly, toe.bottom ?? 0, (toe.bottom ?? 0) + (toe.height ?? st.toeHeight), 'toe', tags('toe', cabinet)))
  }
  const poly = cornerPolygon(run, u0, width, depth, legDepth, returnSide, { setback: fit.carcassV })
  out.push(prism(`${name}_box`, poly, z0, z1, finishOf(ctx), tags('carcass', cabinet)))
  return out
}

/**
 * The run seen from behind: its v = 0 is `run`'s v = depth plane (the carcass
 * back), u runs the other way so that `run`'s [u0, u1] maps onto [u0, u1].
 * For finished backs (island and peninsula bases).
 */
export function backRun(run, u0, u1, depth) {
  const r = run.withFront(depth)
  const [ax, ay] = r.pt(u0 + u1, 0)
  return new Run(ax, ay, -r.dx, -r.dy, -r.nx, -r.ny, 0, depth)
}
