// The website designer's saved room (kitchenData / bathroomData in
// src/hooks/designer/useDesignerState.js) -> an engine Job.
//
// Designer conventions this file relies on (file:line references and the full
// story are in INTEGRATION.md):
//   - room width / "height" (north-south depth) are FEET, stored as strings;
//     wallHeight is INCHES, also a string.
//   - element width / depth / actualHeight / mountHeight are INCHES.
//   - element x / y are SVG PIXELS at `scale` pixels per inch, measured from the
//     room's inside north-west corner, x east, y south (same axes as the engine).
//   - DesignEditor3D centres the box at (x/scale + width/2, y/scale + depth/2),
//     whatever the rotation, and turns it about that centre. rotation is degrees,
//     positive clockwise seen from above; at 0 the front faces south (+y).
//     This is exactly the engine's placement angle, so angle = rotation.
//   - custom walls are pixel line segments; doors are % of the wall length to
//     the door's centre.
//
// Pure data in, pure data out: no React, no DOM, nothing imported from the
// website. `elementTypes` is passed in.
import { rectangularRoom } from '../room/schema.js'
import { mapElementType } from './typeMap.js'

/** Canvas size the designer fits the room into (useRoomManagement.js, DesignPreview.js). */
export const DESIGNER_CANVAS = 600
/** DesignEditor3D's fixed values, in inches. */
export const DESIGNER_WALL_THICKNESS = 4
export const DESIGNER_DOOR_HEIGHT = 80
export const DESIGNER_DEFAULT_WALL_HEIGHT = 96

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}
const rad = (deg) => (deg * Math.PI) / 180

/** Room size in plan inches from the designer's dimensions (feet strings). */
export function roomSize(dimensions = {}) {
  return {
    width: (num(dimensions.width) || 0) * 12,
    depth: (num(dimensions.height) || 0) * 12,
    height: num(dimensions.wallHeight) || DESIGNER_DEFAULT_WALL_HEIGHT,
  }
}

/**
 * Pixels per inch the designer uses right after the dimensions step and when
 * switching rooms: min(600 / widthIn, 600 / depthIn). Zooming changes the live
 * scale without rescaling stored positions, so saved designs are only
 * meaningful at this scale (it is also what the admin DesignPreview assumes).
 */
export function fitScale(dimensions) {
  const { width, depth } = roomSize(dimensions)
  if (!width || !depth) return 1
  return Math.min(DESIGNER_CANVAS / width, DESIGNER_CANVAS / depth)
}

/** Degrees in [0, 360). The designer can store negative angles (rotateElement uses %). */
export const normalizeAngle = (deg) => ((((num(deg) || 0) % 360) + 360) % 360)

/** Rotate a local (east, south) offset by `deg` clockwise seen from above. */
const turn = ([a, b], deg) => {
  const c = Math.cos(rad(deg))
  const s = Math.sin(rad(deg))
  return [a * c - b * s, a * s + b * c]
}

/**
 * Plan centre of an element.
 *   anchor 'editor3d'  (default) DesignEditor3D: (x/s + w/2, y/s + d/2), any rotation.
 *   anchor 'footprint' the 2D planner's drag / snap / clamp model: (x, y) is the
 *                      top-left of the axis-aligned footprint, with width and
 *                      depth swapped when rotation % 180 != 0.
 * The two agree at 0 and 180 degrees and for square elements.
 */
export function elementCenter(el, scale, anchor = 'editor3d') {
  const w = num(el.width) || 0
  const d = num(el.depth) || 0
  const x = (num(el.x) || 0) / scale
  const y = (num(el.y) || 0) / scale
  if (anchor === 'footprint') {
    const turned = normalizeAngle(el.rotation) % 180 !== 0
    return [x + (turned ? d : w) / 2, y + (turned ? w : d) / 2]
  }
  return [x + w / 2, y + d / 2]
}

/** Back-left corner (seen from the front) of a box centred at `center`. */
export function backLeftFromCenter(center, angle, width, depth) {
  const [ox, oy] = turn([-width / 2, -depth / 2], angle)
  return [center[0] + ox, center[1] + oy]
}

/** Inverse of backLeftFromCenter. */
export function centerFromBackLeft(at, angle, width, depth) {
  const [ox, oy] = turn([width / 2, depth / 2], angle)
  return [at[0] + ox, at[1] + oy]
}

/**
 * Where the designer should store an element whose engine placement is
 * `{ at, angle, width, depth }` (for writing a 3D drag back to roomData).
 * Returns pixels at `scale`, in the same anchor convention.
 */
export function designerPosition({ at, angle, width, depth }, scale, anchor = 'editor3d') {
  const [cx, cy] = centerFromBackLeft(at, angle, width, depth)
  let hw = width / 2
  let hd = depth / 2
  if (anchor === 'footprint' && normalizeAngle(angle) % 180 !== 0) [hw, hd] = [hd, hw]
  return { x: (cx - hw) * scale, y: (cy - hd) * scale, rotation: normalizeAngle(angle) }
}

