// A Part is one solid piece of the kitchen: a rail, a panel, a carcass box, a
// burner cap. It is plain data, so it runs the same in the browser, in Node
// tests and in the desktop app; src/engine/three turns parts into meshes.
import { ShapeUtils, Vector2 } from 'three'
import { edgeNormal } from './polygon.js'

/**
 * @typedef {Object} PartTags
 * @property {boolean} [static]   room shell: always visible, never animated
 * @property {number}  [step]     build order; parts sharing a step appear together
 * @property {string}  [group]    room | base | counter | upper | tall | appliance | island | trim
 * @property {string}  [zone]     which run it belongs to (room | back | right | island | ...)
 * @property {string}  [cabinet]  cabinet number or placement id it belongs to
 * @property {string}  [role]     carcass | toe | frame | door | drawer | panel | glass | pull |
 *                                shelf | counter | crown | light-rail | filler | appliance |
 *                                wall | floor | ceiling | window | trim | fixture
 */

/**
 * @typedef {Object} Part
 * @property {string} name        same names build_kitchen.py gives its objects
 * @property {number[][]} verts   [x, y, z] in plan inches
 * @property {number[][]} faces   planar polygons (may be concave) as vertex indices, wound so
 *                                the right-hand normal points out of the solid in three.js space
 * @property {string} material    key of core/materials.js MATERIALS
 * @property {boolean} closed     false for single-sided sheets (see `sheet`)
 * @property {boolean} bevel      false = never ease this part's edges
 * @property {PartTags} tags
 */

// Six times the signed volume, measured in three.js space (x, z, y). A fan is
// exact for planar faces even when they are concave.
function volume6(verts, faces) {
  let v6 = 0
  for (const f of faces) {
    const a = verts[f[0]]
    for (let i = 1; i < f.length - 1; i += 1) {
      const b = verts[f[i]]
      const c = verts[f[i + 1]]
      v6 += a[0] * (b[2] * c[1] - b[1] * c[2])
        - a[2] * (b[0] * c[1] - b[1] * c[0])
        + a[1] * (b[0] * c[2] - b[2] * c[0])
    }
  }
  return v6
}

/**
 * Build a part. Closed solids are turned right side out automatically, so a
 * primitive only has to wind its faces consistently, not in a given direction.
 */
export function makePart(name, verts, faces, material, opts = {}) {
  const closed = opts.closed !== false
  let f = faces.map((face) => [...face])
  if (closed && volume6(verts, f) < 0) f = f.map((face) => face.reverse())
  return {
    name,
    verts: verts.map((v) => [v[0], v[1], v[2]]),
    faces: f,
    material,
    closed,
    bevel: opts.bevel !== false && closed,
    tags: { ...(opts.tags || {}) },
  }
}

/** Volume in cubic inches (closed parts). */
export const partVolume = (part) => Math.abs(volume6(part.verts, part.faces)) / 6

/** Signed volume in three.js space; positive means the faces point outward. */
export const partSignedVolume = (part) => volume6(part.verts, part.faces) / 6

export function partBounds(part) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const v of part.verts) {
    for (let i = 0; i < 3; i += 1) {
      if (v[i] < min[i]) min[i] = v[i]
      if (v[i] > max[i]) max[i] = v[i]
    }
  }
  return { min, max }
}

/** Surface area in square inches. */
export function partArea(part) {
  let area = 0
  for (const f of part.faces) {
    let nx = 0
    let ny = 0
    let nz = 0
    const a = part.verts[f[0]]
    for (let i = 1; i < f.length - 1; i += 1) {
      const b = part.verts[f[i]]
      const c = part.verts[f[i + 1]]
      const ux = b[0] - a[0]
      const uy = b[1] - a[1]
      const uz = b[2] - a[2]
      const vx = c[0] - a[0]
      const vy = c[1] - a[1]
      const vz = c[2] - a[2]
      nx += uy * vz - uz * vy
      ny += uz * vx - ux * vz
      nz += ux * vy - uy * vx
    }
    area += Math.hypot(nx, ny, nz) / 2
  }
  return area
}

// ---------------------------------------------------------------------------
// primitives (plan space)
// ---------------------------------------------------------------------------

