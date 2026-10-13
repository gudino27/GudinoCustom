// Ports of sink_bowl(), sink_cutter() and faucet() in scripts/build_kitchen.py.
// These are placed in plan coordinates (the island's sink is not on a run's
// grid), with an optional rotation about their own centre.
import { cylinder, slab, tube } from '../core/part.js'
import { applianceTags, place, rotateAbout } from './local.js'

export const SINK_DEFAULTS = { width: 18.0, length: 33.4, depth: 9.0, wall: 0.5 }
export const FAUCET_DEFAULTS = { reach: 10.0, height: 10.5 }

/**
 * Undermount basin: an open box (floor, four walls, drain) hung under the
 * counter cutout, its rim at `standards.baseHeight`.
 *
 * @param {Object} o
 * @param {number} o.cx          centre, plan x
 * @param {number} o.cy          centre, plan y
 * @param {number} [o.width=18]  along x before rotation
 * @param {number} [o.length=33.4] along y before rotation
 * @param {number} [o.depth=9]
 * @param {number} [o.wall=0.5]
 * @param {number} [o.angle=0]   degrees, clockwise seen from above
 * @param {string|number} [o.cabinet]
 */
export function sinkBowl(ctx, name = 'sink', o = {}) {
  const { cx, cy } = o
  const W = o.width ?? SINK_DEFAULTS.width
  const L = o.length ?? SINK_DEFAULTS.length
  const t = o.wall ?? SINK_DEFAULTS.wall
  const top = ctx.standards.baseHeight
  const zb = top - (o.depth ?? SINK_DEFAULTS.depth)
  const x0 = cx - W / 2
  const x1 = cx + W / 2
  const y0 = cy - L / 2
  const y1 = cy + L / 2
  const out = [
    slab(`${name}_floor`, x0, x1, y0, y1, zb, zb + t, 'steel'),
    slab(`${name}_w_w`, x0, x0 + t, y0, y1, zb, top, 'steel'),
    slab(`${name}_w_e`, x1 - t, x1, y0, y1, zb, top, 'steel'),
    slab(`${name}_w_n`, x0 + t, x1 - t, y0, y0 + t, zb, top, 'steel'),
    slab(`${name}_w_s`, x0 + t, x1 - t, y1 - t, y1, zb, top, 'steel'),
    cylinder(`${name}_drain`, cx, cy, zb + t + 0.15, 1.8, 0.3, 'steel_dk'),
  ]
  return place(out, rotateAbout(cx, cy, o.angle ?? 0), applianceTags(o))
}

const rect = (cx, cy, hw, hl, rot) => [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]]
  .map(([x, y]) => rot([cx + x, cy + y, 0]).slice(0, 2))

/**
 * The holes a sink needs (the Python's sink_cutter): `top` opens the counter
 * (the bowl less its rim, so the counter laps onto the rim) and `body`
 * hollows a solid carcass such as the island body so the basin is not buried
 * in it (the bowl grown 0.06", no coplanar faces). Pass the polygons to
 * prismWithHoles; `topZ` / `bodyZ` are the z ranges the Python cut over (the
 * body cut does not go through: build the body below `bodyZ[0]` whole).
 *
 * @param {Object} o  same as sinkBowl: { cx, cy, width, length, depth, wall, angle }
 * @returns {{ top: number[][], body: number[][], topZ: number[], bodyZ: number[] }}
 */
export function sinkCutout(ctx, o = {}) {
  const W = o.width ?? SINK_DEFAULTS.width
  const L = o.length ?? SINK_DEFAULTS.length
  const t = o.wall ?? SINK_DEFAULTS.wall
  const depth = o.depth ?? SINK_DEFAULTS.depth
  const { baseHeight, counterThickness } = ctx.standards
  const rot = rotateAbout(o.cx, o.cy, o.angle ?? 0)
  const m = 0.06
  return {
    top: rect(o.cx, o.cy, W / 2 - t, L / 2 - t, rot),
    body: rect(o.cx, o.cy, W / 2 + m, L / 2 + m, rot),
    topZ: [baseHeight - 1.0, baseHeight + counterThickness + 1.0],
    bodyZ: [baseHeight - depth - 1.5, baseHeight + 0.5],
  }
}

/**
 * A swept tube's side quads are not planar where it twists (the lever), so
 * their volume depends on the diagonal a fan splits them along. The reference
 * volumes (bmesh calc_volume) split the tube's quads [a, b, c, d] along b-d
 * (measured on faucet_lever: b-d 0.6913, a-c 0.6751, reference 0.691), while
 * partVolume fans from the first vertex (a-c). Rotate each quad by one so the
 * fan runs b-d: same faces, same winding, same area. A tube whose faces core
 * `tube` already reversed ([d, c, b, a]) fans from d and needs nothing.
 */
function blenderSplit(part) {
  const f0 = part.faces[0]
  const reversed = f0.length === 4 && f0[0] === 1 && f0[3] === 0
  if (reversed) return part
  return { ...part, faces: part.faces.map((f) => (f.length === 4 ? [f[1], f[2], f[3], f[0]] : f)) }
}

/**
 * Single-piece gooseneck faucet on the counter: riser, 180-degree bend and
 * spout, a flange and a side lever. It stands on the counter top
 * (baseHeight + counterThickness).
 *
 * @param {Object} o
 * @param {number} o.x
 * @param {number} o.y
 * @param {number} [o.reach=10]    horizontal reach of the spout (twice the bend radius)
 * @param {number} [o.height=10.5] counter to where the bend springs
 * @param {number} [o.angle=0]     direction the spout reaches, degrees: 0 = east (+x),
 *                                 90 = south (+y); the lever is on its left (north at 0)
 * @param {string|number} [o.cabinet]
 */
export function faucet(ctx, name = 'faucet', o = {}) {
  const { x, y } = o
  const z0 = ctx.standards.baseHeight + ctx.standards.counterThickness
  const zTop = z0 + (o.height ?? FAUCET_DEFAULTS.height) // where the bend springs from
  const R = (o.reach ?? FAUCET_DEFAULTS.reach) / 2 // bend radius, carries the spout over the bowl
  const path = [[x, y, z0], [x, y, zTop - R * 0.25], [x, y, zTop]]
  for (let i = 1; i < 13; i += 1) { // 180 degrees, sweeping toward the bowl
    const a = Math.PI * (1.0 - i / 12.0)
    path.push([x + R + R * Math.cos(a), y, zTop + R * Math.sin(a)])
  }
  path.push([x + 2 * R, y, zTop - 2.2])
  path.push([x + 2 * R, y, zTop - 3.5])
  const out = [
    blenderSplit(tube(`${name}_body`, path, 0.55, 'steel')),
    cylinder(`${name}_flange`, x, y, z0 + 0.6, 1.35, 1.2, 'steel'),
    // side lever, springing off the riser just above the flange
    blenderSplit(tube(`${name}_lever`, [[x, y - 0.45, z0 + 3.2], [x + 0.35, y - 1.7, z0 + 3.6], [x + 0.7, y - 3.0, z0 + 4.4]], 0.28, 'steel')),
  ]
  return place(out, rotateAbout(x, y, o.angle ?? 0), applianceTags(o))
}
