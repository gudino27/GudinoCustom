// The reference kitchen's two wall runs (build_back_wall and build_right_wall
// in scripts/build_kitchen.py) as RunSpec data for buildWallRun
// (cabinets/wallRun.js). The source of truth for reference/homepageKitchen.js
// and the wall parity tests.

/** Wall 1 (back): wall plane y = 0 from x 143.5 to the return at 323.5, fronts facing south. */
export const referenceBackWall = {
  id: 'w1',
  zone: 'back',
  prefix: 'w1',
  from: [143.5, 0],
  to: [323.5, 0],
  normal: [0, 1],
  items: [
    { no: '1', type: 'base-3-drawer', width: 35, options: { splitTop: true } },
    { no: '3', type: 'base-3-drawer', width: 30 },
    // cabinet 4's 44" is the range opening: a 4" filler either side of a 36" range
    { no: '4', type: 'filler', width: 4 },
    { type: 'range', width: 36 },
    { no: '4', type: 'filler', width: 4 },
    { no: '5', type: 'base-3-drawer', width: 30 },
    { no: '7', type: 'upper-glass', width: 35 },
    { no: '9', type: 'upper-glass', width: 30 },
    { type: 'hood', width: 44 },
    { no: '11', type: 'upper-glass', width: 30 },
    // a 41" opening: 3" panel, the 35.625" fridge, 2.375" panel, a 44" deep upper over it
    {
      no: '6',
      type: 'fridge-surround',
      width: 41,
      depth: 26,
      options: { panelName: 'w1_fp', panelLeft: 3, fridgeWidth: 35.625 },
    },
  ],
}

/** Wall 5 (right): wall plane x = 401.2 from y 76.6 for 131", fronts facing west. */
export const referenceRightWall = {
  id: 'w5',
  zone: 'right',
  prefix: 'w5',
  from: [401.2, 76.6],
  to: [401.2, 207.6],
  normal: [-1, 0],
  items: [
    // tower 28 round the 30" double oven's cutout; its north end is flush with the column
    { no: '28', type: 'oven-tower', width: 31.5, options: { carcassInset: [0, 0.04], toeInset: [0, 0] } },
    { no: '29', type: 'base-drawer-doors', width: 33 },
    { no: '31', type: 'base-drawer-doors', width: 33 },
    { no: '32', type: 'base-drawer-doors', width: 33.5 },
    // uppers 33 / 35 / 36; the Python names them after the bases below
    { no: '33', type: 'upper-glass', width: 33, name: 'w5u29' },
    { no: '35', type: 'upper-glass', width: 33, name: 'w5u31' },
    { no: '36', type: 'upper-glass', width: 33.5, name: 'w5u32' },
  ],
}
