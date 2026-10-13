// A Run is a cabinet face line with an outward normal: the local frame every
// cabinet, front and appliance is drawn in. Port of `Run` in build_kitchen.py.
//
//   u  along the face, left to right as you stand in front of it
//   v  measured back from the door face, into the cabinet
//   z  up
//
// (ax, ay) sits on the carcass back — the wall for a wall run, the body face
// for an island — and `front` is how far the door face stands out from it
// along the normal. `voff` shifts every part forward (island fronts sit proud
// of the island body).
import { makePart, prism } from './part.js'
import { edgeNormal } from './polygon.js'

export class Run {
  constructor(ax, ay, dx, dy, nx, ny, voff = 0, front = 0) {
    const L = Math.hypot(dx, dy)
    const nl = Math.hypot(nx, ny)
    this.ax = ax
    this.ay = ay
    this.dx = dx / L
    this.dy = dy / L
    this.nx = nx / nl
    this.ny = ny / nl
    this.voff = voff
    this.front = front
    this.length = L
  }

  /** Plan point at (u, v). */
  pt(u, v) {
    const w = this.front - v - this.voff
    return [this.ax + this.dx * u + this.nx * w, this.ay + this.dy * u + this.ny * w]
  }

  box(name, u0, u1, v0, v1, z0, z1, material, opts) {
    return prism(name, [this.pt(u0, v0), this.pt(u1, v0), this.pt(u1, v1), this.pt(u0, v1)], z0, z1, material, opts)
  }

  /** Raised panel on this face; the field rises from vBack to vFront on a chamfer. */
  raisedPanel(name, u0, u1, z0, z1, vBack, vFront, inset, material, opts) {
    const outer = [[u0, z0], [u1, z0], [u1, z1], [u0, z1]]
    const inner = [[u0 + inset, z0 + inset], [u1 - inset, z0 + inset], [u1 - inset, z1 - inset], [u0 + inset, z1 - inset]]
    const verts = [
      ...outer.map(([u, z]) => [...this.pt(u, vBack), z]),
      ...inner.map(([u, z]) => [...this.pt(u, vFront), z]),
    ]
    const faces = [[3, 2, 1, 0], [4, 5, 6, 7]]
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4
      faces.push([i, j, j + 4, i + 4])
    }
    return makePart(name, verts, faces, material, opts)
  }

  /** Same line, different depth: the base, upper and deep runs of one wall. */
  withFront(front) {
    return new Run(this.ax, this.ay, this.dx * this.length, this.dy * this.length, this.nx, this.ny, this.voff, front)
  }

  withVoff(voff) {
    return new Run(this.ax, this.ay, this.dx * this.length, this.dy * this.length, this.nx, this.ny, voff, this.front)
  }

  /**
   * A free-standing item placed by position and angle (the designer's drag and
   * drop). `at` is its back-left corner seen from the front. Angle 0 runs east
   * with the front facing south; positive angles turn clockwise seen from above.
   */
  static fromPlacement(at, angleDeg, length, depth) {
    const a = (angleDeg * Math.PI) / 180
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    return new Run(at[0], at[1], dx * length, dy * length, -dy, dx, 0, depth)
  }
}

export const runBetween = (ax, ay, bx, by, nx, ny, voff = 0, front = 0) =>
  new Run(ax, ay, bx - ax, by - ay, nx, ny, voff, front)

/** Run along edge i of a polygon, facing out of it. */
export function runOnEdge(poly, i, voff = 0, front = 0) {
  const a = poly[i]
  const b = poly[(i + 1) % poly.length]
  const [nx, ny] = edgeNormal(poly, i)
  return new Run(a[0], a[1], b[0] - a[0], b[1] - a[1], nx, ny, voff, front)
}
