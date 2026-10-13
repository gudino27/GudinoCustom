// The cabinet catalog: every cabinet type the engine builds, carcass plus
// fronts, by name. Ports of base_three_drawers, base_drawer_doors,
// upper_glass, upper_solid, the oven tower and the fridge surround in
// scripts/build_kitchen.py, plus the website designer's cabinet types
// (src/constants/elementTypes.js) as parametric variants of them.
//
//   buildCabinet(ctx, run, item, u0) -> { parts, width, level, counter, ... }
//
// `run` is the line of the carcass backs (the wall for a wall run); its
// `front` is ignored: each cabinet draws on run.withFront(its depth). Sizes
// come from the item, then the type's defaults, then ctx.standards by level.
import { itemCtx } from '../model/context.js'
import { FRIDGE_DEFAULTS, OVEN_DEFAULTS, ovenBottom } from '../appliances/index.js'
import { layoutFronts } from './construction.js'
import { cabinetFronts } from './fronts.js'
import {
  backRun, boxCarcass, cornerCarcass, cornerFaces, glassUpperCarcass, openShelfCarcass, towerCarcass,
} from './carcass.js'
import { endPanel, filler } from './trim.js'

const LEVELS = new Set(['base', 'upper', 'tall'])
const DRAWER_H = 6.5 // top drawer / false front over doors (the Python's drawer_h)
const THREE_DRAWER_H = [12.5, 12.5] // bottom two of three drawers in the reference's 31.5" face
const FLOAT_BOTTOM = 12
const FRIDGE_GAP = 1.5 // fridge top to the deep upper over it (72 -> 73.5)
const TALL_SPLIT_MIN = 60 // taller door faces get an upper and a lower door
const MIRROR_T = 0.14

/** Heights and depths a level gets unless the type or item says otherwise. */
export function levelDims(st, level) {
  if (level === 'upper') return { depth: st.upperDepth, bottom: st.upperBottom, height: st.upperTop - st.upperBottom }
  if (level === 'tall') return { depth: st.tallDepth, bottom: 0, height: st.upperTop }
  return { depth: st.baseDepth, bottom: 0, height: st.baseHeight }
}

// ---------------------------------------------------------------------------
// openings (nominal cells of a cabinet face), bottom of the face at zt
// ---------------------------------------------------------------------------

function threeDrawers(g, zt, splitTop) {
  // the reference face is 31.5" (12.5 + 12.5 + 6.5); other heights scale it
  const k = (g.top - zt) / (THREE_DRAWER_H[0] + THREE_DRAWER_H[1] + DRAWER_H)
  const z = [zt, zt + THREE_DRAWER_H[0] * k, zt + (THREE_DRAWER_H[0] + THREE_DRAWER_H[1]) * k, g.top]
  const { u0, u1 } = g
  const cells = [
    { suffix: '_d0', kind: 'drawer', u0, u1, z0: z[0], z1: z[1] },
    { suffix: '_d1', kind: 'drawer', u0, u1, z0: z[1], z1: z[2] },
  ]
  if (splitTop) {
    const mid = (u0 + u1) / 2
    cells.push({ suffix: '_d2a', kind: 'drawer', u0, u1: mid, z0: z[2], z1: z[3] })
    cells.push({ suffix: '_d2b', kind: 'drawer', u0: mid, u1, z0: z[2], z1: z[3] })
  } else {
    cells.push({ suffix: '_d2', kind: 'drawer', u0, u1, z0: z[2], z1: z[3] })
  }
  return cells
}

/** A drawer (or false front) over doors: `_dr` doors, `_tp` drawer (frontsDrawerDoors' names). */
function drawerOverDoors(u0, u1, zt, top, { kind = 'drawer', drawerH = DRAWER_H, prefix = '' } = {}) {
  const dh = Math.min(drawerH, (top - zt) / 3)
  const zs = top - dh
  return [
    { suffix: `${prefix}_dr`, kind: 'doors', u0, u1, z0: zt, z1: zs, pullAt: 'top' },
    { suffix: `${prefix}_tp`, kind, u0, u1, z0: zs, z1: top },
  ]
}

const doorsCell = (u0, u1, z0, z1, pullAt = 'top', suffix = '') => [{ suffix, kind: 'doors', u0, u1, z0, z1, pullAt }]

