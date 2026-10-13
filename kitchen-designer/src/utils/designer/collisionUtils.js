import { footprint, rotateInRoom } from './rotation.js';
import {
  carryHoused,
  housedElements,
  housingAllowsOverlap,
  housingOf,
  seatInHousing,
  verticalRange,
} from './housing.js';
export const checkWallCollision = (x, y, width, depth, wallsArray = [], roomData = {}, rotation = 0) => {
  for (const wall of wallsArray) {
    // Only check walls that are present
    if (!(roomData.walls || []).includes(wall.wallNumber)) continue;

    // Create cabinet rectangle corners
    const corners = [
      { x: x, y: y },
      { x: x + width, y: y },
      { x: x + width, y: y + depth },
      { x: x, y: y + depth }
    ];

    // Check if wall line intersects with any cabinet edge or if cabinet overlaps wall
    const wallThickness = wall.thickness;

    // Calculate wall as a thick line (rectangle)
    const wallLength = Math.sqrt(Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2));
    const wallAngle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);

    // Wall center point
    const wallCenterX = (wall.x1 + wall.x2) / 2;
    const wallCenterY = (wall.y1 + wall.y2) / 2;

    // Check if cabinet center is too close to wall
    const cabinetCenterX = x + width / 2;
    const cabinetCenterY = y + depth / 2;

    // Distance from cabinet center to wall line
    const A = wall.y2 - wall.y1;
    const B = wall.x1 - wall.x2;
    const C = wall.x2 * wall.y1 - wall.x1 * wall.y2;
    const distance = Math.abs(A * cabinetCenterX + B * cabinetCenterY + C) / Math.sqrt(A * A + B * B);

    // Check if cabinet is too close to wall (considering both wall thickness and cabinet size)
    // Use a more conservative buffer for collision detection
    const buffer = 60; // Reduced buffer to prevent over-aggressive collision detection
    const minDistance = (wallThickness + Math.min(width, depth)) / 2 + buffer;

    if (distance < minDistance) {
      // Also check if the collision point is within the wall segment bounds
      const t = ((cabinetCenterX - wall.x1) * (wall.x2 - wall.x1) + (cabinetCenterY - wall.y1) * (wall.y2 - wall.y1)) /
        (Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2));

      if (t >= 0.0 && t <= 1.0) { // Exact wall bounds - no clipping allowed
        return true; // Collision detected
      }
    }
  }
  return false; // No collision
};
export const pushAwayFromWall = (x, y, width, depth, customWalls, roomData, scale) => {
  // Get all four corners of the cabinet
  const cabinetCorners = [
    { x: x, y: y }, // top-left
    { x: x + width, y: y }, // top-right
    { x: x + width, y: y + depth }, // bottom-right
    { x: x, y: y + depth } // bottom-left
  ];

  for (const wall of customWalls) {
    if (!(roomData.walls || []).includes(wall.wallNumber)) continue;

    const wallThickness = wall.thickness;
    const buffer = 20; // Safe distance from wall
    let closestDistance = Infinity;
    let closestCorner = null;
    let wallNormalX = 0;
    let wallNormalY = 0;

    // Find the closest corner to the wall
    for (const corner of cabinetCorners) {
      const A = wall.y2 - wall.y1;
      const B = wall.x1 - wall.x2;
      const C = wall.x2 * wall.y1 - wall.x1 * wall.y2;
      const distance = Math.abs(A * corner.x + B * corner.y + C) / Math.sqrt(A * A + B * B);

      // Check if this corner is within the wall segment bounds
      const t = ((corner.x - wall.x1) * (wall.x2 - wall.x1) + (corner.y - wall.y1) * (wall.y2 - wall.y1)) /
        (Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2));

      if (t >= -0.05 && t <= 1.05 && distance < closestDistance) {
        closestDistance = distance;
        closestCorner = corner;

        // Calculate wall normal vector (perpendicular to wall)
        const wallLength = Math.sqrt(Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2));
        wallNormalX = -(wall.y2 - wall.y1) / wallLength;
        wallNormalY = (wall.x2 - wall.x1) / wallLength;

        // Ensure normal points away from the cabinet center
        const cabinetCenterX = x + width / 2;
        const cabinetCenterY = y + depth / 2;
        const closestPointX = wall.x1 + t * (wall.x2 - wall.x1);
        const closestPointY = wall.y1 + t * (wall.y2 - wall.y1);

        const toCenterX = cabinetCenterX - closestPointX;
        const toCenterY = cabinetCenterY - closestPointY;

        // If normal is pointing toward cabinet center, flip it
        if (wallNormalX * toCenterX + wallNormalY * toCenterY < 0) {
          wallNormalX = -wallNormalX;
          wallNormalY = -wallNormalY;
        }
      }
    }

    const minDistance = wallThickness / 2 + buffer;

    if (closestDistance < minDistance && closestCorner) {
      // Push the entire cabinet away from the wall
      const pushDistance = minDistance - closestDistance + 10; // Extra safety margin
      const newX = x + wallNormalX * pushDistance;
      const newY = y + wallNormalY * pushDistance;

      // Make sure the new position is within room bounds
      const roomWidth = parseFloat(roomData.dimensions.width) * 12 * scale;
      const roomHeight = parseFloat(roomData.dimensions.height) * 12 * scale;
      const clampedX = Math.max(0, Math.min(newX, roomWidth - width));
      const clampedY = Math.max(0, Math.min(newY, roomHeight - depth));

      return { x: clampedX, y: clampedY };
    }
  }

  return null; // No push needed or possible
};
// -----------------------------
// Overlap rule shared by every way an item gets a position: adding from the
// sidebar, dragging, arrow keys, the properties panel and rotating.
//
// Two items may not share floor space, whatever their category (a dishwasher
// cannot sit inside a refrigerator). The one exception is stacking: when one
// item is mounted entirely above the other (a wall cabinet over a base, a
// microwave or hood over a range, a medicine cabinet over a vanity) their
// plan footprints may overlap. Edges that only touch (flush items, as the
// snap code places them) are not an overlap.
//
// The other exception is housing (housing.js): a cabinet that declares
// `houses: [...]` in its type (the refrigerator cabinet) may hold one
// appliance of an accepted type when the appliance fits inside its opening.
// -----------------------------

