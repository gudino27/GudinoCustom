// Built-in microwave. New: not in the reference kitchen.
import { slab } from '../core/part.js'
import { applianceTags, faceFrame, place } from './local.js'

export const MICROWAVE_DEFAULTS = { width: 30, height: 18, bottom: 54, depth: 15, face: 0.9, control: 4.6 }

/**
 * Built-in microwave in a tall or upper cabinet opening `u0..u1` x `z0..z1`,
 * in the wall ovens' language: dark stainless body set back `face` (0.9")
 * from the door fronts, a door with a dark window, a vertical bar handle on
 * two standoffs, and a control strip with a display on the right.
 *
 * Parts: `_body`, `_door`, `_window`, `_hd` (handle bar), `_hs` x2 (standoffs),
 * `_ctl` (control strip), `_disp` (display).
 *
 * Run depth: drawn from the DOOR FACE; the body goes back to 0.9" off the
 * wall (v = run.front - 0.9), or `depth` deep when given or when the run has
 * no depth (an island run, front 0). An upper run (front 12) or a tall run
 * (front 24) both work.
 *
 * @param {Object} [opts]
 * @param {number} [opts.depth]           body depth (default: to 0.9" off the wall)
 * @param {number} [opts.face=0.9]        set-back of the body face
 * @param {string|number} [opts.cabinet]
 */
export function microwave(ctx, run, name = 'microwave', u0, u1, z0, z1, opts = {}) {
  const vf = opts.face ?? MICROWAVE_DEFAULTS.face
  const a = u0 + 0.1 // clear of the opening
  const b = u1 - 0.1
  const za = z0 + 0.1
  const zb = z1 - 0.1
  const depth = opts.depth ?? (run.front > vf + 6 ? run.front - 0.9 - vf : MICROWAVE_DEFAULTS.depth)
  const ctlW = Math.min(MICROWAVE_DEFAULTS.control, (b - a) * 0.2)
  const doorA = a + 0.3
  const doorB = b - 0.3 - ctlW - 0.3 // door stops short of the control strip
  const dz0 = za + 0.3
  const dz1 = zb - 0.3
  const inset = Math.min(2.0, (doorB - doorA) / 6, (dz1 - dz0) / 6)
  const hu = doorB - 1.4 // handle, near the door's free edge
  const hz0 = dz0 + Math.min(2.0, (dz1 - dz0) / 6)
  const hz1 = dz1 - Math.min(2.0, (dz1 - dz0) / 6)
  const out = [
    slab(`${name}_body`, a, b, vf, vf + depth, za, zb, 'steel_dk'),
    slab(`${name}_door`, doorA, doorB, vf - 0.5, vf, dz0, dz1, 'steel_dk'),
    // the window's back face is buried in the door
    slab(`${name}_window`, doorA + inset, doorB - inset - 2.0, vf - 0.62, vf - 0.45, dz0 + inset, dz1 - inset, 'glassdk'),
    slab(`${name}_hd`, hu - 0.3, hu + 0.3, vf - 2.3, vf - 1.4, hz0, hz1, 'steel'),
  ]
  for (const hz of [hz0 + 0.6, hz1 - 0.6]) {
    out.push(slab(`${name}_hs`, hu - 0.2, hu + 0.2, vf - 1.45, vf - 0.45, hz - 0.3, hz + 0.3, 'steel'))
  }
  // control strip right of the door, its face between the door's and the body's
  out.push(slab(`${name}_ctl`, doorB + 0.3, b - 0.3, vf - 0.35, vf, dz0, dz1, 'steel_dk'))
  out.push(slab(`${name}_disp`, doorB + 0.8, b - 0.8, vf - 0.45, vf - 0.3, dz1 - Math.min(3.5, (dz1 - dz0) / 3), dz1 - 1.0, 'glass'))
  return place(out, faceFrame(run), applianceTags(opts))
}
