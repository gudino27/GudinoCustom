// Both faces of a custom (drawn or pantry) wall.
//
// A custom wall is a plan-px line segment (x1, y1) -> (x2, y2) with a
// thickness, centred on the line. It has two faces:
//   'right'  the side of the right-hand normal of x1,y1 -> x2,y2 on the y-down
//            plan (heading east, the right face looks south)
//   'left'   the other one
// A pantry wall knows which face is inside the pantry (wall.pantryInside).
//
// Thickness: walls drawn with "Draw wall" store `thickness` in plan px (the
// 3D views read the same number as inches). Pantry walls store inches in
// `thickness` and `thicknessIn` (what every 3D build reads); the plan works
// in px, so it goes through wallThicknessPx.
//
// Element convention (see rotation.js / designerToJob.js): x, y are the
// top-left of the rotated footprint in plan px, rotation is degrees clockwise
// seen from above and at 0 the front faces south (+y), the back north.
//
// No React: runs under `node --test` (tests/designer/wallFaces.test.js).
import { footprint, normalizeRotation } from './rotation.js';

/** Footprints may press into a wall by this much (inches) before it counts. */
export const WALL_TOLERANCE_IN = 0.5;
/** An item this close (inches) to a wall face sits against it. */
export const AGAINST_WALL_IN = 3;

/** Wall thickness in plan px. */
export const wallThicknessPx = (wall, scale = 1) => {
  const inches = Number(wall.thicknessIn);
  if (Number.isFinite(inches) && inches > 0) return inches * scale;
  const t = Number(wall.thickness);
  return Number.isFinite(t) && t > 0 ? t : 6;
};

/** Unit direction u, right-hand normal n and length of a wall (plan px). */
export const wallAxes = (wall) => {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const length = Math.hypot(dx, dy);
  const ux = length ? dx / length : 1;
  const uy = length ? dy / length : 0;
  return { length, ux, uy, nx: -uy, ny: ux };
};

/** Stored key for one face of a custom wall in the wall view: "7:right". */
export const wallFaceKey = (wallNumber, face) => `${wallNumber}:${face}`;

/** 3 -> { wallNumber: 3, face: null }; "7:left" -> { wallNumber: 7, face: 'left' }. */
export const parseWallKey = (key) => {
  if (typeof key === 'number') return { wallNumber: key, face: null };
  const [n, face] = String(key).split(':');
  const wallNumber = Number(n);
  return { wallNumber, face: face === 'left' || face === 'right' ? face : null };
};

/** Doors on a wall that leave a gap in it (all of them: doors and cased openings). */
const openingsOn = (wall, doors = []) =>
  (doors || []).filter((d) => d.wallNumber === wall.wallNumber);

/**
 * The solid pieces of a wall along its length, [s0, s1] in plan px, with the
 * openings (doors, cased openings) cut out.
 */
export const wallPieces = (wall, doors = [], scale = 1) => {
  const { length } = wallAxes(wall);
  const gaps = openingsOn(wall, doors)
    .map((d) => {
      const c = ((Number(d.position) || 0) / 100) * length;
      const half = ((Number(d.width) || 32) * scale) / 2;
      return [Math.max(0, c - half), Math.min(length, c + half)];
    })
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const pieces = [];
  let at = 0;
  for (const [a, b] of gaps) {
    if (a > at) pieces.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < length) pieces.push([at, length]);
  return pieces;
};

// Separating-axis overlap of an axis-aligned rect and a wall piece (oriented
// rect): true when they overlap by more than `tol` along every axis.
const rectHitsPiece = (rect, wall, piece, halfT, tol) => {
  const { ux, uy, nx, ny } = wallAxes(wall);
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.depth],
    [rect.x, rect.y + rect.depth],
  ];
  const [s0, s1] = piece;
  const wallCorners = [
    [s0, -halfT],
    [s1, -halfT],
    [s1, halfT],
    [s0, halfT],
  ].map(([s, v]) => [wall.x1 + ux * s + nx * v, wall.y1 + uy * s + ny * v]);
  const axes = [
    [1, 0],
    [0, 1],
    [ux, uy],
    [nx, ny],
  ];
  return axes.every(([ax, ay]) => {
    const pa = corners.map(([x, y]) => x * ax + y * ay);
    const pb = wallCorners.map(([x, y]) => x * ax + y * ay);
    const overlap = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    return overlap > tol;
  });
};

