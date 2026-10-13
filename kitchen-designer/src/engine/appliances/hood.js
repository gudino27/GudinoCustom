// Port of range_hood() in scripts/build_kitchen.py.
import { frustum, slab } from '../core/part.js'
import { applianceTags, place, wallFrame } from './local.js'

export const HOOD_DEFAULTS = { width: 44, depth: 21.5, chimneyDepth: 9 }

/**
 * Hood insert inside a painted surround (the reference: a Thermador 42" insert
 * in a 44" surround): apron, projecting moulding band, a chimney that tapers
 * mostly in depth back to the wall, and the stainless insert under the apron.
 * It runs from `standards.upperBottom` to `standards.upperTop`.
 *
 * Run depth: drawn from the WALL plane (the Python passes y0 = 0, the wall).
 * The reference kitchen hangs it on the upper run (front 12) but any `front`
 * gives the same hood. `uc` is its centre along the run.
 *
 * @param {Object} [opts]
 * @param {number} [opts.width=44]         surround width; chimney is width-2 -> width-6, insert width-5
 * @param {number} [opts.depth=21.5]       apron depth from the wall
 * @param {number} [opts.chimneyDepth=9]   depth at the top of the chimney
 * @param {string|number} [opts.cabinet]
 */
export function rangeHood(ctx, run, name = 'hood', uc, opts = {}) {
  const w = opts.width ?? HOOD_DEFAULTS.width
  const d = opts.depth ?? HOOD_DEFAULTS.depth
  const dt = opts.chimneyDepth ?? HOOD_DEFAULTS.chimneyDepth
  const z0 = ctx.standards.upperBottom
  const zTop = ctx.standards.upperTop
  const zf = z0 + 7.0 // top of the apron / underside of the band
  const zb = zf + 1.6 // top of the moulding band
  const cb = w / 2 - 1.0 // chimney half width at the bottom (21 on the reference)
  const ct = w / 2 - 3.0 // and at the top (19)
  const ci = w / 2 - 2.5 // insert half width (19.5)
  const out = [
    // apron: full width, full depth
    slab(`${name}_apron`, uc - w / 2, uc + w / 2, 0, d, z0, zf, 'paint'),
    // projecting moulding band
    slab(`${name}_band`, uc - w / 2 - 0.7, uc + w / 2 + 0.7, 0, d + 0.7, zf, zb, 'trim'),
    // chimney: tapers mostly in depth
    frustum(`${name}_chimney`,
      [[uc - cb, 0], [uc + cb, 0], [uc + cb, d], [uc - cb, d]],
      [[uc - ct, 0], [uc + ct, 0], [uc + ct, dt], [uc - ct, dt]],
      zb, zTop, 'paint'),
    // stainless insert peeking out under the apron
    slab(`${name}_insert`, uc - ci, uc + ci, 1.0, d - 0.5, z0 - 0.7, z0, 'steel'),
  ]
  return place(out, wallFrame(run), applianceTags(opts))
}
