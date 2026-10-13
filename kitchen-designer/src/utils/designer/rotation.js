// Element rotation in the designer: degrees, clockwise seen from above.
//
// Stored values are kept in [0, 360). Rotating with the -15 / anticlockwise
// buttons used to store negative angles (-90, -180), and code that asked
// "rotation === 0 || rotation === 180" then treated a stove turned to face
// wall 3 as turned sideways: width and depth swapped, and it stopped short of
// the wall. Everything that needs the angle goes through these.

/** Any angle in degrees -> [0, 360). */
export const normalizeRotation = (rotation) => {
  const r = Number(rotation) || 0;
  const n = ((r % 360) + 360) % 360;
  return n === 360 ? 0 : n;
};

/** True when the element sits turned a quarter (90 / 270): its plan footprint swaps width and depth. */
export const isQuarterTurned = (rotation) => {
  const n = normalizeRotation(rotation);
  // nearest multiple of 90, so 88 or 272 from a 3D drag still count
  return Math.round(n / 90) % 2 === 1;
};

/** The element's plan footprint { width, depth } (inches times `scale`), after rotation. */
export const footprint = (element, scale = 1) => (
  isQuarterTurned(element.rotation)
    ? { width: element.depth * scale, depth: element.width * scale }
    : { width: element.width * scale, depth: element.depth * scale }
);

/**
 * Turn an element by `angle` degrees about its centre and keep it inside the
 * room. x / y are the top-left of the plan footprint (as the floor plan stores
 * them), so a quarter turn that swaps width and depth would otherwise pivot on
 * the corner and push the item through a wall.
 *
 * @param {Object} element  { x, y, width, depth, rotation } (x, y in plan px)
 * @param {number} angle    degrees to add
 * @param {Object} room     { width, depth } in plan px
 * @param {number} scale    plan px per inch
 * @returns {{ rotation: number, x: number, y: number }}
 */
export const rotateInRoom = (element, angle, room, scale = 1) => {
  const rotation = normalizeRotation((element.rotation || 0) + angle);
  const before = footprint(element, scale);
  const after = footprint({ ...element, rotation }, scale);
  const clamp = (v, max) => Math.max(0, Math.min(v, Math.max(0, max)));
  return {
    rotation,
    x: clamp(element.x + (before.width - after.width) / 2, room.width - after.width),
    y: clamp(element.y + (before.depth - after.depth) / 2, room.depth - after.depth),
  };
};

// Medicine cabinets / mirrors carry hand-tuned per-rotation offsets in
// DraggableCabinet that were written against the old pivot; they keep it.
const OLD_PIVOT_TYPES = new Set(['medicine', 'medicine-mirror']);

/**
 * SVG transform that draws an element (body drawn width x depth from 0,0,
 * before rotation) turned about its centre so it fills its footprint at
 * (x, y). The old code centred it on the already-swapped footprint, which put
 * quarter-turned items (width - depth) / 2 off their spot: into one wall and
 * away from the other.
 */
export const planTransform = (element, x, y, scale = 1) => {
  const rotation = element.rotation || 0;
  if (rotation === 0) return `translate(${x}, ${y})`;
  const fp = footprint(element, scale);
  const body = OLD_PIVOT_TYPES.has(element.type)
    ? fp
    : { width: element.width * scale, depth: element.depth * scale };
  return `translate(${x + fp.width / 2}, ${y + fp.depth / 2}) rotate(${rotation}) translate(${-body.width / 2}, ${-body.depth / 2})`;
};

/**
 * Where the 3D view stands an element: the plan point (inches) it turns
 * about, from its stored top-left (x, y in plan px). That is the centre of
 * the rotated footprint, as the floor plan and the engine view use, so a
 * quarter-turned item sits on its plan footprint in 3D too. Medicine cabinets
 * / mirrors keep the old pivot (x + width / 2, y + depth / 2), which their
 * hand-tuned offsets were written against.
 *
 * @returns {[number, number]} [x, z] in inches (plan y -> three z)
 */
export const centerFromTopLeft = (element, x = element.x, y = element.y, scale = 1) => {
  if (OLD_PIVOT_TYPES.has(element.type)) {
    return [x / scale + element.width / 2, y / scale + element.depth / 2];
  }
  const fp = footprint(element, 1);
  return [x / scale + fp.width / 2, y / scale + fp.depth / 2];
};

/**
 * The inverse of centerFromTopLeft: stored { x, y } (plan px) for an element
 * whose turning point is at `center` (inches) with `rotation` degrees, so a
 * move or turn in 3D writes back the footprint top-left the plan expects.
 */
export const topLeftFromCenter = (element, center, rotation = element.rotation, scale = 1) => {
  const turned = { ...element, rotation };
  const half = OLD_PIVOT_TYPES.has(element.type)
    ? { width: element.width / 2, depth: element.depth / 2 }
    : (({ width, depth }) => ({ width: width / 2, depth: depth / 2 }))(footprint(turned, 1));
  return { x: (center[0] - half.width) * scale, y: (center[1] - half.depth) * scale };
};