/** Extrusion between two polygons with the same vertex count. */
export function frustum(name, polyBot, polyTop, z0, z1, material, opts) {
  const n = polyBot.length
  const verts = [
    ...polyBot.map(([x, y]) => [x, y, z0]),
    ...polyTop.map(([x, y]) => [x, y, z1]),
  ]
  const ring = [...Array(n).keys()]
  const faces = [[...ring].reverse(), ring.map((i) => i + n)]
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    faces.push([i, j, j + n, i + n])
  }
  return makePart(name, verts, faces, material, opts)
}

/** Vertical extrusion of a plan polygon (convex or concave, no holes). */
export const prism = (name, poly, z0, z1, material, opts) =>
  frustum(name, poly, poly, z0, z1, material, opts)

/** Axis-aligned box. */
export const slab = (name, x0, x1, y0, y1, z0, z1, material, opts) =>
  prism(name, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, material, opts)

/**
 * Vertical extrusion of a polygon with holes: a counter with its sink and
 * cooktop cutouts, a wall with window openings seen in plan, an island body
 * hollowed for the basin. Replaces Blender's boolean cuts.
 * Caps are triangulated; side faces stay quads.
 */
export function prismWithHoles(name, outer, holes, z0, z1, material, opts) {
  const rings = [outer, ...holes]
  const flat = rings.flat()
  const n = flat.length
  const verts = [...flat.map(([x, y]) => [x, y, z0]), ...flat.map(([x, y]) => [x, y, z1])]
  const tris = ShapeUtils.triangulateShape(
    outer.map(([x, y]) => new Vector2(x, y)),
    holes.map((h) => h.map(([x, y]) => new Vector2(x, y))),
  )
  const faces = []
  for (const [a, b, c] of tris) {
    // plan cross product < 0 means the normal points up in three.js space
    const cross = (flat[b][0] - flat[a][0]) * (flat[c][1] - flat[a][1])
      - (flat[b][1] - flat[a][1]) * (flat[c][0] - flat[a][0])
    const up = cross < 0 ? [a, b, c] : [a, c, b]
    faces.push(up.map((i) => i + n)) // top cap
    faces.push([up[0], up[2], up[1]]) // bottom cap
  }
  let start = 0
  rings.forEach((ring, r) => {
    const m = ring.length
    for (let i = 0; i < m; i += 1) {
      const j = (i + 1) % m
      const a = start + i
      const b = start + j
      // the solid lies outside a hole, so a hole's walls face into the hole
      let [nx, ny] = edgeNormal(ring, i)
      if (r > 0) { nx = -nx; ny = -ny }
      // quad [a, b, b+n, a+n] has plan normal (-dy, dx) * height
      const dx = ring[j][0] - ring[i][0]
      const dy = ring[j][1] - ring[i][1]
      const facesOut = dx * ny - dy * nx > 0
      faces.push(facesOut ? [a, b, b + n, a + n] : [b, a, a + n, b + n])
    }
    start += m
  })
  return makePart(name, verts, faces, material, { bevel: false, ...opts })
}

