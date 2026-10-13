// Two-piece elongated toilet: tank against the wall, bowl as stacked
// frustums of egg-shaped outlines (foot, pedestal, flare, rim), seat and
// closed lid, flush lever, and the supply stop on the wall.
import { cylinder, frustum, prism, tube } from '../core/part.js'
import { place, wallFrame } from '../appliances/local.js'
import { ellipse, fixtureTags, roundedRect } from './shapes.js'

/** The designer's toilet (src/constants/elementTypes.js). */
export const TOILET_DEFAULTS = { width: 20, depth: 28, height: 30 }

const N = 20 // sides of the bowl outlines
const EGG = 0.12

/**
 * Toilet standing against the run's wall, filling u0 .. u0 + width and
 * 0 .. depth out from the wall, 0 .. height up.
 *
 * @param {Object} [opts]
 * @param {number} [opts.width=20]
 * @param {number} [opts.depth=28]   wall to the front of the bowl
 * @param {number} [opts.height=30]  floor to the top of the tank lid
 * @param {string|number} [opts.cabinet]
 */
export function toilet(ctx, run, name = 'toilet', u0 = 0, opts = {}) {
  const W = opts.width ?? TOILET_DEFAULTS.width
  const D = opts.depth ?? TOILET_DEFAULTS.depth
  const H = opts.height ?? TOILET_DEFAULTS.height
  const uc = u0 + W / 2
  const P = 'porcelain'

  // tank and lid (the lid overlaps the tank top, so no two faces meet flush)
  const tw = Math.min(19, W - 1)
  const tY0 = 1.0
  const tY1 = Math.min(8.5, D * 0.32)
  const lidZ1 = H - 0.5
  const lidZ0 = lidZ1 - 1.0
  const tZ0 = 14.7
  const tZ1 = lidZ0 + 0.15

  // bowl: from just in front of the tank to 0.6" short of the footprint front
  const yb0 = tY1 + 0.4
  const yb1 = D - 0.6
  const cy = (yb0 + yb1) / 2
  const ry = (yb1 - yb0) / 2
  const rx = Math.min(7.2, (W - 1) / 2)
  const cyF = cy - 1.5 // the foot sits further back than the rim
  const egg = (dx, dy, c) => ellipse(uc, c, dx, dy, N, EGG)

  const rimZ = 15.1
  const seatZ0 = rimZ + 0.05
  const seatZ1 = seatZ0 + 0.75
  const lidB = seatZ1 + 0.05

  const leverU = uc - tw / 2 + 2.2
  const leverZ = tZ1 - 2.8
  const supplyU = uc - Math.min(6.5, tw / 2 - 1.5)

  const out = [
    prism(`${name}_tank`, roundedRect(uc - tw / 2, tY0, uc + tw / 2, tY1, 1.2, 2), tZ0, tZ1, P),
    prism(`${name}_tank_lid`, roundedRect(uc - tw / 2 - 0.3, tY0 - 0.3, uc + tw / 2 + 0.3, tY1 + 0.35, 1.4, 2), lidZ0, lidZ1, P),
    // bowl, bottom up; each piece starts a little inside the one below
    frustum(`${name}_foot`, egg(5.2, 7.2, cyF), egg(5.0, 7.0, cyF), 0, 0.5, P),
    frustum(`${name}_pedestal`, egg(4.8, 6.8, cyF), egg(4.3, 6.2, cyF + 0.5), 0.3, 9.0, P),
    frustum(`${name}_flare`, egg(4.3, 6.2, cyF + 0.5), egg(rx * 0.86, ry * 0.88, cy - 0.6), 8.8, 12.0, P),
    frustum(`${name}_bowl`, egg(rx * 0.86, ry * 0.88, cy - 0.6), egg(rx, ry, cy), 11.8, rimZ - 0.6, P),
    frustum(`${name}_rim`, egg(rx, ry, cy), egg(rx - 0.15, ry - 0.15, cy), rimZ - 0.7, rimZ, P),
    // rear of the bowl, carrying the tank
    prism(`${name}_deck`, roundedRect(uc - 5.5, tY0 + 1.0, uc + 5.5, cy, 2.0, 2), 9.0, tZ0 + 0.2, P),
    frustum(`${name}_seat`, egg(rx + 0.05, ry + 0.1, cy + 0.05), egg(rx - 0.05, ry, cy + 0.05), seatZ0, seatZ1, P),
    frustum(`${name}_lid`, egg(rx - 0.1, ry - 0.1, cy), egg(rx - 0.45, ry - 0.45, cy), lidB, lidB + 0.8, P),
    cylinder(`${name}_hinge`, uc - 2.8, yb0 + 0.9, seatZ0 + 0.55, 0.45, 1.1, P, 'Z', 12),
    cylinder(`${name}_hinge`, uc + 2.8, yb0 + 0.9, seatZ0 + 0.55, 0.45, 1.1, P, 'Z', 12),
    // flush lever on the tank's front left, pointing toward the middle
    cylinder(`${name}_lever_base`, leverU, tY1 + 0.15, leverZ, 0.7, 0.4, 'chrome', 'Y', 12),
    tube(`${name}_lever`, [[leverU, tY1 + 0.3, leverZ], [leverU + 1.3, tY1 + 0.45, leverZ - 0.05], [leverU + 2.6, tY1 + 0.5, leverZ - 0.2]], 0.2, 'chrome', { seg: 8 }),
    // angle stop on the wall and the supply up into the tank
    cylinder(`${name}_stop`, supplyU, 0.8, 7.0, 0.55, 1.5, 'chrome', 'Y', 12),
    tube(`${name}_supply`, [[supplyU, 1.4, 7.0], [supplyU, 2.2, 7.6], [supplyU, 2.2, tZ0 + 0.1]], 0.18, 'chrome', { seg: 8 }),
  ]
  return place(out, wallFrame(run), fixtureTags(opts))
}
