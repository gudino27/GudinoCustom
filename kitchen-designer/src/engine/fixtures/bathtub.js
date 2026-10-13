// Alcove bathtub: apron and deck as one solid with a rounded basin pocket,
// drain and overflow at one end, and the spout and valve on that end wall.
import { cylinder, tube } from '../core/part.js'
import { offsetPolygon } from '../core/polygon.js'
import { place, wallFrame } from '../appliances/local.js'
import { fixtureTags, pocketSolid, roundedRect, translate } from './shapes.js'

/** The designer's bathtub (src/constants/elementTypes.js). */
export const BATHTUB_DEFAULTS = { width: 60, depth: 30, height: 20 }

/** How far the spout and valve rise above the tub's `height` on the end wall. */
export const BATHTUB_TRIM_RISE = 14

/**
 * Alcove tub filling u0 .. u0 + width along the wall, 0 .. depth out from it,
 * 0 .. height up. The spout and valve are on the drain end's wall (the room
 * wall at u0, or at u0 + width with `drain: 'right'`), rising up to
 * height + BATHTUB_TRIM_RISE; everything else stays under `height`.
 *
 * @param {Object} [opts]
 * @param {number} [opts.width=60]
 * @param {number} [opts.depth=30]
 * @param {number} [opts.height=20]
 * @param {'left'|'right'} [opts.drain='left']  end with the drain, spout and valve
 * @param {string|number} [opts.cabinet]
 */
export function bathtub(ctx, run, name = 'bathtub', u0 = 0, opts = {}) {
  const W = opts.width ?? BATHTUB_DEFAULTS.width
  const D = opts.depth ?? BATHTUB_DEFAULTS.depth
  const H = opts.height ?? BATHTUB_DEFAULTS.height
  const right = opts.drain === 'right'

  // Drawn with the drain at u0; mirrored for a right-hand drain.
  const deckBack = 3.0
  const deckFront = 3.5
  const deckEnd = 3.5
  const ru0 = u0 + deckEnd
  const ru1 = u0 + W - deckEnd
  const rimD = D - deckBack - deckFront
  const rim = roundedRect(ru0, deckBack, ru1, D - deckFront, Math.min(6, rimD / 2 - 1), 5)
  const slope = 3.0
  const shift = 1.5 // floor sits toward the drain end: that end wall is steeper
  const floor = translate(offsetPolygon(rim, -slope), -shift, 0)
  const zFloor = Math.max(2, H - 16.5)
  const yc = deckBack + rimD / 2

  // the drain end's pocket wall, where it passes height z
  const endWallU = (z) => {
    const uF = ru0 + slope - shift
    return uF + ((ru0 - uF) * (z - zFloor)) / (H - zFloor)
  }
  const zOver = zFloor + (H - zFloor) * 0.62
  const zSpout = H + 5
  const zValve = H + 10

  const out = [
    pocketSolid(`${name}_body`, {
      outer: [[u0, 0], [u0 + W, 0], [u0 + W, D], [u0, D]],
      rim,
      floor,
      z0: 0,
      zTop: H,
      zFloor,
    }, 'porcelain'),
    cylinder(`${name}_drain`, ru0 + slope - shift + 3.5, yc, zFloor + 0.05, 1.6, 0.25, 'chrome', 'Z', 16),
    cylinder(`${name}_overflow`, endWallU(zOver) + 0.25, yc, zOver, 1.4, 0.5, 'chrome', 'X', 16),
    // spout off the end wall, over the deck into the basin
    cylinder(`${name}_spout_flange`, u0 + 0.3, yc, zSpout, 1.2, 0.5, 'chrome', 'X', 16),
    tube(`${name}_spout`, [[u0 + 0.1, yc, zSpout], [u0 + 4.2, yc, zSpout], [u0 + 5.4, yc, zSpout - 0.9]], 0.6, 'chrome', { seg: 12 }),
    // single-lever valve
    cylinder(`${name}_valve_trim`, u0 + 0.22, yc, zValve, 3.25, 0.35, 'chrome', 'X', 20),
    cylinder(`${name}_valve_hub`, u0 + 0.9, yc, zValve, 0.8, 1.2, 'chrome', 'X', 12),
    tube(`${name}_valve_lever`, [[u0 + 1.3, yc, zValve], [u0 + 1.9, yc + 1.4, zValve + 0.1], [u0 + 2.2, yc + 3.4, zValve + 0.3]], 0.28, 'chrome', { seg: 8 }),
  ]
  const wall = wallFrame(run)
  const map = right ? ([u, y, z]) => wall([2 * u0 + W - u, y, z]) : wall
  return place(out, map, fixtureTags(opts))
}