/** Cylinder centred on (cx, cy, cz); `height` runs along `axis`. */
export function cylinder(name, cx, cy, cz, radius, height, material, axis = 'Z', seg = 16, opts) {
  const ring = []
  for (let i = 0; i < seg; i += 1) {
    const a = (2 * Math.PI * i) / seg
    ring.push([Math.cos(a) * radius, Math.sin(a) * radius])
  }
  const verts = []
  for (const sgn of [-0.5, 0.5]) {
    for (const [a, b] of ring) {
      if (axis === 'Z') verts.push([cx + a, cy + b, cz + sgn * height])
      else if (axis === 'X') verts.push([cx + sgn * height, cy + a, cz + b])
      else verts.push([cx + a, cy + sgn * height, cz + b])
    }
  }
  const idx = [...Array(seg).keys()]
  const faces = [[...idx].reverse(), idx.map((i) => i + seg)]
  for (let i = 0; i < seg; i += 1) {
    const j = (i + 1) % seg
    faces.push([i, j, j + seg, i + seg])
  }
  return makePart(name, verts, faces, material, opts)
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len3 = (a) => Math.hypot(a[0], a[1], a[2])
const norm3 = (a) => { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }

/**
 * One continuous swept pipe through a list of [x, y, z] points. Rings are
 * perpendicular to the local tangent, so bends stay solid.
 */
export function tube(name, path, radius, material, { ref = [0, 1, 0], seg = 12, ...opts } = {}) {
  const n = path.length
  const verts = []
  path.forEach((q, i) => {
    let t
    if (i === 0) t = sub(path[1], path[0])
    else if (i === n - 1) t = sub(path[n - 1], path[n - 2])
    else t = sub(path[i + 1], path[i - 1])
    t = norm3(t)
    let n1 = cross3(t, ref)
    if (len3(n1) < 1e-6) n1 = cross3(t, [1, 0, 0])
    n1 = norm3(n1)
    const n2 = norm3(cross3(t, n1))
    for (let k = 0; k < seg; k += 1) {
      const a = (2 * Math.PI * k) / seg
      const c = Math.cos(a) * radius
      const s = Math.sin(a) * radius
      verts.push([q[0] + n1[0] * c + n2[0] * s, q[1] + n1[1] * c + n2[1] * s, q[2] + n1[2] * c + n2[2] * s])
    }
  })
  const faces = []
  for (let i = 0; i < n - 1; i += 1) {
    for (let k = 0; k < seg; k += 1) {
      const k2 = (k + 1) % seg
      faces.push([i * seg + k, (i + 1) * seg + k, (i + 1) * seg + k2, i * seg + k2])
    }
  }
  faces.push([...Array(seg).keys()])
  const last = []
  for (let k = n * seg - 1; k > (n - 1) * seg - 1; k -= 1) last.push(k)
  faces.push(last)
  return makePart(name, verts, faces, material, { bevel: false, ...opts })
}

/** Flat annulus, e.g. a burner outline. */
export function ring(name, cx, cy, z, rIn, rOut, thick, material, seg = 28, opts) {
  const verts = []
  const faces = []
  for (let k = 0; k < seg; k += 1) {
    const a = (2 * Math.PI * k) / seg
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    verts.push(
      [cx + ca * rIn, cy + sa * rIn, z],
      [cx + ca * rOut, cy + sa * rOut, z],
      [cx + ca * rIn, cy + sa * rIn, z + thick],
      [cx + ca * rOut, cy + sa * rOut, z + thick],
    )
  }
  for (let k = 0; k < seg; k += 1) {
    const a0 = 4 * k
    const a1 = 4 * ((k + 1) % seg)
    faces.push(
      [a0 + 2, a0 + 3, a1 + 3, a1 + 2],
      [a0 + 1, a0, a1, a1 + 1],
      [a0 + 3, a0 + 1, a1 + 1, a1 + 3],
      [a0, a0 + 2, a1 + 2, a1],
    )
  }
  return makePart(name, verts, faces, material, { bevel: false, ...opts })
}

/**
 * Raised panel lying along plan Y (a door leaf in a wall that runs east-west):
 * the field stands proud of its surround on a chamfer.
 */
export function raisedPanel(name, x0, x1, z0, z1, yBack, yFront, inset, material, opts) {
  const outer = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
  const inner = [[x0 + inset, z0 + inset], [x1 - inset, z0 + inset], [x1 - inset, z1 - inset], [x0 + inset, z1 - inset]]
  const verts = [
    ...outer.map(([x, z]) => [x, yBack, z]),
    ...inner.map(([x, z]) => [x, yFront, z]),
  ]
  const faces = [[3, 2, 1, 0], [4, 5, 6, 7]]
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4
    faces.push([i, j, j + 4, i + 4])
  }
  return makePart(name, verts, faces, material, opts)
}

/**
 * A single-sided sheet: visible from the side its normal points to, invisible
 * from behind. `corners` are [x, y, z] in plan inches, wound so the three.js
 * normal faces the viewer it is meant for. Used for the walls that close the
 * room off behind the camera.
 */
export function sheet(name, corners, material, opts) {
  return makePart(name, corners, [corners.map((_, i) => i)], material, { ...opts, closed: false })
}
