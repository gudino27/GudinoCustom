// The orchestrator: a Job in, every part of it out, tagged for the scroll
// build (static, step, group, zone) and for selection (cabinet).
//
//   buildJob(job, { zones }) -> { parts, steps, ctx, notes }
//
// Order: the room (static, step 0), each wall run in job.runs order, each
// island, then the free placements the designer moves one by one (zone
// 'placed', one step each). Step numbers run 1..n across the whole job; a
// builder entry with `sameStep: true` shares the previous entry's number.
import { Run } from './core/run.js'
import { itemCtx, jobCtx } from './model/context.js'
import { applianceKind, buildAppliance } from './appliances/index.js'
import { buildCabinet, isCabinetType } from './cabinets/catalog.js'
import { counterPolygon, counterRun } from './cabinets/counter.js'
import { buildWallRun } from './cabinets/wallRun.js'
import { buildFixture, fixtureKind } from './fixtures/index.js'
import { buildIsland } from './island/index.js'
import { buildRoom } from './room/index.js'

export const ROOM_ZONE = 'room'
export const ISLAND_ZONE = 'island'
export const PLACED_ZONE = 'placed'

// placed appliances that stand under a counter, so get their own piece of it
const COUNTER_APPLIANCES = new Set(['dishwasher', 'wine-cooler', 'sink'])
const LEVEL_GROUPS = new Set(['base', 'upper', 'tall'])

const positive = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}
const finite = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : undefined
}
const str = (v) => (v === undefined || v === null ? null : String(v))

/**
 * @typedef {Object} BuildStep  one group of one build step
 * @property {number} step
 * @property {string} zone
 * @property {string} group
 * @property {string|null} cabinet
 * @property {number} count     parts in it
 */

/**
 * Build a whole job.
 *
 * @param {Object} job  { units, room, standards, style, construction, runs, islands, placements }
 * @param {Object} [options]
 * @param {string[]} [options.zones]  build only these zones ('room', a run's zone, 'island',
 *   'placed'). Step numbers stay those of the whole job, so zones built separately merge.
 * @returns {{ parts: import('./core/part.js').Part[], steps: BuildStep[], ctx: Object, notes: string[] }}
 */
export function buildJob(job = {}, options = {}) {
  const ctx = jobCtx(job)
  const want = options.zones ? new Set(options.zones) : null
  const keep = (zone) => !want || want.has(zone)
  const parts = []
  const steps = []
  const notes = []
  let step = 0

  const add = (entry, n, zone, fallbackCabinet, force) => {
    const cabinet = str(entry.cabinet)
    const tagCabinet = force ?? cabinet ?? fallbackCabinet
    for (const p of entry.parts) {
      Object.assign(p.tags, { static: false, step: n, group: entry.group, zone })
      if (force !== undefined || (p.tags.cabinet === undefined && tagCabinet !== null)) p.tags.cabinet = tagCabinet
    }
    parts.push(...entry.parts)
    steps.push({ step: n, zone, group: entry.group, cabinet: force ?? cabinet, count: entry.parts.length })
  }

  /** Number builder entries (runs, islands); build only when the zone is wanted. */
  const emit = (entries, zone, fallbackCabinet) => {
    for (const e of entries) {
      if (!e.parts || e.parts.length === 0) continue
      if (!e.sameStep || step === 0) step += 1
      if (keep(zone)) add(e, step, zone, fallbackCabinet)
    }
  }

  // the room shell
  if (job.room && keep(ROOM_ZONE)) {
    const room = buildRoom(ctx, job.room)
    for (const p of room) Object.assign(p.tags, { static: true, step: 0, group: 'room', zone: ROOM_ZONE })
    parts.push(...room)
    steps.push({ step: 0, zone: ROOM_ZONE, group: 'room', cabinet: null, count: room.length })
  }

  // wall runs: counters and trim belong to the run (tags.cabinet = its id)
  for (const [i, spec] of (job.runs || []).entries()) {
    const zone = spec.zone ?? spec.id ?? `run${i}`
    emit(buildWallRun(ctx, spec), zone, str(spec.id ?? zone))
  }

  for (const island of job.islands || []) {
    const zone = island.zone ?? ISLAND_ZONE
    emit(buildIsland(ctx, island), zone, str(island.id ?? zone))
  }

  // free placements: one step each, every part tagged with the placement's id
  for (const [i, placement] of (job.placements || []).entries()) {
    step += 1
    if (!keep(PLACED_ZONE)) continue
    const id = String(placement.id ?? `placement${i}`)
    for (const e of buildPlacement(ctx, placement, id, notes)) {
      if (e.parts.length) add(e, step, PLACED_ZONE, id, id)
    }
  }

  return { parts, steps, ctx, notes }
}

// ---------------------------------------------------------------------------
// placements
// ---------------------------------------------------------------------------

/**
 * One free-standing item -> build entries [{ group, parts }], all one step.
 * Never throws: an unknown type, or a builder that fails, becomes a plain box
 * of the placement's size and a line in `notes`.
 */
export function buildPlacement(ctx, placement, id = String(placement.id), notes = []) {
  const p = placement
  const type = p.type
  try {
    if (isCabinetType(type)) return placeCabinet(ctx, p, id)
    if (applianceKind(type)) return placeAppliance(ctx, p, id)
    if (fixtureKind(p)) return placeFixture(ctx, p, id)
  } catch (err) {
    notes.push(`placement ${id} (${type}): ${err.message}; built as a plain box`)
    return [placeholder(ctx, p, id)]
  }
  const kind = type === 'fixture' ? p.options?.kind ?? p.kind : null
  notes.push(`placement ${id}: unknown type "${kind ?? type}"; built as a plain box`)
  return [placeholder(ctx, p, id)]
}

