// Construction systems: how a cabinet's fronts meet its box. `resolveFit`
// turns ctx.construction into the numbers the fronts need (the table in
// CONTRACT.md), and `layoutFronts` applies them to a cabinet face: where the
// frame members go and the rectangle of every front.
//
// Coordinates are the run's: u along the face, z up, v back from the door face.

const SYSTEMS = ['frameless', 'face-frame']
const FITS = ['full-overlay', 'partial-overlay', 'inset']
const DEFAULT_OVERLAY = { 'full-overlay': 1.25, 'partial-overlay': 0.5 }
const OVERLAY_PAIR_GAP = 0.125 // two overlay leaves sharing one opening
const BEAD = 0.25
const BEAD_RECESS = 0.0625 // the bead sits a little behind the frame face
// The overlay frame laps this far into the back of the fronts, the way the
// Python's carcass starts at FRONT_T - 0.1: no touching coplanar faces.
const FRAME_LAP = 0.04
const CARCASS_LAP = 0.1
const EPS = 1e-6

const num = (x, fallback) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : fallback)

/**
 * @typedef {Object} Fit
 * @property {string}   system      frameless | face-frame (after validation)
 * @property {string}   fit         full-overlay | partial-overlay | inset (after validation)
 * @property {string[]} notes       every fallback or adjustment made, in words
 * @property {boolean}  hasFrame    true when frame parts (`_ff_*`) are drawn
 * @property {{stile:number, rail:number, midRail:number, mullion:number}} members
 *           widths that separate a cell from its frame opening (0 for frameless overlay;
 *           `sheet` for frameless inset, where the box edges are the frame)
 * @property {number}   thickness   frame thickness (0 when there is no frame)
 * @property {number}   grow        how far a front edge moves OUT from its frame opening
 *                                  (+overlay; -reveal frameless overlay; -gap inset)
 * @property {number}   pairGap     gap between two neighbouring fronts / a pair of leaves
 * @property {number}   bead        bead width inside each frame opening (0 = none)
 * @property {number}   beadV       v where the bead's face sits
 * @property {number}   reveal      standards.reveal
 * @property {number[]} frontV      [v0, v1] of the fronts
 * @property {number[]|null} frameV [v0, v1] of the frame, null without one
 * @property {number}   carcassV    where the carcass body may start (just behind the deepest)
 * @property {number}   carcassEdgeV where the carcass sides/top/bottom may start: 0 for
 *                                  frameless inset (the box edges show), else carcassV
 * @property {number}   edgeShow    how much frame or box edge shows at the cabinet's edges
 */

