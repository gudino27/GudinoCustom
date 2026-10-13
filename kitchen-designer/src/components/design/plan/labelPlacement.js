// Where an item's name goes on the floor plan.
//
// Out in the room on the item's front side first (so a run of cabinets along
// a wall doesn't stack each name on its neighbour), then the other sides; a
// side is taken only when the name lands clear of every other item and inside
// the room (not on a wall). With no clear side the name is left off: the
// number badge and the element list under the plan still identify the item.
//
// No React: runs under `node --test` (tests/designer/labelPlacement.test.js).

import { footprint, normalizeRotation } from '../../../utils/designer/rotation.js';

export const LABEL_GAP = 11; // footprint edge -> centre of a row above / below
export const SIDE_GAP = 6;   // footprint edge -> a row beside the item
export const ROW_H = 12;     // height of one name row

const isCornerType = (type) => type === 'corner' || type === 'corner-wall';

/** Plan footprint { x, y, width, depth } in plan px. */
export const planBox = (element, scale) => {
  const fp = isCornerType(element.type)
    ? { width: element.width * scale, depth: element.width * scale }
    : footprint(element, scale);
  return { x: element.x, y: element.y, width: fp.width, depth: fp.depth };
};

const overlaps = (a, b) => (
  a.x < b.x + b.width && b.x < a.x + a.width &&
  a.y < b.y + b.depth && b.y < a.y + a.depth
);

/** The side the item faces: rotation 0 faces down the plan (+y). */
export const frontSide = (element) => {
  if (isCornerType(element.type)) return 'below';
  const quarter = Math.round(normalizeRotation(element.rotation) / 90) % 4;
  return ['below', 'left', 'above', 'right'][quarter];
};

const OPPOSITE = { below: 'above', above: 'below', left: 'right', right: 'left' };

/** Row reference point and text anchor for `side` around `box`. */
export const rowAt = (box, side) => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.depth / 2;
  switch (side) {
    case 'above': return { x: cx, y: box.y - LABEL_GAP, anchor: 'middle' };
    case 'left': return { x: box.x - SIDE_GAP, y: cy, anchor: 'end' };
    case 'right': return { x: box.x + box.width + SIDE_GAP, y: cy, anchor: 'start' };
    case 'below':
    default: return { x: cx, y: box.y + box.depth + LABEL_GAP, anchor: 'middle' };
  }
};

/** Box a row of width `w` takes at `row`, `lines` rows deep (growing away from the item). */
const rowBox = (row, w, side, lines = 1) => {
  const h = ROW_H * lines;
  const x = row.anchor === 'middle' ? row.x - w / 2 : row.anchor === 'end' ? row.x - w : row.x;
  const y = side === 'above' ? row.y + ROW_H / 2 - h : row.y - ROW_H / 2;
  return { x, y, width: w, depth: h };
};

/**
 * @param {Object} element   the item
 * @param {number} scale     plan px per inch
 * @param {Object} p
 * @param {Array}  p.elements   every item in the room (the item itself is skipped)
 * @param {{width:number, depth:number}} p.room  room size in plan px
 * @param {number} p.width    width of the name row in px
 * @param {number} [p.lines]  rows the label takes (a housed pair: 2)
 * @returns {{ side, x, y, anchor, box } | null}  null: no clear spot
 */
export const placeLabel = (element, scale, { elements = [], room, width, lines = 1 }) => {
  const box = planBox(element, scale);
  // Items sharing the footprint (a fridge in its cabinet, an upper over a
  // base) don't block: the row is outside the footprint anyway
  const others = elements
    .filter((el) => el && el.id !== element.id && Number.isFinite(el.x) && Number.isFinite(el.y))
    .map((el) => planBox(el, scale))
    .filter((b) => !overlaps(b, box));
  const front = frontSide(element);
  const order = [front, OPPOSITE[front], ...['below', 'right', 'above', 'left'].filter((s) => s !== front && s !== OPPOSITE[front])];
  const inRoom = (r) => !room || (
    r.x >= -2 && r.y >= -2 && r.x + r.width <= room.width + 2 && r.y + r.depth <= room.depth + 2
  );
  for (const side of order) {
    const row = rowAt(box, side);
    const r = rowBox(row, width, side, lines);
    if (inRoom(r) && !others.some((b) => overlaps(r, b))) {
      return { side, ...row, box };
    }
  }
  return null;
};
