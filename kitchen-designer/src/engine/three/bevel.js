// Eased edges, as build_kitchen.py's bevel_parts() did with Blender's bevel
// modifier (1 segment, angle limit 35 degrees): every sharp arris of a
// cabinet part catches a thin highlight instead of reading as CG.
//
// Only closed, convex, manifold polyhedra are bevelled: each face shrinks
// inward in its own plane by the bevel width along its sharp edges, each sharp
// edge is bridged by a quad, and each original vertex is capped by a polygon.
// Anything else (concave parts, holes, open sheets) is returned unchanged.
import { MATERIALS, SHELL_MATERIALS } from '../core/materials.js'
import { IN } from '../core/units.js'
import { add, cross, dot, length, newell, normalize, scale, sub } from './mesh.js'

export const BEVEL_ANGLE = 35 // degrees, bevel_parts' angle_limit

/** Whether a part is eligible for a bevel at all (material, flags). */
export function wantsBevel(part) {
  if (part.closed === false || part.bevel === false) return false
  if (SHELL_MATERIALS.has(part.material)) return false
  // bevel_parts skips by material name prefix; keep that for unknown keys too
  const name = MATERIALS[part.material]?.name || ''
  return !/^(oak_floor|ceiling_white|wall_gray|wall_beige)/.test(name)
}

/** Weld coincident vertices so faces share indices; null if a face collapses. */
function weld(mesh) {
  let min = Infinity
  let max = -Infinity
  for (const v of mesh.verts) for (const c of v) { if (c < min) min = c; if (c > max) max = c }
  const q = Math.max(1e-9, (max - min) * 1e-9)
  const keyOf = (v) => `${Math.round(v[0] / q)},${Math.round(v[1] / q)},${Math.round(v[2] / q)}`
  const map = new Map()
  const verts = []
  const remap = mesh.verts.map((v) => {
    const k = keyOf(v)
    if (!map.has(k)) { map.set(k, verts.length); verts.push(v) }
    return map.get(k)
  })
  const faces = []
  for (const f of mesh.faces) {
    const g = []
    for (const i of f) {
      const j = remap[i]
      if (g.length === 0 || g[g.length - 1] !== j) g.push(j)
    }
    if (g.length > 1 && g[0] === g[g.length - 1]) g.pop()
    if (g.length < 3) return null
    faces.push(g)
  }
  return { verts, faces }
}

/** Is this closed polymesh a convex, manifold polyhedron? Returns its analysis or null. */
export function analyseConvex(mesh) {
  const m = weld(mesh)
  if (!m) return null
  const { verts, faces } = m
  let diag = 0
  for (const v of verts) diag = Math.max(diag, length(sub(v, verts[0])))
  const eps = Math.max(1e-9, diag * 1e-6)
  const normals = []
  for (const f of faces) {
    const n = normalize(newell(f.map((i) => verts[i])))
    if (length(n) === 0) return null
    const d = dot(n, verts[f[0]])
    for (const v of verts) if (dot(n, v) - d > eps) return null // a vertex in front of a face: concave
    for (const i of f) if (Math.abs(dot(n, verts[i]) - d) > eps) return null // non-planar face
    normals.push(n)
  }
  const edges = new Map()
  for (let fi = 0; fi < faces.length; fi += 1) {
    const f = faces[fi]
    for (let i = 0; i < f.length; i += 1) {
      const k = `${f[i]},${f[(i + 1) % f.length]}`
      if (edges.has(k)) return null // same directed edge twice: not manifold / not oriented
      edges.set(k, [fi, i])
    }
  }
  for (const k of edges.keys()) {
    const [a, b] = k.split(',')
    if (!edges.has(`${b},${a}`)) return null // open edge
  }
  return { verts, faces, normals, edges }
}

// intersection of two coplanar lines p + s*d and q + t*e
function meet(p, d, q, e) {
  const c = cross(e, d)
  const cc = dot(c, c)
  if (cc < 1e-24) return q
  const t = -dot(cross(sub(q, p), d), c) / cc
  return add(q, scale(e, t))
}

