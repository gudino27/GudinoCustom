// One wall of cabinets, start to finish: the port of build_back_wall and
// build_right_wall in scripts/build_kitchen.py, driven by data.
//
// buildWallRun lays the items out along the run (bases on the floor, uppers
// over them, talls through both), builds each through the catalog or the
// appliances, adds the counter over the items that take one (split at ranges,
// cut for sinks), crown along the uppers and talls (stepping with their depth)
// and light rail under the uppers, and returns the parts in build order.
import { Run, runBetween } from '../core/run.js'
import { itemCtx } from '../model/context.js'
import { APPLIANCE_WIDTHS, applianceKind, buildAppliance } from '../appliances/index.js'
import { buildCabinet, cabinetDims, CATALOG, isCabinetType, levelDims } from './catalog.js'
import { counterPolygon, counterRun } from './counter.js'
import { crown, lightRail } from './trim.js'

const EPS = 1e-6

/** Where an appliance stands unless the item says `level`. */
export const APPLIANCE_LEVELS = {
  fridge: 'tall',
  'wall-ovens': 'tall',
  range: 'base',
  dishwasher: 'base',
  'wine-cooler': 'base',
  sink: 'base',
  hood: 'upper',
  microwave: 'upper',
}
// built with the bases, the counter runs over them
const UNDER_COUNTER = new Set(['dishwasher', 'wine-cooler'])
// built after the counter; the counter stops for a range and is cut for a sink
const IN_COUNTER = new Set(['range', 'sink'])
// upper-level appliances the crown runs over (the hood's surround is cabinetry)
const CROWNED = new Set(['hood'])

/**
 * @typedef {Object} RunSpec  one wall of cabinets
 * @property {string} [id]
 * @property {string} [zone]        which zone the orchestrator tags it with (back, right, ...)
 * @property {string} [prefix]      name prefix (default id): `${prefix}b1`, `${prefix}_counter`, `${prefix}_crown`
 * @property {number[]} [from]      plan point on the wall where the run starts ...
 * @property {number[]} [to]        ... and where it heads
 * @property {number[]} [normal]    into the room (default: the right-hand side of from->to, i.e. south for east)
 * @property {number[]} [origin]    alternatively the job model's origin + angle (Run.fromPlacement)
 * @property {number} [angle]
 * @property {Run} [run]            or a Run whose (ax, ay) is on the wall
 * @property {RunItem[]} items
 * @property {false|{overhangStart?:number, overhangEnd?:number}} [counter]
 * @property {boolean} [crown=true]
 * @property {number} [crownMaxGap=12]  no crown over cabinets whose top is further than this below the ceiling
 * @property {boolean} [lightRail=true]
 */

/**
 * @typedef {Object} RunItem  a cabinet (catalog type) or an appliance (appliances/index.js type)
 * @property {string} type
 * @property {string|number} [no]   cabinet number; neighbours sharing one build in one step
 * @property {number} [width]
 * @property {number} [at]          u of its left edge (default: after the previous item on its level)
 * @property {string} [level]       base | upper | tall (appliances, fillers, end panels, open shelves)
 * @property {string} [name]        default `${prefix}b{no}` / `u{no}` / `t{no}`, `${prefix}_fill{k}`, `${prefix}_tower`
 * @property {number} [depth] @property {number} [height] @property {number} [bottom]
 * @property {Object} [options]
 */

/** The run's wall line (front 0: each item sets its own depth). */
export function runFromSpec(spec) {
  if (spec.run instanceof Run) return spec.run.withFront(0)
  if (spec.from && spec.to) {
    const [ax, ay] = spec.from
    const [bx, by] = spec.to
    const [nx, ny] = spec.normal || [-(by - ay), bx - ax]
    return runBetween(ax, ay, bx, by, nx, ny, 0, 0)
  }
  if (spec.origin) return Run.fromPlacement(spec.origin, spec.angle ?? 0, spec.length ?? 1, 0)
  throw new Error('buildWallRun: a run needs from/to, origin/angle or run')
}