function equalDrawers(u0, u1, zt, top, n, prefix = '') {
  const h = (top - zt) / n
  return [...Array(n).keys()].map((i) => ({
    suffix: `${prefix}_d${i}`, kind: 'drawer', u0, u1, z0: zt + h * i, z1: i === n - 1 ? top : zt + h * (i + 1),
  }))
}

// ---------------------------------------------------------------------------
// builders: (g) -> Part[] | { parts, groups?, appliances?, counterPolygons?, counterDepth? }
// g = { ctx, wall, run, name, u0, u1, width, depth, bottom, top, level, cabinet, options, item }
// ---------------------------------------------------------------------------

const hasToe = (g) => g.level !== 'upper' && !g.options.floating
const faceBottom = (g) => (hasToe(g) ? g.bottom + g.ctx.standards.toeHeight : g.bottom)

/** Box + one cabinetFronts call; the shared shape of every base, upper and tall. */
function boxWithFronts(g, openings, { zt = faceBottom(g), ctx = g.ctx, vBack, toeDepth } = {}) {
  const bounds = { u0: g.u0, u1: g.u1, z0: zt, z1: g.top }
  const parts = boxCarcass(ctx, g.run, g.name, g.u0, g.u1, {
    z0: zt,
    z1: g.top,
    depth: g.depth,
    vBack,
    toe: hasToe(g) ? { bottom: g.bottom, height: zt - g.bottom, inset: g.options.toeInset, depth: toeDepth } : null,
    inset: g.options.carcassInset,
    bounds,
    openings,
    cabinet: g.cabinet,
  })
  parts.push(...cabinetFronts(ctx, g.run, g.name, bounds, openings, { cabinet: g.cabinet }))
  return parts
}

/** Sink bowls the wall run adds over a sink base, one per bay: [{ item, u0, depth, top }]. */
function sinkAppliances(g, bays) {
  if (g.options.sink === false) return []
  const vanity = !!g.options.vanity
  return bays.map(([a, b], i) => {
    const w = b - a
    const bowl = vanity
      ? { width: Math.min(15, g.depth - 6), length: Math.max(8, Math.min(20, w - 6)), depth: 6 }
      : {}
    return {
      item: {
        type: 'sink',
        no: g.item.no,
        width: w,
        name: g.options.sinkName ?? (bays.length > 1 ? `${g.name}_sink${i}` : `${g.name}_sink`),
        options: { ...bowl, ...(g.options.sinkOptions || {}) },
      },
      u0: a,
      depth: g.depth,
      top: g.top,
      after: true,
    }
  })
}

function sinkBase(g) {
  const zt = faceBottom(g)
  const sinks = g.options.sinks ?? 1
  if (sinks < 2) {
    return {
      parts: boxWithFronts(g, drawerOverDoors(g.u0, g.u1, zt, g.top, { kind: 'false-front' })),
      appliances: sinkAppliances(g, [[g.u0, g.u1]]),
    }
  }
  // two sink bays with a bank of drawers between them
  const bank = g.width >= 48 ? Math.min(18, g.width * 0.3) : 0
  const bay = (g.width - bank) / 2
  const b0 = [g.u0, g.u0 + bay]
  const b1 = [g.u1 - bay, g.u1]
  const openings = [
    ...drawerOverDoors(b0[0], b0[1], zt, g.top, { kind: 'false-front', prefix: '_s0' }),
    ...drawerOverDoors(b1[0], b1[1], zt, g.top, { kind: 'false-front', prefix: '_s1' }),
  ]
  if (bank > 0) openings.push(...equalDrawers(b0[1], b1[0], zt, g.top, 3, '_bank'))
  return { parts: boxWithFronts(g, openings), appliances: sinkAppliances(g, [b0, b1]) }
}

function tallCabinet(g, { splitAt } = {}) {
  const zt = faceBottom(g)
  const h = g.top - zt
  let openings
  if (h > TALL_SPLIT_MIN) {
    let zs = splitAt ?? g.bottom + g.ctx.standards.baseHeight
    if (zs < zt + 12 || zs > g.top - 12) zs = zt + h / 2
    openings = [
      ...doorsCell(g.u0, g.u1, zt, zs, 'top', '_lo'),
      ...doorsCell(g.u0, g.u1, zs, g.top, 'bottom', '_up'),
    ]
  } else {
    openings = doorsCell(g.u0, g.u1, zt, g.top, 'top')
  }
  return boxWithFronts(g, openings)
}

