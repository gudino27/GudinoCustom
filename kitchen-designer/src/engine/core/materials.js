// Material keys are the ones build_kitchen.py uses (M["paint"], M["steel_dk"]).
// `name` is what the mesh material is called in the scene: the homepage's
// applyMaterialLook() styles materials by the prefix of that name, so the
// names must not change.
export const MATERIALS = {
  paint: { name: 'paint_white', color: '#f2f4f1', roughness: 0.42 },
  paint_panel: { name: 'paint_white_panel', color: '#eaece7', roughness: 0.45 },
  toe: { name: 'toe_gray', color: '#b9bdbd', roughness: 0.6 },
  granite: { name: 'granite_top', color: '#cfd0cb', roughness: 0.28 },
  oak: { name: 'oak_floor', color: '#e2c37e', roughness: 0.55 },
  wall: { name: 'wall_gray', color: '#cbd0d1', roughness: 0.85 },
  wall2: { name: 'wall_beige', color: '#a18c65', roughness: 0.85 },
  ceil: { name: 'ceiling_white', color: '#efefef', roughness: 0.9 },
  glass: { name: 'glass_frosted', color: '#dfe7ea', roughness: 0.08, opacity: 0.3 },
  cabint: { name: 'cabinterior_white', color: '#e6e9e6', roughness: 0.7 },
  steel: { name: 'stainless_steel', color: '#b9bcbe', roughness: 0.3, metalness: 1.0 },
  steel_dk: { name: 'stainless_dark', color: '#5f6265', roughness: 0.35, metalness: 1.0 },
  black: { name: 'metal_black', color: '#26282a', roughness: 0.35, metalness: 0.9 },
  beam: { name: 'beam_wood', color: '#6f4a2b', roughness: 0.65 },
  trim: { name: 'paint_trim', color: '#fafbfa', roughness: 0.4 },
  can: { name: 'metal_can', color: '#3a3c3e', roughness: 0.5, metalness: 0.6 },
  glassdk: { name: 'glass_oven', color: '#2c3033', roughness: 0.12, metalness: 0.4 },
  iron: { name: 'cast_iron', color: '#2a2c2e', roughness: 0.78, metalness: 0.15 },
  // single-sided: shows from inside the room, vanishes from behind
  wall_in: { name: 'wall_gray_inside', color: '#cbd0d1', roughness: 0.85, singleSided: true },
  lens: { name: 'can_lens', color: '#ffffff', roughness: 0.3 },
  win_glass: { name: 'glass_window', color: '#eef4f6', roughness: 0.05, opacity: 0.15 },
  // bathroom fixtures
  porcelain: { name: 'porcelain_white', color: '#f7f8f6', roughness: 0.18 },
  chrome: { name: 'stainless_chrome', color: '#d9dcdf', roughness: 0.08, metalness: 1.0 },
  shower_glass: { name: 'glass_shower', color: '#e8f1f3', roughness: 0.04, opacity: 0.22 },
  tile: { name: 'wall_tile', color: '#e4e6e3', roughness: 0.35 },
}

/** Materials of the room shell: never bevelled. */
export const SHELL_MATERIALS = new Set(['oak', 'ceil', 'wall', 'wall2', 'wall_in'])