/** Height and bottom exactly as the designer resolves them. */
export function elementHeights(el, spec = {}) {
  // DesignEditor3D uses actualHeight || spec.defaultHeight || 30; WallView uses
  // actualHeight || spec.fixedHeight. addElement always sets actualHeight, so
  // they only differ for hand-made data; fixedHeight is the right fallback.
  const height = num(el.actualHeight) || spec.fixedHeight || spec.defaultHeight || 30
  // DesignEditor3D: element.mountHeight || spec.mountHeight || 0 (0 falls back to the spec)
  const bottom = num(el.mountHeight) || spec.mountHeight || 0
  return { height, bottom }
}

const materialKind = (id, lookup) => {
  const m = lookup ? lookup(id) : null
  if (m && m.type) return m.type
  if (/^stain-/.test(id)) return 'stain'
  if (/^app-/.test(id)) return 'appliance'
  return 'paint'
}

function finishOf(el, roomData, lookup) {
  const out = {}
  if (el.materialId) {
    out.materialId = el.materialId
    out.kind = materialKind(el.materialId, lookup)
    const m = lookup ? lookup(el.materialId) : null
    if (m && m.hex) out.hex = m.hex
  }
  if (el.finish) out.sheen = el.finish
  if (el.grain) out.grain = el.grain
  const priced = roomData.materials && roomData.materials[el.id]
  if (priced) out.pricingMaterial = priced
  return Object.keys(out).length ? out : null
}

// The fridge body is this much narrower than its opening (buildAppliance's
// 35.625" fridge in a 36" slot).
const FRIDGE_SLOT_PLAY = 0.375

/**
 * Engine options for a designer cabinet that houses an appliance (its spec
 * has `houses` and `housing`, see src/utils/designer/housing.js). Only the
 * fridge surround so far: side panels of housing.sidePanel either side of an
 * opening of width - 2 * sidePanel. `appliance` is the element inside it, or
 * null: then the surround is built empty (appliance: false). The upper over
 * the opening is the cabinet's own `upperHeight` (set in the properties
 * panel), else housing.topHeight, with or without a fridge: what the customer
 * sets is what the 3D view shows (the engine would otherwise bring the upper
 * down to 1.5" over the fridge).
 */
export function housingOptions(engineType, spec = {}, width, appliance, appliancePlacement, { upperHeight } = {}) {
  if (engineType !== 'fridge-surround' || !Array.isArray(spec.houses)) return {}
  const h = spec.housing || {}
  const panel = num(h.sidePanel) ?? 0
  const opening = Math.max(0, width - 2 * panel)
  const out = { panelLeft: panel, fridgeWidth: opening }
  const own = num(upperHeight)
  const upper = own != null && own > 0 ? own : num(h.topHeight)
  if (upper) out.upperHeight = upper
  if (!appliance) {
    out.appliance = false
    return out
  }
  const body = Math.min(appliancePlacement.width, opening) - FRIDGE_SLOT_PLAY
  out.appliance = true
  out.fridgeHeight = appliancePlacement.height
  out.fridgeName = `fridge${appliance.id}`
  out.fridgeOptions = { width: body }
  return out
}

/** One engine placement per designer element. */
export function elementToPlacement(el, { elementTypes = {}, scale, anchor = 'editor3d', roomData = {}, materialLookup } = {}) {
  const spec = elementTypes[el.type] || {}
  const mapped = mapElementType(el.type)
  const width = num(el.width) || spec.defaultWidth || 0
  const depth = num(el.depth) || spec.defaultDepth || 0
  const angle = normalizeAngle(el.rotation)
  const center = elementCenter({ ...el, width, depth }, scale, anchor)
  const at = backLeftFromCenter(center, angle, width, depth)
  const { height, bottom } = elementHeights(el, spec)

  const options = { ...mapped.options }
  if (spec.shape === 'corner') options.returnSide = el.hingeDirection === 'right' ? 'right' : 'left'
  if (spec.hasSink && options.sink === undefined) options.sink = true
  Object.assign(options, housingOptions(mapped.type, spec, width, null, null, { upperHeight: el.upperHeight }))
  const finish = finishOf(el, roomData, materialLookup)
  if (finish) options.finish = finish

  const placement = {
    id: el.id,
    type: mapped.type,
    level: mapped.level,
    at,
    angle,
    width,
    depth,
    height,
    bottom,
    center,
    options,
    designer: {
      type: el.type,
      x: el.x,
      y: el.y,
      rotation: el.rotation || 0,
      category: el.category || spec.category || null,
      zIndex: el.zIndex ?? spec.zIndex ?? null,
    },
  }
  if (mapped.unknown) placement.unknown = true
  return placement
}