function upperSolid(g) {
  const o = g.options
  if (o.mirror) return mirrorCabinet(g)
  // a medicine cabinet keeps one door however wide
  const ctx = o.medicine || o.singleDoor
    ? { ...g.ctx, standards: { ...g.ctx.standards, doorSplitWidth: Infinity } }
    : g.ctx
  return boxWithFronts(g, doorsCell(g.u0, g.u1, faceBottom(g), g.top, 'bottom'), { ctx })
}

/** Medicine cabinet with a mirror door: a slab front `${name}_mr` faced with glass `${name}_mr_g`. */
function mirrorCabinet(g) {
  const ctx = { ...g.ctx, style: { ...g.ctx.style, door: 'slab' } }
  const zt = faceBottom(g)
  const openings = [{ suffix: '_mr', kind: 'false-front', u0: g.u0, u1: g.u1, z0: zt, z1: g.top }]
  const parts = boxWithFronts({ ...g, ctx }, openings, { ctx })
  const { cells } = layoutFronts(ctx, { u0: g.u0, u1: g.u1, z0: zt, z1: g.top }, openings)
  const f = cells[0].front
  const m = Math.min(0.5, (f.u1 - f.u0) / 8, (f.z1 - f.z0) / 8)
  parts.push(g.run.box(`${g.name}_mr_g`, f.u0 + m, f.u1 - m, -MIRROR_T, 0.02, f.z0 + m, f.z1 - m, 'glass',
    { tags: { role: 'glass', cabinet: g.cabinet } }))
  return parts
}

function upperGlass(g) {
  const zt = faceBottom(g)
  const parts = glassUpperCarcass(g.ctx, g.run, g.name, g.u0, g.u1, zt, g.top, {
    depth: g.depth, shelves: g.options.shelves, cabinet: g.cabinet,
  })
  if (hasToe(g)) {
    parts.push(...boxCarcass(g.ctx, g.run, g.name, g.u0, g.u1, {
      z0: zt, z1: zt, depth: g.depth, toe: { bottom: g.bottom, height: zt - g.bottom }, cabinet: g.cabinet,
    }).filter((p) => p.name.endsWith('_toe')))
  }
  parts.push(...cabinetFronts(g.ctx, g.run, g.name, { u0: g.u0, u1: g.u1, z0: zt, z1: g.top },
    [{ suffix: '', kind: 'glass-doors', u0: g.u0, u1: g.u1, z0: zt, z1: g.top, pullAt: g.level === 'upper' ? 'bottom' : 'top' }],
    { cabinet: g.cabinet }))
  return parts
}

function openShelf(g) {
  const zt = faceBottom(g)
  const parts = openShelfCarcass(g.ctx, g.run, g.name, g.u0, g.u1, zt, g.top, {
    depth: g.depth, shelves: g.options.shelves ?? 2, cabinet: g.cabinet,
  })
  if (hasToe(g)) {
    parts.push(...boxCarcass(g.ctx, g.run, g.name, g.u0, g.u1, {
      z0: zt, z1: zt, depth: g.depth, toe: { bottom: g.bottom, height: zt - g.bottom }, cabinet: g.cabinet,
    }).filter((p) => p.name.endsWith('_toe')))
  }
  return parts
}

