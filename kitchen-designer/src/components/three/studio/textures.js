import * as THREE from 'three'

// ---------------------------------------------------------------------------
// procedural textures — the GLB ships flat colours and metre-scale box UVs, so
// one canvas texture per material reads at a consistent size across the room.
// ---------------------------------------------------------------------------
function graniteTexture() {
  const s = 1024
  const c = document.createElement('canvas')
  c.width = c.height = s
  const x = c.getContext('2d')
  x.fillStyle = '#d9d9d4'
  x.fillRect(0, 0, s, s)

  // soft mineral blotches
  for (let i = 0; i < 300; i += 1) {
    const cx = Math.random() * s
    const cy = Math.random() * s
    const r = Math.random() * 60 + 18
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r)
    const dark = Math.random() < 0.45
    g.addColorStop(0, dark ? 'rgba(84,84,88,0.30)' : 'rgba(250,250,248,0.34)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.beginPath()
    x.arc(cx, cy, r, 0, Math.PI * 2)
    x.fill()
  }

  // the dense black / white speckle that gives the stone its grain
  for (let i = 0; i < 46000; i += 1) {
    const r = Math.random()
    if (r < 0.34) x.fillStyle = `rgba(28,28,32,${Math.random() * 0.75 + 0.2})`
    else if (r < 0.62) x.fillStyle = `rgba(252,252,250,${Math.random() * 0.8 + 0.2})`
    else if (r < 0.85) x.fillStyle = `rgba(126,128,132,${Math.random() * 0.5 + 0.15})`
    else x.fillStyle = `rgba(150,136,118,${Math.random() * 0.35 + 0.1})`
    const w = Math.random() * 3.4 + 0.7
    x.fillRect(Math.random() * s, Math.random() * s, w, w * (Math.random() * 0.8 + 0.5))
  }

  // faint veining
  for (let i = 0; i < 7; i += 1) {
    x.strokeStyle = `rgba(96,96,102,${Math.random() * 0.12 + 0.05})`
    x.lineWidth = Math.random() * 5 + 1.5
    x.beginPath()
    let px = -30
    let py = Math.random() * s
    x.moveTo(px, py)
    while (px < s) {
      px += 70 + Math.random() * 90
      py += (Math.random() - 0.5) * 150
      x.lineTo(px, py)
    }
    x.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(0.85, 0.85) // UVs are metres; one tile ≈ 1.2 m of slab
  tex.anisotropy = 8
  return tex
}

function oakTexture() {
  const s = 1024
  const c = document.createElement('canvas')
  c.width = c.height = s
  const x = c.getContext('2d')
  x.fillStyle = '#e3c684'
  x.fillRect(0, 0, s, s)

  const plank = 146 // ≈ 7" boards at one tile per 1.2 m
  for (let row = 0; row * plank < s; row += 1) {
    const y = row * plank
    const t = (Math.random() - 0.5) * 26
    x.fillStyle = `rgb(${226 + t},${197 + t * 0.7},${132 + t * 0.5})`
    x.fillRect(0, y, s, plank - 2)
    for (let i = 0; i < 90; i += 1) {
      x.strokeStyle = `rgba(150,110,60,${Math.random() * 0.09 + 0.02})`
      x.lineWidth = Math.random() * 1.5 + 0.2
      const ly = y + Math.random() * plank
      x.beginPath()
      x.moveTo(0, ly)
      for (let xx = 0; xx <= s; xx += 40) x.lineTo(xx, ly + Math.sin(xx * 0.017 + row) * 1.8)
      x.stroke()
    }
    x.strokeStyle = 'rgba(126,92,46,0.55)'
    x.lineWidth = 2.2
    x.beginPath()
    x.moveTo(0, y)
    x.lineTo(s, y)
    x.stroke()
    // staggered end joints
    const seam = Math.random() * s
    x.beginPath()
    x.moveTo(seam, y)
    x.lineTo(seam, y + plank - 2)
    x.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(0.82, 0.82)
  tex.anisotropy = 8
  return tex
}

function woodTexture(base, grain) {
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const x = c.getContext('2d')
  x.fillStyle = base
  x.fillRect(0, 0, s, s)
  for (let i = 0; i < 200; i += 1) {
    x.strokeStyle = `${grain}${Math.floor(Math.random() * 30 + 8).toString(16).padStart(2, '0')}`
    x.lineWidth = Math.random() * 2.4 + 0.3
    x.beginPath()
    const p0 = Math.random() * s
    x.moveTo(0, p0)
    for (let xx = 0; xx <= s; xx += 26) x.lineTo(xx, p0 + Math.sin(xx * 0.02 + i) * 3)
    x.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1.2, 1.2)
  return tex
}

// A faint blotch map. Used as a roughnessMap it stops painted doors reading as
// one flat plastic sheet — highlights break up the way real lacquer does.
function sheenTexture() {
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const x = c.getContext('2d')
  x.fillStyle = '#d8d8d8'
  x.fillRect(0, 0, s, s)
  for (let i = 0; i < 240; i += 1) {
    const cx = Math.random() * s
    const cy = Math.random() * s
    const r = Math.random() * 90 + 25
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r)
    const v = Math.random() < 0.5 ? 255 : 180
    g.addColorStop(0, `rgba(${v},${v},${v},0.14)`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = g
    x.beginPath()
    x.arc(cx, cy, r, 0, Math.PI * 2)
    x.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1.5, 1.5)
  return tex
}

// One shared set per page: generated on first use, never disposed (every
// studio scene on the page reuses them).
let _TEX = null
export function getTextures() {
  if (!_TEX) {
    _TEX = {
      granite: graniteTexture(),
      oak: oakTexture(),
      beam: woodTexture('#6f4a2b', '#3a2412'),
      sheen: sheenTexture(),
    }
  }
  return _TEX
}
