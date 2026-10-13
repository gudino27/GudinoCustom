// Cabinets that house an appliance: a refrigerator cabinet (fridge surround)
// holds a refrigerator; an oven cabinet could hold a wall oven the same way.
//
// A cabinet type declares what it houses in its elementTypes spec:
//
//   houses:  ['refrigerator']          appliance types it accepts
//   housing: { sidePanel, topHeight, openFront }
//     sidePanel  thickness of the side panel either side of the opening (in)
//     topHeight  height of the cabinet part over the opening (in); the
//                opening runs from the cabinet's bottom to height - topHeight.
//                Each cabinet may set its own as `upperHeight` (the properties
//                panel), within UPPER_HEIGHT_RANGE
//     openFront  the opening has no front (default true): the appliance may
//                stand proud of the cabinet front, but not behind its back
//
// An appliance is "in" a housing when the housing accepts its type, it faces
// the same way, its plan footprint lies inside the opening (between the side
// panels, not behind the back) and it fits under the part above. Such a pair
// may share floor space (collisionUtils.findOverlappingElement); a housing
// holds at most one appliance.
//
// Positions are plan px (inches * scale), x / y the top-left of the footprint
// as the floor plan stores them. Pure functions, no React.
import { footprint, normalizeRotation } from './rotation.js';

// The opening may be this much (inches) tighter than the appliance, so a 36"
// fridge fits a 36" opening after rounding in the snap and keyboard code.
export const HOUSING_TOLERANCE_IN = 0.5;

// The cabinet over the opening may be set between these (inches), per cabinet
export const UPPER_HEIGHT_RANGE = { min: 6, max: 30 };

// Beyond any room: stands for "no front" on an open-front housing.
const FAR = 1e9;

/** Bottom and top of an element above the floor, in inches. */
export const verticalRange = (element, elementTypes = {}) => {
  const spec = elementTypes[element.type] || {};
  const height =
    Number(element.actualHeight) || spec.fixedHeight || spec.defaultHeight || 0;
  // an explicit 0 means the item was lowered to the floor
  const mount = element.mountHeight ?? spec.mountHeight ?? 0;
  const bottom = Number(mount) || 0;
  return { bottom, top: bottom + height };
};

/** The housing spec of an element's type, or null when it houses nothing. */
export const housingOf = (element, elementTypes = {}) => {
  const spec = element && elementTypes[element.type];
  if (!spec || !Array.isArray(spec.houses) || spec.houses.length === 0) return null;
  const h = spec.housing || {};
  // the cabinet's own upper height wins over the type's default
  const own = Number(element.upperHeight);
  return {
    accepts: spec.houses,
    sidePanel: Number(h.sidePanel) || 0,
    topHeight: Number.isFinite(own) && own > 0 ? own : Number(h.topHeight) || 0,
    openFront: h.openFront !== false,
  };
};

/** Height (inches) of the cabinet over `element`'s opening, or 0. */
export const upperHeightOf = (element, elementTypes = {}) => {
  const h = housingOf(element, elementTypes);
  return h ? h.topHeight : 0;
};

/** Can some type in `elementTypes` house an element of `type`? */
export const isHousable = (type, elementTypes = {}) =>
  Object.values(elementTypes).some((s) => Array.isArray(s.houses) && s.houses.includes(type));

/** Width of a housing's opening (inches): its width less the two side panels. */
export const openingWidth = (element, elementTypes = {}) => {
  const h = housingOf(element, elementTypes);
  return h ? Math.max(0, (Number(element.width) || 0) - 2 * h.sidePanel) : 0;
};

/** Cabinet width (inches) for an opening of `opening` inches. */
export const widthForOpening = (type, opening, elementTypes = {}) => {
  const h = housingOf({ type }, elementTypes);
  return h ? opening + 2 * h.sidePanel : opening;
};

// 0..3: which way an item faces, by the nearest quarter turn (the footprint
// model is axis-aligned, as isQuarterTurned)
const quarterOf = (rotation) => Math.round(normalizeRotation(rotation) / 90) % 4;

/**
 * The opening of `housing` in plan px: { x0, x1, y0, y1 } plus the vertical
 * { bottom, top } in inches. `at` overrides the housing's x / y. With
 * `closed`, an open front is cut at the cabinet front (for seating).
 */
