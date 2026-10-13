// Browser only: an Object3D -> binary glTF (GLB), userData exported as
// glTF extras (GLTFExporter does that for every node and material). The
// exporter is imported lazily so the rest of src/engine/three loads in Node.

/**
 * @param {import('three').Object3D} object3d  e.g. buildScene(parts)
 * @param {Object} [options]  extra GLTFExporter options
 * @returns {Promise<ArrayBuffer>}
 */
export async function exportGLB(object3d, options = {}) {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  object3d.updateMatrixWorld(true)
  const result = await new GLTFExporter().parseAsync(object3d, { ...options, binary: true })
  if (!(result instanceof ArrayBuffer)) throw new Error('exportGLB: exporter did not return a binary GLB')
  return result
}
