// Cache keys for the engine view. A cabinet group is rebuilt only when its key
// changes; the key holds everything that shapes or colours the geometry and
// nothing of its pose, so moving or turning an item reuses the group.
//
// No React, no three: runs under `node --test`.

/** JSON with object keys sorted, so key order never changes a cache key. */
export function stableStringify(value) {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

// job.style keys that only describe the designer's state (the most-used colour
// and colour counts, for pricing): no builder reads them, and letting them in
// would rebuild every cabinet when one cabinet's colour changes.
const STYLE_INFO_KEYS = new Set(['color', 'colorCount', 'pricedColorCount'])

function buildStyle(style = {}) {
  const out = {}
  for (const k of Object.keys(style)) if (!STYLE_INFO_KEYS.has(k)) out[k] = style[k]
  return out
}

/**
 * Everything about a placement except its pose (centre / at / angle): type,
 * level, size, bottom, options (door style, sink, corner side, colour, sheen,
 * grain), plus the job-wide standards, style and construction it is built
 * with.
 */
export function placementKey(placement, job = {}) {
  const p = placement
  return stableStringify({
    type: p.type,
    level: p.level,
    width: p.width,
    depth: p.depth,
    height: p.height,
    bottom: p.bottom,
    options: p.options || {},
    unknown: Boolean(p.unknown),
    standards: job.standards || {},
    style: buildStyle(job.style),
    construction: job.construction || {},
  })
}

/** The room shell: walls, openings, floor, height. */
export function roomKey(job = {}) {
  return stableStringify({ room: job.room || null, ceiling: job.standards?.ceiling ?? null })
}
