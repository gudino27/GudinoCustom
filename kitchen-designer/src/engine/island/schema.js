// The island as data: what buildIsland (island/index.js) draws.
//
// An island is a free-standing block of base cabinets described by its COUNTER
// OUTLINE, a plan polygon in inches (x east, y south). Everything else hangs
// off the edges of that outline:
//
//   - the BODY is one closed solid (toe height to base height), the outline
//     pulled in by `bodyInset` on every edge (or by that edge's own `inset`:
//     a seating overhang is simply a bigger inset on that side);
//   - the PLINTH follows the body, standing `plinthProud` out from it;
//   - every edge of the outline has a FACE (same order as the outline's
//     edges: edge i runs from outline[i] to outline[i + 1]) that says what is
//     applied to the body on that side: raised `panels` at a module, one
//     finished `end` panel, `working` fronts and appliances, or `none`;
//   - the COUNTER is the outline itself, `counterThickness` thick, with the
//     sink's opening;
//   - the SINK is an undermount basin hollowed into the body, and the FAUCET
//     stands behind it.
//
// Working items are laid along the body edge in the edge's own frame (a Run):
//   u  distance along the body edge, from its start vertex toward its end
//   v  back from the door face; z up
// so `width` is measured on the body edge (the panel line), not the counter.

/**
 * @typedef {[number, number]} Point2
 */

/**
 * @typedef {Object} Island
 * @property {string}   [id='island']     cabinet tag of the body, plinth, panels and counter
 * @property {string}   [name='isl']      part-name prefix: `${name}_body`, `${name}_pn3_0`, `${name}${item.no}`
 * @property {Point2[]} outline           the counter outline (convex or concave, either winding)
 * @property {number}   [bodyInset=1]     counter edge to body face (the panel line), every edge
 * @property {number}   [plinthProud=0.8] how far the plinth stands out from the body face
 * @property {number}   [plinthRise=0.05] the plinth rises this far above toeHeight (under the fronts)
 * @property {Array<IslandFace|undefined>} [faces]  one per outline edge; a missing entry is `{ type: 'panels' }`
 * @property {IslandSink|null}   [sink]   omit or null for an island without a sink
 * @property {IslandFaucet|false} [faucet] omit for the default faucet behind the sink; false for none
 */

/**
 * What is applied to the body on one edge.
 * @typedef {Object} IslandFace
 * @property {'panels'|'end'|'working'|'none'} type
 *   panels   finished back: raised panels, round(length / module) of them (at least one)
 *   end      one finished end panel along the whole edge
 *   working  cabinet fronts and appliances, `items`, laid left to right from `start`
 *   none     bare body (a peninsula's wall end)
 * @property {number}  [inset]     counter edge to body face on this edge (overrides `bodyInset`)
 * @property {number}  [overhang]  seating overhang: the counter runs this far past the usual
 *                                 `bodyInset` line (inset = bodyInset + overhang)
 * @property {number}  [module=24] panels: target panel width
 * @property {number}  [margin=0.5] panels / end: gap left at each end of every panel
 * @property {number}  [lift=0.7]  panels / end: panels stop this far above toeHeight and below baseHeight
 * @property {IslandItem[]} [items] working: along the edge, left to right as you face it
 * @property {number}  [start=0]   working: u where the first item starts
 * @property {boolean} [fill=false] working: cover what the items leave bare at either end of the
 *                                 edge with panel strips (`${name}_f${edge}_0`, `_1`)
 */

