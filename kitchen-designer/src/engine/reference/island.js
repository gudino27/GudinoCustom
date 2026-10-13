// The reference kitchen's island (scripts/build_kitchen.py build_island), as
// data for island/index.js buildIsland. Edges are those of the counter outline:
//
//   0 north end            end panel
//   1 leg A east           working: 17 filler strip, 49 dishwasher, 13 sink base
//   2 45-degree inner      working: 37 drawer over doors
//   3 leg B north          working: 24, 23, 22, 20 drawer over doors
//   4 east end             end panel
//   5 leg B south          panels (seating side)
//   6 45-degree outer      panels
//   7 leg A west           panels

/** @type {import('../island/schema.js').Island} */
export const REFERENCE_ISLAND = {
  id: 'island',
  name: 'isl',
  outline: [
    [158.3, 75.1], [199.4, 75.1], [199.4, 138.8], [210.9, 150.3],
    [319.5, 150.3], [319.5, 191.5], [211.8, 191.5], [158.5, 138.2],
  ],
  bodyInset: 1.0,
  plinthProud: 0.8,
  plinthRise: 0.05,
  faces: [
    { type: 'end' },
    {
      type: 'working',
      items: [
        { no: '17', type: 'panel', width: 2 },
        { no: '49', type: 'dishwasher', width: 24 },
        { no: '13', type: 'sink-base', apronHeight: 6 },
      ],
    },
    {
      type: 'working',
      // the Python names this one's cells isl37 / isl37t, not _dr / _tp
      items: [{ no: '37', type: 'drawer-doors', drawerHeight: 6.5, suffixes: { doors: '', drawer: 't' } }],
    },
    {
      type: 'working',
      items: [
        { no: '24', type: 'drawer-doors', width: 19.5 },
        { no: '23', type: 'drawer-doors', width: 28 },
        { no: '22', type: 'drawer-doors', width: 30 },
        { no: '20', type: 'drawer-doors', width: 30 },
      ],
    },
    { type: 'end' },
    { type: 'panels', module: 24 },
    { type: 'panels', module: 24 },
    { type: 'panels', module: 24 },
  ],
  // straight off the plan (PDF p2): an 18 x 33.4 bowl, the faucet west of it
  sink: { cx: 188.3, cy: 120.7, width: 18.0, length: 33.4, depth: 9.0, wall: 0.5, edge: 1 },
  faucet: { x: 175.7, y: 120.7 },
}
