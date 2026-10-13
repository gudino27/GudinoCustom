// What is applied to the island body on each edge: finished panels, a
// finished end, or working fronts and appliances. Every face is drawn on a
// Run along its BODY edge (u along the edge, v back from the door face).
import { buildAppliance } from '../appliances/index.js'
import { cabinetFronts, frontsThreeDrawers, panelFront } from '../cabinets/fronts.js'
import { itemCtx } from '../model/context.js'
import { APPLIANCE_ITEMS, FACE_DEFAULTS, ITEM_DEFAULTS, ITEM_TYPES } from './schema.js'

const EPS = 1e-6

/**
 * Finished back: round(length / module) raised panels (at least one), each
 * `margin` in from its share of the edge. Names `${name}_pn${edge}_${i}`.
 */
export function panelsFace(ctx, run, name, edge, face, { cabinet } = {}) {
  const st = ctx.standards
  const module = face.module ?? FACE_DEFAULTS.module
  const margin = face.margin ?? FACE_DEFAULTS.margin
  const lift = face.lift ?? FACE_DEFAULTS.lift
  const L = run.length
  const n = Math.max(1, Math.round(L / module))
  const out = []
  for (let i = 0; i < n; i += 1) {
    out.push(...panelFront(ctx, run, `${name}_pn${edge}_${i}`, (L * i) / n + margin, (L * (i + 1)) / n - margin,
      st.toeHeight + lift, st.baseHeight - lift, { role: 'panel', cabinet }))
  }
  return out
}

/** One finished end panel along the whole edge: `${name}_pe${edge}`. */
export function endFace(ctx, run, name, edge, face, { cabinet } = {}) {
  const st = ctx.standards
  const margin = face.margin ?? FACE_DEFAULTS.margin
  const lift = face.lift ?? FACE_DEFAULTS.lift
  return panelFront(ctx, run, `${name}_pe${edge}`, margin, run.length - margin,
    st.toeHeight + lift, st.baseHeight - lift, { role: 'panel', cabinet })
}

/**
 * Lay the items of a working face along the edge: each gets [u0, u1]. Items
 * without a width share what the others leave. Throws when they do not fit.
 */
export function layoutItems(face, length, edge) {
  const items = face.items || []
  const start = face.start ?? 0
  const fixed = items.reduce((s, it) => s + (it.width ?? 0), 0)
  const free = items.filter((it) => it.width === undefined || it.width === null).length
  const rest = length - start - fixed
  if (rest < -1e-4 || (free > 0 && rest <= EPS)) {
    throw new Error(`island: the items on edge ${edge} need ${(start + fixed).toFixed(3)}" `
      + `${free ? `plus ${free} flexible item(s) ` : ''}but the edge is ${length.toFixed(3)}" long`)
  }
  let u = start
  return items.map((item) => {
    const w = item.width ?? rest / free
    const span = { item, u0: u, u1: Math.min(u + w, length) }
    u += w
    return span
  })
}

/**
 * One working item: a cabinet's fronts (one cabinetFronts call) or an
 * appliance. Returns { group, parts }.
 */
export function workingItem(ctx, run, name, item, u0, u1, { cabinet } = {}) {
  if (!ITEM_TYPES.includes(item.type)) throw new Error(`island: unknown item type "${item.type}" (${name})`)
  const c = itemCtx(ctx, item)
  const st = c.standards
  const z0 = st.toeHeight
  const z1 = st.baseHeight
  const pullAt = item.pullAt || 'top'
  const bounds = { u0, u1, z0, z1 }
  const opts = { cabinet }

  if (APPLIANCE_ITEMS.has(item.type)) {
    const { parts } = buildAppliance(c, run, { ...item, name, width: u1 - u0, no: cabinet }, u0)
    return { group: 'appliance', parts }
  }
  let parts
  switch (item.type) {
    case 'panel':
      parts = cabinetFronts(c, run, name, bounds, [{ suffix: '', kind: 'panel', u0, u1, z0, z1 }], opts)
      break
    case 'doors':
      parts = cabinetFronts(c, run, name, bounds, [{ suffix: '', kind: 'doors', u0, u1, z0, z1, pullAt }], opts)
      break
    case 'drawer-doors': {
      const s = { doors: '_dr', drawer: '_tp', ...(item.suffixes || {}) }
      const zs = z1 - (item.drawerHeight ?? ITEM_DEFAULTS.drawerHeight)
      parts = cabinetFronts(c, run, name, bounds, [
        { suffix: s.doors, kind: 'doors', u0, u1, z0, z1: zs, pullAt },
        { suffix: s.drawer, kind: 'drawer', u0, u1, z0: zs, z1 },
      ], opts)
      break
    }
    case 'sink-base': {
      const s = { doors: '', front: '_apron', ...(item.suffixes || {}) }
      const zs = z1 - (item.apronHeight ?? ITEM_DEFAULTS.apronHeight)
      parts = cabinetFronts(c, run, name, bounds, [
        { suffix: s.doors, kind: 'doors', u0, u1, z0, z1: zs, pullAt },
        { suffix: s.front, kind: 'false-front', u0, u1, z0: zs, z1 },
      ], opts)
      break
    }
    case 'drawers':
      parts = frontsThreeDrawers(c, run, name, u0, u1, { splitTop: !!item.splitTop, heights: item.heights, cabinet })
      break
    default:
      throw new Error(`island: no builder for item type "${item.type}"`)
  }
  return { group: 'island', parts }
}

/** Panel strips over what a working face's items leave bare (face.fill). */
export function fillStrips(ctx, run, name, edge, spans, { cabinet } = {}) {
  const st = ctx.standards
  const out = []
  const gaps = []
  const first = spans.length ? spans[0].u0 : run.length
  const last = spans.length ? spans[spans.length - 1].u1 : 0
  if (first > 0.25) gaps.push([0, first])
  if (run.length - last > 0.25 && spans.length) gaps.push([last, run.length])
  gaps.forEach(([u0, u1], k) => {
    out.push(...panelFront(ctx, run, `${name}_f${edge}_${k}`, u0, u1, st.toeHeight, st.baseHeight, { role: 'panel', cabinet }))
  })
  return out
}