/**
 * One cabinet or appliance on a working face. Each is one build step.
 * @typedef {Object} IslandItem
 * @property {string|number} [no]   cabinet number: the tags' `cabinet` and the default name `${island.name}${no}`
 * @property {string} [name]        part-name prefix (overrides the one made from `no`)
 * @property {'panel'|'doors'|'drawer-doors'|'sink-base'|'drawers'|'dishwasher'|'wine-cooler'|'microwave'} type
 *   panel         an applied panel strip on exactly its rectangle (toe to base)
 *   doors         one door, or a pair when wider than doorSplitWidth, toe to base
 *   drawer-doors  a drawer (`drawerHeight`) over doors
 *   sink-base     a false front (`apronHeight`) over doors; also where the sink goes by default
 *   drawers       three stacked drawers (`heights`, `splitTop`)
 *   dishwasher, wine-cooler, microwave   appliances (appliances/index.js buildAppliance)
 * @property {number} [width]       along the body edge; omitted = share of what the others leave
 * @property {number} [drawerHeight=6.5]  drawer-doors
 * @property {number} [apronHeight=6]     sink-base
 * @property {{doors?: string, drawer?: string, front?: string}} [suffixes]  name suffixes of the
 *                                  cells: drawer-doors `{ doors: '_dr', drawer: '_tp' }`,
 *                                  sink-base `{ doors: '', front: '_apron' }`
 * @property {boolean} [splitTop]   drawers: top drawer split in two
 * @property {number[]} [heights]   drawers: the two lower drawer heights ([12.5, 12.5])
 * @property {'top'|'bottom'} [pullAt='top']  door pulls
 * @property {Object} [construction]  per-cabinet overrides (model/context.js itemCtx)
 * @property {Object} [style]
 * @property {Object} [standards]
 * @property {Object} [options]     appliances: passed through to the builder
 */

/**
 * Undermount basin. Place it by plan centre (`cx`, `cy`) or relative to a
 * working edge (`edge` + `u` + `setback`). `edge` also turns the basin so its
 * `length` runs along that edge and the faucet reaches toward it.
 * @typedef {Object} IslandSink
 * @property {number} [cx]          plan centre
 * @property {number} [cy]
 * @property {number} [edge]        the outline edge the sink faces (the one you stand at)
 * @property {number} [u]           centre along that body edge; default the middle of its sink-base
 *                                  item, else of the edge
 * @property {number} [setback]     counter edge to the basin's centre; default width / 2 + 2.1
 * @property {number} [width=18]    across the edge (plan x when angle 0)
 * @property {number} [length=33.4] along the edge (plan y when angle 0)
 * @property {number} [depth=9]
 * @property {number} [wall=0.5]
 * @property {number} [angle]       degrees clockwise seen from above; default from `edge`, else 0
 * @property {string|number} [cabinet]  default the sink-base item's `no`
 * @property {string} [name='sink']
 */

/**
 * @typedef {Object} IslandFaucet
 * @property {number} [x]           plan position; default `behind` the sink's centre
 * @property {number} [y]
 * @property {number} [behind]      centre of the sink to the faucet, away from the edge (width / 2 + 3.6)
 * @property {number} [angle]       direction the spout reaches, degrees (0 = east); default toward the edge
 * @property {number} [reach]
 * @property {number} [height]
 * @property {string} [name='faucet']
 */

/**
 * One build step: the orchestrator numbers them in this order.
 * @typedef {Object} IslandStep
 * @property {'island'|'appliance'|'counter'} group
 * @property {string} cabinet
 * @property {import('../core/part.js').Part[]} parts
 */

export const ISLAND_DEFAULTS = {
  id: 'island',
  name: 'isl',
  bodyInset: 1.0,
  plinthProud: 0.8,
  plinthRise: 0.05,
}

export const FACE_DEFAULTS = {
  module: 24,
  margin: 0.5,
  lift: 0.7,
}

export const ITEM_DEFAULTS = {
  drawerHeight: 6.5,
  apronHeight: 6.0,
}

export const FACE_TYPES = ['panels', 'end', 'working', 'none']
export const ITEM_TYPES = ['panel', 'doors', 'drawer-doors', 'sink-base', 'drawers', 'dishwasher', 'wine-cooler', 'microwave']
export const APPLIANCE_ITEMS = new Set(['dishwasher', 'wine-cooler', 'microwave'])
