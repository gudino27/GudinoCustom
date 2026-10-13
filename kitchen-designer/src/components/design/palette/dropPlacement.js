// Pure helpers for dropping a palette item onto the floor plan.
//
// Plan coordinates are plan px (inches * scale) with (0, 0) at the room's
// top-left inside corner; x, y of an element are the top-left of its
// (rotated) footprint. The floor plan SVG draws the room PLAN_ORIGIN px in
// from its own top-left, the same 30 px the drag code subtracts.
//
// Imports keep their .js extensions so tests/ can load this file in node.
import { findOverlappingElement, snapIntoHousing } from '../../../utils/designer/collisionUtils.js';
import { isHousable } from '../../../utils/designer/housing.js';
import { footprint } from '../../../utils/designer/rotation.js';
import { elementOverlapsWall } from '../../../utils/designer/wallFaces.js';

export const PLAN_ORIGIN = 30;

/** Screen (client) point -> plan point, given the SVG's inverse screen CTM ({ a, b, c, d, e, f }). */
export const clientToPlan = (clientX, clientY, inverseCtm) => ({
  x: inverseCtm.a * clientX + inverseCtm.c * clientY + inverseCtm.e - PLAN_ORIGIN,
  y: inverseCtm.b * clientX + inverseCtm.d * clientY + inverseCtm.f - PLAN_ORIGIN,
});

/** Plan rectangle -> screen box { left, top, width, height }, given the SVG's screen CTM. */
export const planRectToClient = (rect, ctm) => {
  const map = (x, y) => ({
    x: ctm.a * (x + PLAN_ORIGIN) + ctm.c * (y + PLAN_ORIGIN) + ctm.e,
    y: ctm.b * (x + PLAN_ORIGIN) + ctm.d * (y + PLAN_ORIGIN) + ctm.f,
  });
  const p1 = map(rect.x, rect.y);
  const p2 = map(rect.x + rect.width, rect.y + rect.depth);
  return {
    left: Math.min(p1.x, p2.x),
    top: Math.min(p1.y, p2.y),
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y),
  };
};

/** Is a client point inside a DOMRect-like box? */
export const isPointInBox = (clientX, clientY, box) =>
  !!box &&
  clientX >= box.left &&
  clientX <= box.left + box.width &&
  clientY >= box.top &&
  clientY <= box.top + box.height;

/** Room size in plan px from the room data (dimensions are in feet). */
export const roomSizePx = (roomData, scale) => ({
  width: parseFloat(roomData.dimensions.width) * 12 * scale,
  depth: parseFloat(roomData.dimensions.height) * 12 * scale,
});

/** The item a palette type would add (the fields placement looks at). */
export const candidateFor = (type, elementTypes, id = '__palette-drop__') => {
  const spec = elementTypes[type];
  if (!spec) return null;
  return {
    id,
    type,
    x: 0,
    y: 0,
    width: spec.defaultWidth,
    depth: spec.defaultDepth,
    actualHeight: spec.fixedHeight || spec.defaultHeight,
    mountHeight: spec.mountHeight || 0,
    rotation: 0,
    category: spec.category,
  };
};

/**
 * Top-left for an item of `size` (plan px) centred on the pointer at `point`,
 * kept inside the room. Returns null when it is bigger than the room.
 */
export const dropTopLeft = (point, size, room) => {
  const maxX = room.width - size.width;
  const maxY = room.depth - size.depth;
  if (maxX < 0 || maxY < 0) return null;
  const clamp = (v, max) => Math.max(0, Math.min(v, max));
  return {
    x: clamp(point.x - size.width / 2, maxX),
    y: clamp(point.y - size.depth / 2, maxY),
  };
};

/** The standard room walls present, in the format the wall snap helpers take. */
export const standardWallsFor = (roomData, scale) => {
  const { width, depth } = roomSizePx(roomData, scale);
  const present = roomData.walls || [];
  const all = [
    { wallNumber: 1, x1: 0, y1: 0, x2: width, y2: 0 },
    { wallNumber: 2, x1: width, y1: 0, x2: width, y2: depth },
    { wallNumber: 3, x1: 0, y1: depth, x2: width, y2: depth },
    { wallNumber: 4, x1: 0, y1: 0, x2: 0, y2: depth },
  ];
  return all.filter((w) => present.includes(w.wallNumber)).map((w) => ({ ...w, thickness: 10 }));
};

