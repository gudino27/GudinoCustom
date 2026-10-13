// A placement's colour choice (designer materialId, sheen, grain; carried by
// designerToJob in placement.options.finish) -> which engine materials of that
// cabinet to tint, and how.
//
// The designer offers (src/constants/materials.js):
//   paints  sw-* / bm-*  hex, with a sheen (FINISHES: roughness)
//   stains  stain-*      hex, with a wood grain
//   appliance finishes app-*  hex, metalness, roughness
// Cabinets are painted with the engine's `paint` (boxes, frames, crown fill)
// and `paint_panel` (the raised panels); appliances are `steel` (stainless)
// bodies. Interiors, counters, pulls, toe kicks and glass keep their look.
//
// No React, no three: runs under `node --test`. The tables are passed in.

/** Engine material keys a cabinet colour applies to. */
export const PAINTED_KEYS = ['paint', 'paint_panel']
/** Engine material keys an appliance finish applies to. */
export const APPLIANCE_KEYS = ['steel']
/** The designer's default appliance finish: the engine's stainless as it is. */
export const DEFAULT_APPLIANCE_FINISH = 'app-ss'
/** applyMaterialLook darkens raised panels by this much so they read against their frames. */
export const PANEL_SHADE = 0.9

/**
 * @param {Object|null} finish  placement.options.finish
 *   { materialId, kind: 'paint'|'stain'|'appliance', hex?, sheen?, grain? }
 * @param {Object} [tables]
 * @param {Object} [tables.finishes]  FINISHES (sheen -> { roughness, metalness })
 * @param {(id: string) => Object} [tables.lookup]  getMaterialById
 * @returns {Array<{ key: string, color: string, roughness?: number, metalness?: number,
 *   shade?: number, grain?: boolean }>}  one entry per engine material key; [] = leave as built
 */
export function finishLook(finish, { finishes = {}, lookup } = {}) {
  if (!finish || !finish.materialId) return []
  const m = lookup ? lookup(finish.materialId) : null
  const hex = finish.hex || (m && m.hex)
  if (!hex) return []
  const kind = finish.kind || (m && m.type) || 'paint'

  if (kind === 'appliance') {
    if (finish.materialId === DEFAULT_APPLIANCE_FINISH) return []
    const look = { color: hex }
    if (m && typeof m.roughness === 'number') look.roughness = m.roughness
    if (m && typeof m.metalness === 'number') look.metalness = m.metalness
    return APPLIANCE_KEYS.map((key) => ({ key, ...look }))
  }

  if (kind === 'stain') {
    // wood: the grain texture shows through the stain colour
    return PAINTED_KEYS.map((key) => ({
      key,
      color: hex,
      roughness: 0.55,
      metalness: 0,
      grain: true,
      ...(key === 'paint_panel' ? { shade: PANEL_SHADE } : {}),
    }))
  }

  // paint, with its sheen (satin when none was picked, as the designer shows)
  const sheen = finishes[finish.sheen] || finishes.satin
  return PAINTED_KEYS.map((key) => ({
    key,
    color: hex,
    ...(sheen ? { roughness: sheen.roughness, metalness: sheen.metalness } : {}),
    ...(key === 'paint_panel' ? { shade: PANEL_SHADE } : {}),
  }))
}
