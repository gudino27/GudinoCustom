// Walk-in / butler's pantry: a room inside the room, built from custom walls.
//
// A pantry is stored in roomData.pantries as its INTERIOR rectangle in plan px
// (same units and origin as element x / y: px at `scale`, (0, 0) the room's
// inside north-west corner):
//
//   { id, shape: 'L' | 'U' | 'straight', x, y, width, depth,   // plan px
//     thickness,                        // wall thickness, inches (default 4.5)
//     opening: { side, center, width }, // cased opening: side 'n'|'e'|'s'|'w',
//                                       // centre in inches from the side's
//                                       // north / west end, width in inches
//     wallNumbers: { n, e, s, w } }     // stable wall number per side
//
// Its walls are derived: every side of the rectangle that does not lie on a
// room wall that is present becomes a partition, a custom wall in
// roomData.customWalls (pantryId, pantrySide, pantryInside = the face inside
// the pantry, group / groupName for the 3D camera), centred half a thickness
// outside the interior so the pantry's inside is exactly width x depth.
// North / south partitions run over the corners they share with east / west
// partitions, so the corners close without overlap. The opening is a door of
// type 'cased-opening' in roomData.doors (pantryId set).
//
// syncPantries rebuilds all of that from roomData.pantries; every change goes
// through it. Pure functions, no React: runs under `node --test`.
import { footprint } from './rotation.js';
import { findOverlappingElement } from './collisionUtils.js';
import { findWallOverlap, elementsOnWallFace } from './wallFaces.js';
import { cleanNumber, roundInches, roundPlanPx, roundPlanRect } from './planUnits.js';

export const PANTRY_DEFAULTS = {
  width: 72, // inches, east-west (6')
  depth: 60, // inches, north-south (5')
  thickness: 4.5, // 2x4 stud and drywall both sides
  openingWidth: 36,
  minOpening: 24,
  maxOpening: 60,
  minSize: 30, // smallest inside size, inches
  snap: 12, // an edge this close (inches) to a room wall joins it
};

export const PANTRY_SHAPES = ['L', 'U', 'straight'];
export const SIDES = ['n', 'e', 's', 'w'];
const ROOM_WALL = { n: 1, e: 2, s: 3, w: 4 };
// Face of each side's wall that looks into the pantry (see wallFaces.js)
const INSIDE_FACE = { n: 'right', e: 'right', s: 'left', w: 'left' };

const EPS = 0.01;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Room size in plan px. */
export const roomPx = (roomData, scale = 1) => ({
  width: (parseFloat(roomData.dimensions?.width) || 0) * 12 * scale,
  depth: (parseFloat(roomData.dimensions?.height) || 0) * 12 * scale,
});

const roomWallsPresent = (roomData) => roomData.walls || [1, 2, 3, 4];

/** Sides of the pantry that stand on a room wall that is there (no partition needed). */
export const roomSides = (pantry, roomData, scale = 1) => {
  const room = roomPx(roomData, scale);
  const present = roomWallsPresent(roomData);
  const on = {
    n: pantry.y <= EPS,
    w: pantry.x <= EPS,
    e: pantry.x + pantry.width >= room.width - EPS,
    s: pantry.y + pantry.depth >= room.depth - EPS,
  };
  return SIDES.filter((side) => on[side] && present.includes(ROOM_WALL[side]));
};

/** Sides that get a partition wall, in n, e, s, w order. */
export const partitionSides = (pantry, roomData, scale = 1) => {
  const against = roomSides(pantry, roomData, scale);
  return SIDES.filter((side) => !against.includes(side));
};

/** Shape name from which sides stand on room walls. */
export const shapeOf = (pantry, roomData, scale = 1) => {
  const n = partitionSides(pantry, roomData, scale).length;
  if (n <= 1) return 'straight';
  if (n === 2) return 'L';
  if (n === 3) return 'U';
  return 'island';
};

/** Inside length of a side (plan px). */
const sideLength = (pantry, side) => (side === 'n' || side === 's' ? pantry.width : pantry.depth);

/**
 * The wall segment of one partition side (plan px) and where the pantry's
 * inside starts along it (`start`, px from x1,y1).
 */
