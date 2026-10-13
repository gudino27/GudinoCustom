// Port of wall_ovens() in scripts/build_kitchen.py.
import { slab } from '../core/part.js'
import { applianceTags, faceFrame, place } from './local.js'

export const OVEN_DEFAULTS = { cutoutWidth: 28.5, cutoutHeight: 51.0, face: 1.9 }

/** Bottom of the oven cutout: on the tower's bottom drawer (toe + 9). */
export const ovenBottom = (ctx) => ctx.standards.toeHeight + 9.0

/**
 * Double wall oven (the reference: a 30" HBL8642UC) set back into a tower's
 * cutout: body, two doors with dark windows and bar handles on standoffs, a
 * control strip and a display. A cutout under 36" high gets a single oven.
 *
 * `u0`..`u1` is the tower (the cabinet the oven is built into); the cutout is
 * centred in it. The oven face sits `face` (1.9") behind the door fronts, so
 * the cutout reads as a recess.
 *
 * Run depth: drawn from the DOOR FACE (v = 0) because it sits in a cabinet,
 * with the body's back 0.9" off the wall (v = run.front - 0.9). The reference
 * passes the wall-5 base run (front 24); a deeper or shallower tower keeps the
 * face where it is and changes only the body depth.
 *
 * @param {Object} [opts]
 * @param {number} [opts.cutoutWidth=28.5]
 * @param {number} [opts.cutoutHeight=51]
 * @param {number} [opts.bottom]           bottom of the cutout (default toeHeight + 9)
 * @param {number} [opts.face=1.9]
 * @param {string|number} [opts.cabinet]
 */
export function wallOvens(ctx, run, name = 'oven', u0, u1, opts = {}) {
  const cutW = opts.cutoutWidth ?? OVEN_DEFAULTS.cutoutWidth
  const cutH = opts.cutoutHeight ?? OVEN_DEFAULTS.cutoutHeight
  const uc = (u0 + u1) / 2
  const a = uc - cutW / 2 + 0.1 // clear of the cutout
  const b = uc + cutW / 2 - 0.1
  const z0 = opts.bottom ?? ovenBottom(ctx)
  const z1 = z0 + cutH
  const vf = opts.face ?? OVEN_DEFAULTS.face // oven face, back from the door fronts
  const vb = run.front - 0.9 // back of the body
  const zc = z1 - 5.0 // control strip above the upper door
  const doorsZ = cutH < 36
    ? [[z0 + 0.4, zc - 0.3]]
    : [[z0 + 0.4, z0 + 0.4 + (cutH * 23) / 51], [z0 + 1.0 + (cutH * 23) / 51, zc - 0.3]]
  const out = [slab(`${name}_body`, a, b, vf, vb, z0 + 0.1, z1 - 0.1, 'steel_dk')]
  doorsZ.forEach(([za, zb], k) => {
    out.push(slab(`${name}_door${k}`, a + 0.3, b - 0.3, vf - 0.5, vf, za, zb, 'steel_dk'))
    out.push(slab(`${name}_gl${k}`, a + 3.0, b - 3.0, vf - 0.62, vf - 0.45, za + 3.5, zb - 5.0, 'glassdk'))
    // bar handle on two standoffs across the top of each door
    out.push(slab(`${name}_hd${k}`, a + 2.0, b - 2.0, vf - 2.3, vf - 1.4, zb - 2.6, zb - 1.6, 'steel'))
    for (const du of [a + 3.0, b - 3.0]) {
      out.push(slab(`${name}_hs${k}`, du - 0.3, du + 0.3, vf - 1.45, vf - 0.45, zb - 2.4, zb - 1.8, 'steel'))
    }
  })
  out.push(slab(`${name}_ctl`, a + 0.3, b - 0.3, vf - 0.35, vf, zc, z1 - 0.4, 'steel_dk'))
  out.push(slab(`${name}_disp`, uc - 4.0, uc + 4.0, vf - 0.45, vf - 0.3, zc + 1.2, z1 - 1.6, 'glass'))
  return place(out, faceFrame(run), applianceTags(opts))
}
