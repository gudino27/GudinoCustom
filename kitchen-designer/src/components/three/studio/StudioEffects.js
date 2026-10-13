import { useEffect, useRef } from 'react'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { STUDIO_LOW } from './canvasProps'

// Screen-space AO supplies the contact darkening a shadow map cannot:
// the crevices between doors, under the crown, inside the panel
// recesses. This is most of what separates "CG" from "photo".
// (N8AO rebuilds normals from depth, so no NormalPass — that was a
// second full scene render for nothing.)
// Pair with studioCanvasProps(): antialias off (SMAA here instead) and the
// exposure the ToneMapping effect reads.
//
// Memory: the AO runs at half resolution (its targets are a quarter the
// size; the denoise hides the difference at this radius), and the composer's
// full-size half-float buffers are released when the effects unmount (the
// composer itself is kept for a StrictMode remount, which reallocates them on
// the next frame). A pixel-ratio change resizes them in place (the designer's
// DprSync), it does not make new ones.
export default function StudioEffects({ low = STUDIO_LOW, halfRes = true }) {
  const composerRef = useRef(null)
  useEffect(() => () => {
    const composer = composerRef.current
    if (!composer) return
    composer.inputBuffer?.dispose()
    composer.outputBuffer?.dispose()
  }, [])
  return (
    <EffectComposer ref={composerRef} multisampling={0}>
      {/* N8AO is far less noisy than the classic SSAO pass, which at this
          scene's scale speckled every wall junction with black. */}
      <N8AO
        aoRadius={0.4}
        distanceFalloff={1}
        intensity={1.8}
        aoSamples={low ? 8 : 16}
        denoiseSamples={4}
        denoiseRadius={10}
        halfRes={halfRes || low}
        color="black"
      />
      {/* The composer switches the renderer's own tone mapping off, so the
          exposure on <Canvas> did nothing and highlights clipped per
          channel. Tone map here, where the HDR buffer actually is. */}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  )
}