const letterOf = (entry, level) => entry.letter ?? (level === 'upper' ? 'u' : level === 'tall' ? 't' : 'b')

/**
 * Where every item goes: [{ item (with its name), isCabinet, kind, level, u0, u1 }], in the
 * order given. Bases follow bases, uppers follow uppers, a tall starts after both.
 */
export function layoutWallRun(ctx, spec) {
  const prefix = spec.prefix ?? spec.id ?? 'run'
  const cursor = { base: 0, upper: 0 }
  const counts = {}
  return (spec.items || []).map((item, index) => {
    const isCabinet = isCabinetType(item.type)
    const kind = isCabinet ? null : applianceKind(item.type)
    if (!isCabinet && !kind) throw new Error(`buildWallRun: unknown item type "${item.type}"`)
    let level
    let width
    let name = item.name
    if (isCabinet) {
      const d = cabinetDims(itemCtx(ctx, item), item)
      level = d.level
      width = d.width
      if (name === undefined) {
        const entry = CATALOG[item.type]
        if (entry.name) {
          const k = counts[entry.name] || 0
          counts[entry.name] = k + 1
          name = entry.name === 'tower' ? `${prefix}_tower${k || ''}` : `${prefix}_${entry.name}${k}`
        } else {
          name = `${prefix}${letterOf(entry, level)}${item.no ?? index}`
        }
      }
    } else {
      level = item.level ?? APPLIANCE_LEVELS[kind]
      width = item.width ?? APPLIANCE_WIDTHS[kind]
    }
    const tallStart = Math.max(cursor.base, cursor.upper)
    const u0 = item.at ?? (level === 'upper' ? cursor.upper : level === 'tall' ? tallStart : cursor.base)
    const u1 = u0 + width
    if (level === 'upper') cursor.upper = u1
    else if (level === 'base') cursor.base = u1
    else { cursor.base = u1; cursor.upper = u1 }
    return { item: name === undefined ? item : { ...item, name }, index, isCabinet, kind, level, u0, u1, width }
  })
}

const cabinetOf = (item) => (item.no === undefined || item.no === null ? null : String(item.no))

function tagCabinet(parts, cabinet) {
  if (cabinet === null) return parts
  for (const p of parts) if (p.tags.cabinet === undefined) p.tags.cabinet = cabinet
  return parts
}

const byU = (a, b) => a.u0 - b.u0 || a.index - b.index

/**
 * Build one wall run.
 *
 * @param {Object} ctx
 * @param {RunSpec} spec
 * @returns {{ group: string, cabinet: string|null, parts: import('../core/part.js').Part[], sameStep?: boolean }[]}
 *   build steps in order, unnumbered. `sameStep: true` = shares the previous entry's step number
 *   (the fridge surround's panels, group 'tall', and the upper over the fridge, group 'upper').
 *   Order: bases (and under-counter appliances) along the run, the counter, the range and sinks,
 *   upper cabinets, upper appliances, talls with their appliances, then trim.
 */