const DOOR_KINDS = {
  // designer door type -> room/schema.js Opening fields (useWallManagement.js addDoor, wallViewUtils getDoorTypes)
  standard: { kind: 'door', leaves: 1 },
  pantry: { kind: 'door', leaves: 1 },
  double: { kind: 'door', leaves: 2 },
  sliding: { kind: 'door', leaves: 1, sliding: true }, // no sliding leaf in the engine yet
  room: { kind: 'cased-opening' }, // "Room Connection": an opening (DesignEditor3D still draws a leaf)
  'cased-opening': { kind: 'cased-opening' }, // a pantry's opening: trim, no leaf (utils/designer/pantry.js)
}

/**
 * The designer's walls, removed walls, custom walls and doors as a
 * room/schema.js Room (what buildRoom draws), in plan inches.
 *
 *   walls 1-4  rectangularRoom(): w1 north (0,0)->(W,0), w2 east, w3 south (0,D)->(W,D),
 *              w4 west (0,0)->(0,D), on the room face, 4" thick like DesignEditor3D
 *              (RoomWalls), only those in roomData.walls.
 *   custom     side 'center' partitions from the pixel segment / scale, named w<wallNumber>,
 *              only those in roomData.walls.
 *   doors      Opening { kind, center: position% x wall length, width, head 80 };
 *              doors on a wall that is not in the room are dropped with a warning.
 *
 * @returns {{ room: import('../room/schema.js').Room, info: Object, warnings: string[] }}
 */
export function designerRoom(roomData, { scale } = {}) {
  const { width: W, depth: D, height: H } = roomSize(roomData.dimensions)
  const s = scale || fitScale(roomData.dimensions)
  const active = new Set(roomData.walls || [1, 2, 3, 4])
  const t = DESIGNER_WALL_THICKNESS
  const warnings = []

  const room = rectangularRoom(W, D, {
    height: H,
    thickness: t,
    walls: [1, 2, 3, 4].filter((n) => active.has(n)),
  })
  const byNumber = new Map(room.walls.map((w) => [Number(w.name.slice(1)), w]))
  for (const cw of roomData.customWalls || []) {
    if (!active.has(cw.wallNumber)) continue
    const wall = {
      name: `w${cw.wallNumber}`,
      from: [cw.x1 / s, cw.y1 / s],
      to: [cw.x2 / s, cw.y2 / s],
      side: 'center',
      // Drawn walls store "pixels" (useWallManagement.js) but DesignEditor3D reads
      // it as inches; pantry walls store inches (thicknessIn, utils/designer/pantry.js).
      thickness: num(cw.thicknessIn) || num(cw.thickness) || t,
      openings: [],
      designerId: cw.id,
    }
    if (cw.pantryId) {
      wall.pantryId = cw.pantryId
      wall.pantryInside = cw.pantryInside
    }
    room.walls.push(wall)
    byNumber.set(cw.wallNumber, wall)
  }

  for (const door of roomData.doors || []) {
    const wall = byNumber.get(door.wallNumber)
    if (!wall) {
      warnings.push(`door ${door.id} is on wall ${door.wallNumber}, which is not in the room; dropped (DesignEditor3D does not draw it either)`)
      continue
    }
    const len = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1])
    const doorType = door.type || 'standard'
    const kind = DOOR_KINDS[doorType] || DOOR_KINDS.standard
    wall.openings.push({
      ...kind,
      center: ((num(door.position) ?? 50) / 100) * len,
      width: num(door.width) || 32,
      head: DESIGNER_DOOR_HEIGHT,
      designerId: door.id,
      doorType,
    })
  }

  const info = {
    width: W,
    depth: D,
    ceiling: H,
    walls: [...active],
    removedWalls: [...(roomData.removedWalls || [])],
    originalWalls: [...(roomData.originalWalls || [1, 2, 3, 4])],
  }
  return { room, info, warnings }
}

function jobStyle(elements, roomData, materialLookup) {
  // The designer has no door style, pull or counter choice; only a colour per
  // cabinet (materialId), a sheen and a wood grain. The engine's style keys
  // stay at their defaults; the dominant cabinet colour rides along as `color`.
  const counts = new Map()
  for (const el of elements) {
    if (el.category !== 'cabinet' || !el.materialId) continue
    counts.set(el.materialId, (counts.get(el.materialId) || 0) + 1)
  }
  const style = {}
  if (counts.size) {
    const [materialId] = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
    const el = elements.find((e) => e.materialId === materialId)
    const color = { materialId, kind: materialKind(materialId, materialLookup) }
    const m = materialLookup ? materialLookup(materialId) : null
    if (m && m.hex) color.hex = m.hex
    if (el.finish) color.sheen = el.finish
    if (el.grain) color.grain = el.grain
    style.color = color
    style.colorCount = counts.size
  }
  if (roomData.colorCount) style.pricedColorCount = roomData.colorCount
  return style
}