// Footprints may overlap by this much (inches) before it counts, so flush
// placement survives rounding in the snap and keyboard code.
export const OVERLAP_TOLERANCE_IN = 0.5;

/** Bottom and top of an element above the floor, in inches (lives in housing.js). */
export { verticalRange };

/** True when one item is mounted wholly above the other, so they may overlap in plan. */
export const canStack = (a, b, elementTypes = {}) => {
  const ra = verticalRange(a, elementTypes);
  const rb = verticalRange(b, elementTypes);
  return ra.bottom >= rb.top || rb.bottom >= ra.top;
};

/** Do two plan rectangles (top-left x, y plus width, depth) overlap by more than `tolerance`? */
export const footprintsOverlap = (a, b, tolerance = 0) => {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y);
  return overlapX > tolerance && overlapY > tolerance;
};

/**
 * The first other element that `element` would overlap if its footprint's
 * top-left sat at (x, y), or null. `size` overrides the footprint (plan px).
 */
export const findOverlappingElement = (
  element,
  x,
  y,
  allElements = [],
  elementTypes = {},
  scale = 1,
  size = footprint(element, scale)
) => {
  const rect = { x, y, width: size.width, depth: size.depth };
  const tolerance = OVERLAP_TOLERANCE_IN * scale;
  return (
    allElements.find((other) => {
      if (other.id === element.id) return false;
      if (canStack(element, other, elementTypes)) return false;
      const fp = footprint(other, scale);
      const overlaps = footprintsOverlap(
        rect,
        { x: other.x, y: other.y, width: fp.width, depth: fp.depth },
        tolerance
      );
      // a fridge inside its fridge cabinet
      return overlaps && !housingAllowsOverlap(element, { x, y }, other, allElements, elementTypes, scale);
    }) || null
  );
};

