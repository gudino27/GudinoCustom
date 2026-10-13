// The reference kitchen's room (build_room, build_hallway and build_enclosure
// in scripts/build_kitchen.py) as data in the room schema (room/schema.js).
// buildRoom(jobCtx({}), referenceRoom) reproduces its 82 parts.

const W1_LEN = 323.5
const W9_LEN = 204
const W5_X = 401.2
const W5_WALL_T = 13.2
const W5_Y0 = 76.6
const W5_LEN = 131
const X_FAR = W5_X + W5_WALL_T // 414.4
const FAR_Y = -72 // end wall of the hallway / next room
const Y_FAR = 1100 // floor and ceiling run far past the camera
const ENCLOSE_Y = 300 // plain wall across the south, behind the island
const HALL_T = 6

// floor and ceiling reach well past the camera so no slab edge enters frame
const SHELL_RECT = [-6, FAR_Y - 8, X_FAR + 400, Y_FAR]

const win48 = (at) => ({ kind: 'window', at, width: 48, sill: 36, head: 96, grid: [3, 3] })

/** @type {import('../room/schema.js').Room} */
export const referenceRoom = {
  height: 120,
  floor: { rect: SHELL_RECT, thickness: 1, material: 'oak' },
  ceiling: { rect: SHELL_RECT, thickness: 2, material: 'ceil' },
  walls: [
    // wall 1 (back), carried on across the hallway aperture to the oven wall.
    // Built as boxes around its openings (w1_a, w1_head, w1_b) as the Python does.
    {
      name: 'w1',
      from: [0, 0],
      to: [W5_X, 0],
      side: 'right',
      thickness: 6,
      extend: [6, 0],
      split: true,
      openings: [
        // Door71: a pair of raised-panel leaves in a cased opening
        {
          kind: 'door',
          name: 'w1_door',
          at: 22,
          width: 71,
          head: 82,
          leaves: 2,
          leaf: { bottom: 0.5, top: 79.6, v: [-4.4, -2.65] },
          casing: { name: 'w1_case', outside: 1.5, lap: 0, headDown: 2, headUp: 0.5, v: [-6, 0.8] },
        },
        // the 77.7" aperture into the hallway, with its own header and casing
        // (the casing sits at the wall's hallway face, as in the Python)
        {
          kind: 'cased-opening',
          at: W1_LEN,
          width: W5_X - W1_LEN,
          head: 96,
          header: { name: 'hall_header', overhang: HALL_T + 1 },
          casing: {
            names: { left: 'hall_case_w', right: 'hall_case_e', head: 'hall_case_h' },
            outside: HALL_T + 1,
            lap: 0.8,
            headDown: 2,
            headUp: 0,
            v: [-6.6, -5.4],
          },
        },
      ],
    },
    // wall 2: the 24" return that finishes wall 1
    { name: 'w1_return', from: [W1_LEN, 0], to: [W1_LEN, 24], side: 'right', thickness: 5 },
    // the next room's end wall, seen through the hallway
    {
      name: 'w_far',
      from: [250, FAR_Y],
      to: [X_FAR + 170, FAR_Y],
      side: 'right',
      thickness: 6,
      baseboard: { name: 'hall_base_n', s: [W1_LEN - HALL_T - 250, W5_X + HALL_T - 250] },
    },
    // wall 9 (left): one solid with three Win48 openings
    {
      name: 'w9',
      from: [0, 0],
      to: [0, W9_LEN],
      side: 'left',
      thickness: 6,
      extend: [6, 0],
      openings: [win48(25.5), win48(78), win48(130.5)],
    },
    // wall 5 (right) and the column that closes it, run north to the hallway
    { name: 'w5', from: [W5_X, -6], to: [W5_X, W5_Y0 + W5_LEN + 4], side: 'right', thickness: W5_WALL_T },
    // the hallway's side walls. Their baseboards sit inside the wall body in the
    // Python (v -0.9..0); kept for parity, they are hidden.
    {
      name: 'hall_w',
      from: [W1_LEN, -6],
      to: [W1_LEN, FAR_Y],
      side: 'right',
      thickness: HALL_T,
      baseboard: { name: 'hall_base_w', v: [-0.9, 0] },
    },
    {
      name: 'hall_e',
      from: [W5_X, FAR_Y],
      to: [W5_X, -6],
      side: 'right',
      thickness: HALL_T,
      baseboard: { name: 'hall_base_e', v: [-0.9, 0] },
    },
  ],
  beams: [{ name: 'beam', from: [-6, 49], to: [84, 49], width: 10, depth: 11 }],
  cans: [
    ...[[92, 46], [196, 46], [286, 46], [150, 128], [256, 128], [196, 216], [352, 104], [352, 180]]
      .map((at) => ({ at, name: 'can' })),
    // one light in the hallway so it is not a dark slot
    { at: [(W1_LEN + W5_X) / 2, FAR_Y + 46], name: 'hall_can', lensMaterial: 'trim' },
  ],
  // single-sided walls closing the room south of wall 9 and the oven wall
  sheets: [
    { name: 'enc_s', from: [W5_X, ENCLOSE_Y], to: [0, ENCLOSE_Y], side: 'right' },
    { name: 'enc_w', from: [0, ENCLOSE_Y], to: [0, W9_LEN], side: 'right' },
    { name: 'enc_e', from: [W5_X, W5_Y0 + W5_LEN + 4], to: [W5_X, ENCLOSE_Y], side: 'right' },
  ],
}