export const housingBay = (housing, elementTypes = {}, scale = 1, at = housing, { closed = false } = {}) => {
  const h = housingOf(housing, elementTypes);
  if (!h) return null;
  const W = housing.width * scale;
  const D = housing.depth * scale;
  const p = h.sidePanel * scale;
  // local: u across the front (left to right seen from the front), v from the back
  const u0 = p;
  const u1 = W - p;
  const v0 = 0;
  const v1 = h.openFront && !closed ? FAR : D;
  const { x, y } = at;
  let rect;
  switch (quarterOf(housing.rotation)) {
    case 1: // front faces west, back on the east side
      rect = { x0: x + D - v1, x1: x + D - v0, y0: y + u0, y1: y + u1 };
      break;
    case 2: // front faces north, back on the south side
      rect = { x0: x + W - u1, x1: x + W - u0, y0: y + D - v1, y1: y + D - v0 };
      break;
    case 3: // front faces east, back on the west side
      rect = { x0: x + v0, x1: x + v1, y0: y + W - u1, y1: y + W - u0 };
      break;
    default: // front faces south (+y), back on the north side
      rect = { x0: x + u0, x1: x + u1, y0: y + v0, y1: y + v1 };
  }
  const { bottom, top } = verticalRange(housing, elementTypes);
  return { ...rect, bottom, top: top - h.topHeight };
};

/**
 * Does `appliance` sit inside `housing`'s opening? `applianceAt` /
 * `housingAt` override their x / y (a candidate move).
 */
export const fitsInHousing = (
  appliance,
  housing,
  elementTypes = {},
  scale = 1,
  { applianceAt = appliance, housingAt = housing } = {}
) => {
  if (!appliance || !housing || appliance.id === housing.id) return false;
  const h = housingOf(housing, elementTypes);
  if (!h || !h.accepts.includes(appliance.type)) return false;
  if (quarterOf(appliance.rotation) !== quarterOf(housing.rotation)) return false;
  const bay = housingBay(housing, elementTypes, scale, housingAt);
  const fp = footprint(appliance, scale);
  const tol = HOUSING_TOLERANCE_IN * scale;
  const ax = applianceAt.x;
  const ay = applianceAt.y;
  const inPlan =
    ax >= bay.x0 - tol &&
    ax + fp.width <= bay.x1 + tol &&
    ay >= bay.y0 - tol &&
    ay + fp.depth <= bay.y1 + tol;
  if (!inPlan) return false;
  const r = verticalRange(appliance, elementTypes);
  return r.bottom >= bay.bottom - HOUSING_TOLERANCE_IN && r.top <= bay.top + HOUSING_TOLERANCE_IN;
};

/** The elements inside `housing` where they are now (at most one in a valid design). */
export const housedElements = (housing, allElements = [], elementTypes = {}, scale = 1, housingAt = housing) =>
  housingOf(housing, elementTypes)
    ? allElements.filter(
        (o) => o.id !== housing.id && fitsInHousing(o, housing, elementTypes, scale, { housingAt })
      )
    : [];

/**
 * May `element` placed at `at` share floor space with `other` (where it is)
 * because one houses the other? The housing must have no other appliance in
 * it already.
 */
export const housingAllowsOverlap = (element, at, other, allElements = [], elementTypes = {}, scale = 1) => {
  const pair = (appliance, applianceAt, housing, housingAt) => {
    if (!fitsInHousing(appliance, housing, elementTypes, scale, { applianceAt, housingAt })) return false;
    // one appliance per housing
    return !allElements.some(
      (o) =>
        o.id !== appliance.id &&
        o.id !== housing.id &&
        fitsInHousing(o, housing, elementTypes, scale, { housingAt })
    );
  };
  const otherAt = { x: other.x, y: other.y };
  return pair(element, at, other, otherAt) || pair(other, otherAt, element, at);
};

/**
 * Where `appliance` sits in `housing`: turned to face the same way, centred
 * across the opening and flush with the cabinet back (the engine draws the
 * fridge from the wall plane). Returns { x, y, rotation } or null when it
 * does not fit.
 */