export const sideSegment = (pantry, side, parts, scale = 1) => {
  const t = (pantry.thickness || PANTRY_DEFAULTS.thickness) * scale;
  const x0 = pantry.x;
  const y0 = pantry.y;
  const x1 = pantry.x + pantry.width;
  const y1 = pantry.y + pantry.depth;
  if (side === 'n' || side === 's') {
    const y = side === 'n' ? y0 - t / 2 : y1 + t / 2;
    const xa = x0 - (parts.includes('w') ? t : 0);
    const xb = x1 + (parts.includes('e') ? t : 0);
    return { x1: xa, y1: y, x2: xb, y2: y, start: x0 - xa };
  }
  const x = side === 'w' ? x0 - t / 2 : x1 + t / 2;
  return { x1: x, y1: y0, x2: x, y2: y1, start: 0 };
};

/** The pantry's footprint including its walls (plan px). */
export const outerRect = (pantry, roomData, scale = 1) => {
  const parts = partitionSides(pantry, roomData, scale);
  const t = (pantry.thickness || PANTRY_DEFAULTS.thickness) * scale;
  const x0 = pantry.x - (parts.includes('w') ? t : 0);
  const y0 = pantry.y - (parts.includes('n') ? t : 0);
  const x1 = pantry.x + pantry.width + (parts.includes('e') ? t : 0);
  const y1 = pantry.y + pantry.depth + (parts.includes('s') ? t : 0);
  return { x: x0, y: y0, width: x1 - x0, depth: y1 - y0 };
};

const rectsOverlap = (a, b, tol = 0) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > tol &&
  Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y) > tol;

/** The opening kept on a partition side and inside its length. */
export const normalizeOpening = (pantry, parts, scale = 1) => {
  if (!parts.length) return { ...pantry.opening };
  const current = pantry.opening || {};
  let side = parts.includes(current.side) ? current.side : null;
  let center = Number(current.center);
  if (!side) {
    // the longest partition, the front (north / south) on a tie
    side = [...parts].sort((a, b) => sideLength(pantry, b) - sideLength(pantry, a))[0];
    center = NaN;
  }
  // inches to 1/16": 125 px / 4.1666 px per inch is 29.999999999999996, and
  // an opening 4" shorter than that was stored as 25.999999999999996
  const lengthIn = roundInches(sideLength(pantry, side) / scale);
  const maxWidth = Math.max(12, Math.min(PANTRY_DEFAULTS.maxOpening, lengthIn - 4));
  const width = roundInches(
    clamp(Number(current.width) || PANTRY_DEFAULTS.openingWidth, Math.min(PANTRY_DEFAULTS.minOpening, maxWidth), maxWidth)
  );
  const margin = Math.min(2, (lengthIn - width) / 2);
  if (!Number.isFinite(center)) center = lengthIn / 2;
  center = clamp(center, width / 2 + margin, lengthIn - width / 2 - margin);
  return { side, center: roundInches(center), width };
};

/** Next free wall number in the room. */
export const nextWallNumber = (roomData) => {
  const used = [
    4,
    ...(roomData.allAvailableWalls || []),
    ...(roomData.walls || []),
    ...(roomData.customWalls || []).map((w) => w.wallNumber),
    ...(roomData.pantries || []).flatMap((p) => Object.values(p.wallNumbers || {})),
  ].filter(Number.isFinite);
  return Math.max(...used) + 1;
};

