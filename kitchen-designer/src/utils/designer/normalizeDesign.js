// Bring a saved design up to the shape the designer and the admin viewer
// draw today. Designs are stored as the room objects the designer page keeps
// in state (localStorage `kitchenDesignState` / `bathroomDesignState`, and
// `kitchen_data` / `bathroom_data` of a submitted design), and older ones
// miss fields or carry values the current code reads differently:
//
//   - rotations stored negative (-90, -180) by the old anticlockwise button:
//     normalised to [0, 360) (utils/designer/rotation.js)
//   - numbers stored as strings ("24"), missing ids, category, zIndex or
//     actualHeight
//   - no walls / removedWalls / customWalls / doors / pantries / materials
//   - element types this build does not know: kept, and reported in `issues`
//     (the caller decides whether to draw a placeholder or drop them)
//   - custom walls, doors and pantries with unusable coordinates: dropped and
//     reported; pantry walls / openings whose pantry is gone: dropped;
//     a pantry saved without its walls: its walls rebuilt (syncPantries)
//
// Pure (no React, no DOM, no storage): runs under `node --test`. Never
// mutates its input; normalising twice gives the same result.
import { normalizeRotation } from './rotation.js';
import { syncPantries } from './pantry.js';

export const DEFAULT_WALLS = [1, 2, 3, 4];
const DEFAULT_WALL_HEIGHT = '96';
const DESIGNER_CANVAS = 600; // px the plan fits the room into (useRoomManagement)

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const toNumber = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
};
const finite = (v) => Number.isFinite(toNumber(v));
const numberList = (list, fallback) => {
  if (!Array.isArray(list)) return [...fallback];
  const out = [];
  for (const v of list) {
    const n = toNumber(v);
    if (Number.isFinite(n) && !out.includes(n)) out.push(n);
  }
  return out;
};

/** Plan px per inch the designer uses for a room of these dimensions. */
export const fitScale = (dimensions = {}) => {
  const w = (parseFloat(dimensions.width) || 0) * 12;
  const d = (parseFloat(dimensions.height) || 0) * 12;
  if (!w || !d) return 1;
  return Math.min(DESIGNER_CANVAS / w, DESIGNER_CANVAS / d);
};

