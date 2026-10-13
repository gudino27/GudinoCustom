// Floor, ceiling, beams, recessed cans, closing sheets, baseboards and extras.
import { cylinder, prism, sheet, slab } from '../core/part.js'
import { ROOM_DEFAULTS } from './schema.js'

const EPS = 1e-6

const slabOutline = (s, what) => {
  if (s.outline) return s.outline
  if (s.rect) {
    const [x0, y0, x1, y1] = s.rect
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  }
  throw new Error(`${what} needs \`rect\` or \`outline\``)
}

/** Floor slab, top face at z = 0. */
export function buildFloor(floor) {
  const t = floor.thickness ?? ROOM_DEFAULTS.floor.thickness
  return prism(floor.name || 'floor', slabOutline(floor, 'floor'), -t, 0, floor.material || 'oak',
    { bevel: false, tags: { role: 'floor' } })
}

/** Ceiling slab, bottom face at the room's height. */
export function buildCeiling(ceiling, height) {
  const t = ceiling.thickness ?? ROOM_DEFAULTS.ceiling.thickness
  return prism(ceiling.name || 'ceiling', slabOutline(ceiling, 'ceiling'), height, height + t, ceiling.material || 'ceil',
    { bevel: false, tags: { role: 'ceiling' } })
}

/** A beam hung from the ceiling along from -> to. */
export function buildBeam(beam, height) {
  const [ax, ay] = beam.from
  const [bx, by] = beam.to
  const L = Math.hypot(bx - ax, by - ay)
  if (!(L > EPS)) throw new Error(`beam "${beam.name || 'beam'}" has no length`)
  const nx = (-(by - ay) / L) * (beam.width / 2)
  const ny = ((bx - ax) / L) * (beam.width / 2)
  const poly = [[ax - nx, ay - ny], [bx - nx, by - ny], [bx + nx, by + ny], [ax + nx, ay + ny]]
  return prism(beam.name || 'beam', poly, height - beam.depth, height, beam.material || 'beam', { tags: { role: 'trim' } })
}

/** A recessed can: housing disc at the ceiling and its lens. */
export function buildCan(can, height) {
  const D = ROOM_DEFAULTS.can
  const name = can.name || 'can'
  const [x, y] = can.at
  const tags = { tags: { role: 'fixture' } }
  return [
    cylinder(name, x, y, height - D.drop, can.radius ?? D.radius, D.height, can.material || 'can', 'Z', 16, tags),
    cylinder(can.lensName || `${name}_in`, x, y, height - D.lensDrop, can.lensRadius ?? D.lensRadius, D.lensHeight,
      can.lensMaterial || 'lens', 'Z', 16, tags),
  ]
}

/**
 * A single-sided sheet from -> to, seen from its `side` (the room). The
 * corners are wound so the three.js normal (plan x, z, y) points that way.
 */
export function buildSheet(sh, height) {
  const [ax, ay] = sh.from
  const [bx, by] = sh.to
  const L = Math.hypot(bx - ax, by - ay)
  if (!(L > EPS)) throw new Error(`sheet "${sh.name}" has no length`)
  const dx = (bx - ax) / L
  const dy = (by - ay) / L
  const f = sh.side === 'left' ? [dy, -dx] : [-dy, dx]
  const z0 = sh.z0 ?? 0
  const z1 = sh.z1 ?? height
  let corners = [[ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1]]
  // three.js normal of the quad: (T1 - T0) x (T3 - T0) with T = (x, z, y)
  const T = (p) => [p[0], p[2], p[1]]
  const [p0, p1, p3] = [T(corners[0]), T(corners[1]), T(corners[3])]
  const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]
  const w = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]]
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
  if (n[0] * f[0] + n[2] * f[1] < 0) corners = [corners[1], corners[0], corners[3], corners[2]]
  return sheet(sh.name, corners, sh.material || 'wall_in', { tags: { role: 'wall' } })
}

/** Escape hatch: an explicit box or prism. */
export function buildExtra(e) {
  const opts = { tags: { role: e.role || 'trim' } }
  if (e.bevel === false) opts.bevel = false
  if (e.box) {
    const [x0, y0, z0, x1, y1, z1] = e.box
    return slab(e.name, x0, x1, y0, y1, z0, z1, e.material, opts)
  }
  if (e.poly && e.z) return prism(e.name, e.poly, e.z[0], e.z[1], e.material, opts)
  throw new Error(`extra "${e.name}" needs \`box\` or \`poly\` and \`z\``)
}

/**
 * Baseboards along a wall. Without an `s` range a baseboard runs the whole
 * room face (0..length) and breaks at openings that reach the floor (and at their casings).
 */
export function buildBaseboards(frame, openings) {
  const spec = frame.wall.baseboard
  if (!spec) return []
  const list = spec === true ? [{}] : Array.isArray(spec) ? spec : [spec]
  const parts = []
  list.forEach((b, bi) => {
    const D = ROOM_DEFAULTS.baseboard
    const h = b.height ?? D.height
    const t = b.thickness ?? D.thickness
    const [v0, v1] = b.v || [frame.vFront, frame.vFront + t]
    let spans
    if (b.s) {
      spans = [b.s]
    } else {
      const gaps = openings
        .filter((o) => o.kind !== 'window' && o.cut.z0 <= frame.z0 + EPS)
        .map((o) => {
          const c = o.casing === false ? null : { ...ROOM_DEFAULTS.casing, ...(o.casing || {}) }
          return c ? [o.s0 - c.outside, o.s1 + c.outside] : [o.s0, o.s1]
        })
        .sort((x, y) => x[0] - y[0])
      spans = []
      // the room face runs 0..length; the `extend` part is buried in the neighbouring wall
      let cur = 0
      for (const [g0, g1] of gaps) {
        if (g0 - cur > EPS) spans.push([cur, g0])
        cur = Math.max(cur, g1)
      }
      if (frame.length - cur > EPS) spans.push([cur, frame.length])
    }
    const base = b.name || (list.length === 1 ? `${frame.name}_base` : `${frame.name}_base${bi}`)
    spans.forEach(([s0, s1], k) => {
      const name = spans.length === 1 ? base : `${base}${k}`
      parts.push(frame.box(name, s0, s1, v0, v1, frame.z0, frame.z0 + h, b.material || 'trim', { tags: { role: 'trim' } }))
    })
  })
  return parts
}