/** Custom walls and the cased opening of one pantry. */
export const pantryWallsAndDoors = (pantry, roomData, scale = 1) => {
  const parts = partitionSides(pantry, roomData, scale);
  const thickness = pantry.thickness || PANTRY_DEFAULTS.thickness;
  const walls = [];
  const doors = [];
  const opening = normalizeOpening(pantry, parts, scale);
  for (const side of parts) {
    const seg = sideSegment(pantry, side, parts, scale);
    const wallNumber = pantry.wallNumbers[side];
    walls.push({
      id: `${pantry.id}-${side}`,
      x1: cleanNumber(seg.x1),
      y1: cleanNumber(seg.y1),
      x2: cleanNumber(seg.x2),
      y2: cleanNumber(seg.y2),
      thickness, // inches, as the 3D views read it
      thicknessIn: thickness,
      isCustom: true,
      existedPrior: !!pantry.existedPrior,
      wallNumber,
      doors: [],
      pantryId: pantry.id,
      pantrySide: side,
      pantryInside: INSIDE_FACE[side],
      group: pantry.id,
      groupName: 'Pantry',
    });
    if (opening.side === side) {
      const length = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
      doors.push({
        id: `${pantry.id}-opening`,
        wallNumber,
        position: cleanNumber(((seg.start + opening.center * scale) / length) * 100),
        width: opening.width,
        type: 'cased-opening',
        pantryId: pantry.id,
        existedPrior: !!pantry.existedPrior,
      });
    }
  }
  return { walls, doors, opening };
};

const sortNumbers = (list) => [...new Set(list)].sort((a, b) => a - b);

/**
 * Rebuild every pantry's walls and opening in roomData (customWalls, doors,
 * walls, allAvailableWalls, removedWalls). Walls drawn with "Draw wall" and
 * other doors are left alone. Returns a new roomData.
 */
export const syncPantries = (roomData, scale = 1) => {
  const pantries = roomData.pantries || [];
  let next = { ...roomData };
  // Give every side a wall number once, so a wall keeps its number while the
  // pantry moves (the number an item or door refers to)
  const withNumbers = [];
  for (const pantry of pantries) {
    const wallNumbers = { ...(pantry.wallNumbers || {}) };
    for (const side of SIDES) {
      if (!Number.isFinite(wallNumbers[side])) {
        wallNumbers[side] = nextWallNumber({ ...next, pantries: [...withNumbers, { ...pantry, wallNumbers }] });
      }
    }
    withNumbers.push({ ...pantry, wallNumbers });
  }
  const oldPantryWalls = (roomData.customWalls || []).filter((w) => w.pantryId).map((w) => w.wallNumber);
  const allPantryNumbers = new Set([
    ...oldPantryWalls,
    ...withNumbers.flatMap((p) => Object.values(p.wallNumbers)),
  ]);
  const walls = [];
  const doors = [];
  const normalized = withNumbers.map((pantry) => {
    const built = pantryWallsAndDoors(pantry, roomData, scale);
    walls.push(...built.walls);
    doors.push(...built.doors);
    return { ...pantry, opening: built.opening, shape: pantry.shape || shapeOf(pantry, roomData, scale) };
  });
  const builtNumbers = walls.map((w) => w.wallNumber);
  const keep = (n) => !allPantryNumbers.has(n);
  // Walls of a pantry that is already there count as original walls, so they
  // are not charged (the same as a drawn wall marked "existed prior")
  const priorNumbers = walls.filter((w) => w.existedPrior).map((w) => w.wallNumber);
  next = {
    ...next,
    pantries: normalized,
    customWalls: [...(roomData.customWalls || []).filter((w) => !w.pantryId), ...walls],
    doors: [...(roomData.doors || []).filter((d) => !d.pantryId), ...doors],
    walls: sortNumbers([...(roomData.walls || [1, 2, 3, 4]).filter(keep), ...builtNumbers]),
    allAvailableWalls: sortNumbers([...(roomData.allAvailableWalls || [1, 2, 3, 4]).filter(keep), ...builtNumbers]),
    removedWalls: (roomData.removedWalls || []).filter(keep),
    originalWalls: sortNumbers([...(roomData.originalWalls || [1, 2, 3, 4]).filter(keep), ...priorNumbers]),
  };
  return next;
};

/**
 * Mark a pantry as already built (or not). Its partition walls then count as
 * existing walls and its opening is not charged, like a drawn wall marked
 * "existed prior". Returns a new roomData.
 */
export const setPantryExistedPrior = (roomData, id, existedPrior, scale = 1) => syncPantries({
  ...roomData,
  pantries: (roomData.pantries || []).map((p) => (p.id === id ? { ...p, existedPrior: !!existedPrior } : p)),
}, scale);

