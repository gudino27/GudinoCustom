// THREE materials for core/materials.js MATERIALS, set up the way
// GLTFLoader builds them from public/models/kitchen.glb, so the homepage's
// applyMaterialLook() (which styles by material name prefix) and its fade-in
// logic behave exactly as they do on the loaded GLB.
//
// Sides: the published GLB is double-sided everywhere except
// wall_gray_inside, partly because Blender left some parts inside out (the
// wall-5 counter's faces point inward). Engine parts are always outward and
// closed unless they are `sheet`s, so an opaque closed solid seen from outside
// only ever shows its front faces: back faces are always behind a front face
// of the same solid. Opaque materials are therefore FrontSide (half the
// fragments, and sheets keep their authored side). Transparent materials stay
// DoubleSide, where the far faces show through; `{ doubleSided: true }` gives
// the GLB's settings exactly.
import { Color, DoubleSide, FrontSide, MeshStandardMaterial } from 'three'
import { MATERIALS } from '../core/materials.js'

/** Side a material gets: FrontSide for single-sided and opaque, DoubleSide for transparent. */
export function materialSide(def, { doubleSided = false } = {}) {
  if (def.singleSided) return FrontSide
  if (doubleSided) return DoubleSide
  return def.opacity !== undefined && def.opacity < 1 ? DoubleSide : FrontSide
}

/** One material for a MATERIALS entry (key kept in userData.materialKey). */
export function createMaterial(key, opts = {}) {
  const def = MATERIALS[key]
  if (!def) throw new Error(`unknown material "${key}"`)
  const transparent = def.opacity !== undefined && def.opacity < 1
  const m = new MeshStandardMaterial({
    name: def.name,
    // hex colours are sRGB; Color converts them to the linear working space,
    // matching the GLB's linear baseColorFactor
    color: new Color(def.color),
    roughness: def.roughness ?? 1,
    metalness: def.metalness ?? 0,
    opacity: transparent ? def.opacity : 1,
    transparent,
    // GLTFLoader turns off depth writes for alphaMode BLEND
    depthWrite: !transparent,
    side: materialSide(def, opts),
  })
  m.userData.materialKey = key
  return m
}

/**
 * @param {{ doubleSided?: boolean }} [opts]  doubleSided: every material but
 *   wall_gray_inside double-sided, exactly as the published GLB
 * @returns {Object<string, MeshStandardMaterial>} keyed like MATERIALS
 */
export function createMaterials(opts = {}) {
  const out = {}
  for (const key of Object.keys(MATERIALS)) out[key] = createMaterial(key, opts)
  return out
}
