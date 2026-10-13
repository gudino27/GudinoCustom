// three.js bridge: engine parts -> three.js geometry, materials and scenes.
export { DEFAULT_BEVEL, partPolymesh, partsToGeometry } from './geometry.js'
export { BEVEL_ANGLE, analyseConvex, bevelPolymesh, wantsBevel } from './bevel.js'
export { boxAxis, boxUV } from './uv.js'
export { createMaterial, createMaterials, materialSide } from './materials.js'
export { buildScene, stepMeshName } from './scene.js'
export { exportGLB } from './exportGLB.js'
export { parseGLB, readAccessor, readGLB } from './readGLB.js'