/**
 * Keep a pantry rectangle inside the room, at least minSize, with edges that
 * come within `snap` of a room wall joined to it. mode 'move' keeps the size;
 * 'resize' moves the edges.
 */
export const fitRect = (rect, roomData, scale = 1, mode = 'move', thicknessIn = PANTRY_DEFAULTS.thickness, anchor = {}) => {
  const room = roomPx(roomData, scale);
  const present = roomWallsPresent(roomData);
  const t = thicknessIn * scale;
  const snap = PANTRY_DEFAULTS.snap * scale + t;
  const minS = PANTRY_DEFAULTS.minSize * scale;
  // anchor.x / anchor.y: 'low' or 'high', the edge a resize keeps where it is
  const axis = (pos, size, total, lowWall, highWall, keep) => {
    const lo = present.includes(lowWall) ? 0 : t;
    const hi = present.includes(highWall) ? total : total - t;
    const span = Math.max(0, hi - lo);
    if (mode === 'move') {
      const s = clamp(size, Math.min(minS, span), span);
      let p = clamp(pos, lo, hi - s);
      if (present.includes(lowWall) && p < snap) p = 0;
      if (present.includes(highWall) && total - (p + s) < snap) p = total - s;
      return [clamp(p, lo, hi - s), s];
    }
    let a = clamp(pos, lo, hi);
    let b = clamp(pos + size, lo, hi);
    if (present.includes(lowWall) && a < snap) a = 0;
    if (present.includes(highWall) && total - b < snap) b = total;
    if (b - a < minS) {
      // keep the anchored edge where it is and give the other one room
      if (keep === 'high') {
        a = Math.max(lo, b - minS);
        b = Math.max(b, a + minS);
      } else {
        b = Math.min(hi, a + minS);
        a = Math.min(a, b - minS);
      }
    }
    return [a, b - a];
  };
  const [x, width] = axis(rect.x, rect.width, room.width, 4, 2, anchor.x);
  const [y, depth] = axis(rect.y, rect.depth, room.depth, 1, 3, anchor.y);
  return { x, y, width, depth };
};

/** Items (not stacked ones) overlapping the walls of `pantryId` in roomData. */
export const itemsInPantryWalls = (roomData, pantryId, scale = 1) => {
  const own = (roomData.customWalls || []).filter((w) => w.pantryId === pantryId).map((w) => w.wallNumber);
  if (!own.length) return [];
  return (roomData.elements || []).filter((el) => {
    const fp = footprint(el, scale);
    return !!findWallOverlap({ x: el.x, y: el.y, width: fp.width, depth: fp.depth }, roomData, scale, { only: own });
  });
};

/** Items whose centre stands inside the pantry's inside rectangle. */
export const itemsInsidePantry = (pantry, elements = [], scale = 1) =>
  elements.filter((el) => {
    const fp = footprint(el, scale);
    const cx = el.x + fp.width / 2;
    const cy = el.y + fp.depth / 2;
    return cx > pantry.x && cx < pantry.x + pantry.width && cy > pantry.y && cy < pantry.y + pantry.depth;
  });

/** Items standing against either face of the pantry's walls (or in them). */
export const itemsAgainstPantry = (roomData, pantryId, scale = 1) => {
  const walls = (roomData.customWalls || []).filter((w) => w.pantryId === pantryId);
  const ids = new Set();
  for (const wall of walls) {
    for (const face of ['left', 'right']) {
      elementsOnWallFace(wall, face, roomData.elements, scale).forEach(({ element }) => ids.add(element.id));
    }
  }
  itemsInPantryWalls(roomData, pantryId, scale).forEach((el) => ids.add(el.id));
  return (roomData.elements || []).filter((el) => ids.has(el.id));
};

const otherPantriesHit = (roomData, pantry, scale) => {
  const mine = outerRect(pantry, roomData, scale);
  return (roomData.pantries || []).some(
    (p) => p.id !== pantry.id && rectsOverlap(mine, outerRect(p, roomData, scale), 0.5 * scale)
  );
};

