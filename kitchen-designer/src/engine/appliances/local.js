// Local frames the appliances are authored in. Each appliance is drawn with the
// ordinary primitives (slab, cylinder, frustum, tube) in one of two local plan
// spaces, then mapped onto its run:
//
//   wall frame  [u, y, z]  y = distance out from the WALL plane (v = run.front)
//   face frame  [u, v, z]  v = distance back from the DOOR face (v = 0)
//
// Free-standing appliances (fridge, range, hood) use the wall frame, so they
// do not move when the run's cabinet depth (`front`) changes. Appliances that
// sit flush with the cabinet fronts (dishwasher, wall ovens, microwave, wine
// cooler) use the face frame.
//
// The map is an isometry, so bounding box, volume and area survive it; the
// winding is fixed again by makePart when the map is a reflection.
import { makePart } from '../core/part.js'

/** [u, y, z] with y measured out from the wall -> plan [x, y, z]. */
export const wallFrame = (run) => ([u, y, z]) => {
  const [px, py] = run.pt(u, run.front - y)
  return [px, py, z]
}

/** [u, v, z] with v measured back from the door face -> plan [x, y, z]. */
export const faceFrame = (run) => ([u, v, z]) => {
  const [px, py] = run.pt(u, v)
  return [px, py, z]
}

/** Rotate about the plan point (cx, cy) by `deg` (clockwise seen from above, y is south). */
export const rotateAbout = (cx, cy, deg) => {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  if (deg === 0) return (p) => p
  return ([x, y, z]) => {
    const dx = x - cx
    const dy = y - cy
    return [cx + dx * c - dy * s, cy + dx * s + dy * c, z]
  }
}

/** The tags every appliance part carries. */
export function applianceTags(opts = {}) {
  const tags = { role: 'appliance' }
  if (opts.cabinet !== undefined && opts.cabinet !== null) tags.cabinet = String(opts.cabinet)
  return tags
}

/** Map locally authored parts into plan space and tag them. */
export function place(parts, map, tags = {}) {
  return parts.map((p) => makePart(p.name, p.verts.map(map), p.faces, p.material, {
    closed: p.closed,
    bevel: p.bevel,
    tags: { ...p.tags, ...tags },
  }))
}
