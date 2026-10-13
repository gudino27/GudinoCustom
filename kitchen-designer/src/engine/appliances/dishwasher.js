// Port of dishwasher() in scripts/build_kitchen.py.
import { slab } from '../core/part.js'
import { applianceTags, faceFrame, place } from './local.js'

/**
 * Dishwasher front (the reference: a 24" SHX78CM4N) with a bar handle. Only
 * the stainless door panel is modelled; it lines up with the cabinet fronts
 * either side (the same `reveal`), from 1" below the toe line to the top of
 * the base carcass.
 *
 * Run depth: drawn from the DOOR FACE (v = 0 .. 1.2), so it does not depend
 * on `front` at all. The reference passes island leg A (front 0, voff -0.63);
 * a wall base run (front 24) works the same.
 *
 * With `full`, the whole machine is built, for layouts where the dishwasher can be
 * seen from the side or stands at the end of a run (the website designer): the
 * tub behind the door, a control strip across the top of the door and a toe
 * plate below it. The reference kitchen leaves it off (flush between cabinets,
 * only the door shows), so its parts stay as they are.
 *
 * @param {Object} [opts]
 * @param {string|number} [opts.cabinet]
 * @param {boolean} [opts.full]  build the tub, control strip and toe plate
 * @param {number} [opts.depth]  overall depth from the door face (full only, default 23)
 */
export function dishwasher(ctx, run, name = 'dishwasher', u0, u1, opts = {}) {
  const { reveal, toeHeight, baseHeight } = ctx.standards
  const out = [
    slab(`${name}_body`, u0 + reveal, u1 - reveal, 0, 1.2, toeHeight - 1.0, baseHeight, 'steel_dk'),
    slab(`${name}_bar`, u0 + 2.0, u1 - 2.0, -1.4, -0.4, baseHeight - 3.4, baseHeight - 2.2, 'steel'),
  ]
  if (opts.full) {
    const depth = opts.depth ?? 23
    out.push(
      // controls: a dark strip proud of the door, above the handle
      slab(`${name}_controls`, u0 + reveal + 0.5, u1 - reveal - 0.5, -0.2, 0, baseHeight - 2.0, baseHeight - 0.4, 'black'),
      // the stainless tub behind the door, under the counter
      slab(`${name}_tub`, u0 + reveal, u1 - reveal, 1.2, depth, toeHeight - 1.0, baseHeight - 0.25, 'steel'),
      // toe plate, set back like a cabinet kick
      slab(`${name}_toe`, u0 + reveal, u1 - reveal, 2.0, 2.5, 0, toeHeight - 1.0, 'toe'),
    )
  }
  return place(out, faceFrame(run), applianceTags(opts))
}
