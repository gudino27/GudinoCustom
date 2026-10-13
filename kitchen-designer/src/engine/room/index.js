// buildRoom: the room shell from a Room (room/schema.js) as parts.
import { buildCasing, buildDoor } from './door.js'
import { buildBaseboards, buildBeam, buildCan, buildCeiling, buildExtra, buildFloor, buildSheet } from './fixtures.js'
import { buildWallBody, resolveOpenings, wallFrame } from './wall.js'
import { buildWindow } from './window.js'

export { ROOM_DEFAULTS, rectangularRoom } from './schema.js'
export { elevationRegions, elevationSolid, resolveOpenings, wallFrame } from './wall.js'
export { axisCylinder, panelDoorLeaf } from './door.js'

/**
 * Everything on one wall: its body (one solid with real openings, or boxes
 * around them), headers, windows, door leaves and knobs, casings, baseboards.
 * @param {import('../model/context.js').Ctx} ctx
 * @param {import('./schema.js').Wall} wall
 * @param {Object} [opts]
 * @param {number} [opts.height]      room height (default ctx.standards.ceiling)
 * @param {number} [opts.windowIndex] first number for default window names
 * @returns {import('../core/part.js').Part[]}
 */
export function buildWall(ctx, wall, opts = {}) {
  const height = opts.height ?? ctx.standards.ceiling
  const frame = wallFrame(wall, height)
  const openings = resolveOpenings(frame)
  const parts = buildWallBody(frame, openings)
  let win = opts.windowIndex ?? 0
  const count = (kind) => openings.filter((o) => o.kind === kind).length
  const cased = openings.filter((o) => o.kind !== 'window')
  const doors = openings.filter((o) => o.kind === 'door')
  for (const o of openings) {
    if (o.kind === 'window') {
      parts.push(...buildWindow(frame, o, win))
      win += 1
      continue
    }
    if (o.kind === 'door') {
      const dn = o.name || (count('door') === 1 ? `${wall.name}_door` : `${wall.name}_door${doors.indexOf(o)}`)
      parts.push(...buildDoor(frame, o, dn))
    }
    const cn = cased.length === 1 ? `${wall.name}_case` : `${wall.name}_case${cased.indexOf(o)}`
    parts.push(...buildCasing(frame, o, cn))
  }
  parts.push(...buildBaseboards(frame, openings))
  return parts
}

/**
 * The room shell: floor, ceiling, walls with their openings, windows, doors,
 * casings, baseboards, beams, recessed cans, closing sheets and extras. Every
 * part carries tags.role (floor | ceiling | wall | window | trim | fixture).
 * @param {import('../model/context.js').Ctx} ctx
 * @param {import('./schema.js').Room} room
 * @returns {import('../core/part.js').Part[]}
 */
export function buildRoom(ctx, room) {
  const height = room.height ?? ctx.standards.ceiling
  const parts = []
  if (room.floor) parts.push(buildFloor(room.floor))
  if (room.ceiling) parts.push(buildCeiling(room.ceiling, height))
  let windowIndex = 0
  for (const wall of room.walls || []) {
    parts.push(...buildWall(ctx, wall, { height, windowIndex }))
    windowIndex += (wall.openings || []).filter((o) => o.kind === 'window').length
  }
  for (const b of room.beams || []) parts.push(buildBeam(b, height))
  for (const c of room.cans || []) parts.push(...buildCan(c, height))
  for (const s of room.sheets || []) parts.push(buildSheet(s, height))
  for (const e of room.extras || []) parts.push(buildExtra(e))
  return parts
}