/** Same rule as findOverlappingElement, with the footprint size given (plan px). */
export const checkElementCollision = (
  elementX,
  elementY,
  elementWidth,
  elementHeight,
  draggedElement,
  allElements,
  elementTypes,
  scale
) =>
  Boolean(
    findOverlappingElement(
      draggedElement,
      elementX,
      elementY,
      allElements,
      elementTypes,
      scale,
      { width: elementWidth, depth: elementHeight }
    )
  );

/**
 * The position updates for moving `element` to (x, y): the element itself
 * and whatever it houses (a fridge moves with its fridge cabinet).
 * Returns [{ id, x, y, rotation? }], the element first.
 */
export const moveWithHoused = (element, x, y, allElements = [], elementTypes = {}, scale = 1) => [
  { id: element.id, x, y },
  ...carryHoused(element, { x, y }, allElements, elementTypes, scale),
];

/** `allElements` with position updates ([{ id, ...fields }]) applied. */
export const applyMoves = (allElements = [], moves = []) => {
  const byId = new Map(moves.map((m) => [m.id, m]));
  return allElements.map((o) => (byId.has(o.id) ? { ...o, ...byId.get(o.id) } : o));
};

/**
 * Would any moved item land on another item once all `moves` are made?
 * `ignoreIds` are left out of the check (a housed fridge sliding out of its
 * cabinet with the arrow keys).
 */
export const movesOverlap = (moves, allElements = [], elementTypes = {}, scale = 1, { ignoreIds = [] } = {}) => {
  const moved = new Set(moves.map((m) => m.id));
  const ignored = new Set(ignoreIds);
  const after = applyMoves(allElements, moves).filter((o) => !ignored.has(o.id));
  return after
    .filter((o) => moved.has(o.id))
    .some((o) => findOverlappingElement(o, o.x, o.y, after, elementTypes, scale));
};

/**
 * A move of `element` to (x, y) is refused when it (or what it houses, which
 * moves with it) lands on another item. An item that already overlaps
 * something where it is now (older saved designs) is let go, so it can be
 * moved out of the way.
 */
export const isMoveBlocked = (element, x, y, allElements, elementTypes, scale) =>
  movesOverlap(moveWithHoused(element, x, y, allElements, elementTypes, scale), allElements, elementTypes, scale) &&
  !findOverlappingElement(element, element.x, element.y, allElements, elementTypes, scale);

/** The housing `element` sits in now, or null. */
export const housingAround = (element, allElements = [], elementTypes = {}, scale = 1) =>
  allElements.find(
    (h) =>
      h.id !== element.id &&
      housingOf(h, elementTypes) &&
      housedElements(h, allElements, elementTypes, scale).some((o) => o.id === element.id)
  ) || null;

/** Is there nothing inside `housing` but (possibly) `exceptId`? */
const housingIsEmpty = (housing, allElements, elementTypes, scale, exceptId) =>
  !housedElements(housing, allElements, elementTypes, scale).some((o) => o.id !== exceptId);

/**
 * Dragging an appliance over a cabinet that houses its type: the seat in
 * that cabinet (centred in the opening, flush with the back, turned to face
 * the same way) when the appliance's centre at (x, y) is over the cabinet,
 * the cabinet is empty and the seat is free. { x, y, rotation, housingId } or null.
 */
export const snapIntoHousing = (element, x, y, allElements = [], elementTypes = {}, scale = 1) => {
  const fp = footprint(element, scale);
  const cx = x + fp.width / 2;
  const cy = y + fp.depth / 2;
  for (const housing of allElements) {
    if (housing.id === element.id || !housingOf(housing, elementTypes)) continue;
    const hfp = footprint(housing, scale);
    const over = cx >= housing.x && cx <= housing.x + hfp.width && cy >= housing.y && cy <= housing.y + hfp.depth;
    if (!over) continue;
    if (!housingIsEmpty(housing, allElements, elementTypes, scale, element.id)) continue;
    const seat = seatInHousing(element, housing, elementTypes, scale);
    if (!seat) continue;
    const seated = { ...element, rotation: seat.rotation };
    if (findOverlappingElement(seated, seat.x, seat.y, allElements, elementTypes, scale)) continue;
    return { ...seat, housingId: housing.id };
  }
  return null;
};

