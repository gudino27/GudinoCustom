// Under-counter wine cooler. New: not in the reference kitchen.
import { slab } from '../core/part.js'
import { applianceTags, faceFrame, place } from './local.js'

export const WINE_COOLER_DEFAULTS = { width: 24, depth: 22.6, stile: 1.6 }

/**
 * Under-counter wine cooler between base cabinets `u0..u1`: dark stainless
 * body, a stainless-framed dark glass door lined up with the neighbouring
 * fronts (same `reveal`), a vertical bar handle on two standoffs and a black
 * toe grille. It stops 0.25" under the counter (baseHeight - 0.25).
 *
 * Parts: `_body`, `_r0` `_r1` (door rails), `_s0` `_s1` (door stiles), `_glass`,
 * `_hd` (handle bar), `_hs` x2 (standoffs), `_grille`.
 *
 * Run depth: drawn from the DOOR FACE. The door is v 0 .. 0.8 like a cabinet
 * front, the body behind it runs back to 0.5" off the wall (v = run.front -
 * 0.5), or `depth` deep when given or when the run has no depth (front 0).
 *
 * @param {Object} [opts]
 * @param {number} [opts.depth]
 * @param {number} [opts.height]   top of the unit (default baseHeight - 0.25)
 * @param {'left'|'right'} [opts.hinge='left']  the handle goes on the other side
 * @param {string|number} [opts.cabinet]
 */
export function wineCooler(ctx, run, name = 'wine', u0, u1, opts = {}) {
  const { reveal, toeHeight, baseHeight } = ctx.standards
  const a = u0 + reveal
  const b = u1 - reveal
  const zTop = opts.height ?? baseHeight - 0.25
  const vd = 0.8 // back of the door
  const depth = opts.depth ?? (run.front > 6 ? run.front - 0.5 - vd : WINE_COOLER_DEFAULTS.depth)
  const s = Math.min(WINE_COOLER_DEFAULTS.stile, (b - a) / 6)
  const dz0 = toeHeight + reveal // door bottom sits on the toe line like the fronts
  const dz1 = zTop
  const hu = opts.hinge === 'right' ? a + s / 2 : b - s / 2 // centred on the stile
  const hz0 = dz0 + (dz1 - dz0) * 0.3
  const hz1 = dz1 - 2.5
  const out = [
    slab(`${name}_body`, a, b, vd, vd + depth, 0.5, zTop, 'steel_dk'),
    slab(`${name}_r0`, a, b, 0, vd, dz0, dz0 + s, 'steel'),
    slab(`${name}_r1`, a, b, 0, vd, dz1 - s, dz1, 'steel'),
    slab(`${name}_s0`, a, a + s, 0, vd, dz0 + s, dz1 - s, 'steel'),
    slab(`${name}_s1`, b - s, b, 0, vd, dz0 + s, dz1 - s, 'steel'),
    // pane laps 0.2" into the frame, its faces inside the frame's thickness
    slab(`${name}_glass`, a + s - 0.2, b - s + 0.2, 0.25, 0.6, dz0 + s - 0.2, dz1 - s + 0.2, 'glassdk'),
    slab(`${name}_hd`, hu - 0.3, hu + 0.3, -1.45, -0.55, hz0, hz1, 'steel'),
  ]
  for (const hz of [hz0 + 0.35, hz1 - 0.35]) {
    out.push(slab(`${name}_hs`, hu - 0.2, hu + 0.2, -0.6, 0.05, hz - 0.2, hz + 0.2, 'steel'))
  }
  // toe grille under the door, its back buried in the body
  out.push(slab(`${name}_grille`, a + 0.5, b - 0.5, 0.4, vd + 0.05, 0.9, dz0 - 0.4, 'black'))
  return place(out, faceFrame(run), applianceTags(opts))
}
