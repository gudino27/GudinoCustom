// Port of range_stove() in scripts/build_kitchen.py, plus the counter opening
// it needs.
import { cylinder, slab } from '../core/part.js'
import { applianceTags, place, wallFrame } from './local.js'

export const RANGE_DEFAULTS = { width: 36, depth: 24, clearance: 0.05 }

/** Grate sections (two burners each) for a range body `w` wide: 30" -> 2, 36" -> 3, 48" -> 4. */
export const rangeSections = (w) => (w < 33 ? 2 : w < 42 ? 3 : 4)

/**
 * Pro-style gas range standing in its opening: stainless body, oven door with
 * a window and a bar handle, knob panel, sealed burners under cast-iron grates
 * and a low backguard. It stands 1" proud of the cabinet doors.
 *
 * `u0`..`u1` is the OPENING (the gap the counter leaves); the body is that
 * less `clearance` (0.05") each side, or `width` wide centred in it. The
 * reference calls it with the opening 69..105 on the wall-1 base run.
 *
 * Run depth: drawn from the WALL plane. The body runs 1" .. 1 + depth out from
 * the wall (1..25 in the reference, i.e. 1" proud of a front = 24 base run);
 * with any other `front` the range stays put and only the cabinets move.
 * The cooking surface is `standards.baseHeight`.
 *
 * Burners, grates and knobs follow the width: 2 grate sections under 33",
 * 3 up to 42", 4 above, two burners and two knobs per section.
 *
 * @param {Object} [opts]
 * @param {number} [opts.width]           body width (default: the opening less the clearance)
 * @param {number} [opts.depth=24]        body depth
 * @param {number} [opts.clearance=0.05]
 * @param {string|number} [opts.cabinet]
 */
export function rangeStove(ctx, run, name = 'range', u0, u1, opts = {}) {
  const clearance = opts.clearance ?? RANGE_DEFAULTS.clearance
  const uc = (u0 + u1) / 2
  const w = opts.width ?? (u1 - u0 - 2 * clearance)
  const x0 = uc - w / 2
  const x1 = uc + w / 2
  const cx = (x0 + x1) / 2
  const yb = 1.0 // back of the body
  const yf = yb + (opts.depth ?? RANGE_DEFAULTS.depth) // front of the body
  const zd = ctx.standards.baseHeight // cooking surface
  const yd = yf + 1.8 // face of the oven door
  const out = [
    slab(`${name}_kick`, x0 + 0.4, x1 - 0.4, yf - 4.0, yf - 0.6, 0.3, 4.6, 'black'),
    slab(`${name}_body`, x0, x1, yb, yf, 4.6, zd, 'steel'),
    slab(`${name}_door`, x0 + 0.5, x1 - 0.5, yf, yd, 5.2, 28.8, 'steel'),
    // the window's back face is buried in the door, so nothing is coplanar
    slab(`${name}_window`, cx - (w / 2 - 6.95), cx + (w / 2 - 6.95), yd - 0.05, yd + 0.15, 10.5, 22.5, 'glassdk'),
    slab(`${name}_panel`, x0 + 0.5, x1 - 0.5, yf, yf + 1.2, 29.3, zd - 0.3, 'steel'),
    slab(`${name}_deck`, x0, x1, yb, yf + 0.2, zd, zd + 0.4, 'steel'),
    slab(`${name}_back`, x0, x1, 0.2, yb + 2.0, zd, zd + 4.5, 'steel'),
  ]
  // bar handle on two standoffs along the top of the oven door
  const hy = yd + 1.6
  out.push(cylinder(`${name}_handle`, cx, hy, 26.4, 0.55, x1 - x0 - 6.0, 'steel', 'X'))
  for (const sx of [x0 + 4.0, x1 - 4.0]) {
    out.push(cylinder(`${name}_standoff`, sx, (yd + hy) / 2, 26.4, 0.35, hy - yd + 0.1, 'steel', 'Y'))
  }
  const sections = opts.sections ?? rangeSections(w)
  // one knob per burner
  const knobs = 2 * sections
  for (let i = 0; i < knobs; i += 1) {
    out.push(cylinder(`${name}_knob`, cx + (i - (knobs - 1) / 2) * 5.6, yf + 1.75, 32.4, 1.0, 1.2, 'black', 'Y'))
  }

  // sealed burners, two per grate section
  const zt = zd + 0.4
  const pitch = (w - 1.1) / sections
  const half = pitch / 2 - 0.3
  for (let s = 0; s < sections; s += 1) {
    const gx = cx + (s - (sections - 1) / 2) * pitch
    for (const [by, r] of [[yb + 8.0, 1.7], [yb + 17.5, 2.1]]) {
      out.push(cylinder('burner_base', gx, by, zt + 0.1, r + 0.5, 0.2, 'iron'))
      out.push(cylinder('burner_cap', gx, by, zt + 0.38, r, 0.35, 'iron'))
    }
    // continuous cast-iron grate over the pair
    const gx0 = gx - half
    const gx1 = gx + half
    const gy0 = yb + 3.2
    const gy1 = yf - 1.2
    const zb0 = zt
    const zb1 = zt + 1.1 // grate tops level with a 1.5" counter
    for (let i = 0; i < 4; i += 1) { // bars running front to back
      const bx = gx0 + ((gx1 - gx0) * i) / 3.0
      out.push(slab('grate_b', bx - 0.28, bx + 0.28, gy0, gy1, zb0, zb1, 'iron'))
    }
    for (let j = 0; j < 3; j += 1) { // cross rails
      const by = gy0 + ((gy1 - gy0) * j) / 2.0
      out.push(slab('grate_c', gx0, gx1, by - 0.28, by + 0.28, zb0, zb1 - 0.25, 'iron'))
    }
  }
  return place(out, wallFrame(run), applianceTags(opts))
}

/**
 * The counter opening a slide-in range needs. The counter on a wall run stops
 * either side of it (the Python's w1_counter_l / w1_counter_r), so this is a
 * split, not a hole: counter builders end the run's top at `u0` and restart it
 * at `u1`. `polygon` is the plan rectangle of the gap, from the wall to past
 * the counter's front edge, for builders that work on plan polygons.
 *
 * @param {number} u0  left edge of the opening
 * @param {number} u1  right edge of the opening
 * @param {Object} [opts]
 * @param {number} [opts.overhang]  counter overhang past the door face (default standards.counterOverhang)
 * @returns {{ u0: number, u1: number, polygon: number[][], through: true }}
 */
export function rangeOpening(ctx, run, u0, u1, opts = {}) {
  const over = (opts.overhang ?? ctx.standards.counterOverhang) + 0.1
  return {
    u0,
    u1,
    polygon: [run.pt(u0, run.front), run.pt(u1, run.front), run.pt(u1, -over), run.pt(u0, -over)],
    through: true,
  }
}