/**
 * Put pantry `id` at `rect` (plan px, fitted to the room). With `carry`, the
 * items inside it move along. Returns the new roomData, or null when the
 * pantry's walls would land on an item, the carried items on others, or it
 * would overlap another pantry. An item that was already in its walls does
 * not block the change.
 */
export const updatePantryRect = (roomData, id, rect, scale = 1, { mode = 'move', carry = false, anchor } = {}) => {
  const pantry = (roomData.pantries || []).find((p) => p.id === id);
  if (!pantry) return null;
  // edges on the 1/16" grid, so the saved size reads 30", not 29.999999999999996"
  const fitted = roundPlanRect(fitRect(rect, roomData, scale, mode, pantry.thickness, anchor), scale);
  const moved = { ...pantry, ...fitted };
  const dx = fitted.x - pantry.x;
  const dy = fitted.y - pantry.y;
  const carriedIds = new Set(carry ? itemsInsidePantry(pantry, roomData.elements, scale).map((el) => el.id) : []);
  const elements = (roomData.elements || []).map((el) =>
    carriedIds.has(el.id) ? { ...el, x: roundPlanPx(el.x + dx, scale), y: roundPlanPx(el.y + dy, scale) } : el
  );
  const before = new Set(itemsInPantryWalls(roomData, id, scale).map((el) => el.id));
  const next = syncPantries(
    { ...roomData, elements, pantries: roomData.pantries.map((p) => (p.id === id ? moved : p)) },
    scale
  );
  if (otherPantriesHit(next, moved, scale)) return null;
  const blocked = itemsInPantryWalls(next, id, scale).some((el) => !before.has(el.id));
  if (blocked) return null;
  if (carriedIds.size) {
    const landsOnOther = next.elements.some(
      (el) =>
        carriedIds.has(el.id) &&
        findOverlappingElement(
          el,
          el.x,
          el.y,
          next.elements.filter((o) => !carriedIds.has(o.id)),
          {},
          scale
        )
    );
    if (landsOnOther) return null;
  }
  return next;
};

/** Move pantry `id` so its inside's top-left is at (x, y) plan px; items inside go along. */
export const movePantry = (roomData, id, x, y, scale = 1) => {
  const pantry = (roomData.pantries || []).find((p) => p.id === id);
  if (!pantry) return null;
  return updatePantryRect(roomData, id, { ...pantry, x, y }, scale, { mode: 'move', carry: true });
};

/**
 * New inside size in inches. The side that stands on a room wall stays put,
 * so a pantry in the north-east corner grows west and south.
 */
export const resizePantry = (roomData, id, { widthIn, depthIn }, scale = 1) => {
  const pantry = (roomData.pantries || []).find((p) => p.id === id);
  if (!pantry) return null;
  const against = roomSides(pantry, roomData, scale);
  const width = Number.isFinite(widthIn) ? widthIn * scale : pantry.width;
  const depth = Number.isFinite(depthIn) ? depthIn * scale : pantry.depth;
  const eastFixed = against.includes('e') && !against.includes('w');
  const southFixed = against.includes('s') && !against.includes('n');
  const x = eastFixed ? pantry.x + pantry.width - width : pantry.x;
  const y = southFixed ? pantry.y + pantry.depth - depth : pantry.y;
  const anchor = { x: eastFixed ? 'high' : 'low', y: southFixed ? 'high' : 'low' };
  return updatePantryRect(roomData, id, { x, y, width, depth }, scale, { mode: 'resize', anchor });
};

/** Drag one side's wall to plan coordinate `to` (y for n / s, x for e / w). */
export const dragPantrySide = (roomData, id, side, to, scale = 1) => {
  const p = (roomData.pantries || []).find((q) => q.id === id);
  if (!p) return null;
  const t = (p.thickness || PANTRY_DEFAULTS.thickness) * scale;
  let { x, y, width, depth } = p;
  // `to` is the wall's centre line: the inside edge is half a thickness in
  if (side === 'n') {
    const edge = to + t / 2;
    depth = y + depth - edge;
    y = edge;
  } else if (side === 's') depth = to - t / 2 - y;
  else if (side === 'w') {
    const edge = to + t / 2;
    width = x + width - edge;
    x = edge;
  } else if (side === 'e') width = to - t / 2 - x;
  const anchor = { x: side === 'w' ? 'high' : 'low', y: side === 'n' ? 'high' : 'low' };
  return updatePantryRect(roomData, id, { x, y, width, depth }, scale, { mode: 'resize', anchor });
};

