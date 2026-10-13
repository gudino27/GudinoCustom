// Appliances and plumbing fixtures, and the dispatcher the run builders call.
import { dishwasher } from './dishwasher.js'
import { fridge, FRIDGE_DEFAULTS } from './fridge.js'
import { HOOD_DEFAULTS, rangeHood } from './hood.js'
import { MICROWAVE_DEFAULTS, microwave } from './microwave.js'
import { OVEN_DEFAULTS, ovenBottom, wallOvens } from './ovens.js'
import { RANGE_DEFAULTS, rangeOpening, rangeStove } from './range.js'
import { faucet, sinkBowl, sinkCutout, SINK_DEFAULTS } from './sink.js'
import { WINE_COOLER_DEFAULTS, wineCooler } from './wineCooler.js'

export { dishwasher } from './dishwasher.js'
export { fridge, FRIDGE_DEFAULTS } from './fridge.js'
export { HOOD_DEFAULTS, rangeHood } from './hood.js'
export { MICROWAVE_DEFAULTS, microwave } from './microwave.js'
export { OVEN_DEFAULTS, ovenBottom, wallOvens } from './ovens.js'
export { RANGE_DEFAULTS, rangeOpening, rangeSections, rangeStove } from './range.js'
export { FAUCET_DEFAULTS, faucet, sinkBowl, sinkCutout, SINK_DEFAULTS } from './sink.js'
export { WINE_COOLER_DEFAULTS, wineCooler } from './wineCooler.js'

/**
 * Engine appliance kinds, and the names the website designer
 * (src/constants/elementTypes.js) and other callers use for them.
 */
export const APPLIANCE_ALIASES = {
  fridge: 'fridge',
  refrigerator: 'fridge',
  range: 'range',
  stove: 'range',
  hood: 'hood',
  'range-hood': 'hood',
  rangeHood: 'hood',
  'wall-ovens': 'wall-ovens',
  wallOvens: 'wall-ovens',
  'double-oven': 'wall-ovens',
  oven: 'wall-ovens',
  dishwasher: 'dishwasher',
  microwave: 'microwave',
  'wine-cooler': 'wine-cooler',
  wineCooler: 'wine-cooler',
  sink: 'sink',
}

/** Default width along the run, per engine kind (the designer's defaults where it has one). */
export const APPLIANCE_WIDTHS = {
  fridge: 36,
  range: 36,
  hood: HOOD_DEFAULTS.width,
  'wall-ovens': 30,
  dishwasher: 24,
  microwave: MICROWAVE_DEFAULTS.width,
  'wine-cooler': WINE_COOLER_DEFAULTS.width,
  sink: 36,
}

export const applianceKind = (type) => APPLIANCE_ALIASES[type] || null
export const isApplianceType = (type) => applianceKind(type) !== null

/**
 * Build one appliance standing on `run` at `u0`.
 *
 * item = { no, type, width?, height?, depth?, bottom?, options? }
 *   width   the slot along the run (the appliance is centred in it)
 *   height  fridge height; microwave opening height; wall-oven cutout height
 *   bottom  microwave opening / wall-oven cutout bottom
 *   options passed through to the builder (see each function)
 *
 * Returns { parts, width, cutouts, counterGap }: `cutouts` are plan polygons
 * to cut from the counter (sinks), `counterGap` = { u0, u1 } where the counter
 * must stop and restart (slide-in ranges).
 */
export function buildAppliance(ctx, run, item, u0 = 0) {
  const kind = applianceKind(item.type)
  if (!kind) throw new Error(`buildAppliance: unknown appliance type "${item.type}"`)
  const width = item.width ?? APPLIANCE_WIDTHS[kind]
  const u1 = u0 + width
  const uc = (u0 + u1) / 2
  const opt = { ...(item.options || {}) }
  if (item.no !== undefined && opt.cabinet === undefined) opt.cabinet = item.no
  const name = item.name || opt.name
  let parts
  let cutouts = []
  let counterGap = null

  switch (kind) {
    case 'fridge': {
      // body 3/8" narrower than the slot (35.625 in a 36" slot), centred
      const w = opt.width ?? width - 0.375
      parts = fridge(ctx, run, name || 'fridge', uc - w / 2, {
        height: item.height ?? FRIDGE_DEFAULTS.height, ...opt, width: w,
      })
      break
    }
    case 'range': {
      parts = rangeStove(ctx, run, name || 'range', u0, u1, { depth: RANGE_DEFAULTS.depth, ...opt })
      counterGap = { u0, u1 }
      break
    }
    case 'hood':
      parts = rangeHood(ctx, run, name || 'hood', uc, { ...opt, width: opt.width ?? width })
      break
    case 'wall-ovens':
      parts = wallOvens(ctx, run, name || 'oven', u0, u1, {
        cutoutWidth: Math.min(OVEN_DEFAULTS.cutoutWidth, width - 1.5),
        cutoutHeight: item.height ?? OVEN_DEFAULTS.cutoutHeight,
        bottom: item.bottom ?? ovenBottom(ctx),
        ...opt,
      })
      break
    case 'dishwasher':
      parts = dishwasher(ctx, run, name || 'dishwasher', u0, u1, opt)
      break
    case 'microwave': {
      const z0 = item.bottom ?? MICROWAVE_DEFAULTS.bottom
      const z1 = z0 + (item.height ?? MICROWAVE_DEFAULTS.height)
      parts = microwave(ctx, run, name || 'microwave', u0, u1, z0, z1, opt)
      break
    }
    case 'wine-cooler':
      parts = wineCooler(ctx, run, name || 'wine', u0, u1, opt)
      break
    case 'sink': {
      // bowl centred in the slot, halfway between the wall and the counter edge,
      // its length along the run; faucet behind it, reaching toward the front
      const length = opt.length ?? Math.min(SINK_DEFAULTS.length, width - 3.0)
      const bw = opt.width ?? SINK_DEFAULTS.width
      const back = run.front > bw + 4 ? run.front : bw + 6
      const vc = (back - ctx.standards.counterOverhang) / 2
      const [cx, cy] = run.pt(uc, vc)
      const angle = (Math.atan2(run.ny, run.nx) * 180) / Math.PI
      const bowl = { ...opt, cx, cy, width: bw, length, angle }
      const [fx, fy] = run.pt(uc, Math.min(back - 1.5, vc + bw / 2 + 3.0))
      parts = [
        ...sinkBowl(ctx, name || 'sink', bowl),
        ...faucet(ctx, name ? `${name}_faucet` : 'faucet', {
          x: fx, y: fy, angle, reach: opt.reach, height: opt.faucetHeight, cabinet: opt.cabinet,
        }),
      ]
      cutouts = [sinkCutout(ctx, bowl).top]
      break
    }
    default:
      throw new Error(`buildAppliance: no builder for "${kind}"`)
  }
  return { parts, width, cutouts, counterGap }
}

/** Counter openings an appliance item needs, without building it. */
export function applianceOpenings(ctx, run, item, u0 = 0) {
  const kind = applianceKind(item.type)
  const width = item.width ?? APPLIANCE_WIDTHS[kind]
  if (kind === 'range') return rangeOpening(ctx, run, u0, u0 + width)
  return null
}
