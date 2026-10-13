// Minimal GLB reader for Node tests: parses the container (JSON chunk + BIN
// chunk) by hand, no loader, no DOM. Returns what the tests compare against:
// mesh names, extras, material names and sides, bounds and accessor data.
import { toPlan } from '../core/units.js'

const GLB_MAGIC = 0x46546c67 // 'glTF'
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }
const ARRAYS = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
}

function toArrayBuffer(src) {
  if (src instanceof ArrayBuffer) return src
  if (ArrayBuffer.isView(src)) return src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength)
  if (typeof src === 'string') {
    // Node only; getBuiltinModule keeps bundlers from trying to resolve 'fs'
    // eslint-disable-next-line no-undef
    const fs = typeof process !== 'undefined' ? process.getBuiltinModule?.('node:fs') : undefined
    if (!fs) throw new Error('readGLB: reading a path needs Node (process.getBuiltinModule)')
    return toArrayBuffer(fs.readFileSync(src))
  }
  throw new TypeError('readGLB: expected a path, ArrayBuffer or typed array')
}

/** Parse a GLB container into { json, bin } (bin is a DataView-able ArrayBuffer slice or null). */
export function parseGLB(pathOrBuffer) {
  const buf = toArrayBuffer(pathOrBuffer)
  const dv = new DataView(buf)
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error('readGLB: not a GLB file')
  const length = dv.getUint32(8, true)
  let off = 12
  let json = null
  let bin = null
  while (off < length) {
    const clen = dv.getUint32(off, true)
    const ctype = dv.getUint32(off + 4, true)
    const start = off + 8
    if (ctype === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, clen)))
    else if (ctype === CHUNK_BIN && !bin) bin = buf.slice(start, start + clen)
    off = start + clen
  }
  if (!json) throw new Error('readGLB: no JSON chunk')
  return { json, bin }
}

/** Read an accessor as a flat typed array (tightly packed, normalized ints left as ints). */
export function readAccessor(json, bin, index) {
  const acc = json.accessors[index]
  const Type = ARRAYS[acc.componentType]
  const ncomp = COMPONENTS[acc.type]
  const out = new Type(acc.count * ncomp)
  if (acc.bufferView === undefined) return out
  const view = json.bufferViews[acc.bufferView]
  const base = (view.byteOffset || 0) + (acc.byteOffset || 0)
  const esize = Type.BYTES_PER_ELEMENT
  const stride = view.byteStride || esize * ncomp
  const dv = new DataView(bin)
  const get = {
    5120: (o) => dv.getInt8(o),
    5121: (o) => dv.getUint8(o),
    5122: (o) => dv.getInt16(o, true),
    5123: (o) => dv.getUint16(o, true),
    5125: (o) => dv.getUint32(o, true),
    5126: (o) => dv.getFloat32(o, true),
  }[acc.componentType]
  for (let i = 0; i < acc.count; i += 1) {
    for (let c = 0; c < ncomp; c += 1) out[i * ncomp + c] = get(base + i * stride + c * esize)
  }
  return out
}

function nodeExtras(json) {
  // a mesh's extras may sit on the mesh or on the node that instances it
  const byMesh = new Map()
  for (const n of json.nodes || []) {
    if (n.mesh !== undefined && !byMesh.has(n.mesh)) byMesh.set(n.mesh, n)
  }
  return byMesh
}

/**
 * Meshes of a .glb, one entry per glTF mesh (primitives summed).
 *
 * @param {string|ArrayBuffer|Uint8Array} pathOrBuffer
 * @returns {Array<{
 *   name: string, extras: Object, material: string, doubleSided: boolean,
 *   min: number[], max: number[], planMin: number[], planMax: number[],
 *   vertexCount: number, triangleCount: number,
 *   attribute: (name: string) => Float32Array|null, index: () => Uint32Array|null
 * }>}  the parsed glTF JSON is attached as the array's non-enumerable `json`
 */
export function readGLB(pathOrBuffer) {
  const { json, bin } = parseGLB(pathOrBuffer)
  const nodes = nodeExtras(json)
  const meshes = (json.meshes || []).map((mesh, mi) => {
    const node = nodes.get(mi)
    const prims = mesh.primitives
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    let vertexCount = 0
    let triangleCount = 0
    for (const p of prims) {
      const pos = json.accessors[p.attributes.POSITION]
      vertexCount += pos.count
      for (let i = 0; i < 3; i += 1) {
        min[i] = Math.min(min[i], pos.min[i])
        max[i] = Math.max(max[i], pos.max[i])
      }
      triangleCount += (p.indices !== undefined ? json.accessors[p.indices].count : pos.count) / 3
    }
    // node transforms are ignored: the Blender export and buildScene both bake
    // geometry in world space with identity nodes
    const a = toPlan(min)
    const b = toPlan(max)
    const mat = json.materials?.[prims[0].material] || {}
    const concat = (arrays, Type) => {
      const n = arrays.reduce((s, x) => s + x.length, 0)
      const out = new Type(n)
      let o = 0
      for (const x of arrays) { out.set(x, o); o += x.length }
      return out
    }
    return {
      name: node?.name ?? mesh.name,
      meshName: mesh.name,
      extras: { ...(mesh.extras || {}), ...(node?.extras || {}) },
      material: mat.name ?? null,
      doubleSided: mat.doubleSided === true,
      min,
      max,
      planMin: [0, 1, 2].map((i) => Math.min(a[i], b[i])),
      planMax: [0, 1, 2].map((i) => Math.max(a[i], b[i])),
      vertexCount,
      triangleCount,
      attribute(name) {
        const arrays = []
        for (const p of prims) {
          if (p.attributes[name] === undefined) return null
          arrays.push(Float32Array.from(readAccessor(json, bin, p.attributes[name])))
        }
        return concat(arrays, Float32Array)
      },
      index() {
        const arrays = []
        let base = 0
        for (const p of prims) {
          const count = json.accessors[p.attributes.POSITION].count
          const idx = p.indices !== undefined
            ? Uint32Array.from(readAccessor(json, bin, p.indices))
            : Uint32Array.from({ length: count }, (_, i) => i)
          const offset = base
          arrays.push(idx.map((i) => i + offset))
          base += count
        }
        return concat(arrays, Uint32Array)
      },
    }
  })
  Object.defineProperty(meshes, 'json', { value: json, enumerable: false })
  return meshes
}