function tryBevel(an, w, sharp) {
  const { verts, faces, normals, edges } = an
  const corners = [] // corners[f][i]: new position of face f's i-th vertex
  for (let fi = 0; fi < faces.length; fi += 1) {
    const f = faces[fi]
    const n = normals[fi]
    const k = f.length
    const lines = []
    for (let i = 0; i < k; i += 1) {
      const a = verts[f[i]]
      const b = verts[f[(i + 1) % k]]
      const d = normalize(sub(b, a))
      const off = sharp.has(`${f[i]},${f[(i + 1) % k]}`) ? w : 0
      lines.push([add(a, scale(normalize(cross(n, d)), off)), d])
    }
    const c = []
    for (let i = 0; i < k; i += 1) {
      const [p, d] = lines[(i - 1 + k) % k]
      const [q, e] = lines[i]
      c.push(meet(p, d, q, e))
    }
    // the shrunk face must keep every edge pointing the same way (no overlap)
    for (let i = 0; i < k; i += 1) {
      const e = sub(c[(i + 1) % k], c[i])
      if (dot(e, lines[i][1]) <= 0) return null
    }
    corners.push(c)
  }

  const out = { verts: [], faces: [] }
  const push = (pts, outward) => {
    const clean = []
    for (const p of pts) {
      if (clean.length && length(sub(p, clean[clean.length - 1])) < 1e-12) continue
      clean.push(p)
    }
    while (clean.length > 1 && length(sub(clean[0], clean[clean.length - 1])) < 1e-12) clean.pop()
    if (clean.length < 3) return
    const nrm = newell(clean)
    if (length(nrm) < 1e-18) return
    if (outward && dot(nrm, outward) < 0) clean.reverse()
    const base = out.verts.length
    out.verts.push(...clean)
    out.faces.push(clean.map((_, i) => base + i))
  }

  corners.forEach((c) => push(c, null))
  // a quad along every sharp edge
  for (const [k, [fi, i]] of edges) {
    if (!sharp.has(k)) continue
    const [a, b] = k.split(',').map(Number)
    if (a > b) continue // each undirected edge once
    const [gi, j] = edges.get(`${b},${a}`)
    const cf = corners[fi]
    const cg = corners[gi]
    const kf = cf.length
    const kg = cg.length
    push([cf[(i + 1) % kf], cf[i], cg[(j + 1) % kg], cg[j]], add(normals[fi], normals[gi]))
  }
  // a cap at every vertex: the ring of face corners around it
  const faceAt = new Map() // vertex -> [face, position]
  faces.forEach((f, fi) => f.forEach((v, i) => { if (!faceAt.has(v)) faceAt.set(v, [fi, i]) }))
  for (const [v, start] of faceAt) {
    const ring = []
    let outward = [0, 0, 0]
    let [fi, i] = start
    for (let guard = 0; guard < 64; guard += 1) {
      ring.push(corners[fi][i])
      outward = add(outward, normals[fi])
      const f = faces[fi]
      const next = f[(i + 1) % f.length]
      const [gi, j] = edges.get(`${next},${v}`)
      fi = gi
      i = (j + 1) % faces[gi].length
      if (fi === start[0]) break
    }
    push(ring, outward)
  }
  return out
}

/**
 * Bevel a closed polymesh (three.js space) by `width` metres. Returns a new
 * polymesh, or null when the part is not a convex manifold polyhedron or has
 * no edge sharper than `angle`, in which case the caller keeps it sharp.
 */
export function bevelPolymesh(mesh, width, angle = BEVEL_ANGLE) {
  if (!(width > 0)) return null
  const an = analyseConvex(mesh)
  if (!an) return null
  const cosLimit = Math.cos((angle * Math.PI) / 180)
  const sharp = new Set()
  for (const [k, [fi]] of an.edges) {
    const [a, b] = k.split(',')
    const [gi] = an.edges.get(`${b},${a}`)
    if (dot(an.normals[fi], an.normals[gi]) < cosLimit) sharp.add(k)
  }
  if (sharp.size === 0) return null
  // clamp like the modifier's use_clamp_overlap: shrink until the faces stay valid
  for (let w = width, tries = 0; tries < 6; tries += 1, w /= 2) {
    const r = tryBevel(an, w, sharp)
    if (r) return r
  }
  return null
}

/** Bevel width in metres for a width given in inches. */
export const bevelMetres = (inches) => inches * IN
