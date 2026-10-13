// Walk-in shower: a low pan with a curb and drain, frameless glass on the
// open sides (a fixed panel and a hinged door on the front), a shower head
// on a swept arm and a valve on the back wall, optional tiled wall panels.
import { cylinder, frustum, slab, tube } from '../core/part.js'
import { offsetPolygon } from '../core/polygon.js'
import { place, wallFrame } from '../appliances/local.js'
import { ellipse, fixtureTags, pocketSolid, roundedRect } from './shapes.js'

/** The designer's shower (src/constants/elementTypes.js). */
export const SHOWER_DEFAULTS = { width: 36, depth: 36, height: 80 }

const PAN_TOP = 4.0 // curb height
const PAN_FLOOR = 1.5
const CURB = 3.0 // curb width on an open side
const FLANGE = 0.75 // pan lip on a wall side
const GLASS_T = 0.375
const TILE_T = 0.5
const GAP = 0.25 // glass to wall, glass to glass

/**
 * Shower filling u0 .. u0 + width along the wall, 0 .. depth out from it,
 * 0 .. height up. The back (the run's wall) always carries the valve and head.
 *
 * @param {Object} [opts]
 * @param {number} [opts.width=36]
 * @param {number} [opts.depth=36]
 * @param {number} [opts.height=80]
 * @param {string[]} [opts.walls=['back','left','right']]  sides that have a wall; the other
 *                                   sides (of left, right, front) get glass
 * @param {boolean} [opts.tile=false]  draw tiled panels on the wall sides (normally the
 *                                   room's own walls are there already)
 * @param {'left'|'right'} [opts.hinge='right']  which end of the front the door hangs from
 * @param {number} [opts.valveHeight=48]
 * @param {number} [opts.headHeight=78]  height of the shower arm at the wall
 * @param {string|number} [opts.cabinet]
 */
