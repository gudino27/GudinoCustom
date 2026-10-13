// Port of fridge() in scripts/build_kitchen.py.
import { slab } from '../core/part.js'
import { applianceTags, place, wallFrame } from './local.js'

export const FRIDGE_DEFAULTS = { width: 35.625, height: 72, depth: 25, doorDepth: 3.6 }

/**
 * Counter-depth French-door refrigerator (the reference is a Bosch B36CT80SNB,
 * 35.625 w x 72 h): body, two doors, a freezer drawer and bar handles.
 *
 * Run depth: drawn from the WALL plane (v = run.front), not from the door
 * face, so it lands in the same place whatever the run's `front` is. The
 * reference passes the deep run over the fridge (front 26, the Python's
 * `deep_face`); the body is then 25" deep, the doors stand 2.6" proud of the
 * 26" cabinet face and the handles 4.2". `u0` is the left edge of the body
 * (the Python's `x0 - W1_RUN_X`).
 *
 * @param {Object} [opts]
 * @param {number} [opts.width=35.625]
 * @param {number} [opts.height=72]
 * @param {number} [opts.depth=25]      body depth from the wall
 * @param {string|number} [opts.cabinet]
 */
export function fridge(ctx, run, name = 'fridge', u0 = 0, opts = {}) {
  const w = opts.width ?? FRIDGE_DEFAULTS.width
  const h = opts.height ?? FRIDGE_DEFAULTS.height
  const d = opts.depth ?? FRIDGE_DEFAULTS.depth
  const df = d + FRIDGE_DEFAULTS.doorDepth // face of the doors
  const x0 = u0
  const zDoor = 26.0 // French doors above the freezer drawer
  const zFz = 25.4 // top of the freezer drawer
  const out = [
    slab(`${name}_body`, x0, x0 + w, 0, d, 0.5, h, 'steel_dk'),
    slab(`${name}_dl`, x0, x0 + w / 2 - 0.2, d, df, zDoor, h, 'steel_dk'),
    slab(`${name}_dr`, x0 + w / 2 + 0.2, x0 + w, d, df, zDoor, h, 'steel_dk'),
    slab(`${name}_fz`, x0, x0 + w, d, df, 0.5, zFz, 'steel_dk'),
  ]
  // door handles: 34" up to 4" under the top (68 on the 72" reference)
  for (const dx of [w / 2 - 3.0, w / 2 + 3.0]) {
    out.push(slab(`${name}_h`, x0 + dx - 0.45, x0 + dx + 0.45, df, df + 1.6, 34.0, h - 4.0, 'steel'))
  }
  out.push(slab(`${name}_hz`, x0 + 6, x0 + w - 6, df, df + 1.4, 12.0, 13.2, 'steel'))
  return place(out, wallFrame(run), applianceTags(opts))
}
