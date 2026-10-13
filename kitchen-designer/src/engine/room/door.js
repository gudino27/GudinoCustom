// Door leaves, knobs and casings. Port of panel_door_leaf and the Door71 /
// hallway casings in build_kitchen.py.
import { makePart } from '../core/part.js'
import { ROOM_DEFAULTS } from './schema.js'

/**
 * One stile-and-rail leaf with a raised panel (panel_door_leaf), drawn in the
 * wall frame: s0..s1 along the wall, z0..z1, faces at vBack and vFront.
 */
export function panelDoorLeaf(frame, name, s0, s1, z0, z1, vBack, vFront, opts = {}) {
  const D = ROOM_DEFAULTS.leaf
  const stile = opts.stile ?? D.stile
  const topRail = opts.topRail ?? D.topRail
  const botRail = opts.bottomRail ?? D.bottomRail
  const t = opts.material || 'trim'
  const tags = { tags: { role: 'trim' } }
  return [
    frame.box(`${name}_ls`, s0, s0 + stile, vBack, vFront, z0, z1, t, tags),
    frame.box(`${name}_rs`, s1 - stile, s1, vBack, vFront, z0, z1, t, tags),
    frame.box(`${name}_br`, s0 + stile, s1 - stile, vBack, vFront, z0, z0 + botRail, t, tags),
    frame.box(`${name}_tr`, s0 + stile, s1 - stile, vBack, vFront, z1 - topRail, z1, t, tags),
    frame.raisedPanel(`${name}_panel`, s0 + stile - 0.4, s1 - stile + 0.4, z0 + botRail - 0.4, z1 - topRail + 0.4,
      vBack + 0.35, vFront - 0.25, 1.6, opts.panelMaterial || 'paint_panel', tags),
  ]
}

/** Cylinder of `seg` sides centred on `c`, its length along unit vector `axis`. */
export function axisCylinder(name, c, axis, radius, length, material, seg = 16, opts) {
  // ring basis: e1 horizontal and square to the axis (or plan x for a vertical axis), e2 = axis x e1
  let e1 = Math.abs(axis[2]) > 0.999 ? [1, 0, 0] : [-axis[1], axis[0], 0]
  const l1 = Math.hypot(...e1)
  e1 = e1.map((x) => x / l1)
  const e2 = [
    axis[1] * e1[2] - axis[2] * e1[1],
    axis[2] * e1[0] - axis[0] * e1[2],
    axis[0] * e1[1] - axis[1] * e1[0],
  ]
  const verts = []
  for (const sgn of [-0.5, 0.5]) {
    for (let i = 0; i < seg; i += 1) {
      const a = (2 * Math.PI * i) / seg
      const ca = Math.cos(a) * radius
      const sa = Math.sin(a) * radius
      verts.push([0, 1, 2].map((k) => c[k] + e1[k] * ca + e2[k] * sa + axis[k] * sgn * length))
    }
  }
  const idx = [...Array(seg).keys()]
  const faces = [[...idx].reverse(), idx.map((i) => i + seg)]
  for (let i = 0; i < seg; i += 1) {
    const j = (i + 1) % seg
    faces.push([i, j, j + seg, i + seg])
  }
  return makePart(name, verts, faces, material, opts)
}

/**
 * The leaves and knobs of a door opening.
 * @param {ReturnType<import('./wall.js').wallFrame>} frame
 * @param {Object} o        resolved door opening
 * @param {string} name     prefix: `${name}_l`, `${name}_r` (pair) or `${name}_leaf`; knobs `${name}_knob`
 */
export function buildDoor(frame, o, name) {
  const D = ROOM_DEFAULTS
  const leaves = o.leaves ?? D.door.leaves
  if (!leaves) return []
  const lf = o.leaf || {}
  const z0 = o.bottom + (lf.bottom ?? D.leaf.bottom)
  const z1 = lf.top ?? o.head - D.leaf.headClear
  const [vBack, vFront] = lf.v || [frame.vBack + D.leaf.setback, frame.vBack + D.leaf.setback + D.leaf.thickness]
  const parts = []
  const knobS = []
  if (leaves === 2) {
    const mid = (o.s0 + o.s1) / 2
    parts.push(...panelDoorLeaf(frame, `${name}_l`, o.s0, mid, z0, z1, vBack, vFront, lf))
    parts.push(...panelDoorLeaf(frame, `${name}_r`, mid, o.s1, z0, z1, vBack, vFront, lf))
    knobS.push(mid - D.knob.fromMeet, mid + D.knob.fromMeet)
  } else {
    parts.push(...panelDoorLeaf(frame, `${name}_leaf`, o.s0, o.s1, z0, z1, vBack, vFront, lf))
    knobS.push(o.hinge === 'right' ? o.s0 + D.knob.fromEdge : o.s1 - D.knob.fromEdge)
  }
  if (o.knobs !== false) {
    const k = { ...D.knob, ...(o.knobs || {}) }
    const v = vFront + k.proud
    const axis = [frame.front[0], frame.front[1], 0]
    for (const s of k.at || knobS) {
      parts.push(axisCylinder(`${name}_knob`, [...frame.pt(s, v), k.z], axis, k.radius, k.length, k.material || 'steel',
        16, { tags: { role: 'fixture' } }))
    }
  }
  return parts
}

/**
 * Casing around a door or cased opening: a leg each side and a head.
 * @param {string} prefix   default name prefix (`${prefix}_l`, `_r`, `_head`)
 */
export function buildCasing(frame, o, prefix) {
  if (o.casing === false) return []
  const c = { ...ROOM_DEFAULTS.casing, ...(o.casing || {}) }
  const pre = c.name || prefix
  const names = { left: `${pre}_l`, right: `${pre}_r`, head: `${pre}_head`, ...(c.names || {}) }
  const [vb, vf] = c.v || [frame.vBack, frame.vFront + c.proud]
  const mat = c.material || 'trim'
  const top = o.head + c.headUp
  const sl = o.s0 - c.outside
  const sr = o.s1 + c.outside
  const tags = { tags: { role: 'trim' } }
  return [
    frame.box(names.head, sl, sr, vb, vf, o.head - c.headDown, top, mat, tags),
    frame.box(names.left, sl, o.s0 + c.lap, vb, vf, o.bottom, top, mat, tags),
    frame.box(names.right, o.s1 - c.lap, sr, vb, vf, o.bottom, top, mat, tags),
  ]
}
