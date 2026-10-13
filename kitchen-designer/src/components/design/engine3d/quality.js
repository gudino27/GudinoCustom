// Render quality for the engine view. The homepage's STUDIO_LOW only looks at
// the window width (phones and small tablets); the designer also drops to the
// cheaper settings (smaller shadow maps, half-resolution AO with fewer
// samples, a lower pixel ratio) on machines that report few cores or little
// memory, and when the frame rate sags (EngineRoom3D's PerformanceMonitor).
//
// No React: runs under `node --test`.

import { STUDIO_DPR, STUDIO_DPR_LOW } from '../../three/studio/canvasProps.js'

const LOW_WIDTH = 820 // as STUDIO_LOW
const LOW_CORES = 4
const LOW_MEMORY_GB = 4

/**
 * @param {Object} [device]  for tests; each defaults to the live value
 * @param {number} [device.width]   window.innerWidth
 * @param {number} [device.cores]   navigator.hardwareConcurrency
 * @param {number} [device.memory]  navigator.deviceMemory (GB, Chrome only)
 * @returns {boolean} true for the low-cost settings
 */
export function lowQuality(device = {}) {
  const nav = typeof navigator !== 'undefined' ? navigator : {}
  const win = typeof window !== 'undefined' ? window : {}
  const width = 'width' in device ? device.width : win.innerWidth
  const cores = 'cores' in device ? device.cores : nav.hardwareConcurrency
  const memory = 'memory' in device ? device.memory : nav.deviceMemory
  if (width > 0 && width < LOW_WIDTH) return true
  if (cores > 0 && cores < LOW_CORES) return true
  if (memory > 0 && memory < LOW_MEMORY_GB) return true
  return false
}

/**
 * The canvas pixel ratio: normal, degraded (the frame rate sagged) or for a
 * photo (twice the CSS size, capped so the long side stays under `maxSide`
 * device pixels).
 */
export function pixelRatio({ low = false, degraded = false, photo = false, cssWidth = 0, cssHeight = 0, maxSide = 4096 } = {}) {
  if (photo) {
    const side = Math.max(cssWidth, cssHeight)
    return side > 0 ? Math.min(2, maxSide / side) : 2
  }
  if (degraded) return 1
  return [1, low ? STUDIO_DPR_LOW : STUDIO_DPR]
}