const placementRun = (p, width, depth) => Run.fromPlacement(p.at || [0, 0], finite(p.angle) ?? 0, width || 1, depth)

function placeCabinet(ctx0, p, id) {
  const item = {
    no: id,
    type: p.type,
    name: p.name,
    width: positive(p.width),
    depth: positive(p.depth),
    height: positive(p.height),
    bottom: finite(p.bottom),
    level: p.level,
    options: p.options,
    construction: p.construction,
    style: p.style,
    standards: p.standards,
  }
  const ctx = itemCtx(ctx0, item)
  const run = placementRun(p, item.width, item.depth ?? 0)
  const cab = buildCabinet(ctx0, run, item, 0)
  const apps = cab.appliances.map((a) => {
    const actx = a.top === undefined ? ctx : { ...ctx, standards: { ...ctx.standards, baseHeight: a.top } }
    return { ...a, ...buildAppliance(actx, run.withFront(a.depth), a.item, a.u0) }
  })

  const out = []
  for (const a of apps.filter((x) => x.first)) out.push({ group: 'appliance', parts: a.parts })
  for (const g of cab.groups) out.push({ group: g.group, parts: g.parts })
  if (cab.counter) out.push({ group: 'counter', parts: placedCounter(ctx, run, cab, apps, id) })
  for (const a of apps.filter((x) => !x.first)) out.push({ group: 'appliance', parts: a.parts })
  return out
}

/**
 * A placed cabinet's own counter: its width, from the wall to the standard
 * overhang in front of the doors, no end overhangs (neighbours butt), with the
 * openings its sinks need, plus a corner cabinet's return leg.
 */
function placedCounter(ctx, run, cab, apps, id) {
  const cutouts = apps.flatMap((a) => a.cutouts || [])
  const gaps = apps.map((a) => a.counterGap).filter(Boolean)
  const name = `${cab.name}_counter`
  const parts = counterRun(ctx, run.withFront(cab.counterDepth), name, 0, cab.width, {
    z: cab.top, cutouts, gaps, cabinet: id,
  })
  for (const poly of cab.counterPolygons) {
    const pname = poly.name === name ? `${name}_return` : poly.name
    parts.push(...counterPolygon(ctx, pname, poly.polygon, { z: cab.top, cutouts, cabinet: id }))
  }
  return parts
}

function placeAppliance(ctx0, p, id) {
  const kind = applianceKind(p.type)
  const ctx = itemCtx(ctx0, p)
  const depth = positive(p.depth) ?? ctx.standards.baseDepth
  const item = {
    no: id,
    type: p.type,
    name: p.name ?? `${kind}${id}`,
    width: positive(p.width),
    height: positive(p.height),
    bottom: finite(p.bottom),
    options: p.options,
  }
  if (kind === 'fridge' || kind === 'range' || kind === 'dishwasher' || kind === 'wine-cooler' || kind === 'sink') {
    // these stand on the floor (or the counter's cabinet); bottom is not theirs to set
    delete item.bottom
  }
  const run = placementRun(p, item.width, depth)
  const built = buildAppliance(ctx, run, item, 0)
  const out = [{ group: 'appliance', parts: built.parts }]
  if (COUNTER_APPLIANCES.has(kind)) {
    // an under-counter appliance placed alone still wants the counter over it
    const counter = counterRun(ctx, run, `${item.name}_counter`, 0, built.width, {
      cutouts: built.cutouts, cabinet: id,
    })
    // as on a wall run: the counter over a dishwasher, a sink dropped into the counter
    if (kind === 'sink') out.unshift({ group: 'counter', parts: counter })
    else out.push({ group: 'counter', parts: counter })
  }
  return out
}

function placeFixture(ctx0, p, id) {
  const ctx = itemCtx(ctx0, p)
  const kind = fixtureKind(p)
  const item = {
    no: id,
    kind,
    type: p.type,
    name: p.name ?? `${kind}${id}`,
    width: positive(p.width),
    depth: positive(p.depth),
    height: positive(p.height),
    options: p.options,
  }
  const run = placementRun(p, item.width, item.depth ?? 0)
  return [{ group: 'appliance', parts: buildFixture(ctx, run, item, 0).parts }]
}

/** A plain box of the placement's size, so nothing the customer placed goes missing. */
function placeholder(ctx, p, id) {
  const st = ctx.standards
  const level = LEVEL_GROUPS.has(p.level) ? p.level : 'base'
  const width = positive(p.width) ?? 24
  const depth = positive(p.depth) ?? (level === 'upper' ? st.upperDepth : st.baseDepth)
  const bottom = Math.max(0, finite(p.bottom) ?? (level === 'upper' ? st.upperBottom : 0))
  const height = positive(p.height) ?? (level === 'upper' ? st.upperTop - st.upperBottom : st.baseHeight)
  const run = placementRun(p, width, depth)
  const box = run.box(p.name ?? `placed${id}`, 0, width, 0, depth, bottom, bottom + height, 'paint', {
    tags: { role: 'placeholder', cabinet: id },
  })
  return { group: level, parts: [box] }
}