export function buildWallRun(ctx, spec) {
  const st = ctx.standards
  const wall = runFromSpec(spec)
  const prefix = spec.prefix ?? spec.id ?? 'run'
  const laid = layoutWallRun(ctx, spec)

  // build everything first
  const entries = laid.map((e) => {
    const cabinet = cabinetOf(e.item)
    if (e.isCabinet) {
      const cab = buildCabinet(ctx, wall, e.item, e.u0)
      const ictx = itemCtx(ctx, e.item)
      const apps = cab.appliances.map((a) => {
        const actx = a.top === undefined ? ictx : { ...ictx, standards: { ...ictx.standards, baseHeight: a.top } }
        const built = buildAppliance(actx, wall.withFront(a.depth), a.item, a.u0)
        return { ...a, ...built, cabinet: cabinetOf(a.item) ?? cabinet }
      })
      tagCabinet(cab.parts, cabinet)
      return { ...e, cabinet, cab, apps }
    }
    const depth = e.item.depth ?? levelDims(st, e.level).depth
    const app = buildAppliance(itemCtx(ctx, e.item), wall.withFront(depth), e.item, e.u0)
    return { ...e, cabinet, app, depth }
  })
  const sorted = [...entries].sort(byU)
  const at = (level) => sorted.filter((e) => e.level === level)

  const steps = []
  const push = (group, cabinet, parts, sameStep = false) => {
    if (!parts || parts.length === 0) return false
    const last = steps[steps.length - 1]
    // neighbours with the same cabinet number build together (the fillers of wall 1's cabinet 4)
    if (!sameStep && last && cabinet !== null && last.cabinet === cabinet && last.group === group && group !== 'appliance') {
      last.parts.push(...parts)
      return true
    }
    steps.push(sameStep ? { group, cabinet, parts: [...parts], sameStep: true } : { group, cabinet, parts: [...parts] })
    return true
  }
  const pushCabinet = (e) => {
    let emitted = false
    for (const g of e.cab.groups) {
      if (push(g.group, e.cabinet, g.parts, emitted)) emitted = true
    }
  }
  const pushApps = (e, pred) => {
    for (const a of e.apps.filter(pred)) push('appliance', a.cabinet, a.parts)
  }

  // 1. bases, and the appliances the counter runs over
  for (const e of at('base')) {
    if (e.isCabinet) {
      pushApps(e, (a) => a.first)
      pushCabinet(e)
    } else if (!IN_COUNTER.has(e.kind)) {
      push('appliance', e.cabinet, e.app.parts)
    }
  }

  // 2. the counter
  if (spec.counter !== false) steps.push(...counterStep(ctx, wall, prefix, at('base'), spec.counter || {}))

  // 3. what stands in the counter: ranges and sinks
  for (const e of at('base')) {
    if (e.isCabinet) pushApps(e, (a) => !a.first)
    else if (IN_COUNTER.has(e.kind)) push('appliance', e.cabinet, e.app.parts)
  }

  // 4. uppers, then the appliances hung among them
  const uppers = at('upper')
  for (const e of uppers) {
    if (!e.isCabinet) continue
    pushApps(e, (a) => a.first)
    pushCabinet(e)
    pushApps(e, (a) => !a.first)
  }
  for (const e of uppers) if (!e.isCabinet) push('appliance', e.cabinet, e.app.parts)

  // 5. talls, each with its appliance (a fridge before its surround, ovens after their tower)
  for (const e of at('tall')) {
    if (!e.isCabinet) { push('appliance', e.cabinet, e.app.parts); continue }
    pushApps(e, (a) => a.first)
    pushCabinet(e)
    pushApps(e, (a) => !a.first)
  }

  // 6. trim
  const trim = [
    ...(spec.crown === false ? [] : crownParts(ctx, wall, prefix, sorted, spec)),
    ...(spec.lightRail === false ? [] : lightRailParts(ctx, wall, prefix, uppers)),
  ]
  push('trim', null, trim)
  return steps
}

/** Every part of a wall run's steps, in order. */
export const wallRunParts = (steps) => steps.flatMap((s) => s.parts)

// ---------------------------------------------------------------------------
// counter, crown, light rail
// ---------------------------------------------------------------------------

