// Everything in the engine is authored in plan inches:
//   x = east, y = south, z = up
// measured from the room's north-west inside corner, exactly as the shop
// drawings and scripts/build_kitchen.py do. three.js is metres, y-up.
export const IN = 0.0254

/** plan inches [x, y, z] -> three.js metres [x, y, z] (east, up, south) */
export const toThree = ([x, y, z]) => [x * IN, z * IN, y * IN]

/** three.js metres -> plan inches */
export const toPlan = ([x, y, z]) => [x / IN, z / IN, y / IN]

/** Same helper the homepage scene uses for cameras and lights. */
export const at = (east, south, up) => [east * IN, up * IN, south * IN]