/** ctx.construction as numbers. Never throws: odd combinations fall back and say so in `notes`. */
export function resolveFit(ctx) {
  const c = ctx.construction || {}
  const st = ctx.standards
  const notes = []
  const T = st.frontThickness

  let system = c.system
  if (!SYSTEMS.includes(system)) {
    notes.push(`unknown construction system "${system}": using frameless`)
    system = 'frameless'
  }
  let fit = c.fit
  if (!FITS.includes(fit)) {
    notes.push(`unknown fit "${fit}": using full-overlay`)
    fit = 'full-overlay'
  }
  if (system === 'frameless' && fit === 'partial-overlay') {
    notes.push('frameless cabinets have no partial overlay: using full-overlay')
    fit = 'full-overlay'
  }

  const f = c.frame || {}
  const frame = {
    stile: num(f.stile, 1.5),
    rail: num(f.rail, 1.5),
    midRail: num(f.midRail, 1.5),
    thickness: num(f.thickness, 0.75),
  }
  for (const k of ['stile', 'rail', 'midRail', 'thickness']) {
    if (f[k] !== undefined && num(f[k], null) === null) notes.push(`frame.${k} ${f[k]} is not a size: using ${frame[k]}`)
  }
  const sheet = num(c.sheet, 0.75)
  const gap = num(c.gap, 0.09375)
  const reveal = st.reveal
  const inset = fit === 'inset'

  if (f.bead && !(inset && system === 'face-frame')) {
    notes.push(system === 'frameless'
      ? 'a bead needs a face frame: ignored on frameless'
      : 'a bead is an inset detail: ignored on an overlay fit')
  }
  if (c.overlay != null && (system === 'frameless' || inset)) {
    notes.push(`overlay ${c.overlay} ignored: ${system} ${fit} fronts are sized by ${inset ? 'gap' : 'reveal'}`)
  }

  const out = {
    system,
    fit,
    notes,
    hasFrame: system === 'face-frame',
    members: { stile: 0, rail: 0, midRail: 0, mullion: 0 },
    thickness: 0,
    grow: 0,
    pairGap: 0,
    bead: 0,
    beadV: 0,
    reveal,
    frontV: [0, T],
    frameV: null,
    carcassV: 0,
    carcassEdgeV: 0,
    edgeShow: 0,
  }

  if (system === 'frameless' && !inset) {
    out.grow = -reveal
    out.pairGap = 2 * reveal
  } else if (system === 'frameless') {
    out.members = { stile: sheet, rail: sheet, midRail: sheet, mullion: sheet }
    out.grow = -gap
    out.pairGap = gap
  } else {
    out.members = { stile: frame.stile, rail: frame.rail, midRail: frame.midRail, mullion: frame.stile }
    out.thickness = frame.thickness
    if (inset) {
      out.grow = -gap
      out.pairGap = gap
      if (f.bead) {
        out.bead = BEAD
        out.beadV = Math.min(BEAD_RECESS, frame.thickness / 2)
      }
    } else {
      let overlay = num(c.overlay, null)
      if (overlay === null) {
        if (c.overlay != null) notes.push(`overlay ${c.overlay} is not a size: using the ${fit} default`)
        overlay = DEFAULT_OVERLAY[fit]
      }
      const room = Math.min(frame.stile, frame.rail) - OVERLAY_PAIR_GAP / 2
      if (overlay > room) {
        notes.push(`overlay ${overlay} is wider than the frame allows at the cabinet edge: fronts stop ${OVERLAY_PAIR_GAP / 2}" short of it`)
      }
      out.grow = overlay
      out.pairGap = OVERLAY_PAIR_GAP
    }
  }

  if (out.hasFrame) {
    out.frameV = inset ? [0, out.thickness] : [T - FRAME_LAP, T - FRAME_LAP + out.thickness]
  }
  const deepest = Math.max(T, out.frameV ? out.frameV[1] : 0)
  out.carcassV = deepest - CARCASS_LAP
  out.carcassEdgeV = system === 'frameless' && inset ? 0 : out.carcassV
  out.edgeShow = Math.max(0, Math.min(out.members.stile, out.members.stile - out.grow))
  if (system === 'frameless' && !inset) out.edgeShow = 0
  return out
}

// ---------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------

const near = (a, b) => Math.abs(a - b) < EPS

/** Cell side widths: full member at the cabinet edge, half a member between cells. */
function shares(fit, bounds, cell) {
  const m = fit.members
  return {
    l: near(cell.u0, bounds.u0) ? m.stile : m.mullion / 2,
    r: near(cell.u1, bounds.u1) ? m.stile : m.mullion / 2,
    b: near(cell.z0, bounds.z0) ? m.rail : m.midRail / 2,
    t: near(cell.z1, bounds.z1) ? m.rail : m.midRail / 2,
  }
}

// Merge touching collinear segments [line, a, b]; `keepApart(line, at)` vetoes a merge.
function mergeSegments(segs, keepApart = () => false) {
  const byLine = new Map()
  for (const s of segs) {
    const key = s[0].toFixed(5)
    if (!byLine.has(key)) byLine.set(key, [])
    byLine.get(key).push(s)
  }
  const out = []
  for (const list of byLine.values()) {
    list.sort((p, q) => p[1] - q[1])
    let cur = [...list[0]]
    for (const s of list.slice(1)) {
      if (s[1] < cur[2] - EPS || (s[1] <= cur[2] + EPS && !keepApart(cur[0], s[1]))) {
        cur[2] = Math.max(cur[2], s[2])
      } else {
        out.push(cur)
        cur = [...s]
      }
    }
    out.push(cur)
  }
  return out
}

/**
 * Lay out a cabinet face: frame members and the rectangle of every front.
 *
 * @param {Object} ctx
 * @param {{u0:number,u1:number,z0:number,z1:number}} bounds
 * @param {Array<{kind:string,u0:number,u1:number,z0:number,z1:number}>} openings
 * @param {Fit} [fit]
 * @returns {{ fit: Fit, members: Array<{key:string,u0:number,u1:number,z0:number,z1:number,v0:number,v1:number}>,
 *            cells: Array<{opening:Object, frameOpening:Object|null, front:Object, leaves:Object[]}> }}
 *   `members` are frame parts (keys sl, sr, rt, rb, mr{n}, mu{n}, bd{n}); for frameless inset they
 *   are the box edges the carcass must show (key edge-*), and are not drawn by the fronts.
 *   `leaves` splits a doors cell wider than doorSplitWidth into a pair.
 */