/** Does the plan rect { x, y, width, depth } (px) press into `wall`'s thickness? */
export const rectOverlapsWall = (rect, wall, doors = [], scale = 1, tolerance = WALL_TOLERANCE_IN * scale) => {
  const halfT = wallThicknessPx(wall, scale) / 2;
  return wallPieces(wall, doors, scale).some((piece) => rectHitsPiece(rect, wall, piece, halfT, tolerance));
};

/**
 * The first active custom wall the plan rect overlaps, or null.
 * @param {Object} rect        { x, y, width, depth } plan px
 * @param {Object} roomData    { customWalls, walls, doors }
 * @param {number} scale
 * @param {Object} [opts]      { only: Set|Array of wall numbers to look at }
 */
export const findWallOverlap = (rect, roomData = {}, scale = 1, { only } = {}) => {
  const active = roomData.walls || [1, 2, 3, 4];
  const onlySet = only ? new Set(only) : null;
  for (const wall of roomData.customWalls || []) {
    if (!active.includes(wall.wallNumber)) continue;
    if (onlySet && !onlySet.has(wall.wallNumber)) continue;
    if (rectOverlapsWall(rect, wall, roomData.doors, scale)) return wall;
  }
  return null;
};

/** Does `element` with its footprint's top-left at (x, y) press into a custom wall? */
export const elementOverlapsWall = (element, x, y, roomData, scale = 1, opts) => {
  const fp = footprint(element, scale);
  return !!findWallOverlap({ x, y, width: fp.width, depth: fp.depth }, roomData, scale, opts);
};

/**
 * Rotation (degrees) that puts an item's back against `wall` with its front
 * facing out of `face`. At rotation 0 the front faces +y, and rotation turns
 * it clockwise: front = (-sin r, cos r).
 */
export const facingRotation = (wall, face) => {
  const { nx, ny } = wallAxes(wall);
  const s = face === 'left' ? -1 : 1;
  const deg = (Math.atan2(-nx * s, ny * s) * 180) / Math.PI;
  return normalizeRotation(Math.round(deg * 1000) / 1000);
};

// Half the axis-aligned footprint measured along a unit direction
const halfExtent = (fp, ax, ay) => (Math.abs(ax) * fp.width + Math.abs(ay) * fp.depth) / 2;

/**
 * Snap an item to the nearest custom wall face it is dropped against: back to
 * the wall, front facing away from it, on whichever side it is on.
 *
 * @param {Object} o
 *   element      the item ({ width, depth, rotation, type, ... }, inches)
 *   center       { x, y } plan px where the item's centre is now (the pointer)
 *   roomData     { customWalls, walls, doors, dimensions }
 *   scale        plan px per inch
 *   snapIn       how close (inches) the item's back must come to a face (default 8)
 * @returns {{ snapped: false } | { snapped: true, x, y, rotation, wallNumber, face }}
 *   x, y: top-left of the turned footprint.
 */