export function shower(ctx, run, name = 'shower', u0 = 0, opts = {}) {
  const W = opts.width ?? SHOWER_DEFAULTS.width
  const D = opts.depth ?? SHOWER_DEFAULTS.depth
  const H = opts.height ?? SHOWER_DEFAULTS.height
  const u1 = u0 + W
  const walls = new Set(opts.walls ?? ['back', 'left', 'right'])
  walls.add('back')
  const has = (s) => walls.has(s)
  const tile = opts.tile === true
  const tT = (s) => (tile && has(s) ? TILE_T : 0)
  const out = []

  // pan: curb on the open sides, a narrow lip on the wall sides
  const inset = (s) => (has(s) ? FLANGE : CURB)
  const rim = roundedRect(u0 + inset('left'), inset('back'), u1 - inset('right'), D - inset('front'), 1.0, 2)
  out.push(pocketSolid(`${name}_pan`, {
    outer: [[u0, 0], [u1, 0], [u1, D], [u0, D]],
    rim,
    floor: offsetPolygon(rim, -0.5),
    z0: 0,
    zTop: PAN_TOP,
    zFloor: PAN_FLOOR,
  }, 'porcelain'))
  const fu = (u0 + inset('left') + u1 - inset('right')) / 2
  const fy = (inset('back') + D - inset('front')) / 2
  out.push(cylinder(`${name}_drain`, fu, fy, PAN_FLOOR + 0.04, 1.75, 0.2, 'chrome', 'Z', 16))

  // tiled panels, standing 0.5" down into the pan
  const tz0 = PAN_TOP - 0.5
  if (tile) {
    out.push(slab(`${name}_tile_back`, u0, u1, 0, TILE_T, tz0, H, 'tile'))
    if (has('left')) out.push(slab(`${name}_tile_left`, u0, u0 + TILE_T, TILE_T, D, tz0, H, 'tile'))
    if (has('right')) out.push(slab(`${name}_tile_right`, u1 - TILE_T, u1, TILE_T, D, tz0, H, 'tile'))
  }

  // glass
  const gTop = Math.min(76, H - 2)
  const pz0 = PAN_TOP + 0.1
  const dz0 = PAN_TOP + 0.4
  const g2 = GLASS_T / 2
  const yG = D - CURB / 2 // front glass centre line
  const uL = u0 + CURB / 2 // side glass centre lines
  const uR = u1 - CURB / 2
  const back = tT('back') + GAP

  const clip = (id, uc, y, z, alongU) => (alongU
    ? slab(`${name}_clip${id}`, uc - 0.8, uc + 0.8, y - 0.45, y + 0.45, z, z + 1.8, 'chrome')
    : slab(`${name}_clip${id}`, uc - 0.45, uc + 0.45, y - 0.8, y + 0.8, z, z + 1.8, 'chrome'))

  // side panels on open sides, fixed, clipped to the back wall
  for (const [side, uc] of [['left', uL], ['right', uR]]) {
    if (has(side)) continue
    const yEnd = has('front') ? D - tT('front') - GAP : yG - g2 - 0.05
    out.push(slab(`${name}_glass_${side}`, uc - g2, uc + g2, back, yEnd, pz0, gTop, 'shower_glass'))
    out.push(clip(`_${side}0`, uc, back + 1.0, pz0 + 6, false))
    out.push(clip(`_${side}1`, uc, back + 1.0, gTop - 7.8, false))
  }

  if (!has('front')) {
    // front glass runs between the walls, or over the ends of the side panels
    const a = has('left') ? u0 + tT('left') + GAP : uL - g2 - 0.02
    const b = has('right') ? u1 - tT('right') - GAP : uR + g2 + 0.02
    const len = b - a
    const doorW = len < 30 ? len : Math.min(24, len * 0.66)
    const hingeRight = opts.hinge !== 'left'
    const d0 = hingeRight ? b - doorW : a
    const d1 = hingeRight ? b : a + doorW
    out.push(slab(`${name}_door`, d0, d1, yG - g2, yG + g2, dz0, gTop, 'shower_glass'))
    if (len >= 30) {
      const p0 = hingeRight ? a : d1 + GAP
      const p1 = hingeRight ? d0 - GAP : b
      out.push(slab(`${name}_glass_front`, p0, p1, yG - g2, yG + g2, pz0, gTop, 'shower_glass'))
      const pc = hingeRight ? p0 + 1.0 : p1 - 1.0
      out.push(clip('_front0', pc, yG, pz0 + 6, true))
      out.push(clip('_front1', pc, yG, gTop - 7.8, true))
    }
    // hinges straddle the door's hinge edge; the handle is on its free edge
    const hu = hingeRight ? d1 : d0
    const hs = hingeRight ? -1 : 1
    for (const [k, z] of [[0, dz0 + 8], [1, gTop - 11]]) {
      const ha = hu + hs * 1.8
      out.push(slab(`${name}_hinge${k}`, Math.min(hu - hs * 0.2, ha), Math.max(hu - hs * 0.2, ha), yG - 0.55, yG + 0.55, z, z + 3, 'chrome'))
    }
    const hx = hingeRight ? d0 + 2.5 : d1 - 2.5
    const face = yG + g2
    const zh = dz0 + (gTop - dz0) * 0.5
    out.push(slab(`${name}_handle_s`, hx - 0.3, hx + 0.3, face - 0.1, face + 0.65, zh - 5, zh - 4.4, 'chrome'))
    out.push(slab(`${name}_handle_s`, hx - 0.3, hx + 0.3, face - 0.1, face + 0.65, zh + 4.4, zh + 5, 'chrome'))
    out.push(slab(`${name}_handle`, hx - 0.35, hx + 0.35, face + 0.6, face + 1.1, zh - 6, zh + 6, 'chrome'))
  }

  // valve and head on the back wall, centred
  const uc = u0 + W / 2
  const wy = tT('back')
  const zv = opts.valveHeight ?? 48
  out.push(cylinder(`${name}_valve_trim`, uc, wy + 0.2, zv, 3.25, 0.35, 'chrome', 'Y', 20))
  out.push(cylinder(`${name}_valve_hub`, uc, wy + 0.85, zv, 0.8, 1.1, 'chrome', 'Y', 12))
  out.push(tube(`${name}_valve_lever`, [[uc, wy + 1.3, zv], [uc + 1.4, wy + 1.9, zv + 0.1], [uc + 3.4, wy + 2.2, zv + 0.3]], 0.28, 'chrome', { seg: 8 }))
  const za = Math.min(opts.headHeight ?? 78, H - 1.5)
  const reach = Math.min(8, D / 3)
  const hy = wy + reach
  const zh = za - 1.4 // underside of the arm's drop
  out.push(cylinder(`${name}_arm_flange`, uc, wy + 0.2, za, 1.1, 0.35, 'chrome', 'Y', 16))
  out.push(tube(`${name}_arm`, [[uc, wy + 0.1, za], [uc, wy + reach * 0.55, za + 0.35], [uc, hy - 0.5, za - 0.1], [uc, hy, zh + 0.2]], 0.36, 'chrome', { seg: 10 }))
  out.push(frustum(`${name}_head`, ellipse(uc, hy, 3.0, 3.0, 20), ellipse(uc, hy, 0.9, 0.9, 20), zh - 1.1, zh + 0.3, 'chrome'))
  out.push(cylinder(`${name}_head_face`, uc, hy, zh - 1.2, 2.85, 0.3, 'chrome', 'Z', 20))

  return place(out, wallFrame(run), fixtureTags(opts))
}
