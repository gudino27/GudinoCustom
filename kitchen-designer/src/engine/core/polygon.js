// 2D polygon helpers in plan space. Ports of the helpers in build_kitchen.py.

export function polyArea(poly) {
  let a = 0
  for (let i = 0; i < poly.length; i += 1) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

export function pointInPoly(poly, px, py) {
  let inside = false
  const n = poly.length
  for (let i = 0; i < n; i += 1) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % n]
    if ((y0 > py) !== (y1 > py)) {
      const xc = x0 + ((py - y0) * (x1 - x0)) / (y1 - y0)
      if (px < xc) inside = !inside
    }
  }
  return inside
}

/** Unit normal of edge i, pointing out of the polygon. */
export function edgeNormal(poly, i) {
  const [x0, y0] = poly[i]
  const [x1, y1] = poly[(i + 1) % poly.length]
  const dx = x1 - x0
  const dy = y1 - y0
  const L = Math.hypot(dx, dy)
  const nx = dy / L
  const ny = -dx / L
  const mx = (x0 + x1) / 2 + nx * 0.05
  const my = (y0 + y1) / 2 + ny * 0.05
  return pointInPoly(poly, mx, my) ? [-nx, -ny] : [nx, ny]
}

/** Miter offset, outward by d inches (negative = inward); handles reflex corners. */
export function offsetPolygon(poly, d) {
  const n = poly.length
  const lines = []
  for (let i = 0; i < n; i += 1) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % n]
    const [nx, ny] = edgeNormal(poly, i)
    const L = Math.hypot(x1 - x0, y1 - y0)
    lines.push([x0 + nx * d, y0 + ny * d, (x1 - x0) / L, (y1 - y0) / L])
  }
  const out = []
  for (let i = 0; i < n; i += 1) {
    const [ax, ay, adx, ady] = lines[(i - 1 + n) % n]
    const [bx, by, bdx, bdy] = lines[i]
    const den = adx * bdy - ady * bdx
    if (Math.abs(den) < 1e-9) {
      out.push([bx, by])
      continue
    }
    const t = ((bx - ax) * bdy - (by - ay) * bdx) / den
    out.push([ax + adx * t, ay + ady * t])
  }
  return out
}
