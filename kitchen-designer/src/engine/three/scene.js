// Parts -> a THREE.Group of single-material meshes.
//
//   groupBy 'step'     one mesh per (step, static, group, zone, material), named
//                      and tagged exactly like public/models/kitchen.glb, so it
//                      drops into KitchenBuildSection in place of the loaded GLB
//   groupBy 'cabinet'  one THREE.Group per tags.cabinet ('room' for untagged
//                      parts), each holding one mesh per material: what the
//                      designer selects and moves
//
// Geometry is baked in world space (identity transforms), as in the GLB.
import { Group, Mesh } from 'three'
import { MATERIALS } from '../core/materials.js'
import { mergeKey } from '../core/tags.js'
import { DEFAULT_BEVEL, partsToGeometry } from './geometry.js'
import { createMaterials } from './materials.js'

const materialName = (key) => MATERIALS[key]?.name || key

/** GLB mesh name for a merge bucket: `${group}_${step padded to 3}_${material name}`. */
export const stepMeshName = (step, group, materialKey) =>
  `${group}_${String(step).padStart(3, '0')}_${materialName(materialKey)}`

function bucket(parts, keyOf) {
  const map = new Map()
  for (const p of parts) {
    const k = keyOf(p)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(p)
  }
  return map
}

function byStep(parts, materials, bevel) {
  const root = new Group()
  root.name = 'kitchen'
  const buckets = [...bucket(parts, mergeKey).values()]
  buckets.sort((a, b) => (a[0].tags.step || 0) - (b[0].tags.step || 0))
  for (const list of buckets) {
    const t = list[0].tags
    const step = t.step || 0
    const group = t.group || 'room'
    const mesh = new Mesh(partsToGeometry(list, { bevel }), materials[list[0].material])
    mesh.name = stepMeshName(step, group, list[0].material)
    mesh.userData = {
      build_static: t.static ? 1 : 0,
      build_order: step,
      build_group: group,
      build_zone: t.zone || 'room',
    }
    root.add(mesh)
  }
  return root
}

function byCabinet(parts, materials, bevel) {
  const root = new Group()
  root.name = 'kitchen'
  const cabinets = bucket(parts, (p) => (p.tags.cabinet != null ? String(p.tags.cabinet) : 'room'))
  for (const [cabinet, list] of cabinets) {
    const g = new Group()
    g.name = cabinet
    g.userData = { cabinet }
    for (const [key, mats] of bucket(list, (p) => p.material)) {
      const mesh = new Mesh(partsToGeometry(mats, { bevel }), materials[key])
      mesh.name = `${cabinet}_${materialName(key)}`
      mesh.userData = { cabinet, material: key, parts: mats.map((p) => p.name) }
      g.add(mesh)
    }
    root.add(g)
  }
  return root
}

/**
 * @param {import('../core/part.js').Part[]} parts  tagged parts (orchestrator output)
 * @param {{ groupBy?: 'step'|'cabinet', bevel?: number, materials?: Object }} [opts]
 *   bevel in inches (0 = off); `materials` to share one set across scenes
 *   (defaults to a fresh createMaterials())
 * @returns {Group}
 */
export function buildScene(parts, { groupBy = 'step', bevel = DEFAULT_BEVEL, materials } = {}) {
  const mats = materials || createMaterials()
  for (const p of parts) {
    if (!mats[p.material]) throw new Error(`part "${p.name}": unknown material "${p.material}"`)
  }
  if (groupBy === 'step') return byStep(parts, mats, bevel)
  if (groupBy === 'cabinet') return byCabinet(parts, mats, bevel)
  throw new Error(`buildScene: unknown groupBy "${groupBy}"`)
}
