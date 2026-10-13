// Bathroom fixtures, and the dispatcher the run and placement builders call.
import { BASIN_DEFAULTS, basin, basinCutout, VANITY_HEIGHT, vanityFaucet } from './basin.js'
import { BATHTUB_DEFAULTS, bathtub } from './bathtub.js'
import { SHOWER_DEFAULTS, shower } from './shower.js'
import { TOILET_DEFAULTS, toilet } from './toilet.js'

export { BASIN_DEFAULTS, basin, basinCutout, VANITY_FAUCET_DEFAULTS, VANITY_HEIGHT, vanityFaucet } from './basin.js'
export { BATHTUB_DEFAULTS, BATHTUB_TRIM_RISE, bathtub } from './bathtub.js'
export { FIXTURE_MATERIALS } from './materials.js'
export { SHOWER_DEFAULTS, shower } from './shower.js'
export { TOILET_DEFAULTS, toilet } from './toilet.js'

/** Engine fixture kinds, and the other names callers use for them. */
export const FIXTURE_ALIASES = {
  toilet: 'toilet',
  wc: 'toilet',
  bathtub: 'bathtub',
  tub: 'bathtub',
  bath: 'bathtub',
  shower: 'shower',
  basin: 'basin',
  lavatory: 'basin',
  'vanity-basin': 'basin',
}

/** Default footprint per kind (the designer's defaults where it has one). */
export const FIXTURE_SIZES = {
  toilet: TOILET_DEFAULTS,
  bathtub: BATHTUB_DEFAULTS,
  shower: SHOWER_DEFAULTS,
  basin: { width: 36, depth: 21, height: VANITY_HEIGHT }, // the designer's vanity-sink slot
}

/**
 * The fixture kind of an item: `item.kind`, `item.options.kind` (what
 * adapters/designerToJob emits: type 'fixture', options.kind 'toilet'), the
 * designer's own type, or `item.type`.
 */
export function fixtureKind(item = {}) {
  for (const k of [item.kind, item.options?.kind, item.designer?.type, item.type]) {
    if (k && FIXTURE_ALIASES[k]) return FIXTURE_ALIASES[k]
  }
  return null
}

export const isFixtureItem = (item) => fixtureKind(item) !== null

/**
 * Build one fixture standing on `run` at `u0`.
 *
 * item = { no | id, type | kind, width?, depth?, height?, options? }
 *   toilet / bathtub / shower  fill u0 .. u0 + width, 0 .. depth out from the wall
 *   basin    a vanity top's bowl(s) and faucet(s) centred in the slot; depth is
 *            the vanity's (default run.front), height the vanity carcass (rim z);
 *            options: { sinks = 1, shape, basinWidth, basinLength, basinDepth,
 *            overhang = 1, reach, faucetHeight }
 *   options  passed through to the builder (walls, tile, hinge, drain, ...)
 *
 * Returns { parts, width, cutouts }: `cutouts` are plan polygons to cut from
 * the vanity top (basins); tags.role = 'fixture', tags.cabinet = item.no ?? item.id.
 */
export function buildFixture(ctx, run, item, u0 = 0) {
  const kind = fixtureKind(item)
  if (!kind) throw new Error(`buildFixture: unknown fixture type "${item.kind || item.options?.kind || item.type}"`)
  const size = FIXTURE_SIZES[kind]
  const width = item.width ?? size.width
  const opt = { ...(item.options || {}) }
  delete opt.kind
  const cab = item.no ?? item.id
  if (cab !== undefined && cab !== null && opt.cabinet === undefined) opt.cabinet = cab
  const name = item.name || opt.name
  const dims = { width, depth: item.depth ?? size.depth, height: item.height ?? size.height }
  let parts
  let cutouts = []

  switch (kind) {
    case 'toilet':
      parts = toilet(ctx, run, name || 'toilet', u0, { ...opt, ...dims })
      break
    case 'bathtub':
      parts = bathtub(ctx, run, name || 'bathtub', u0, { ...opt, ...dims })
      break
    case 'shower':
      parts = shower(ctx, run, name || 'shower', u0, { ...opt, ...dims })
      break
    case 'basin': {
      // bowls along the slot, centred between the wall and the top's front
      // edge; each faucet behind its bowl, reaching toward the front
      const sinks = Math.max(1, Math.round(opt.sinks ?? 1))
      const D = item.depth ?? (run.front > 0 ? run.front : size.depth)
      const overhang = opt.overhang ?? 1.0
      const bay = width / sinks
      const bw = opt.basinWidth ?? Math.min(BASIN_DEFAULTS.width, bay - 4)
      const bl = opt.basinLength ?? Math.min(BASIN_DEFAULTS.length, D - 7)
      const z = opt.z ?? item.height ?? ctx.standards.vanityHeight ?? VANITY_HEIGHT
      const vc = (D - overhang) / 2 - 0.75
      const along = (Math.atan2(run.dy, run.dx) * 180) / Math.PI // basin width runs along the vanity
      const out = (Math.atan2(run.ny, run.nx) * 180) / Math.PI // toward the room
      parts = []
      for (let k = 0; k < sinks; k += 1) {
        const uc = u0 + bay * (k + 0.5)
        const suffix = sinks > 1 ? `${k}` : ''
        const bname = `${name || 'basin'}${suffix}`
        const [cx, cy] = run.pt(uc, vc)
        const bowl = {
          cx, cy, z, width: bw, length: bl, depth: opt.basinDepth, shape: opt.shape, angle: along, cabinet: opt.cabinet,
        }
        const [fx, fy] = run.pt(uc, Math.min(D - 1.5, vc + bl / 2 + 2.0))
        parts.push(
          ...basin(ctx, bname, bowl),
          ...vanityFaucet(ctx, `${bname}_faucet`, {
            x: fx, y: fy, angle: out, z: z + ctx.standards.counterThickness,
            reach: opt.reach, height: opt.faucetHeight, cabinet: opt.cabinet,
          }),
        )
        cutouts.push(basinCutout(ctx, bowl).top)
      }
      break
    }
    default:
      throw new Error(`buildFixture: no builder for "${kind}"`)
  }
  return { parts, width, cutouts }
}
