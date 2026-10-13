// The scale stored plan px are at, and moving a room's plan px to a new one.
//
// Items, pantries and drawn walls are stored in plan px at the scale the room
// is drawn at: fitPlanScale(dimensions). The 3D views, the AR export and the
// admin viewer read them back at that scale (engine/adapters/designerToJob.js
// fitScale). Pure functions: runs under `node --test`.
import { roundPlanPx, roundPlanRect } from './planUnits.js';
import { syncPantries } from './pantry.js';

/** Plan px per inch for a room of these dimensions (feet): what the designer draws at. */
export const fitPlanScale = (dimensions = {}) => {
  const w = (parseFloat(dimensions.width) || 0) * 12;
  const d = (parseFloat(dimensions.height) || 0) * 12;
  if (!w || !d) return 1;
  return Math.min(600 / w, 600 / d);
};

/**
 * Stored plan px are at the scale the room was drawn at (fitPlanScale of its
 * dimensions). When the room size changes that scale changes, so everything
 * in plan px moves to the new one, keeping its place in inches: items
 * (x, y), pantries (x, y, width, depth) and drawn / pantry walls (end
 * points). Door positions are percentages and sizes are inches: unchanged.
 * Pantry walls should be rebuilt afterwards (syncPantries).
 */
export const rescalePlan = (roomData, fromScale, toScale) => {
  if (!roomData || !(fromScale > 0) || !(toScale > 0) || fromScale === toScale) return roomData;
  const k = toScale / fromScale;
  const px = (v) => (typeof v === 'number' && Number.isFinite(v) ? roundPlanPx(v * k, toScale) : v);
  return {
    ...roomData,
    elements: (roomData.elements || []).map((el) => ({ ...el, x: px(el.x), y: px(el.y) })),
    pantries: roomData.pantries
      ? roomData.pantries.map((p) => roundPlanRect({ ...p, x: p.x * k, y: p.y * k, width: p.width * k, depth: p.depth * k }, toScale))
      : roomData.pantries,
    customWalls: (roomData.customWalls || []).map((w) => ({ ...w, x1: px(w.x1), y1: px(w.y1), x2: px(w.x2), y2: px(w.y2) })),
  };
};

/**
 * The room as the design step should get it: stored plan px moved from the
 * scale they were drawn at (roomData.planScale; DimensionsSetup records it
 * before the first size change) to `newScale`, pantry walls rebuilt, and
 * planScale set. Changing 12' x 10' to 14' x 10' used to leave every item,
 * pantry and drawn wall at its old px, so they all moved and shrank.
 */
export const roomAtScale = (roomData, newScale) => {
  const from = Number(roomData.planScale) > 0 ? Number(roomData.planScale) : newScale;
  let next = rescalePlan(roomData, from, newScale);
  if (next !== roomData && (next.pantries || []).length) next = syncPantries(next, newScale);
  return next.planScale === newScale ? next : { ...next, planScale: newScale };
};
