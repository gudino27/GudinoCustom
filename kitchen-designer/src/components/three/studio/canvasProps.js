import * as THREE from 'three'

// Phones and small tablets get smaller shadow maps and cheaper AO.
export const STUDIO_LOW = typeof window !== 'undefined' && window.innerWidth < 820

// Highest pixel ratio a studio canvas renders at (normal / low).
export const STUDIO_DPR = 1.5
export const STUDIO_DPR_LOW = 1.25

// Passed as <Canvas shadows>. R3F re-applies this on every render of the
// Canvas and sets shadowMap.enabled from it, so switching shadows on inside a
// component is undone the first time the caption changes — which is how the
// scene ended up rendering with no shadows at all.
//   PCF (not PCFSoft) honours shadow.radius, so each light sets its own
//   penumbra; the maps are redrawn on demand (set gl.shadowMap.needsUpdate
//   when something moves), not every frame.
export const STUDIO_SHADOWS = { type: THREE.PCFShadowMap, autoUpdate: false }

// The <Canvas> props every studio scene shares. Spread them, then add the
// scene's own (camera, frameloop, events). `gl` merges extra renderer options,
// e.g. { preserveDrawingBuffer: true } for screenshots.
export function studioCanvasProps({ low = STUDIO_LOW, exposure = 1.3, gl } = {}) {
  return {
    shadows: STUDIO_SHADOWS,
    // capped: every canvas pixel is paid for several times over in the
    // composer's half-float buffers and the AO targets
    dpr: [1, low ? STUDIO_DPR_LOW : STUDIO_DPR],
    gl: {
      // SMAA does the anti-aliasing; the composer renders off-screen,
      // so a multisampled canvas would only cost memory
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      // read by the ToneMapping effect (the composer owns tone mapping)
      // exposed for the room, as an interior photographer would; the
      // sun patches are allowed to run bright
      toneMappingExposure: exposure,
      ...gl,
    },
  }
}