/**
 * Adding an appliance: a free seat in the first empty cabinet that houses
 * its type, or null (then the normal free-spot search runs).
 */
export const seatInEmptyHousing = (element, allElements = [], elementTypes = {}, scale = 1) => {
  for (const housing of allElements) {
    if (housing.id === element.id || !housingOf(housing, elementTypes)) continue;
    if (!housingIsEmpty(housing, allElements, elementTypes, scale, element.id)) continue;
    const seat = seatInHousing(element, housing, elementTypes, scale);
    if (!seat) continue;
    const seated = { ...element, rotation: seat.rotation };
    if (findOverlappingElement(seated, seat.x, seat.y, allElements, elementTypes, scale)) continue;
    return { ...seat, housingId: housing.id };
  }
  return null;
};

// Positions along one axis, 0..max: every `step` plus the spots that sit
// flush against another item's edges.
const axisStops = (max, step, flush) => {
  const stops = new Set();
  for (let v = 0; v < max; v += step) stops.add(v);
  stops.add(Math.max(0, max));
  flush.forEach((v) => {
    if (v >= 0 && v <= max) stops.add(v);
  });
  return [...stops];
};

/**
 * Nearest spot inside the room where `element` (footprint after rotation)
 * overlaps nothing.
 *
 * @param {Object} element   { id, type, width, depth, rotation, mountHeight, ... }
 * @param {Array}  allElements
 * @param {Object} elementTypes
 * @param {number} scale     plan px per inch
 * @param {Object} options
 *   room        { width, depth } in plan px (required)
 *   preferred   { x, y } spot to try first and measure distance from
 *   walls       room walls present (1 top, 2 right, 3 bottom, 4 left)
 *   wallsFirst  look along the walls before the open floor (default true)
 *   maxDistance give up on spots further than this from `preferred` (px)
 *   isBlocked   (x, y, width, depth) => bool, extra rule (door clearance)
 * @returns {{ x: number, y: number } | null}
 */
export const findFreePosition = (
  element,
  allElements = [],
  elementTypes = {},
  scale = 1,
  {
    room,
    preferred = { x: 0, y: 0 },
    walls = [1, 2, 3, 4],
    wallsFirst = true,
    maxDistance = Infinity,
    isBlocked,
  } = {}
) => {
  const { width, depth } = footprint(element, scale);
  const maxX = room.width - width;
  const maxY = room.depth - depth;
  if (maxX < 0 || maxY < 0) return null; // bigger than the room

  const isFree = (p) =>
    !findOverlappingElement(element, p.x, p.y, allElements, elementTypes, scale) &&
    !(isBlocked && isBlocked(p.x, p.y, width, depth));

  const clamp = (v, max) => Math.max(0, Math.min(v, max));
  const start = { x: clamp(preferred.x, maxX), y: clamp(preferred.y, maxY) };
  if (isFree(start)) return start;

  const others = allElements
    .filter((o) => o.id !== element.id)
    .map((o) => ({ ...o, fp: footprint(o, scale) }));
  const step = scale; // one inch
  const xs = axisStops(maxX, step, others.flatMap((o) => [o.x + o.fp.width, o.x - width]));
  const ys = axisStops(maxY, step, others.flatMap((o) => [o.y + o.fp.depth, o.y - depth]));

  const alongWalls = [];
  if (walls.includes(1)) xs.forEach((x) => alongWalls.push({ x, y: 0 }));
  if (walls.includes(2)) ys.forEach((y) => alongWalls.push({ x: maxX, y }));
  if (walls.includes(3)) xs.forEach((x) => alongWalls.push({ x, y: maxY }));
  if (walls.includes(4)) ys.forEach((y) => alongWalls.push({ x: 0, y }));
  const openFloor = [];
  ys.forEach((y) => xs.forEach((x) => openFloor.push({ x, y })));

  const nearestFree = (spots) =>
    spots
      .map((p) => ({ ...p, d: Math.hypot(p.x - start.x, p.y - start.y) }))
      .filter((p) => p.d <= maxDistance)
      .sort((a, b) => a.d - b.d)
      .find(isFree);

  const tiers = wallsFirst ? [alongWalls, openFloor] : [[...alongWalls, ...openFloor]];
  for (const spots of tiers) {
    const hit = nearestFree(spots);
    if (hit) return { x: hit.x, y: hit.y };
  }
  return null;
};

