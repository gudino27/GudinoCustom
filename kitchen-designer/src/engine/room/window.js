// A window in its wall opening: clear glass, sill, head, jambs and a muntin
// grid. Port of the Win48 loop in build_kitchen.py's build_room.
import { ROOM_DEFAULTS } from './schema.js'

/**
 * @param {ReturnType<import('./wall.js').wallFrame>} frame
 * @param {Object} o        a resolved window opening (resolveOpenings)
 * @param {number} index    number used in the part names
 * @returns {import('../core/part.js').Part[]}
 */
export function buildWindow(frame, o, index) {
  const D = ROOM_DEFAULTS
  const p = o.prefix || 'win'
  const i = o.index ?? index
  const { s0, s1 } = o
  const z0 = o.bottom
  const z1 = o.head
  const tr = { ...D.windowTrim, ...(o.trim || {}) }
  const gl = { ...D.windowGlass, ...(o.glass || {}) }
  const mu = { ...D.muntin, ...(o.muntin || {}) }
  const trimMat = tr.material || 'trim'
  const tags = { tags: { role: 'window' } }
  const [tb, tf] = tr.v
  const tw = tr.width
  const parts = [
    frame.box(`${p}_glass${i}`, s0, s1, gl.v[0], gl.v[1], z0, z1, gl.material || 'win_glass', tags),
    frame.box(`${p}_sill${i}`, s0 - tw, s1 + tw, tb, tf, z0 - tr.sillDrop, z0, trimMat, tags),
    frame.box(`${p}_head${i}`, s0 - tw, s1 + tw, tb, tf, z1, z1 + tw, trimMat, tags),
    frame.box(`${p}_jl${i}`, s0 - tw, s0, tb, tf, z0, z1, trimMat, tags),
    frame.box(`${p}_jr${i}`, s1, s1 + tw, tb, tf, z0, z1, trimMat, tags),
  ]
  const [cols, rows] = o.grid || D.window.grid
  const hw = mu.width / 2
  const muMat = mu.material || 'trim'
  for (let k = 1; k < Math.max(cols, rows); k += 1) {
    if (k < cols) {
      const sm = s0 + ((s1 - s0) * k) / cols
      parts.push(frame.box(`${p}_mv${i}${k}`, sm - hw, sm + hw, mu.v[0], mu.v[1], z0, z1, muMat, tags))
    }
    if (k < rows) {
      const zm = z0 + ((z1 - z0) * k) / rows
      parts.push(frame.box(`${p}_mh${i}${k}`, s0, s1, mu.v[0], mu.v[1], zm - hw, zm + hw, muMat, tags))
    }
  }
  return parts
}
