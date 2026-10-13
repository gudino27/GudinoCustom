// World-space box projection, 1 UV unit = 1 metre: the UVs build_kitchen.py's
// add_box_uvs() wrote, as they came out of Blender's glTF exporter (Blender
// Y = -three Z, and the exporter stores v' = 1 - v). Derived from, and tested
// against, TEXCOORD_0 of public/models/kitchen.glb. In three.js space (X east,
// Y up, Z south, metres), by the face normal's dominant axis:
//
//   |nx| largest  ->  u = -Z,  v = 1 - Y
//   |nz| largest  ->  u =  X,  v = 1 - Y
//   |ny| largest  ->  u =  X,  v = 1 + Z
//
// Ties go to the first axis in the order X, Z, Y (Blender's x, y, z), as in
// add_box_uvs; at an exact 45-degree tie Blender's own choice follows float
// noise, so either mapping is "the same" there.

/** Which projection a face with normal n uses: 0 = X, 1 = Z, 2 = Y (three.js axes). */
export function boxAxis(nx, ny, nz) {
  const ax = Math.abs(nx)
  const ay = Math.abs(ny)
  const az = Math.abs(nz)
  // max over Blender axes (x, y, z) = three (X, Z, Y); first maximum wins
  let best = 0
  let bestVal = ax
  if (az > bestVal) { best = 1; bestVal = az }
  if (ay > bestVal) best = 2
  return best
}

/** UV of three.js point (x, y, z) on a face projected along `axis` (see boxAxis). */
export function boxUV(axis, x, y, z) {
  if (axis === 0) return [-z, 1 - y]
  if (axis === 1) return [x, 1 - y]
  return [x, 1 + z]
}