/** The oven tower round its cutout (build_right_wall): `_lo _hi _sl _sr _bk _toe`, doors `_up`, drawer `_dw`. */
function ovenTower(g) {
  const { ctx, options: o } = g
  const zt = faceBottom(g)
  const c = o.cutout || {}
  const cut = {
    width: c.width ?? Math.min(OVEN_DEFAULTS.cutoutWidth, g.width - 3),
    height: c.height ?? OVEN_DEFAULTS.cutoutHeight,
    bottom: c.bottom ?? g.bottom + ovenBottom(ctx),
  }
  const c1 = cut.bottom + cut.height
  const openings = []
  if (g.top - c1 > 3) openings.push({ suffix: '_up', kind: 'doors', u0: g.u0, u1: g.u1, z0: c1, z1: g.top, pullAt: 'bottom' })
  if (cut.bottom - zt > 3) openings.push({ suffix: '_dw', kind: 'drawer', u0: g.u0, u1: g.u1, z0: zt, z1: cut.bottom })
  const bounds = { u0: g.u0, u1: g.u1, z0: zt, z1: g.top }
  const parts = towerCarcass(ctx, g.run, g.name, g.u0, g.u1, {
    z0: zt,
    z1: g.top,
    bottom: g.bottom,
    depth: g.depth,
    cutout: cut,
    inset: o.carcassInset,
    toeInset: o.toeInset,
    toe: hasToe(g),
    bounds,
    openings,
    cabinet: g.cabinet,
  })
  parts.push(...cabinetFronts(ctx, g.run, g.name, bounds, openings, { cabinet: g.cabinet }))
  const appliances = o.appliance === false ? [] : [{
    item: {
      type: 'wall-ovens',
      no: g.item.no,
      width: g.width,
      height: cut.height,
      bottom: cut.bottom,
      name: o.ovenName ?? `${g.name.replace(/_tower$/, '')}_oven`,
      options: { cutoutWidth: cut.width, ...(o.ovenOptions || {}) },
    },
    u0: g.u0,
    depth: g.depth,
    after: true,
  }]
  return { parts, appliances }
}

/**
 * Fridge surround (build_back_wall): a side panel either side of the fridge,
 * floor to the top, and a deep upper over it. Groups: panels 'tall', upper
 * 'upper'. The fridge itself comes back in `appliances`, placed first.
 */
function fridgeSurround(g) {
  const { ctx, options: o } = g
  const fw = o.fridgeWidth ?? FRIDGE_DEFAULTS.width
  const fh = o.fridgeHeight ?? FRIDGE_DEFAULTS.height
  const pl = o.panelLeft ?? (g.width - fw) / 2
  const pn = o.panelName ?? `${g.name}_fp`
  const panels = []
  const common = { bottom: g.bottom, top: g.top, depth: g.depth, cabinet: g.cabinet }
  if (pl > 1e-6) panels.push(...endPanel(ctx, g.run, `${pn}_l`, g.u0, g.u0 + pl, common))
  if (g.u1 - (g.u0 + pl + fw) > 1e-6) panels.push(...endPanel(ctx, g.run, `${pn}_r`, g.u0 + pl + fw, g.u1, common))
  const uh = o.upperHeight ?? g.top - (g.bottom + fh + FRIDGE_GAP)
  const upper = uh > 3
    ? boxWithFronts({ ...g, level: 'upper' }, doorsCell(g.u0, g.u1, g.top - uh, g.top, 'bottom'), { zt: g.top - uh })
    : []
  const appliances = o.appliance === false ? [] : [{
    item: {
      type: 'fridge', no: g.item.no, width: fw, height: fh, name: o.fridgeName, options: { width: fw, ...(o.fridgeOptions || {}) },
    },
    u0: g.u0 + pl,
    depth: g.depth,
    first: true,
  }]
  return {
    parts: [...panels, ...upper],
    groups: [{ group: 'tall', parts: panels }, { group: 'upper', parts: upper }],
    appliances,
  }
}

