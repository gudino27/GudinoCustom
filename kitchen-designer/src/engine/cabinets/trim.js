// Trim that completes a wall run: crown and its soffit filler, light rail,
// fillers, toe kicks and end panels. Ports of crown() and light_rail() in
// scripts/build_kitchen.py, and of the fillers either side of wall 1's range
// opening and the fridge side panels (build_back_wall).
//
// Every function draws on a Run whose `front` is the depth of the cabinets it
// finishes (the Python passes the upper run for the uppers' crown, the deep
// run over the fridge, the base run for the oven tower): v = 0 is their door
// face, v = depth the wall.
import { finishOf, toeBox } from './carcass.js'

// crown: three steps, each projecting further (the Python's (0.7, 1.8, 3.0)),
// tucked 0.3" behind the door face
const CROWN_STEPS = [0.7, 1.8, 3.0]
const CROWN_TUCK = 0.3
const CROWN_DROP = 3.0 // crown starts this far below the cabinet tops
const LIGHT_RAIL_PROJ = 0.6
const LIGHT_RAIL_H = 1.0

const tags = (role, cabinet) => ({ tags: cabinet === undefined || cabinet === null ? { role } : { role, cabinet: String(cabinet) } })

/**
 * Three-step crown plus the soffit filler that closes the cabinet tops to the
 * ceiling (without it you see straight over the cabinet backs). Parts
 * `${name}_fill` (v 0..depth, zfill..ztop) and `${name}_c0.._c2`.
 * ctx.style.crown 'none' keeps only the filler.
 *
 * @param {Object} [o]
 * @param {number} [o.depth]  cabinet depth (default run.front)
 * @param {number} [o.ztop]   ceiling (default standards.ceiling)
 * @param {number} [o.zbot]   bottom of the crown (default: 3" under zfill)
 * @param {number} [o.zfill]  top of the cabinets, where the filler starts (default standards.upperTop)
 */
export function crown(ctx, run, name, u0, u1, { depth, ztop, zbot, zfill, cabinet } = {}) {
  const st = ctx.standards
  const d = depth ?? run.front
  const top = ztop ?? st.ceiling
  const zf = zfill ?? st.upperTop
  const zb = zbot ?? zf - CROWN_DROP
  const out = []
  if (top - zf > 1e-6) out.push(run.box(`${name}_fill`, u0, u1, 0, d, zf, top, finishOf(ctx), tags('crown', cabinet)))
  if (ctx.style?.crown === 'none') return out
  const h = (top - zb) / CROWN_STEPS.length
  CROWN_STEPS.forEach((proj, i) => {
    out.push(run.box(`${name}_c${i}`, u0 - proj, u1 + proj, -proj, CROWN_TUCK, zb + i * h, zb + (i + 1) * h,
      'trim', tags('crown', cabinet)))
  })
  return out
}

/** Light rail under the uppers: 1" tall, 0.6" proud of the doors, top at `z`. */
export function lightRail(ctx, run, name, u0, u1, { z, depth, cabinet } = {}) {
  const zz = z ?? ctx.standards.upperBottom
  return [run.box(name, u0, u1, -LIGHT_RAIL_PROJ, depth ?? run.front, zz - LIGHT_RAIL_H, zz, finishOf(ctx), tags('light-rail', cabinet))]
}

/** A toe kick `name` under a base (recessed by standards.toeRecess). */
export function toeKick(ctx, run, name, u0, u1, { depth, bottom = 0, height, recess, cabinet } = {}) {
  return [toeBox(ctx, run, name, u0, u1, { bottom, height, recess, depth, cabinet })]
}

/**
 * Filler strip flush with the door faces (wall 1's `w1_fill0` / `w1_fill1`
 * beside the range): a toe `${name}_toe` under a body `name`, both inset 0.04"
 * from u0/u1 like the boxes they sit between. `toe: false` for an upper or a
 * floating filler.
 */
export function filler(ctx, run, name, u0, u1, { bottom = 0, top, depth, toe = true, inset = 0.04, cabinet } = {}) {
  const st = ctx.standards
  const d = depth ?? run.front
  const z1 = top ?? st.baseHeight
  const out = []
  let z0 = bottom
  if (toe) {
    out.push(toeBox(ctx, run, `${name}_toe`, u0 + inset, u1 - inset, { bottom, depth: d, cabinet }))
    z0 = bottom + st.toeHeight
  }
  out.push(run.box(name, u0 + inset, u1 - inset, 0, d, z0, z1, finishOf(ctx), tags('filler', cabinet)))
  return out
}

/**
 * Finished end panel, flush with the door faces and down to the floor (the
 * fridge side panels `w1_fp_l` / `w1_fp_r`): one solid, v 0..depth.
 */
export function endPanel(ctx, run, name, u0, u1, { bottom = 0, top, depth, cabinet } = {}) {
  return [run.box(name, u0, u1, 0, depth ?? run.front, bottom, top ?? ctx.standards.upperTop, finishOf(ctx), tags('panel', cabinet))]
}
