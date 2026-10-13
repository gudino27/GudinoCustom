// Parts -> one flat-shaded THREE.BufferGeometry in three.js space (metres,
// y up). Each face is triangulated in its own plane and gets its own vertices
// (shared only within the face), a per-face normal and box-projected UVs.
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute } from 'three'
import { bevelMetres, bevelPolymesh, wantsBevel } from './bevel.js'
import { length, newell, normalize, partToPolymesh, triangulatePolygon } from './mesh.js'
import { boxAxis, boxUV } from './uv.js'

export const DEFAULT_BEVEL = 0.032 // inches, bevel_parts' width

/**
 * The polymesh a part is drawn with: three.js space, outward, bevelled when
 * it qualifies (closed, convex, not a shell material, `bevel !== false`).
 */
export function partPolymesh(part, { bevel = DEFAULT_BEVEL } = {}) {
  const mesh = partToPolymesh(part)
  if (bevel > 0 && wantsBevel(part)) {
    const b = bevelPolymesh(mesh, bevelMetres(bevel))
    if (b) return b
  }
  return mesh
}

/** Append one polymesh's faces as flat-shaded triangles. */
function appendPolymesh(acc, mesh, uv) {
  for (const f of mesh.faces) {
    const pts = f.map((i) => mesh.verts[i])
    const nrm = newell(pts)
    if (length(nrm) < 1e-18) continue
    const tris = triangulatePolygon(pts, nrm)
    if (!tris.length) continue
    const n = normalize(nrm)
    const axis = boxAxis(n[0], n[1], n[2])
    const base = acc.count
    for (const p of pts) {
      acc.pos.push(p[0], p[1], p[2])
      acc.nrm.push(n[0], n[1], n[2])
      if (uv) acc.uv.push(...boxUV(axis, p[0], p[1], p[2]))
      acc.count += 1
    }
    for (const t of tris) acc.idx.push(base + t[0], base + t[1], base + t[2])
  }
}

/**
 * @param {import('../core/part.js').Part[]} parts
 * @param {{ bevel?: number, uv?: boolean }} [opts]  bevel in inches (0 = off)
 * @returns {BufferGeometry}
 */
export function partsToGeometry(parts, { bevel = DEFAULT_BEVEL, uv = true } = {}) {
  const acc = { pos: [], nrm: [], uv: [], idx: [], count: 0 }
  for (const part of parts) appendPolymesh(acc, partPolymesh(part, { bevel }), uv)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(acc.pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(acc.nrm, 3))
  if (uv) g.setAttribute('uv', new Float32BufferAttribute(acc.uv, 2))
  g.setIndex(acc.count > 65535 ? new Uint32BufferAttribute(acc.idx, 1) : new Uint16BufferAttribute(acc.idx, 1))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}