function counterStep(ctx, wall, prefix, bases, opts) {
  const st = ctx.standards
  const spans = []
  const polys = []
  for (const e of bases) {
    let takes = false
    let top = st.baseHeight
    let depth = e.depth
    const gaps = []
    const cutouts = []
    if (e.isCabinet) {
      takes = e.cab.counter
      top = e.cab.top
      depth = e.cab.counterDepth
      for (const a of e.apps) {
        cutouts.push(...(a.cutouts || []))
        if (a.counterGap) gaps.push(a.counterGap)
      }
      if (takes) for (const p of e.cab.counterPolygons) polys.push({ ...p, top, cabinet: e.cabinet })
    } else {
      takes = UNDER_COUNTER.has(e.kind) || IN_COUNTER.has(e.kind)
      cutouts.push(...(e.app.cutouts || []))
      if (e.app.counterGap) gaps.push(e.app.counterGap)
    }
    if (!takes) continue
    const last = spans[spans.length - 1]
    if (last && Math.abs(last.u1 - e.u0) < EPS && Math.abs(last.top - top) < EPS && Math.abs(last.depth - depth) < EPS) {
      last.u1 = e.u1
      last.gaps.push(...gaps)
      last.cutouts.push(...cutouts)
    } else {
      spans.push({ u0: e.u0, u1: e.u1, top, depth, gaps, cutouts })
    }
  }
  const parts = []
  spans.forEach((s, i) => {
    const name = spans.length === 1 ? `${prefix}_counter` : `${prefix}_counter${i}`
    parts.push(...counterRun(ctx, wall.withFront(s.depth), name, s.u0, s.u1, {
      gaps: s.gaps,
      cutouts: s.cutouts,
      z: s.top,
      overhangStart: i === 0 ? opts.overhangStart || 0 : 0,
      overhangEnd: i === spans.length - 1 ? opts.overhangEnd || 0 : 0,
    }))
  })
  for (const p of polys) {
    parts.push(...counterPolygon(ctx, p.name, p.polygon, { z: p.top, cabinet: p.cabinet }))
  }
  return parts.length ? [{ group: 'counter', cabinet: null, parts }] : []
}

/** Segments of touching items with the same depth, top and crown suffix. */
function segments(list, key) {
  const out = []
  for (const s of list) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.u1 - s.u0) < EPS && key(last) === key(s)) last.u1 = s.u1
    else out.push({ ...s })
  }
  return out
}

function crownParts(ctx, wall, prefix, sorted, spec) {
  const st = ctx.standards
  const maxGap = spec.crownMaxGap ?? 12
  const items = []
  for (const e of sorted) {
    if (e.level !== 'upper' && e.level !== 'tall') continue
    if (e.isCabinet) {
      items.push({ u0: e.u0, u1: e.u1, depth: e.cab.crown.depth, top: e.cab.crown.top, suffix: e.cab.crown.suffix })
    } else if (CROWNED.has(e.kind)) {
      items.push({ u0: e.u0, u1: e.u1, depth: st.upperDepth, top: st.upperTop, suffix: null })
    }
  }
  const segs = segments(items, (s) => `${s.depth.toFixed(4)}|${s.top.toFixed(4)}|${s.suffix}`)
    .filter((s) => s.top >= st.ceiling - maxGap && s.top < st.ceiling - EPS)
  const used = new Set()
  const out = []
  for (const s of segs) {
    const base = s.suffix ? `${prefix}_crown_${s.suffix}` : `${prefix}_crown`
    let name = base
    for (let k = 1; used.has(name); k += 1) name = `${base}${k}`
    used.add(name)
    out.push(...crown(ctx, wall.withFront(s.depth), name, s.u0, s.u1, { depth: s.depth, zfill: s.top }))
  }
  return out
}

function lightRailParts(ctx, wall, prefix, uppers) {
  const st = ctx.standards
  const items = uppers
    .filter((e) => e.isCabinet && e.cab.bottom > st.baseHeight + st.counterThickness)
    .map((e) => ({ u0: e.u0, u1: e.u1, depth: e.cab.depth, bottom: e.cab.bottom }))
  const segs = segments(items, (s) => `${s.depth.toFixed(4)}|${s.bottom.toFixed(4)}`)
  return segs.flatMap((s, i) => lightRail(ctx, wall.withFront(s.depth), segs.length === 1 ? `${prefix}_lr` : `${prefix}_lr${i}`,
    s.u0, s.u1, { z: s.bottom, depth: s.depth }))
}