export const seatInHousing = (appliance, housing, elementTypes = {}, scale = 1) => {
  const h = housingOf(housing, elementTypes);
  if (!h || !h.accepts.includes(appliance.type)) return null;
  const rotation = normalizeRotation(housing.rotation);
  const turned = { ...appliance, rotation };
  const fp = footprint(turned, scale);
  const hfp = footprint(housing, scale);
  const bay = housingBay(housing, elementTypes, scale, housing, { closed: true });
  const midX = (bay.x0 + bay.x1) / 2 - fp.width / 2;
  const midY = (bay.y0 + bay.y1) / 2 - fp.depth / 2;
  let x;
  let y;
  switch (quarterOf(rotation)) {
    case 1:
      x = housing.x + hfp.width - fp.width;
      y = midY;
      break;
    case 2:
      x = midX;
      y = housing.y + hfp.depth - fp.depth;
      break;
    case 3:
      x = housing.x;
      y = midY;
      break;
    default:
      x = midX;
      y = housing.y;
  }
  const seat = { x, y, rotation };
  return fitsInHousing({ ...turned, ...seat }, housing, elementTypes, scale) ? seat : null;
};

/**
 * Where the items inside `housing` go when it changes to `next` (a move,
 * turn or resize): shifted with it, or re-seated when it turned or changed
 * size. Returns [{ id, x, y, rotation? }]; an item that no longer fits after
 * a resize stays where it is.
 */
export const carryHoused = (housing, next, allElements = [], elementTypes = {}, scale = 1) => {
  const inside = housedElements(housing, allElements, elementTypes, scale);
  if (inside.length === 0) return [];
  const after = { ...housing, ...next };
  const reshaped =
    quarterOf(after.rotation) !== quarterOf(housing.rotation) ||
    after.width !== housing.width ||
    after.depth !== housing.depth;
  const dx = after.x - housing.x;
  const dy = after.y - housing.y;
  return inside
    .map((o) => {
      if (!reshaped) return { id: o.id, x: o.x + dx, y: o.y + dy };
      const seat = seatInHousing(o, after, elementTypes, scale);
      return seat ? { id: o.id, ...seat } : null;
    })
    .filter(Boolean);
};

/**
 * { applianceId: housingId } for every appliance sitting in a housing (the
 * first housing that holds it). For the 3D engine view (designerToJob's
 * `housed` option).
 */
export const housedPairs = (allElements = [], elementTypes = {}, scale = 1) => {
  const out = {};
  for (const housing of allElements) {
    if (!housingOf(housing, elementTypes)) continue;
    const [inside] = housedElements(housing, allElements, elementTypes, scale);
    if (inside && out[inside.id] === undefined) out[inside.id] = housing.id;
  }
  return out;
};

/**
 * Would changing `housing` by `next` (a new width, height, upper height,
 * depth, turn or position) leave what is inside it no longer fitting?
 * Returns null when the change is fine, otherwise
 *   { reason, item, need, open, current }
 * reason 'width'  the opening would be narrower than the item:
 *                 need = the item's width, open = the new opening width,
 *                 current = the opening width now
 * reason 'height' the opening would be lower than the item:
 *                 need = the item's top (in), open = the new opening height,
 *                 current = the opening height now
 * reason 'fit'    any other way it stops fitting
 */
export const housingChangeProblem = (housing, next, allElements = [], elementTypes = {}, scale = 1) => {
  if (!housing || !housingOf(housing, elementTypes)) return null;
  const inside = housedElements(housing, allElements, elementTypes, scale);
  if (inside.length === 0) return null;
  const after = { ...housing, ...next };
  const moves = carryHoused(housing, next, allElements, elementTypes, scale);
  for (const item of inside) {
    const move = moves.find((m) => m.id === item.id);
    if (move && fitsInHousing({ ...item, ...move }, after, elementTypes, scale)) continue;
    const itemWidth = Number(item.width) || 0;
    const openNow = openingWidth(housing, elementTypes);
    const openAfter = openingWidth(after, elementTypes);
    if (openAfter + HOUSING_TOLERANCE_IN < itemWidth) {
      return { reason: 'width', item, need: itemWidth, open: openAfter, current: openNow };
    }
    const itemTop = verticalRange(item, elementTypes).top;
    const heightNow = housingBay(housing, elementTypes, 1).top;
    const heightAfter = housingBay(after, elementTypes, 1).top;
    if (heightAfter + HOUSING_TOLERANCE_IN < itemTop) {
      return { reason: 'height', item, need: itemTop, open: heightAfter, current: heightNow };
    }
    return { reason: 'fit', item };
  }
  return null;
};