/**
 * A pantry drag on the plan: `drag` is { id, mode: 'move' | 'side', side,
 * wallAt, start, origin, base } (base: the room when the drag began; plan
 * px). Start one with startPantryDrag, then call pantryDragStep with the
 * room of the latest render and the pointer (plan px) on every move.
 */
export const startPantryDrag = (roomData, fields) => ({ ...fields, base: roomData, produced: new Set([roomData]) });

/**
 * Every step starts again from drag.base, so a step taken after the room
 * changed some other way (an item added, the other room, a drag whose
 * mouseup never arrived) would put the old room back and lose that change.
 * Returns { stale: true } then (end the drag), else { stale: false,
 * roomData } with roomData null when the pantry cannot go there.
 */
export const pantryDragStep = (drag, latestRoomData, point, scale = 1) => {
  if (!drag.produced.has(latestRoomData)) return { stale: true, roomData: null };
  const next =
    drag.mode === 'move'
      ? movePantry(drag.base, drag.id, drag.origin.x + point.x - drag.start.x, drag.origin.y + point.y - drag.start.y, scale)
      : dragPantrySide(
          drag.base,
          drag.id,
          drag.side,
          drag.side === 'n' || drag.side === 's' ? drag.wallAt + point.y - drag.start.y : drag.wallAt + point.x - drag.start.x,
          scale
        );
  if (next) drag.produced.add(next);
  return { stale: false, roomData: next };
};

/** Change the cased opening: { side?, center? (inches), width? (inches) }. */
export const setPantryOpening = (roomData, id, changes, scale = 1) => {
  const pantries = (roomData.pantries || []).map((p) => {
    if (p.id !== id) return p;
    const opening = { ...p.opening, ...changes };
    // a new side starts centred unless a centre came with it
    if (changes.side && changes.side !== p.opening?.side && changes.center === undefined) opening.center = NaN;
    return { ...p, opening };
  });
  return syncPantries({ ...roomData, pantries }, scale);
};

/** Remove pantry `id` and its walls; `removeItemIds` go with it. */
export const removePantry = (roomData, id, { removeItemIds = [] } = {}, scale = 1) => {
  const drop = new Set(removeItemIds);
  const materials = { ...(roomData.materials || {}) };
  drop.forEach((itemId) => delete materials[itemId]);
  return syncPantries(
    {
      ...roomData,
      pantries: (roomData.pantries || []).filter((p) => p.id !== id),
      elements: (roomData.elements || []).filter((el) => !drop.has(el.id)),
      materials,
    },
    scale
  );
};