/**
 * Where a drop lands and whether it is allowed. Mirrors the rule the plan
 * uses while dragging a placed item:
 *  - a seat in an empty housing (a fridge over a fridge cabinet) wins;
 *  - else the snapped spot; a snap that lands on another item falls back to
 *    the unsnapped spot when that one is clear;
 *  - door clearance only counts when the spot is not snapped to a cabinet.
 *
 * @param {{x,y}} raw            unsnapped top-left
 * @param {{x,y,snapped}} snapped result of the snap chain (or raw)
 * @param {{x,y,rotation}|null} housingSeat
 * @param {(x,y)=>boolean} overlapsAt  lands on another item?
 * @param {(x,y)=>boolean} [blockedAt] in a door clearance zone?
 * @returns {{ x, y, rotation, snapped, housed, allowed, reason }}
 *   reason: null | 'overlap' | 'door' | 'wall' (presses into a custom wall)
 */
export const decideDrop = ({ raw, snapped, housingSeat, overlapsAt, blockedAt = () => false, wallAt = () => false }) => {
  if (housingSeat) {
    return { x: housingSeat.x, y: housingSeat.y, rotation: housingSeat.rotation, snapped: true, housed: true, allowed: true, reason: null };
  }
  const result = (pos, isSnapped, allowed, reason, rotation = 0) => ({
    x: pos.x,
    y: pos.y,
    rotation,
    snapped: isSnapped,
    housed: false,
    allowed,
    reason,
  });
  const isSnapped = !!(snapped && snapped.snapped);
  const pos = snapped || raw;
  // a snap to a custom wall also turns the item to face away from it
  const rotation = isSnapped && Number.isFinite(snapped.rotation) ? snapped.rotation : 0;
  const clear = (p, r) => !overlapsAt(p.x, p.y, r) && !wallAt(p.x, p.y, r);
  const doorBlocked = (p, s) => !s && blockedAt(p.x, p.y);
  if (doorBlocked(pos, isSnapped)) return result(pos, isSnapped, false, 'door', rotation);
  if (clear(pos, rotation)) return result(pos, isSnapped, true, null, rotation);
  if (isSnapped && clear(raw, 0) && !blockedAt(raw.x, raw.y)) {
    return result(raw, false, true, null);
  }
  const reason = !overlapsAt(pos.x, pos.y, rotation) && wallAt(pos.x, pos.y, rotation) ? 'wall' : 'overlap';
  return result(pos, isSnapped, false, reason, rotation);
};

/**
 * Full drop decision for palette `type` at plan `point`.
 *
 * @param {Object} o
 *   type, point {x,y}, roomData, elementTypes, scale
 *   snap      (x, y, width, depth, candidate) => { x, y, snapped, rotation? } (the page's snap
 *             chain; a snap to a custom wall face also turns the item; optional)
 *   isBlocked (x, y, width, depth) => bool (door clearance; optional)
 * @returns {null | { x, y, width, depth, rotation, snapped, housed, allowed, reason }}
 *   null when the type is unknown or bigger than the room.
 */
export const resolveDrop = ({ type, point, roomData, elementTypes, scale, snap, isBlocked }) => {
  const candidate = candidateFor(type, elementTypes);
  if (!candidate) return null;
  const elements = roomData.elements || [];
  const size = footprint(candidate, scale);
  const raw = dropTopLeft(point, size, roomSizePx(roomData, scale));
  if (!raw) return null;

  const housingSeat = isHousable(type, elementTypes)
    ? snapIntoHousing(candidate, raw.x, raw.y, elements, elementTypes, scale)
    : null;
  const snapped = snap ? snap(raw.x, raw.y, size.width, size.depth, candidate) : { ...raw, snapped: false };
  const turned = (rotation = 0) => ({ ...candidate, rotation });
  const decision = decideDrop({
    raw,
    snapped,
    housingSeat,
    overlapsAt: (x, y, rotation) => !!findOverlappingElement(turned(rotation), x, y, elements, elementTypes, scale),
    blockedAt: isBlocked ? (x, y) => isBlocked(x, y, size.width, size.depth) : undefined,
    // no item may press into a drawn or pantry wall's thickness
    wallAt: (x, y, rotation) => elementOverlapsWall(turned(rotation), x, y, roomData, scale),
  });
  const fp = footprint(turned(decision.rotation), scale);
  return { ...decision, width: fp.width, depth: fp.depth };
};
