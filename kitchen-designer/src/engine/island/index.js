// The island: a free-standing block of base cabinets described by its counter
// outline (island/schema.js). Port of build_island() in scripts/build_kitchen.py.
import { MATERIALS } from '../core/materials.js'
import { prism, prismWithHoles } from '../core/part.js'
import { edgeNormal } from '../core/polygon.js'
import { runOnEdge } from '../core/run.js'
import { resolveFit } from '../cabinets/construction.js'
import { faucet, sinkBowl, sinkCutout, SINK_DEFAULTS } from '../appliances/index.js'
import { assertEdgesSurvive, bodySolid, holeInside, offsetEdges } from './body.js'
import { endFace, fillStrips, layoutItems, panelsFace, workingItem } from './faces.js'
import { FACE_TYPES, ISLAND_DEFAULTS } from './schema.js'

export { ISLAND_DEFAULTS, FACE_DEFAULTS, ITEM_DEFAULTS, ITEM_TYPES, FACE_TYPES } from './schema.js'
export { bodySolid, offsetEdges } from './body.js'

// The fronts bite this far into the body (the Python's voff = -(FRONT_T - 0.12)),
// so the back of every front is buried and nothing is coplanar with the body.
const FRONT_BITE = 0.12
// The sink's setback and the faucet's distance behind it, from the reference:
// counter edge 199.4 -> bowl centre 188.3 -> faucet 175.7, bowl 18 wide.
const SINK_SETBACK_EXTRA = 2.1
const FAUCET_BEHIND_EXTRA = 3.6
const PLINTH_TUCK = 0.1

const deg = (rad) => (rad * 180) / Math.PI

/** The faces of every edge, defaults filled in and validated. */
export function islandFaces(island) {
  const n = island.outline.length
  return [...Array(n).keys()].map((e) => {
    const face = { type: 'panels', ...((island.faces || [])[e] || {}) }
    if (!FACE_TYPES.includes(face.type)) throw new Error(`island: edge ${e} has unknown face type "${face.type}"`)
    return face
  })
}

/**
 * The island's plan layout: body and plinth polygons, the run of every body
 * edge and where the door faces stand. Exposed for the designer (hit testing,
 * dimensions) and the tests.
 */
export function islandLayout(ctx, island) {
  const o = { ...ISLAND_DEFAULTS, ...island }
  const outline = o.outline
  if (!Array.isArray(outline) || outline.length < 3) throw new Error('island: the outline needs at least 3 points')
  const faces = islandFaces(island)
  const st = ctx.standards
  const fit = resolveFit(ctx)
  // how deep the working fronts are: the fronts, or the face frame behind them
  const deepest = Math.max(fit.frontV[1], fit.frameV ? fit.frameV[1] : 0)
  const insets = faces.map((f) => {
    let inset = f.inset ?? o.bodyInset + (f.overhang ?? 0)
    // a face frame makes the working face deeper: recess the body so the door
    // face stays where it is on a frameless island
    if (f.type === 'working') inset += deepest - st.frontThickness
    return inset
  })
  const body = offsetEdges(outline, insets.map((d) => -d))
  assertEdgesSurvive(outline, body, 'body')
  // a bare edge ('none': a peninsula's wall end) keeps its plinth just inside the body
  const plinth = offsetEdges(body, faces.map((f) => (f.type === 'none' ? -PLINTH_TUCK : o.plinthProud)))
  const runs = faces.map((f, e) => {
    const depth = f.type === 'working' ? deepest : st.frontThickness
    return runOnEdge(body, e, -(depth - FRONT_BITE))
  })
  return { o, outline, faces, insets, body, plinth, runs, deepest }
}

