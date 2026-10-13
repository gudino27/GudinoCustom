// Cabinet fronts: doors, drawer fronts, applied panels and pulls. Ports of the
// front functions in scripts/build_kitchen.py (panel_front, glass_front,
// pull_h, pull_v, doors, drawer, fronts_three_drawers, fronts_drawer_doors),
// plus `cabinetFronts`, the general form that honours ctx.construction.
//
// Everything is drawn on a Run: u along the face, v back from the door face
// (v = 0), z up. With the reference context (frameless, full overlay,
// raised-panel) every function returns exactly the parts the Python built.
import { layoutFronts, resolveFit } from './construction.js'

// small offsets the Python uses so no two visible faces are coplanar
const PANEL_LAP = 0.35 // raised field tucks under its stiles and rails
const PANEL_BACK = 0.05 // field's back sits this far in front of the leaf's back
const PANEL_FACE = 0.12 // field's face, measured back from the door face
const GLASS_LAP = 0.3
const GLASS_V = [0.30, 0.52]
const SHAKER_FACE = 0.3 // flat shaker panel sits this far behind the frame face

// pulls: a bar standing off the face on two posts
const PULL_BAR_V = [-1.05, -0.55]
const PULL_POST_V = [-0.55, 0.05]
const PULL_HALF = 0.3
const POST_HALF = 0.2
const POST_IN = 0.35
const DOOR_PULL_EDGE = 1.4 // bar centre in from the leaf's latch edge
const DOOR_PULL_NEAR = 3.0 // bar ends measured from the cell's top (or bottom)
const DOOR_PULL_FAR = 8.0
const DRAWER_PULL_MAX = 10.0
const DRAWER_PULL_FRACTION = 0.42

const finish = (ctx) => ctx.style?.finish || 'paint'
const panelFinish = (ctx) => ctx.style?.panelFinish || 'paint_panel'
const pullFinish = (ctx) => (/steel|stainless|nickel|chrome/.test(ctx.style?.pull || '') ? 'steel' : 'black')
const tagOpts = (role, cabinet) => ({ tags: cabinet === undefined ? { role } : { role, cabinet } })

/**
 * A stile-and-rail front (a door leaf, a drawer front, an applied panel).
 * ctx.style.door picks the field: 'raised-panel' (reference), 'shaker' (flat
 * panel recessed behind the frame) or 'slab' (one flat piece named `name`).
 * Parts: `${name}_r0/_r1/_s0/_s1/_p`.
 */
export function panelFront(ctx, run, name, u0, u1, z0, z1, { role = 'panel', cabinet } = {}) {
  const T = ctx.standards.frontThickness
  const o = tagOpts(role, cabinet)
  const door = ctx.style?.door || 'raised-panel'
  if (door === 'slab') return [run.box(name, u0, u1, 0, T, z0, z1, finish(ctx), o)]

  const s = Math.min(ctx.standards.stile, (u1 - u0) / 3, (z1 - z0) / 3)
  const out = [
    run.box(`${name}_r0`, u0, u1, 0, T, z0, z0 + s, finish(ctx), o),
    run.box(`${name}_r1`, u0, u1, 0, T, z1 - s, z1, finish(ctx), o),
    run.box(`${name}_s0`, u0, u0 + s, 0, T, z0 + s, z1 - s, finish(ctx), o),
    run.box(`${name}_s1`, u1 - s, u1, 0, T, z0 + s, z1 - s, finish(ctx), o),
  ]
  const pu0 = u0 + s - PANEL_LAP
  const pu1 = u1 - s + PANEL_LAP
  const pz0 = z0 + s - PANEL_LAP
  const pz1 = z1 - s + PANEL_LAP
  if (door === 'shaker') {
    out.push(run.box(`${name}_p`, pu0, pu1, SHAKER_FACE, T - PANEL_BACK, pz0, pz1, panelFinish(ctx), o))
  } else {
    const inset = Math.min(1.0, (u1 - u0) / 8, (z1 - z0) / 8)
    out.push(run.raisedPanel(`${name}_p`, pu0, pu1, pz0, pz1, T - PANEL_BACK, PANEL_FACE, inset, panelFinish(ctx), o))
  }
  return out
}

