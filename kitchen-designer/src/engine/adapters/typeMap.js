// Designer element type -> engine catalog type.
//
// Every key of the website's `elementTypes` (src/constants/elementTypes.js, 34
// types) has one row here. The table is also the engine catalog's shopping
// list: `ENGINE_TYPES` is every engine type the designer needs, and the
// `needs` notes say what the builder has to support beyond a plain box.
//
// Row fields:
//   type     engine catalog type (or 'fixture' for things the engine does not build)
//   level    'base' | 'upper' | 'tall' | 'appliance' | 'fixture'
//   options  passed through on the placement (merged under the element's own options)
//   needs    what the engine builder must do for this row (documentation only)

/** @typedef {{ type: string, level: string, options: Object, needs?: string }} TypeRow */

/** @type {Record<string, TypeRow>} */
export const TYPE_MAP = {
  // ---------- kitchen cabinets ----------
  base: {
    type: 'base-drawer-doors',
    level: 'base',
    options: {},
    needs: 'one drawer over a door (pair above doorSplitWidth); frontsDrawerDoors',
  },
  'sink-base': {
    type: 'sink-base',
    level: 'base',
    options: { sink: true },
    needs: 'false drawer front over a door pair; counter cutout + sinkBowl + faucet',
  },
  wall: {
    type: 'upper-solid',
    level: 'upper',
    options: {},
    needs: 'panel doors; height and mount height come from the placement',
  },
  tall: {
    type: 'tall',
    level: 'tall',
    options: {},
    needs: 'full-height doors split upper/lower when taller than ~60"',
  },
  corner: {
    type: 'corner-base',
    level: 'base',
    options: { lazySusan: true, legDepth: 24 },
    needs: 'L-shaped carcass in a width x depth square; returnSide from hingeDirection; L counter',
  },
  'drawer-base': {
    type: 'base-3-drawer',
    level: 'base',
    options: { drawers: 3 },
    needs: 'frontsThreeDrawers',
  },
  'double-drawer-base': {
    type: 'drawer-base',
    level: 'base',
    options: { drawers: 2 },
    needs: 'two equal deep drawers (pots and pans)',
  },
  'glass-wall': {
    type: 'upper-glass',
    level: 'upper',
    options: { glass: true },
    needs: 'glassFront doors + interior shelves visible through the glass',
  },
  'open-shelf': {
    type: 'open-shelf',
    level: 'upper',
    options: { shelves: 2 },
    needs: 'box with no fronts; finished interior; wall-mounted (designer mountHeight 54)',
  },
  'island-base': {
    type: 'island-base',
    level: 'base',
    options: { island: true, finishedBack: true },
    needs: 'free-standing: panelled back and ends, counter overhang for seating',
  },
  'peninsula-base': {
    type: 'island-base',
    level: 'base',
    options: { peninsula: true, finishedBack: true },
    needs: 'like island-base but one end meets a run or wall (no end panel there)',
  },
  pantry: {
    type: 'pantry',
    level: 'tall',
    options: {},
    needs: 'tall doors with roll-outs; like tall but shelves at pantry spacing',
  },
  'refrigerator-cabinet': {
    type: 'fridge-surround',
    level: 'tall',
    options: {},
    needs: 'side panel either side of the fridge opening + the deep upper over it; builds the fridge it houses '
      + '(designerToJob `housed`) or none (appliance: false)',
  },
  'corner-wall': {
    type: 'corner-upper',
    level: 'upper',
    options: { legDepth: 12 },
    needs: 'L or diagonal upper in a width x depth square; returnSide from hingeDirection',
  },

  // ---------- bathroom cabinets ----------
  vanity: {
    type: 'vanity-doors',
    level: 'base',
    options: { vanity: true },
    needs: 'base-doors at vanity height (32) and depth (21)',
  },
  'vanity-sink': {
    type: 'vanity-sink',
    level: 'base',
    options: { vanity: true, sink: true, sinks: 1 },
    needs: 'sink-base at vanity height/depth; vanity top with one bowl',
  },
  medicine: {
    type: 'upper-solid',
    level: 'upper',
    options: { medicine: true },
    needs: 'shallow (6") upper, single door',
  },
  linen: {
    type: 'tall',
    level: 'tall',
    options: { linen: true },
    needs: 'narrow tall at 21" depth',
  },
  'double-vanity': {
    type: 'vanity-sink',
    level: 'base',
    options: { vanity: true, sink: true, sinks: 2 },
    needs: 'two sink bays with a drawer bank between',
  },
  'floating-vanity': {
    type: 'vanity-sink',
    level: 'base',
    options: { vanity: true, sink: true, sinks: 1, floating: true },
    needs: 'no toe kick, finished bottom; bottom = designer mountHeight (0 unless the customer set one)',
  },
  'corner-vanity': {
    type: 'vanity-corner',
    level: 'base',
    options: { vanity: true, sink: true, sinks: 1 },
    needs: 'corner-base at vanity height/depth with a sink',
  },
  'vanity-tower': {
    type: 'tall',
    level: 'tall',
    options: { vanity: true, tower: true },
    needs: 'narrow tall, often sits on the vanity top in real jobs (designer: floor)',
  },
  'medicine-mirror': {
    type: 'upper-solid',
    level: 'upper',
    options: { medicine: true, mirror: true },
    needs: 'shallow upper whose door is a mirror (new front kind)',
  },
  'linen-tower': {
    type: 'tall',
    level: 'tall',
    options: { linen: true, tower: true },
    needs: 'tall at 18" depth',
  },

  // ---------- kitchen appliances ----------
  refrigerator: {
    type: 'refrigerator',
    level: 'appliance',
    options: {},
    needs: 'fridge(): Bosch B36CT80SNB in the reference; scale to the placement box',
  },
  stove: {
    type: 'stove',
    level: 'appliance',
    options: {},
    needs: 'rangeStove(): reference is 36"; designer default is 30" x 26"',
  },
  dishwasher: {
    type: 'dishwasher',
    level: 'appliance',
    // the whole machine, not just the door: designer layouts show its sides
    options: { full: true },
    needs: 'dishwasher() under the counter run',
  },
  microwave: {
    type: 'microwave',
    level: 'appliance',
    options: { mount: 'wall' },
    needs: 'microwave(): designer places it on the wall at mountHeight 54, not in a cabinet',
  },
  'wine-cooler': {
    type: 'wine-cooler',
    level: 'appliance',
    options: {},
    needs: 'wineCooler() under the counter run',
  },
  'range-hood': {
    type: 'range-hood',
    level: 'appliance',
    options: {},
    needs: 'rangeHood(): designer gives a 36 x 18 x 12 box at mountHeight 66',
  },
  'double-oven': {
    type: 'double-oven',
    level: 'appliance',
    options: { tower: false },
    needs: 'wallOvens(): reference sits in a tower cutout; designer places a bare 50" unit',
  },

  // ---------- bathroom fixtures (no engine builder) ----------
  toilet: { type: 'fixture', level: 'fixture', options: { kind: 'toilet' } },
  bathtub: { type: 'fixture', level: 'fixture', options: { kind: 'bathtub' } },
  shower: { type: 'fixture', level: 'fixture', options: { kind: 'shower' } },
}

/** Every engine type the designer needs, excluding 'fixture'. */
export const ENGINE_TYPES = [...new Set(Object.values(TYPE_MAP).map((r) => r.type))]
  .filter((t) => t !== 'fixture')
  .sort()

/**
 * Engine type and options for one designer element type. Unknown types come
 * back as a fixture of that kind, flagged `unknown: true`, so nothing is lost.
 */
export function mapElementType(designerType) {
  const row = TYPE_MAP[designerType]
  if (!row) {
    return { type: 'fixture', level: 'fixture', options: { kind: designerType }, unknown: true }
  }
  return { type: row.type, level: row.level, options: { ...row.options } }
}

/** Designer types in `elementTypes` that have no row here (should be []). */
export const unmappedTypes = (elementTypes) => Object.keys(elementTypes || {}).filter((t) => !TYPE_MAP[t])