/** L-shaped corner cabinet (lazy Susan base, corner upper, corner vanity): two fronts meeting at the inside corner. */
function cornerCabinet(g) {
  const { ctx, options: o } = g
  const st = ctx.standards
  const legDefault = g.level === 'upper' ? st.upperDepth : o.vanity ? 21 : st.baseDepth
  const leg = Math.min(o.legDepth ?? legDefault, g.depth, g.width)
  const side = o.returnSide === 'right' ? 'right' : 'left'
  const zt = faceBottom(g)
  const parts = cornerCarcass(ctx, g.wall, g.name, g.u0, g.width, g.depth, leg, side, {
    z0: zt, z1: g.top, toe: hasToe(g) ? { bottom: g.bottom, height: zt - g.bottom } : null, cabinet: g.cabinet,
  })
  const { faceA, faceB } = cornerFaces(g.wall, g.u0, g.width, g.depth, leg, side)
  const pullAt = g.level === 'upper' ? 'bottom' : 'top'
  for (const [face, sfx] of [[faceA, '_a'], [faceB, '_b']]) {
    if (face.u1 - face.u0 < 3) continue
    parts.push(...cabinetFronts(ctx, face.run, `${g.name}${sfx}`, { u0: face.u0, u1: face.u1, z0: zt, z1: g.top },
      doorsCell(face.u0, face.u1, zt, g.top, pullAt), { cabinet: g.cabinet }))
  }
  const out = { parts, counterDepth: leg, counterPolygons: [] }
  if (g.level === 'base') {
    // the return leg's share of the top; the wall run's strip covers the main leg
    const oh = st.counterOverhang
    const vEnd = g.depth - leg - oh
    if (vEnd > 1e-6) {
      const sq = g.wall.withFront(g.depth)
      const [a, b] = side === 'left' ? [g.u0, g.u0 + leg + oh] : [g.u1 - leg - oh, g.u1]
      out.counterPolygons.push({ name: `${g.name}_counter`, polygon: [sq.pt(a, 0), sq.pt(b, 0), sq.pt(b, vEnd), sq.pt(a, vEnd)] })
    }
  }
  if (o.sink) {
    out.appliances = sinkAppliances({ ...g, depth: leg }, [[faceA.u0, faceA.u1]])
  }
  return out
}

/** Island / peninsula base: drawer over doors in front, applied panels on the finished back (`_bk{i}`). */
function islandBase(g) {
  const { ctx } = g
  const T = ctx.standards.frontThickness
  const zt = faceBottom(g)
  const st = ctx.standards
  const parts = boxWithFronts(g, drawerOverDoors(g.u0, g.u1, zt, g.top), {
    vBack: g.depth - (T - 0.1),
    toeDepth: g.depth - st.toeRecess,
  })
  const br = backRun(g.wall, g.u0, g.u1, g.depth)
  const n = Math.max(1, Math.round(g.width / 24))
  const openings = [...Array(n).keys()].map((i) => ({
    suffix: `_bk${i}`,
    kind: 'panel',
    u0: g.u0 + (g.width * i) / n + 0.5,
    u1: g.u0 + (g.width * (i + 1)) / n - 0.5,
    z0: zt + 0.7,
    z1: g.top - 0.7,
  }))
  parts.push(...cabinetFronts(ctx, br, g.name, { u0: g.u0, u1: g.u1, z0: zt, z1: g.top }, openings, { cabinet: g.cabinet }))
  return parts
}

function fillerCabinet(g) {
  return filler(g.ctx, g.run, g.name, g.u0, g.u1, {
    bottom: g.bottom, top: g.top, depth: g.depth, toe: hasToe(g), cabinet: g.cabinet,
  })
}

function endPanelCabinet(g) {
  return endPanel(g.ctx, g.run, g.name, g.u0, g.u1, { bottom: g.bottom, top: g.top, depth: g.depth, cabinet: g.cabinet })
}

// ---------------------------------------------------------------------------
// the catalog
// ---------------------------------------------------------------------------

const base = (width, build, extra = {}) => ({ level: 'base', takesCounter: true, defaults: { width }, build, ...extra })
const vanity = (defaults, build, extra = {}) => ({
  level: 'base', takesCounter: true, defaults: { depth: 21, height: 32, ...defaults, options: { vanity: true, ...(defaults.options || {}) } }, build, ...extra,
})