/** Glass door: stiles and rails `ctx.standards.stile` wide around a pane `${name}_g`. */
export function glassFront(ctx, run, name, u0, u1, z0, z1, { role = 'door', cabinet } = {}) {
  const T = ctx.standards.frontThickness
  const s = ctx.standards.stile
  const o = tagOpts(role, cabinet)
  return [
    run.box(`${name}_r0`, u0, u1, 0, T, z0, z0 + s, finish(ctx), o),
    run.box(`${name}_r1`, u0, u1, 0, T, z1 - s, z1, finish(ctx), o),
    run.box(`${name}_s0`, u0, u0 + s, 0, T, z0 + s, z1 - s, finish(ctx), o),
    run.box(`${name}_s1`, u1 - s, u1, 0, T, z0 + s, z1 - s, finish(ctx), o),
    run.box(`${name}_g`, u0 + s - GLASS_LAP, u1 - s + GLASS_LAP, GLASS_V[0], GLASS_V[1],
      z0 + s - GLASS_LAP, z1 - s + GLASS_LAP, 'glass', tagOpts('glass', cabinet)),
  ]
}

/** Horizontal bar pull centred on (uc, z): the bar `name` and two posts `${name}_p`. */
export function pullH(ctx, run, name, uc, z, { length = 5, cabinet } = {}) {
  const o = tagOpts('pull', cabinet)
  const m = pullFinish(ctx)
  const out = [run.box(name, uc - length / 2, uc + length / 2, PULL_BAR_V[0], PULL_BAR_V[1], z - PULL_HALF, z + PULL_HALF, m, o)]
  for (const du of [-length / 2 + POST_IN, length / 2 - POST_IN]) {
    out.push(run.box(`${name}_p`, uc + du - POST_HALF, uc + du + POST_HALF, PULL_POST_V[0], PULL_POST_V[1],
      z - POST_HALF, z + POST_HALF, m, o))
  }
  return out
}

/** Vertical bar pull at u from z0 to z1: the bar `name` and two posts `${name}_p`. */
export function pullV(ctx, run, name, u, z0, z1, { cabinet } = {}) {
  const o = tagOpts('pull', cabinet)
  const m = pullFinish(ctx)
  const out = [run.box(name, u - PULL_HALF, u + PULL_HALF, PULL_BAR_V[0], PULL_BAR_V[1], z0, z1, m, o)]
  for (const dz of [z0 + POST_IN, z1 - POST_IN]) {
    out.push(run.box(`${name}_p`, u - POST_HALF, u + POST_HALF, PULL_POST_V[0], PULL_POST_V[1],
      dz - POST_HALF, dz + POST_HALF, m, o))
  }
  return out
}

// ---------------------------------------------------------------------------
// fronts placed in a laid-out cell (no fitting here: construction.js did it)
// ---------------------------------------------------------------------------

function doorLeaves(ctx, run, name, cell, { glass, pullAt = 'top', cabinet }) {
  const r = ctx.standards.reveal
  const out = []
  const n = cell.leaves.length
  cell.leaves.forEach((f, i) => {
    const leafName = `${name}_d${i}`
    out.push(...(glass
      ? glassFront(ctx, run, leafName, f.u0, f.u1, f.z0, f.z1, { role: 'door', cabinet })
      : panelFront(ctx, run, leafName, f.u0, f.u1, f.z0, f.z1, { role: 'door', cabinet })))
    // latch edge: the right of a single door or of the left leaf, the left of the right leaf
    const pu = n === 1 || i === 0 ? f.u1 - DOOR_PULL_EDGE : f.u0 + DOOR_PULL_EDGE
    // measured from the cell line, as the Python measures from its z0/z1
    const pz = pullAt === 'top'
      ? [f.z1 + r - DOOR_PULL_FAR, f.z1 + r - DOOR_PULL_NEAR]
      : [f.z0 - r + DOOR_PULL_NEAR, f.z0 - r + DOOR_PULL_FAR]
    out.push(...pullV(ctx, run, `${name}_pl${i}`, pu, pz[0], pz[1], { cabinet }))
  })
  return out
}

function drawerFront(ctx, run, name, cell, { pull = true, pullLen, cabinet, role = 'drawer' }) {
  const f = cell.front
  const o = cell.opening
  const out = panelFront(ctx, run, name, f.u0, f.u1, f.z0, f.z1, { role, cabinet })
  if (pull) {
    const length = pullLen || Math.min(DRAWER_PULL_MAX, (o.u1 - o.u0) * DRAWER_PULL_FRACTION)
    out.push(...pullH(ctx, run, `${name}_pl`, (f.u0 + f.u1) / 2, (f.z0 + f.z1) / 2, { length, cabinet }))
  }
  return out
}