export const snapToWallFace = ({ element, center, roomData = {}, scale = 1, snapIn = 8 }) => {
  const active = roomData.walls || [1, 2, 3, 4];
  let best = null;
  for (const wall of roomData.customWalls || []) {
    if (!active.includes(wall.wallNumber)) continue;
    const { length, ux, uy, nx, ny } = wallAxes(wall);
    if (!length) continue;
    const rx = center.x - wall.x1;
    const ry = center.y - wall.y1;
    const along = rx * ux + ry * uy;
    if (along < 0 || along > length) continue;
    const d = rx * nx + ry * ny;
    const face = d >= 0 ? 'right' : 'left';
    const rotation = facingRotation(wall, face);
    const fp = footprint({ ...element, rotation }, scale);
    const halfT = wallThicknessPx(wall, scale) / 2;
    const hn = halfExtent(fp, nx, ny);
    const gap = Math.abs(d) - halfT - hn;
    if (gap > snapIn * scale) continue;
    if (best && Math.abs(gap) >= Math.abs(best.gap)) continue;
    best = { wall, face, rotation, fp, along, halfT, hn, gap, length, ux, uy, nx, ny };
  }
  if (!best) return { snapped: false };

  const { wall, face, rotation, fp, halfT, hn, length, ux, uy, nx, ny } = best;
  const side = face === 'right' ? 1 : -1;
  const hu = halfExtent(fp, ux, uy);
  const alongC = length >= 2 * hu ? Math.max(hu, Math.min(length - hu, best.along)) : length / 2;
  const off = halfT + hn;
  const at = (s) => ({
    x: wall.x1 + ux * s + nx * off * side - fp.width / 2,
    y: wall.y1 + uy * s + ny * off * side - fp.depth / 2,
  });
  let pos = at(alongC);

  // Flush with a room wall along the wall's run, and inside the room
  if (roomData.dimensions) {
    const W = parseFloat(roomData.dimensions.width) * 12 * scale;
    const D = parseFloat(roomData.dimensions.height) * 12 * scale;
    const near = snapIn * scale;
    if (Math.abs(ux) > 0.99) {
      if (pos.x < near) pos.x = 0;
      if (W - (pos.x + fp.width) < near) pos.x = W - fp.width;
    } else if (Math.abs(uy) > 0.99) {
      if (pos.y < near) pos.y = 0;
      if (D - (pos.y + fp.depth) < near) pos.y = D - fp.depth;
    }
    pos = {
      x: Math.max(0, Math.min(pos.x, W - fp.width)),
      y: Math.max(0, Math.min(pos.y, D - fp.depth)),
    };
  }

  // Slide along the wall off any wall end it presses into (the corner of a
  // pantry), to where it just touches it
  const hits = (p) =>
    (roomData.customWalls || []).some(
      (w) =>
        active.includes(w.wallNumber) &&
        rectOverlapsWall({ x: p.x, y: p.y, width: fp.width, depth: fp.depth }, w, roomData.doors, scale, 0.01)
    );
  if (hits(pos)) {
    const step = 0.25;
    const reach = 2 * hu + 4 * halfT;
    let found = null;
    for (let k = step; k <= reach && !found; k += step) {
      for (const sgn of [1, -1]) {
        const p = { x: pos.x + ux * k * sgn, y: pos.y + uy * k * sgn };
        if (!hits(p)) {
          found = p;
          break;
        }
      }
    }
    if (found) pos = found;
  }

  return { snapped: true, x: pos.x, y: pos.y, rotation, wallNumber: wall.wallNumber, face };
};

/**
 * Items standing against one face of a custom wall, as the wall view shows
 * them: seen from that face, left to right.
 *
 * @returns {Array<{ element, x: number, center: number }>}  x: inches from the
 *   face's left end to the item's left edge (item width = element.width, as it
 *   faces the wall); center: inches to the item's centre.
 */
export const elementsOnWallFace = (wall, face, elements = [], scale = 1, { thresholdIn = AGAINST_WALL_IN } = {}) => {
  const { length, ux, uy, nx, ny } = wallAxes(wall);
  if (!length) return [];
  const halfT = wallThicknessPx(wall, scale) / 2;
  const side = face === 'left' ? -1 : 1;
  const out = [];
  for (const element of elements || []) {
    const fp = footprint(element, scale);
    const cx = element.x + fp.width / 2 - wall.x1;
    const cy = element.y + fp.depth / 2 - wall.y1;
    const along = cx * ux + cy * uy;
    if (along < 0 || along > length) continue;
    const d = (cx * nx + cy * ny) * side;
    if (d <= 0) continue;
    const gap = d - halfT - halfExtent(fp, nx, ny);
    if (gap > thresholdIn * scale || gap < -halfT - WALL_TOLERANCE_IN * scale) continue;
    // Seen from the right face the wall runs left to right from x1,y1; from the left face, mirrored
    const seen = (side === 1 ? along : length - along) / scale;
    out.push({ element, center: seen, x: seen - (Number(element.width) || 0) / 2 });
  }
  return out.sort((a, b) => a.center - b.center);
};

/** Doors on a custom wall as seen from `face`: position mirrored from the left face. */
export const doorsSeenFrom = (wall, face, doors = []) =>
  openingsOn(wall, doors).map((d) =>
    face === 'left' ? { ...d, position: 100 - (Number(d.position) || 0) } : d
  );
