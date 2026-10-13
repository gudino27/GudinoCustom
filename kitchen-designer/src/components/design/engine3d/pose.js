// Poses of placed items in the engine view: where a cabinet group stands, how
// it follows a drag without rebuilding its geometry, the room clamp, and the
// write-back to the designer's { x, y, rotation }.
//
// The engine bakes each placement's plan position into its geometry (metres,
// y up, plan x east -> three x, plan y south -> three z), so a group built at
// pose P0 sits at the identity transform. To show it at P1 its matrix is
// M(P1) * M(P0)^-1, where M(P) = T(centre, bottom) * Ry(-angle): turning
// clockwise seen from above is a negative rotation about +y when z points
// south.
//
// No React: runs under `node --test`.
import { Matrix4 } from 'three'
import { IN, backLeftFromCenter, designerPosition, normalizeAngle } from '../../../engine/index.js'

const DEG = Math.PI / 180

/** Clearance kept between a dragged item and the room's walls (inches), as DesignEditor3D does. */
export const CLAMP_BUFFER = 0.5

/** The pose part of an engine placement: plan centre (inches), angle (degrees), bottom (inches). */
export function poseOf(placement) {
  return {
    center: [placement.center[0], placement.center[1]],
    angle: placement.angle || 0,
    bottom: placement.bottom || 0,
  }
}

/** A pose as three.js position (metres) and rotation about y (radians). */
export function poseToObject({ center, angle, bottom }) {
  return {
    position: [center[0] * IN, (bottom || 0) * IN, center[1] * IN],
    rotationY: -(angle || 0) * DEG,
  }
}

/** Designer angle (degrees, clockwise from above, [0, 360)) from a three.js rotation.y. */
export const angleFromRotationY = (rotationY) => normalizeAngle(-rotationY / DEG)

/**
 * Heading (rotation about +y, radians) of a quaternion { x, y, z, w }.
 * Read it from the quaternion, not from object.rotation.y: past +-90 degrees
 * three's Euler decomposition of a pure y turn comes back as (pi, pi - t, pi),
 * so rotation.y alone reports the wrong angle.
 */
export function yawFromQuaternion({ x, y, z, w }) {
  return Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y))
}

/** M(P): the transform that puts the item's local frame (centre, bottom, facing) in the world. */
export function poseMatrix(pose, target = new Matrix4()) {
  const { position, rotationY } = poseToObject(pose)
  const rot = new Matrix4().makeRotationY(rotationY)
  return target.makeTranslation(position[0], position[1], position[2]).multiply(rot)
}

/** M(to) * M(from)^-1: moves geometry baked at `from` to `to`. */
export function deltaMatrix(to, from, target = new Matrix4()) {
  const inv = poseMatrix(from).invert()
  return poseMatrix(to, target).multiply(inv)
}

/** True when two poses are the same (to float noise). */
export function samePose(a, b, eps = 1e-9) {
  return Math.abs(a.center[0] - b.center[0]) < eps
    && Math.abs(a.center[1] - b.center[1]) < eps
    && Math.abs(normalizeAngle(a.angle) - normalizeAngle(b.angle)) < eps
    && Math.abs((a.bottom || 0) - (b.bottom || 0)) < eps
}

/**
 * Keep an item inside the room while it is dragged (DesignEditor3D's clamp, in
 * plan inches): the rotated width x depth box stays `buffer` off each wall;
 * an item too big for the room is centred on that axis.
 *
 * @param {[number, number]} center  plan inches
 * @param {number} angle   degrees
 * @param {{ width: number, depth: number }} size   the item, inches
 * @param {{ width: number, depth: number }} room   interior, inches
 * @returns {[number, number]} clamped centre
 */
export function clampCenter(center, angle, { width, depth }, room, buffer = CLAMP_BUFFER) {
  const c = Math.abs(Math.cos(angle * DEG))
  const s = Math.abs(Math.sin(angle * DEG))
  const halfX = (width * c + depth * s) / 2
  const halfY = (width * s + depth * c) / 2
  const axis = (v, half, size) => {
    const lo = half + buffer
    const hi = size - half - buffer
    if (lo > hi) return size / 2
    return Math.min(hi, Math.max(lo, v))
  }
  return [axis(center[0], halfX, room.width), axis(center[1], halfY, room.depth)]
}

/** The same clamp on a three.js position (metres); returns the clamped [x, z]. */
export function clampObjectXZ([x, z], rotationY, size, room, buffer = CLAMP_BUFFER) {
  const [cx, cy] = clampCenter([x / IN, z / IN], angleFromRotationY(rotationY), size, room, buffer)
  return [cx * IN, cy * IN]
}

/**
 * What to hand onUpdateElement when a drag ends.
 *
 * @param {{ position: number[], rotationY: number }} object  the dragged proxy (metres, radians)
 * @param {Object} placement  the engine placement being dragged (width, depth, angle)
 * @param {{ scale: number, anchor: string, mode: 'translate'|'rotate' }} opts
 * @returns {{ x: number, y: number, rotation?: number }}
 *   translate: { x, y } (rotation untouched);
 *   rotate: { x, y, rotation } — the item turns about its centre, so with the
 *   planner's footprint anchor its top-left moves too; rotation is a whole
 *   number of degrees in [0, 360), like DesignEditor3D writes.
 */
export function writeBack(object, placement, { scale, anchor, mode }) {
  const center = [object.position[0] / IN, object.position[2] / IN]
  const angle = mode === 'rotate'
    ? normalizeAngle(Math.round(angleFromRotationY(object.rotationY)))
    : placement.angle
  const { width, depth } = placement
  const at = backLeftFromCenter(center, angle, width, depth)
  const pos = designerPosition({ at, angle, width, depth }, scale, anchor)
  if (mode === 'rotate') return { x: pos.x, y: pos.y, rotation: pos.rotation }
  return { x: pos.x, y: pos.y }
}

/** Live values for the properties panel while dragging (onTransformChange), as DesignEditor3D sends them. */
export function liveTransform(object) {
  return {
    rotation: angleFromRotationY(object.rotationY),
    mountHeight: object.position[1] / IN,
  }
}