/**
 * The general form: a cabinet face `bounds` tiled by `openings`, each a nominal
 * cell. Adds the frame the construction system calls for (`${name}_ff_sl/_sr/
 * _rt/_rb/_mr{n}/_mu{n}`, bead `_ff_bd{n}`, role 'frame') and sizes each front
 * by the table in CONTRACT.md.
 *
 * opening = { suffix, kind, u0, u1, z0, z1, pullAt, pullLen }
 *   kind 'doors' | 'glass-doors'  one leaf, or a pair when wider than doorSplitWidth:
 *                                 `${name}${suffix}_d{i}` + pulls `_pl{i}`
 *   kind 'drawer'                 `${name}${suffix}` + pull `${name}${suffix}_pl`
 *   kind 'false-front'            a drawer front without a pull
 *   kind 'panel'                  an applied panel drawn exactly on its rectangle, outside the
 *                                 frame layout (island panels, finished ends)
 */
export function cabinetFronts(ctx, run, name, bounds, openings, { cabinet } = {}) {
  const fit = resolveFit(ctx)
  const { members, cells } = layoutFronts(ctx, bounds, openings, fit)
  const out = []
  if (fit.hasFrame) {
    for (const m of members) {
      out.push(run.box(`${name}_ff_${m.key}`, m.u0, m.u1, m.v0, m.v1, m.z0, m.z1, finish(ctx), tagOpts('frame', cabinet)))
    }
  }
  for (const cell of cells) {
    const o = cell.opening
    const n = `${name}${o.suffix || ''}`
    switch (o.kind) {
      case 'doors':
      case 'glass-doors':
        out.push(...doorLeaves(ctx, run, n, cell, { glass: o.kind === 'glass-doors', pullAt: o.pullAt, cabinet }))
        break
      case 'drawer':
        out.push(...drawerFront(ctx, run, n, cell, { pullLen: o.pullLen, cabinet }))
        break
      case 'false-front':
        out.push(...drawerFront(ctx, run, n, cell, { pull: false, cabinet }))
        break
      case 'panel':
        out.push(...panelFront(ctx, run, n, o.u0, o.u1, o.z0, o.z1, { role: 'panel', cabinet }))
        break
      default:
        throw new Error(`cabinetFronts: unknown opening kind "${o.kind}" in ${n}`)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// the Python's entry points, as single- or multi-cell cabinetFronts calls
// ---------------------------------------------------------------------------

/** One door, or a pair when wider than doorSplitWidth, in the cell u0..u1 x z0..z1. */
export function doors(ctx, run, name, u0, u1, z0, z1, { glass = false, pullAt = 'top', cabinet } = {}) {
  return cabinetFronts(ctx, run, name, { u0, u1, z0, z1 },
    [{ suffix: '', kind: glass ? 'glass-doors' : 'doors', u0, u1, z0, z1, pullAt }], { cabinet })
}

/** One drawer front with a centred bar pull (length min(10, 0.42 x width) unless given). */
export function drawer(ctx, run, name, u0, u1, z0, z1, { pullLen, cabinet } = {}) {
  return cabinetFronts(ctx, run, name, { u0, u1, z0, z1 },
    [{ suffix: '', kind: 'drawer', u0, u1, z0, z1, pullLen }], { cabinet })
}

/**
 * Three stacked drawers (wall 1 bases 1/3/5): `${name}_d0/_d1/_d2`, or with
 * splitTop the top one split in two, `_d2a/_d2b`.
 */
export function frontsThreeDrawers(ctx, run, name, u0, u1, { splitTop = false, heights = [12.5, 12.5], cabinet } = {}) {
  const st = ctx.standards
  const z = [st.toeHeight, st.toeHeight + heights[0], st.toeHeight + heights[0] + heights[1], st.baseHeight]
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
  return cabinetFronts(ctx, run, name, { u0, u1, z0: z[0], z1: z[3] }, cells, { cabinet })
}

/** A top drawer over doors (wall 5, island): doors `${name}_dr_d{i}`, drawer `${name}_tp`. */
export function frontsDrawerDoors(ctx, run, name, u0, u1, { drawerH = 6.5, cabinet } = {}) {
  const st = ctx.standards
  const zs = st.baseHeight - drawerH
  return cabinetFronts(ctx, run, name, { u0, u1, z0: st.toeHeight, z1: st.baseHeight }, [
    { suffix: '_dr', kind: 'doors', u0, u1, z0: st.toeHeight, z1: zs, pullAt: 'top' },
    { suffix: '_tp', kind: 'drawer', u0, u1, z0: zs, z1: st.baseHeight },
  ], { cabinet })
}