const ENTRIES = {
  'base-3-drawer': base(30, (g) => boxWithFronts(g, threeDrawers(g, faceBottom(g), !!g.options.splitTop))),
  'base-drawer-doors': base(24, (g) => boxWithFronts(g, drawerOverDoors(g.u0, g.u1, faceBottom(g), g.top))),
  'base-doors': base(24, (g) => boxWithFronts(g, doorsCell(g.u0, g.u1, faceBottom(g), g.top))),
  'drawer-base': base(18, (g) => boxWithFronts(g, equalDrawers(g.u0, g.u1, faceBottom(g), g.top, g.options.drawers ?? 3))),
  'double-drawer-base': base(30, (g) => boxWithFronts(g, equalDrawers(g.u0, g.u1, faceBottom(g), g.top, g.options.drawers ?? 2))),
  'sink-base': base(33, sinkBase),
  filler: { level: 'base', levelFromItem: true, takesCounter: true, defaults: { width: 3 }, build: fillerCabinet, name: 'fill' },
  'end-panel': { level: 'base', levelFromItem: true, takesCounter: true, defaults: { width: 0.75 }, build: endPanelCabinet, name: 'end' },
  'upper-glass': { level: 'upper', takesCounter: false, defaults: { width: 30 }, build: upperGlass },
  'upper-solid': { level: 'upper', takesCounter: false, defaults: { width: 30 }, build: upperSolid },
  'open-shelf': { level: 'upper', levelFromItem: true, takesCounter: true, defaults: { width: 30 }, build: openShelf },
  tall: { level: 'tall', takesCounter: false, defaults: { width: 24 }, build: (g) => tallCabinet(g), crownSuffix: 'tl' },
  pantry: {
    level: 'tall', takesCounter: false, defaults: { width: 24 }, crownSuffix: 'tl',
    build: (g) => tallCabinet(g, { splitAt: g.ctx.standards.upperBottom }),
  },
  'oven-tower': { level: 'tall', takesCounter: false, defaults: { width: 31.5 }, build: ovenTower, crownSuffix: 'tw', name: 'tower' },
  'fridge-surround': {
    level: 'tall', takesCounter: false, defaults: { width: 41, depth: 26 }, build: fridgeSurround, crownSuffix: 'fr', letter: 'u',
  },
  'corner-base': base(36, cornerCabinet, { defaults: { width: 36, depth: 36 } }),
  'corner-upper': { level: 'upper', takesCounter: false, defaults: { width: 24, depth: 24 }, build: cornerCabinet },
  'island-base': base(48, islandBase, { defaults: { width: 48, depth: 24, options: { finishedBack: true } } }),
  'peninsula-base': base(36, islandBase, { defaults: { width: 36, depth: 24, options: { finishedBack: true, peninsula: true } } }),
  vanity: vanity({ width: 30 }, (g) => boxWithFronts(g, doorsCell(g.u0, g.u1, faceBottom(g), g.top))),
  'vanity-sink': vanity({ width: 36, options: { sink: true, sinks: 1 } }, sinkBase),
  'double-vanity': vanity({ width: 60, options: { sink: true, sinks: 2 } }, sinkBase),
  'floating-vanity': vanity({ width: 48, depth: 18, bottom: FLOAT_BOTTOM, height: 32 - FLOAT_BOTTOM, options: { sink: true, sinks: 1, floating: true } }, sinkBase),
  'corner-vanity': vanity({ width: 30, depth: 30, options: { sink: true, legDepth: 21 } }, cornerCabinet),
  'vanity-tower': { level: 'tall', takesCounter: false, defaults: { width: 12, depth: 21, height: 84 }, build: (g) => tallCabinet(g), crownSuffix: 'tl' },
  linen: { level: 'tall', takesCounter: false, defaults: { width: 18, depth: 21, height: 84 }, build: (g) => tallCabinet(g), crownSuffix: 'tl' },
  'linen-tower': { level: 'tall', takesCounter: false, defaults: { width: 24, depth: 18, height: 84 }, build: (g) => tallCabinet(g), crownSuffix: 'tl' },
  medicine: {
    level: 'upper', takesCounter: false, defaults: { width: 24, depth: 6, height: 30, bottom: 48, options: { medicine: true } }, build: upperSolid,
  },
  'medicine-mirror': {
    level: 'upper', takesCounter: false, defaults: { width: 30, depth: 6, height: 36, bottom: 48, options: { medicine: true, mirror: true } }, build: upperSolid,
  },
}

/** Other names for catalog types: the website designer's, and the designer adapter's. */
export const CATALOG_ALIASES = {
  base: 'base-drawer-doors',
  wall: 'upper-solid',
  'glass-wall': 'upper-glass',
  corner: 'corner-base',
  'corner-wall': 'corner-upper',
  'linen-cabinet': 'linen',
  'vanity-doors': 'vanity',
  'vanity-corner': 'corner-vanity',
  'lazy-susan': 'corner-base',
}