/** Where the sink goes, in sinkBowl's terms, and its faucet. null when there is none. */
export function islandSink(ctx, island, layout = islandLayout(ctx, island)) {
  const s = island.sink
  if (!s) return null
  const width = s.width ?? SINK_DEFAULTS.width
  let { cx, cy } = s
  let angle = s.angle
  let normal = null
  let cabinet = s.cabinet
  if (s.edge !== undefined && s.edge !== null) {
    const e = s.edge
    const run = layout.runs[e]
    if (!run) throw new Error(`island: the sink faces edge ${e}, which the outline does not have`)
    normal = edgeNormal(layout.body, e)
    if (angle === undefined) angle = deg(Math.atan2(-run.dx, run.dy))
    const face = layout.faces[e]
    const spans = face.type === 'working' ? layoutItems(face, run.length, e) : []
    const base = spans.find((sp) => sp.item.type === 'sink-base')
    if (cabinet === undefined && base && base.item.no !== undefined) cabinet = base.item.no
    if (cx === undefined || cy === undefined) {
      const u = s.u ?? (base ? (base.u0 + base.u1) / 2 : run.length / 2)
      const setback = s.setback ?? width / 2 + SINK_SETBACK_EXTRA
      // from the counter edge back to the centre; the body edge is `inset` in from it
      const back = setback - layout.insets[e]
      const [bx, by] = layout.body[e]
      cx = bx + run.dx * u - normal[0] * back
      cy = by + run.dy * u - normal[1] * back
    }
  }
  if (cx === undefined || cy === undefined) throw new Error('island: give the sink cx/cy or the edge it faces')
  angle = angle ?? 0
  if (Object.is(angle, -0)) angle = 0
  if (!normal) normal = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)]
  const bowl = {
    cx, cy, width, length: s.length, depth: s.depth, wall: s.wall, angle,
    ...(cabinet !== undefined ? { cabinet } : {}),
  }

  let tap = null
  if (island.faucet !== false) {
    const f = island.faucet || {}
    let { x, y } = f
    if (x === undefined || y === undefined) {
      const behind = f.behind ?? width / 2 + FAUCET_BEHIND_EXTRA
      x = cx - normal[0] * behind
      y = cy - normal[1] * behind
    }
    let fa = f.angle ?? deg(Math.atan2(normal[1], normal[0]))
    if (Object.is(fa, -0)) fa = 0
    tap = {
      name: f.name || 'faucet',
      x, y, angle: fa, reach: f.reach, height: f.height,
      ...(cabinet !== undefined ? { cabinet } : {}),
    }
  }
  return { name: s.name || 'sink', bowl, cut: sinkCutout(ctx, bowl), faucet: tap, cabinet }
}

/**
 * Build an island.
 *
 * @param {import('../model/context.js').Ctx} ctx
 * @param {import('./schema.js').Island} island
 * @returns {import('./schema.js').IslandStep[]} in build order: body + plinth; every panel;
 *   each working item in turn (edge order, left to right); the counter; the sink and faucet.
 *   The orchestrator numbers the steps and sets zone.
 */
export function buildIsland(ctx, island) {
  const layout = islandLayout(ctx, island)
  const { o, outline, faces, body, plinth, runs } = layout
  const st = ctx.standards
  const finish = ctx.style?.finish || 'paint'
  const counterMat = MATERIALS[ctx.style?.counter] ? ctx.style.counter : 'granite'
  const id = String(o.id)
  const name = o.name
  const sink = islandSink(ctx, island, layout)
  const steps = []
  const push = (group, cabinet, parts) => { if (parts.length) steps.push({ group, cabinet: String(cabinet), parts }) }

  // body with the basin pocket, and the plinth
  let pocket = null
  let zp = st.toeHeight
  if (sink) {
    pocket = sink.cut.body
    if (!holeInside(body, pocket)) throw new Error('island: the sink does not fit inside the island body')
    zp = Math.min(Math.max(sink.cut.bodyZ[0], st.toeHeight + 0.25), st.baseHeight - 0.25)
  }
  const tags = (role) => ({ tags: { role, cabinet: id } })
  push('island', id, [
    bodySolid(`${name}_body`, body, pocket, st.toeHeight, st.baseHeight, zp, finish, tags('carcass')),
    prism(`${name}_plinth`, plinth, 0, st.toeHeight + o.plinthRise, finish, tags('toe')),
  ])

  // every finished panel, one step
  const panels = []
  faces.forEach((face, e) => {
    if (face.type === 'panels') panels.push(...panelsFace(ctx, runs[e], name, e, face, { cabinet: id }))
    if (face.type === 'end') panels.push(...endFace(ctx, runs[e], name, e, face, { cabinet: id }))
  })
  push('island', id, panels)

  // working faces: one step per item
  faces.forEach((face, e) => {
    if (face.type !== 'working') return
    const run = runs[e]
    const spans = layoutItems(face, run.length, e)
    spans.forEach(({ item, u0, u1 }, k) => {
      const itemName = item.name || (item.no !== undefined ? `${name}${item.no}` : `${name}_e${e}_${k}`)
      const cabinet = String(item.no ?? itemName)
      const { group, parts } = workingItem(ctx, run, itemName, item, u0, u1, { cabinet })
      push(group, cabinet, parts)
    })
    if (face.fill) push('island', id, fillStrips(ctx, run, name, e, spans, { cabinet: id }))
  })

  // the counter, with the sink's opening
  push('counter', id, [prismWithHoles(`${name}_counter`, outline, sink ? [sink.cut.top] : [],
    st.baseHeight, st.baseHeight + st.counterThickness, counterMat, tags('counter'))])

  if (sink) {
    const cab = sink.cabinet ?? id
    const parts = sinkBowl(ctx, sink.name, { ...sink.bowl, cabinet: cab })
    if (sink.faucet) parts.push(...faucet(ctx, sink.faucet.name, { ...sink.faucet, cabinet: cab }))
    push('appliance', cab, parts)
  }
  return steps
}

/** buildIsland, flattened. */
export const islandParts = (ctx, island) => buildIsland(ctx, island).flatMap((s) => s.parts)
