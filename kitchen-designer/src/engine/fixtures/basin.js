// Vanity basin, the hole it needs in the vanity top, and the vanity faucet.
// Same conventions as appliances/sink.js (sinkBowl, sinkCutout, faucet):
// plan coordinates, an optional rotation about the basin's own centre.
import { cylinder, tube } from '../core/part.js'
import { offsetPolygon } from '../core/polygon.js'
import { place, rotateAbout } from '../appliances/local.js'
import { ellipse, fixtureTags, pocketSolid, roundedRect, translate } from './shapes.js'

/** Floor to the top of a vanity carcass (the designer's vanity fixedHeight). */
export const VANITY_HEIGHT = 32

export const BASIN_DEFAULTS = { width: 17, length: 14, depth: 6, wall: 0.6, shape: 'rect' }
export const VANITY_FAUCET_DEFAULTS = { reach: 4.5, height: 5.5 }

/** z of the basin rim: the underside of the vanity top. */
const rimZ = (ctx, o) => o.z ?? ctx.standards.vanityHeight ?? VANITY_HEIGHT

/** Outer outline of the basin, centred on the origin, before rotation. */
function outline(o) {
  const W = o.width ?? BASIN_DEFAULTS.width
  const L = o.length ?? BASIN_DEFAULTS.length
  if ((o.shape ?? BASIN_DEFAULTS.shape) === 'oval') return ellipse(0, 0, W / 2, L / 2, 24)
  return roundedRect(-W / 2, -L / 2, W / 2, L / 2, Math.min(2.5, Math.min(W, L) / 4), 3)
}

const toPlan = (poly, o) => {
  const rot = rotateAbout(o.cx, o.cy, o.angle ?? 0)
  return translate(poly, o.cx, o.cy).map(([x, y]) => rot([x, y, 0]).slice(0, 2))
}

/**
 * Undermount vanity basin: one porcelain solid (rim, sloped bowl, floor) hung
 * under the top's cutout, its rim at the underside of the vanity top.
 *
 * @param {Object} o
 * @param {number} o.cx            centre, plan x
 * @param {number} o.cy            centre, plan y
 * @param {number} [o.width=17]    along x before rotation
 * @param {number} [o.length=14]   along y before rotation
 * @param {number} [o.depth=6]     rim to the underside
 * @param {number} [o.wall=0.6]    rim width the top laps onto
 * @param {'rect'|'oval'} [o.shape='rect']
 * @param {number} [o.angle=0]     degrees, clockwise seen from above
 * @param {number} [o.z]           rim height (default standards.vanityHeight ?? 32)
 * @param {string|number} [o.cabinet]
 */
export function basin(ctx, name = 'basin', o = {}) {
  const t = o.wall ?? BASIN_DEFAULTS.wall
  const top = rimZ(ctx, o)
  const zb = top - (o.depth ?? BASIN_DEFAULTS.depth)
  const outer = outline(o)
  const rim = offsetPolygon(outer, -t)
  const out = [
    pocketSolid(`${name}_bowl`, {
      outer,
      outerBot: offsetPolygon(outer, -1.0),
      rim,
      floor: offsetPolygon(rim, -1.5),
      z0: zb,
      zTop: top,
      zFloor: zb + t,
    }, 'porcelain'),
    cylinder(`${name}_drain`, 0, 0, zb + t + 0.04, 0.8, 0.2, 'chrome', 'Z', 16),
  ]
  const rot = rotateAbout(o.cx, o.cy, o.angle ?? 0)
  return place(out, ([x, y, z]) => rot([x + o.cx, y + o.cy, z]), fixtureTags(o))
}

/**
 * The holes a basin needs (like sinkCutout): `top` opens the vanity top (the
 * basin less its rim, so the top laps onto the rim) and `body` hollows a solid
 * carcass (the basin grown 0.06"). `topZ` / `bodyZ` are the z ranges to cut.
 *
 * @param {Object} o  same as basin
 * @returns {{ top: number[][], body: number[][], topZ: number[], bodyZ: number[] }}
 */
export function basinCutout(ctx, o = {}) {
  const t = o.wall ?? BASIN_DEFAULTS.wall
  const depth = o.depth ?? BASIN_DEFAULTS.depth
  const top = rimZ(ctx, o)
  const outer = outline(o)
  return {
    top: toPlan(offsetPolygon(outer, -t), o),
    body: toPlan(offsetPolygon(outer, 0.06), o),
    topZ: [top - 1.0, top + ctx.standards.counterThickness + 1.0],
    bodyZ: [top - depth - 1.5, top + 0.5],
  }
}

/**
 * Vanity faucet, a smaller sibling of the kitchen faucet: flange, riser, a
 * quarter bend into a level spout with a turned-down tip, and a side lever.
 * It stands on the vanity top (rim z + counterThickness unless `z` is given).
 *
 * @param {Object} o
 * @param {number} o.x
 * @param {number} o.y
 * @param {number} [o.angle=0]     direction the spout reaches, degrees: 0 = east (+x), 90 = south (+y)
 * @param {number} [o.reach=4.5]
 * @param {number} [o.height=5.5]  top of the vanity top to the top of the spout
 * @param {number} [o.z]           top of the vanity top
 * @param {string|number} [o.cabinet]
 */
export function vanityFaucet(ctx, name = 'vanity_faucet', o = {}) {
  const { x, y } = o
  const z0 = o.z ?? rimZ(ctx, {}) + ctx.standards.counterThickness
  const h = o.height ?? VANITY_FAUCET_DEFAULTS.height
  const reach = o.reach ?? VANITY_FAUCET_DEFAULTS.reach
  const r = 0.45
  const R = 1.6 // bend radius
  const zt = z0 + h - r // spout centre line
  const path = [[x, y, z0 - 0.05], [x, y, zt - R]]
  for (let i = 1; i <= 6; i += 1) {
    const a = (Math.PI / 2) * (i / 6)
    path.push([x + R - R * Math.cos(a), y, zt - R + R * Math.sin(a)])
  }
  path.push([x + reach - 0.5, y, zt], [x + reach - 0.1, y, zt - 0.25], [x + reach, y, zt - 0.9])
  const out = [
    cylinder(`${name}_flange`, x, y, z0 + 0.2, 1.1, 0.5, 'chrome', 'Z', 16),
    tube(`${name}_body`, path, r, 'chrome', { seg: 12 }),
    tube(`${name}_lever`, [[x, y - 0.3, zt - R - 1.2], [x + 0.25, y - 1.3, zt - R - 0.9], [x + 0.5, y - 2.3, zt - R - 0.4]], 0.2, 'chrome', { seg: 8 }),
  ]
  return place(out, rotateAbout(x, y, o.angle ?? 0), fixtureTags(o))
}