// Candidate spots for a new pantry of `shape`, best first
const candidates = (shape, roomData, scale) => {
  const { width: W, depth: D } = roomPx(roomData, scale);
  const present = roomWallsPresent(roomData);
  const has = (n) => present.includes(n);
  const w = Math.min(PANTRY_DEFAULTS.width * scale, Math.max(PANTRY_DEFAULTS.minSize * scale, W / 2));
  const d = Math.min(PANTRY_DEFAULTS.depth * scale, Math.max(PANTRY_DEFAULTS.minSize * scale, D / 2));
  const out = [];
  if (shape === 'L') {
    if (has(1) && has(2)) out.push({ x: W - w, y: 0, width: w, depth: d, front: 's' });
    if (has(1) && has(4)) out.push({ x: 0, y: 0, width: w, depth: d, front: 's' });
    if (has(3) && has(2)) out.push({ x: W - w, y: D - d, width: w, depth: d, front: 'n' });
    if (has(3) && has(4)) out.push({ x: 0, y: D - d, width: w, depth: d, front: 'n' });
  } else if (shape === 'U') {
    if (has(1)) out.push({ x: (W - w) / 2, y: 0, width: w, depth: d, front: 's' });
    if (has(2)) out.push({ x: W - d, y: (D - w) / 2, width: d, depth: w, front: 'w' });
    if (has(3)) out.push({ x: (W - w) / 2, y: D - d, width: w, depth: d, front: 'n' });
    if (has(4)) out.push({ x: 0, y: (D - w) / 2, width: d, depth: w, front: 'e' });
  } else {
    // straight: one partition across the shorter end of the room
    if (W <= D) {
      const dd = Math.min(PANTRY_DEFAULTS.depth * scale, D / 2);
      if (has(1) && has(2) && has(4)) out.push({ x: 0, y: 0, width: W, depth: dd, front: 's' });
      if (has(3) && has(2) && has(4)) out.push({ x: 0, y: D - dd, width: W, depth: dd, front: 'n' });
    }
    const ww = Math.min(PANTRY_DEFAULTS.depth * scale, W / 2);
    if (has(4) && has(1) && has(3)) out.push({ x: 0, y: 0, width: ww, depth: D, front: 'e' });
    if (has(2) && has(1) && has(3)) out.push({ x: W - ww, y: 0, width: ww, depth: D, front: 'w' });
    if (W > D) {
      const dd = Math.min(PANTRY_DEFAULTS.depth * scale, D / 2);
      if (has(1) && has(2) && has(4)) out.push({ x: 0, y: 0, width: W, depth: dd, front: 's' });
      if (has(3) && has(2) && has(4)) out.push({ x: 0, y: D - dd, width: W, depth: dd, front: 'n' });
    }
  }
  return out;
};

/**
 * A new pantry of `shape` in the freest spot (the corner / wall / end with the
 * fewest items in its way), with a 36" cased opening centred on its front.
 * Returns { roomData, pantry } or null when the room has no spot for that shape
 * (the room wall it needs was removed) or everything is taken.
 */
export const addPantry = (roomData, shape = 'L', scale = 1, { id = `pantry-${Date.now()}` } = {}) => {
  const base = { pantries: [], ...roomData };
  const spots = candidates(shape, base, scale);
  let best = null;
  for (const spot of spots) {
    const { front, ...rect } = spot;
    const fitted = roundPlanRect(fitRect(rect, base, scale, 'move'), scale);
    const pantry = {
      id,
      shape,
      ...fitted,
      thickness: PANTRY_DEFAULTS.thickness,
      opening: { side: front, center: NaN, width: PANTRY_DEFAULTS.openingWidth },
      wallNumbers: {},
    };
    const next = syncPantries({ ...base, pantries: [...base.pantries, pantry] }, scale);
    const placed = next.pantries.find((p) => p.id === id);
    if (otherPantriesHit(next, placed, scale)) continue;
    const outer = outerRect(placed, next, scale);
    const inWay = (base.elements || []).filter((el) => {
      const fp = footprint(el, scale);
      return rectsOverlap(outer, { x: el.x, y: el.y, width: fp.width, depth: fp.depth }, 0.5 * scale);
    }).length;
    if (!best || inWay < best.inWay) best = { inWay, roomData: next, pantry: placed };
    if (inWay === 0) break;
  }
  // never build walls through items: no clear spot, no pantry
  if (!best || best.inWay > 0) return null;
  return { roomData: best.roomData, pantry: best.pantry };
};

/** The pantry a custom wall belongs to, and the wall's letter (A, B, C ...) in it. */
export const pantryWallInfo = (roomData, wallNumber) => {
  const wall = (roomData.customWalls || []).find((w) => w.wallNumber === wallNumber);
  if (!wall || !wall.pantryId) return null;
  const pantries = roomData.pantries || [];
  const index = pantries.findIndex((p) => p.id === wall.pantryId);
  if (index < 0) return null;
  const own = (roomData.customWalls || []).filter((w) => w.pantryId === wall.pantryId);
  const order = SIDES.filter((s) => own.some((w) => w.pantrySide === s));
  const letter = String.fromCharCode(65 + order.indexOf(wall.pantrySide));
  return { pantry: pantries[index], index, number: pantries.length > 1 ? index + 1 : null, letter, wall };
};
