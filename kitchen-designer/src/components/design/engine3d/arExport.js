// The AR model from the cabinet engine: the same kitchen the engine view
// shows (room shell without its ceiling, one group per element, the
// customer's colours), exported as GLB in metres, y up — what <model-viewer>,
// Scene Viewer and AR Quick Look expect.
//
// buildARScene is three.js only (runs under `node --test`); exportEngineGLB
// needs the browser (GLTFExporter).
import { Group } from 'three'
import { createMaterials, designerToJob, exportGLB, fitScale } from '../../../engine/index.js'
import { housedPairs } from '../../../utils/designer/housing.js'
import { applyFinish, applyShadowFlags, syncScene } from './sceneBuild.js'

/**
 * Bevel for the AR export, inches. 0 = no bevels: the rounded edges roughly
 * double the triangle count, which a phone pays for in download and memory,
 * and at AR viewing distance they are not visible.
 */
export const AR_BEVEL = 0

/** Placement anchor the engine view and the AR export share (the 2D planner's). */
export const DESIGNER_ANCHOR = 'footprint'

/**
 * @param {Object} roomData  kitchenData / bathroomData
 * @param {Object} opts { elementTypes, roomType, scale, finishes, lookup, bevel, anchor }
 * @returns {{ scene: Group, job: Object, notes: string[] }}
 */
export function buildARScene(roomData, {
  elementTypes, roomType, scale, finishes, lookup, bevel = AR_BEVEL, anchor = DESIGNER_ANCHOR,
} = {}) {
  const job = designerToJob(roomData, {
    elementTypes, roomType, scale, anchor, materialLookup: lookup,
    // a fridge in a refrigerator cabinet is built by the cabinet
    housed: housedPairs(roomData.elements || [], elementTypes, scale || fitScale(roomData.dimensions)),
  })
  // plain engine materials: no canvas textures, so nothing to encode as images
  const materials = createMaterials()
  const prepare = (group, placement) => {
    applyShadowFlags(group, { shell: !placement })
    if (placement) applyFinish(group, placement.options?.finish, { finishes, lookup, tex: null })
    if (placement?.options?.housedFinish) applyFinish(group, placement.options.housedFinish, { finishes, lookup, tex: null })
  }
  const built = syncScene({}, job, { materials, bevel, prepare })
  const scene = new Group()
  scene.name = roomType === 'bathroom' ? 'bathroom' : 'kitchen'
  scene.add(built.shell.group)
  for (const entry of built.cabinets.values()) scene.add(entry.group)
  return { scene, job, notes: [...(job.meta?.warnings || []), ...built.notes] }
}

/** Browser only: the AR model as a GLB Blob. */
export async function exportEngineGLB(roomData, opts = {}) {
  const { scene, notes } = buildARScene(roomData, opts)
  const glb = await exportGLB(scene)
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose() })
  return { blob: new Blob([glb], { type: 'model/gltf-binary' }), bytes: glb.byteLength, notes }
}