/**
 * Rotate `element` in place (about its centre, kept in the room) without
 * landing on another item: if the turned footprint overlaps something, it is
 * nudged to the nearest free spot within one item length. Returns the
 * { rotation, x, y } update, or null when there is no room to turn.
 */
export const rotateWithoutOverlap = (element, angle, room, allElements, elementTypes, scale = 1) => {
  const turned = rotateInRoom(element, angle, room, scale);
  const candidate = { ...element, ...turned };
  const lands = findOverlappingElement(candidate, turned.x, turned.y, allElements, elementTypes, scale);
  // already overlapping before the turn (older saved designs): let it turn
  const alreadyOverlapping = findOverlappingElement(element, element.x, element.y, allElements, elementTypes, scale);
  if (!lands || alreadyOverlapping) return turned;
  const size = footprint(candidate, scale);
  const spot = findFreePosition(candidate, allElements, elementTypes, scale, {
    room,
    preferred: { x: turned.x, y: turned.y },
    wallsFirst: false,
    maxDistance: Math.max(size.width, size.depth),
  });
  return spot ? { rotation: turned.rotation, x: spot.x, y: spot.y } : null;
};

/**
 * rotateWithoutOverlap for an item and what it houses: a fridge cabinet turns
 * with its fridge re-seated inside. Returns [{ id, rotation, x, y }] (the
 * element first) or null when there is no room to turn. A cabinet with
 * something inside is not nudged: it turns in place or not at all.
 */
export const rotateWithHoused = (element, angle, room, allElements, elementTypes, scale = 1) => {
  const inside = housedElements(element, allElements, elementTypes, scale);
  if (inside.length === 0) {
    const turned = rotateWithoutOverlap(element, angle, room, allElements, elementTypes, scale);
    return turned ? [{ id: element.id, ...turned }] : null;
  }
  const turned = rotateInRoom(element, angle, room, scale);
  const moves = [
    { id: element.id, ...turned },
    ...carryHoused(element, turned, allElements, elementTypes, scale),
  ];
  const alreadyOverlapping = movesOverlap(
    [{ id: element.id, x: element.x, y: element.y }],
    allElements,
    elementTypes,
    scale
  );
  if (!alreadyOverlapping && movesOverlap(moves, allElements, elementTypes, scale)) return null;
  return moves;
};
export const checkRotatedRectCollision = (
  ax, ay, aWidth, aHeight, aRotation,
  bx, by, bWidth, bHeight, bRotation
) => {
  // For simplicity, we'll use a conservative approach:
  // Calculate the bounding box of the rotated clearance zone and check against that
  const angleRad = (bRotation || 0) * Math.PI / 180;

  // Calculate corners of rotated rectangle
  const halfWidth = bWidth / 2;
  const halfHeight = bHeight / 2;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ];

  // Rotate corners and find bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  corners.forEach(corner => {
    const rotatedX = corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad) + bx;
    const rotatedY = corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad) + by;
    minX = Math.min(minX, rotatedX);
    maxX = Math.max(maxX, rotatedX);
    minY = Math.min(minY, rotatedY);
    maxY = Math.max(maxY, rotatedY);
  });

  // Check collision with expanded bounding box
  return !(ax + aWidth < minX ||
    ax > maxX ||
    ay + aHeight < minY ||
    ay > maxY);
};