/** Parse a room that arrived as a JSON string; anything else passes through. */
const parseRoom = (raw) => {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeElement = (el, index, elementTypes, issues, usedIds) => {
  const spec = elementTypes[el.type];
  const out = { ...el };
  const label = `item ${index + 1}`;

  if (out.id === undefined || out.id === null || out.id === '' || usedIds.has(String(out.id))) {
    let id = `legacy-${index + 1}`;
    while (usedIds.has(id)) id = `${id}-x`;
    issues.push({ code: 'element-id', index, message: `${label}: no unique id, given "${id}"` });
    out.id = id;
  }
  usedIds.add(String(out.id));

  if (!spec) {
    issues.push({
      code: 'unknown-type',
      index,
      elementId: out.id,
      type: out.type,
      message: `${label}: type "${out.type}" is not known to this version`,
    });
  }

  // position: plan px; size: inches
  for (const key of ['x', 'y']) {
    const n = toNumber(out[key]);
    if (!Number.isFinite(n)) {
      if (out[key] !== undefined) issues.push({ code: 'element-position', index, elementId: out.id, message: `${label}: ${key} was not a number, set to 0` });
      out[key] = 0;
    } else out[key] = n;
  }
  const sizeDefault = { width: spec?.defaultWidth ?? 24, depth: spec?.defaultDepth ?? 24 };
  for (const key of ['width', 'depth']) {
    const n = toNumber(out[key]);
    if (!Number.isFinite(n) || n <= 0) {
      issues.push({ code: 'element-size', index, elementId: out.id, message: `${label}: ${key} missing, set to ${sizeDefault[key]}"` });
      out[key] = sizeDefault[key];
    } else out[key] = n;
  }
  for (const key of ['actualHeight', 'mountHeight', 'upperHeight']) {
    if (out[key] === undefined || out[key] === null || out[key] === '') continue;
    const n = toNumber(out[key]);
    if (Number.isFinite(n)) out[key] = n;
    else delete out[key];
  }
  // the wall view reads actualHeight (the designer sets it when an item is added)
  if (!(out.actualHeight > 0) && spec && (spec.fixedHeight || spec.defaultHeight)) {
    out.actualHeight = spec.fixedHeight || spec.defaultHeight;
  }

  const rotation = normalizeRotation(out.rotation);
  if (out.rotation !== undefined && toNumber(out.rotation) !== rotation) {
    issues.push({ code: 'rotation', index, elementId: out.id, message: `${label}: rotation ${out.rotation} read as ${rotation}` });
  }
  out.rotation = rotation;

  if (!out.category && spec?.category) out.category = spec.category;
  if (!Number.isFinite(toNumber(out.zIndex))) out.zIndex = spec?.zIndex ?? 1;
  else out.zIndex = toNumber(out.zIndex);
  return out;
};

const normalizeCustomWall = (wall, index, issues) => {
  const coords = ['x1', 'y1', 'x2', 'y2'];
  if (!isObject(wall) || !coords.every((k) => finite(wall[k])) || !finite(wall.wallNumber)) {
    issues.push({ code: 'custom-wall', index, message: `custom wall ${index + 1}: missing coordinates or wall number, left out` });
    return null;
  }
  const out = { ...wall };
  coords.forEach((k) => { out[k] = toNumber(wall[k]); });
  out.wallNumber = toNumber(wall.wallNumber);
  if (Math.hypot(out.x2 - out.x1, out.y2 - out.y1) <= 0) {
    issues.push({ code: 'custom-wall', index, message: `custom wall ${index + 1}: zero length, left out` });
    return null;
  }
  if (out.id === undefined || out.id === null || out.id === '') out.id = `wall-${out.wallNumber}`;
  if (!finite(out.thickness) || toNumber(out.thickness) <= 0) out.thickness = 6;
  else out.thickness = toNumber(out.thickness);
  return out;
};

const normalizeDoor = (door, index, issues) => {
  if (!isObject(door) || !finite(door.wallNumber) || !finite(door.position)) {
    issues.push({ code: 'door', index, message: `door ${index + 1}: missing wall or position, left out` });
    return null;
  }
  const width = toNumber(door.width);
  return {
    ...door,
    id: door.id ?? `door-${index + 1}`,
    wallNumber: toNumber(door.wallNumber),
    position: Math.max(0, Math.min(100, toNumber(door.position))),
    width: Number.isFinite(width) && width > 0 ? width : 32,
    type: door.type || 'standard',
  };
};

const normalizePantry = (pantry, index, issues) => {
  const keys = ['x', 'y', 'width', 'depth'];
  if (!isObject(pantry) || !keys.every((k) => finite(pantry[k])) ||
      toNumber(pantry.width) <= 0 || toNumber(pantry.depth) <= 0) {
    issues.push({ code: 'pantry', index, message: `pantry ${index + 1}: missing position or size, left out` });
    return null;
  }
  const out = { ...pantry };
  keys.forEach((k) => { out[k] = toNumber(pantry[k]); });
  if (out.id === undefined || out.id === null || out.id === '') out.id = `pantry-legacy-${index + 1}`;
  return out;
};

/**
 * Normalise one room (kitchen_data / bathroom_data / a localStorage state).
 *
 * @param {Object|string|null} raw
 * @param {Object} [opts]
 * @param {Object} [opts.elementTypes]  the designer's elementTypes (to spot unknown types and fill defaults)
 * @param {number} [opts.scale]         plan px per inch, to rebuild pantry walls; default fitScale(dimensions)
 * @returns {{ roomData: Object|null, issues: Array<{code: string, message: string}> }}
 */
export const normalizeRoomData = (raw, { elementTypes = {}, scale } = {}) => {
  const issues = [];
  const src = parseRoom(raw);
  if (!isObject(src)) {
    if (raw !== null && raw !== undefined) issues.push({ code: 'room', message: 'room data could not be read' });
    return { roomData: null, issues };
  }

  const dims = isObject(src.dimensions) ? src.dimensions : {};
  if (!isObject(src.dimensions)) issues.push({ code: 'dimensions', message: 'no room dimensions' });
  const dimensions = {
    ...dims,
    width: dims.width ?? '',
    height: dims.height ?? '',
    wallHeight: finite(dims.wallHeight) && toNumber(dims.wallHeight) > 0 ? dims.wallHeight : DEFAULT_WALL_HEIGHT,
  };

  const rawElements = Array.isArray(src.elements) ? src.elements : [];
  const usedIds = new Set();
  const elements = [];
  rawElements.forEach((el, i) => {
    if (!isObject(el)) {
      issues.push({ code: 'element', index: i, message: `item ${i + 1}: not an item, left out` });
      return;
    }
    elements.push(normalizeElement(el, i, elementTypes, issues, usedIds));
  });

  let pantries = (Array.isArray(src.pantries) ? src.pantries : [])
    .map((p, i) => normalizePantry(p, i, issues))
    .filter(Boolean);
  const pantryIds = new Set(pantries.map((p) => String(p.id)));

  let customWalls = (Array.isArray(src.customWalls) ? src.customWalls : [])
    .map((w, i) => normalizeCustomWall(w, i, issues))
    .filter(Boolean);
  let doors = (Array.isArray(src.doors) ? src.doors : [])
    .map((d, i) => normalizeDoor(d, i, issues))
    .filter(Boolean);

  // pantry walls / openings whose pantry is gone
  const orphanWalls = customWalls.filter((w) => w.pantryId && !pantryIds.has(String(w.pantryId)));
  if (orphanWalls.length) {
    issues.push({ code: 'pantry-orphan', message: `${orphanWalls.length} pantry wall(s) without their pantry, left out` });
    customWalls = customWalls.filter((w) => !orphanWalls.includes(w));
  }
  doors = doors.filter((d) => !d.pantryId || pantryIds.has(String(d.pantryId)));

  const walls = numberList(src.walls, DEFAULT_WALLS);
  const roomData = {
    ...src,
    dimensions,
    elements,
    materials: isObject(src.materials) ? src.materials : {},
    colorCount: finite(src.colorCount) && toNumber(src.colorCount) >= 1 ? toNumber(src.colorCount) : 1,
    walls,
    removedWalls: numberList(src.removedWalls, []),
    customWalls,
    allAvailableWalls: numberList(src.allAvailableWalls, [...new Set([...DEFAULT_WALLS, ...walls])]),
    originalWalls: numberList(src.originalWalls, DEFAULT_WALLS),
    doors,
    pantries,
  };

  // a pantry saved without its walls (or with none left): rebuild them
  const bare = pantries.filter((p) => !customWalls.some((w) => String(w.pantryId) === String(p.id)));
  if (bare.length && finite(dimensions.width) && finite(dimensions.height)) {
    issues.push({ code: 'pantry-walls', message: `${bare.length} pantry(s) had no walls saved; rebuilt` });
    const rebuilt = syncPantries(roomData, scale || fitScale(dimensions));
    return { roomData: rebuilt, issues };
  }
  return { roomData, issues };
};

/**
 * Normalise a submitted design (the /api/designs/:id row): its kitchen_data and
 * bathroom_data, and the include flags (0 / 1 from the database).
 *
 * @returns {Object} the design with normalised rooms and `normalizeIssues`
 *                   { kitchen: [...], bathroom: [...] }
 */
export const normalizeDesign = (design, opts = {}) => {
  if (!isObject(design)) return design;
  const kitchen = normalizeRoomData(design.kitchen_data, opts);
  const bathroom = normalizeRoomData(design.bathroom_data, opts);
  return {
    ...design,
    include_kitchen: !!design.include_kitchen && design.include_kitchen !== '0',
    include_bathroom: !!design.include_bathroom && design.include_bathroom !== '0',
    kitchen_data: kitchen.roomData,
    bathroom_data: bathroom.roomData,
    normalizeIssues: { kitchen: kitchen.issues, bathroom: bathroom.issues },
  };
};

/** Ids of elements whose type `elementTypes` does not know. */
export const unknownTypeIds = (issues = []) =>
  new Set(issues.filter((i) => i.code === 'unknown-type').map((i) => String(i.elementId)));