/**
 * type -> { level, defaults, takesCounter, type (canonical), build, crownSuffix? }.
 * `defaults` holds only what differs from the level's standards (width always).
 * The designer's 'drawer-base' (three drawers) and the adapter's 'drawer-base'
 * with options.drawers = 2 both land on the one equal-drawers builder.
 */
export const CATALOG = Object.fromEntries([
  ...Object.entries(ENTRIES).map(([k, e]) => [k, { ...e, type: k }]),
  ...Object.entries(CATALOG_ALIASES).map(([k, t]) => [k, { ...ENTRIES[t], type: t, alias: true }]),
])

export const isCabinetType = (type) => Object.prototype.hasOwnProperty.call(CATALOG, type)

/**
 * The resolved size and place of a catalog item, without building it.
 * @returns {{ entry, level, width, depth, bottom, height, top, options }}
 */
export function cabinetDims(ctx, item) {
  const entry = CATALOG[item.type]
  if (!entry) throw new Error(`buildCabinet: unknown cabinet type "${item.type}"`)
  const st = ctx.standards
  const d = entry.defaults
  const options = { ...(d.options || {}), ...(item.options || {}) }
  const level = entry.levelFromItem && LEVELS.has(item.level) ? item.level : entry.level
  const lv = levelDims(st, level)
  const width = item.width ?? d.width
  const depth = item.depth ?? d.depth ?? lv.depth
  let bottom = item.bottom ?? d.bottom ?? lv.bottom
  let height = item.height ?? d.height ?? lv.height
  if (options.floating && item.bottom === undefined && d.bottom === undefined) {
    bottom = FLOAT_BOTTOM
    if (item.height === undefined) height -= FLOAT_BOTTOM
  }
  return { entry, level, width, depth, bottom, height, top: bottom + height, options }
}

/**
 * Build one cabinet standing on `run` from `u0`.
 *
 * item = { no, type, width?, depth?, height?, bottom?, name?, level?, options?, construction?, style?, standards? }
 *   options (by type): splitTop, drawers, sink, sinks, sinkOptions, floating, shelves, mirror,
 *   medicine, cutout {width,height,bottom}, fridgeWidth, fridgeHeight, panelLeft, panelName,
 *   upperHeight, legDepth, returnSide, carcassInset [l,r], toeInset [l,r], appliance: false
 *
 * @returns {{
 *   parts: import('../core/part.js').Part[], name: string, type: string, width: number, level: string,
 *   counter: boolean, depth: number, bottom: number, top: number,
 *   groups: {group: string, parts: import('../core/part.js').Part[]}[],
 *   appliances: {item: Object, u0: number, depth: number, top?: number, first?: boolean, after?: boolean}[],
 *   counterDepth: number, counterPolygons: {name: string, polygon: number[][]}[],
 *   crown: {depth: number, top: number, suffix: string|null}
 * }}
 *   counter: a counter runs over it. groups: its parts by build group (the fridge surround has two).
 *   appliances: what the wall run must build with it (sinks, the ovens in a tower, the fridge in a
 *   surround), each on run.withFront(depth); `first` = before the cabinet in the build order.
 */
export function buildCabinet(ctx0, run, item, u0 = 0) {
  const ctx = itemCtx(ctx0, item)
  const dims = cabinetDims(ctx, item)
  const { entry, level, width, depth, bottom, top, options } = dims
  const cabinet = item.no === undefined || item.no === null ? undefined : String(item.no)
  const name = item.name ?? `${entry.type}${cabinet ?? ''}`
  const g = {
    ctx,
    wall: run,
    run: run.withFront(depth),
    name,
    u0,
    u1: u0 + width,
    width,
    depth,
    bottom,
    top,
    level,
    cabinet,
    options,
    item,
  }
  const built = entry.build(g)
  const res = Array.isArray(built) ? { parts: built } : built
  const counter = options.counter ?? (entry.takesCounter && level === 'base')
  return {
    parts: res.parts,
    name,
    type: entry.type,
    width,
    level,
    counter,
    depth,
    bottom,
    top,
    groups: res.groups || [{ group: level, parts: res.parts }],
    appliances: res.appliances || [],
    counterDepth: res.counterDepth ?? depth,
    counterPolygons: res.counterPolygons || [],
    crown: { depth, top, suffix: entry.crownSuffix ?? null },
  }
}