function jobStandards(elementTypes, roomType, ceiling) {
  const base = roomType === 'bathroom' ? elementTypes.vanity : elementTypes.base
  const upper = roomType === 'bathroom' ? elementTypes.medicine : elementTypes.wall
  const out = { ceiling }
  if (base) {
    if (base.fixedHeight) out.baseHeight = base.fixedHeight
    if (base.defaultDepth) out.baseDepth = base.defaultDepth
  }
  if (upper) {
    if (upper.mountHeight) out.upperBottom = upper.mountHeight
    const h = upper.fixedHeight || upper.defaultHeight
    if (upper.mountHeight && h) out.upperTop = upper.mountHeight + h
    if (upper.defaultDepth) out.upperDepth = upper.defaultDepth
  }
  return out
}

/**
 * The designer's state for one room -> an engine Job.
 *
 * @param {Object} roomData  kitchenData or bathroomData
 * @param {Object} opts
 * @param {Object} opts.elementTypes   the website's elementTypes (passed in, never imported)
 * @param {'kitchen'|'bathroom'} [opts.roomType]
 * @param {number} [opts.scale]        pixels per inch of element x/y; default fitScale(dimensions).
 *                                     Pass the page's live `scale` to match what the 2D view shows now.
 * @param {'editor3d'|'footprint'} [opts.anchor]  how x/y anchor a rotated element (see elementCenter)
 * @param {(id: string) => Object} [opts.materialLookup]  getMaterialById, to add hex colours
 * @param {Object} [opts.style]        job style overrides
 * @param {Object} [opts.construction] job construction overrides
 * @param {Object|Map} [opts.housed]   { applianceId: housingId } for appliances standing inside a
 *                                     cabinet that houses them (a fridge in a refrigerator cabinet;
 *                                     the website's housedPairs). The cabinet is built with the
 *                                     appliance (one placement, `housed: [applianceId]`, the
 *                                     appliance's colour in options.housedFinish) and the appliance
 *                                     gets no placement of its own.
 */
export function designerToJob(roomData, {
  elementTypes = {},
  roomType = 'kitchen',
  scale,
  anchor = 'editor3d',
  materialLookup,
  style: styleOverride,
  construction = {},
  housed = {},
} = {}) {
  if (!roomData) throw new Error('designerToJob: roomData is required')
  const s = scale || fitScale(roomData.dimensions)
  const elements = roomData.elements || []
  const { room, info, warnings } = designerRoom(roomData, { scale: s })

  const placementOf = (el) => elementToPlacement(el, { elementTypes, scale: s, anchor, roomData, materialLookup })

  // housing id -> the appliance inside it (only housings the engine builds with one)
  const housedMap = housed instanceof Map ? housed : new Map(Object.entries(housed || {}))
  const byId = new Map(elements.map((el) => [String(el.id), el]))
  const inside = new Map()
  for (const [applianceId, housingId] of housedMap) {
    const appliance = byId.get(String(applianceId))
    const housing = byId.get(String(housingId))
    if (!appliance || !housing || inside.has(String(housingId))) continue
    if (mapElementType(housing.type).type !== 'fridge-surround') continue
    inside.set(String(housingId), appliance)
  }
  const housedIds = new Set([...inside.values()].map((a) => String(a.id)))

  const placements = []
  for (const el of elements) {
    if (!elementTypes[el.type]) warnings.push(`element ${el.id}: type "${el.type}" is not in elementTypes`)
    if (housedIds.has(String(el.id))) continue // built by the cabinet it stands in
    const p = placementOf(el)
    if (p.unknown) warnings.push(`element ${el.id}: type "${el.type}" has no engine mapping; emitted as a fixture`)
    const appliance = inside.get(String(el.id))
    if (appliance) {
      const spec = elementTypes[el.type] || {}
      const ap = placementOf(appliance)
      delete p.options.upperHeight
      Object.assign(p.options, housingOptions(p.type, spec, p.width, appliance, ap, { upperHeight: el.upperHeight }))
      if (ap.options.finish) p.options.housedFinish = ap.options.finish
      p.housed = [appliance.id]
    }
    placements.push(p)
  }

  return {
    units: 'in',
    room,
    standards: jobStandards(elementTypes, roomType, info.ceiling),
    style: { ...jobStyle(elements, roomData, materialLookup), ...(styleOverride || {}) },
    construction: { ...construction },
    runs: [],
    placements,
    islands: [],
    meta: {
      source: 'designer',
      roomType,
      scale: s,
      anchor,
      room: info,
      // housing id -> id of the appliance built inside it
      housed: Object.fromEntries([...inside].map(([hid, a]) => [hid, a.id])),
      warnings,
    },
  }
}