export function layoutFronts(ctx, bounds, openings, fit = resolveFit(ctx)) {
  const framed = openings.filter((o) => o.kind !== 'panel')
  const m = fit.members
  const members = []
  const cells = []

  const drawsMembers = framed.length > 0 && (fit.hasFrame || m.stile > 0)
  if (drawsMembers) {
    const v = fit.frameV || [0, ctx.construction?.sheet ?? 0.75]
    const push = (key, u0, u1, z0, z1) => {
      if (u1 - u0 > EPS && z1 - z0 > EPS) members.push({ key, u0, u1, z0, z1, v0: v[0], v1: v[1] })
    }
    const { u0, u1, z0, z1 } = bounds
    push('sl', u0, u0 + m.stile, z0, z1)
    push('sr', u1 - m.stile, u1, z0, z1)
    push('rt', u0 + m.stile, u1 - m.stile, z1 - m.rail, z1)
    push('rb', u0 + m.stile, u1 - m.stile, z0, z0 + m.rail)

    // interior lines between neighbouring cells
    const hs = []
    const vs = []
    for (const a of framed) {
      for (const b of framed) {
        if (a === b) continue
        if (near(a.z1, b.z0)) {
          const lo = Math.max(a.u0, b.u0)
          const hi = Math.min(a.u1, b.u1)
          if (hi - lo > EPS) hs.push([a.z1, lo, hi])
        }
        if (near(a.u1, b.u0)) {
          const lo = Math.max(a.z0, b.z0)
          const hi = Math.min(a.z1, b.z1)
          if (hi - lo > EPS) vs.push([a.u1, lo, hi])
        }
      }
    }
    const hmerged = mergeSegments(hs)
    const crossed = (u, z) => hmerged.some(([hz, a, b]) => near(hz, z) && a < u - EPS && b > u + EPS)
    const vmerged = mergeSegments(vs, crossed)
    hmerged.forEach(([zl, a, b], i) => {
      const ua = near(a, u0) ? a + m.stile : a + m.mullion / 2
      const ub = near(b, u1) ? b - m.stile : b - m.mullion / 2
      push(`mr${i}`, ua, ub, zl - m.midRail / 2, zl + m.midRail / 2)
    })
    vmerged.forEach(([ul, a, b], i) => {
      const za = near(a, z0) ? a + m.rail : a + m.midRail / 2
      const zb = near(b, z1) ? b - m.rail : b - m.midRail / 2
      push(`mu${i}`, ul - m.mullion / 2, ul + m.mullion / 2, za, zb)
    })
    if (!fit.hasFrame) {
      // frameless inset: these are the carcass edges, reported but not drawn
      for (const mem of members) mem.key = `edge-${mem.key}`
    }
  }

  let bead = 0
  const addBead = (u0, u1, z0, z1) => {
    members.push({ key: `bd${bead}`, u0, u1, z0, z1, v0: fit.beadV, v1: fit.frameV[1] })
    bead += 1
  }
  for (const o of openings) {
    if (o.kind === 'panel') {
      const r = { u0: o.u0, u1: o.u1, z0: o.z0, z1: o.z1 }
      cells.push({ opening: o, frameOpening: null, front: r, leaves: [r] })
      continue
    }
    const s = shares(fit, bounds, o)
    const fo = { u0: o.u0 + s.l, u1: o.u1 - s.r, z0: o.z0 + s.b, z1: o.z1 - s.t }
    if (fit.bead > 0) {
      const bw = fit.bead
      addBead(fo.u0, fo.u0 + bw, fo.z0, fo.z1)
      addBead(fo.u1 - bw, fo.u1, fo.z0, fo.z1)
      addBead(fo.u0 + bw, fo.u1 - bw, fo.z0, fo.z0 + bw)
      addBead(fo.u0 + bw, fo.u1 - bw, fo.z1 - bw, fo.z1)
    }
    // how far each front edge sits in from its cell line
    const edge = (share) => share + fit.bead - Math.min(fit.grow, share - fit.pairGap / 2)
    const front = {
      u0: o.u0 + edge(s.l),
      u1: o.u1 - edge(s.r),
      z0: o.z0 + edge(s.b),
      z1: o.z1 - edge(s.t),
    }
    let leaves = [front]
    const isDoors = o.kind === 'doors' || o.kind === 'glass-doors'
    if (isDoors && o.u1 - o.u0 > ctx.standards.doorSplitWidth) {
      const mid = (front.u0 + front.u1) / 2
      leaves = [
        { ...front, u1: mid - fit.pairGap / 2 },
        { ...front, u0: mid + fit.pairGap / 2 },
      ]
    }
    cells.push({ opening: o, frameOpening: fo, front, leaves })
  }
  return { fit, members, cells }
}
