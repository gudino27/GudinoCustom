import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

// What you see through the windows. Without it the openings showed the
// room's own oak floor running on outside. A painted exterior — sky, a soft
// tree line, lawn — standing a few feet out, so it shifts behind the mullions
// as the camera moves the way a real view does.
function exteriorTexture() {
  const w = 1024
  const h = 768
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')
  const horizon = h * 0.58

  const sky = x.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#a9c8e4')
  sky.addColorStop(0.7, '#d6e6f1')
  sky.addColorStop(1, '#eef3f3')
  x.fillStyle = sky
  x.fillRect(0, 0, w, horizon)

  // soft clouds
  for (let i = 0; i < 26; i += 1) {
    const cx = Math.random() * w
    const cy = Math.random() * horizon * 0.55
    const r = Math.random() * 70 + 30
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(cx - r, cy - r, r * 2, r * 2)
  }

  // two bands of trees: distant and hazy, then nearer and darker
  const trees = (base, spread, rMin, rMax, colours, n) => {
    for (let i = 0; i < n; i += 1) {
      const cx = Math.random() * w
      const r = Math.random() * (rMax - rMin) + rMin
      const cy = base - Math.random() * spread
      x.fillStyle = colours[Math.floor(Math.random() * colours.length)]
      x.beginPath()
      x.arc(cx, cy, r, 0, Math.PI * 2)
      x.fill()
    }
  }
  trees(horizon + 6, 70, 18, 46, ['#8fa98f', '#9bb39a', '#86a087'], 150)
  trees(horizon + 30, 60, 26, 60, ['#58764f', '#4d6a45', '#62804f', '#6f8b58'], 120)

  const lawn = x.createLinearGradient(0, horizon + 20, 0, h)
  lawn.addColorStop(0, '#7f9d5c')
  lawn.addColorStop(1, '#6b8a4a')
  x.fillStyle = lawn
  x.fillRect(0, horizon + 20, w, h - horizon - 20)
  for (let i = 0; i < 5000; i += 1) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,84,40' : '150,176,110'},0.18)`
    x.fillRect(Math.random() * w, horizon + 20 + Math.random() * (h - horizon), 2, 3)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// A plane facing +z before `rotation`; size is [width, height] in world units.
// Stand it a few feet outside the window wall, facing in.
export default function ExteriorView({ position, rotation = [0, 0, 0], size }) {
  const tex = useMemo(() => exteriorTexture(), [])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh position={position} rotation={rotation} renderOrder={-1}>
      <planeGeometry args={size} />
      {/* unlit: daylight outside is far brighter than anything in the room */}
      <meshBasicMaterial map={tex} fog={false} toneMapped />
    </mesh>
  )
}
