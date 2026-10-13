import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

// Put inside a <Canvas>: when the canvas unmounts, free its WebGL context
// right away. R3F does the same, but from a 500 ms timer that a background
// tab can hold back for a minute or more; until then the old context keeps
// every texture, shadow map and render target it had, and a user who flips
// between the plan and 3D (or leaves the homepage) carries two contexts.
// Runs inside the R3F tree, which React's StrictMode double-mount does not
// reach, so a development remount never loses a live context.
export default function ContextRelease() {
  const gl = useThree((s) => s.gl)
  useEffect(() => () => {
    try {
      gl.renderLists.dispose()
      gl.dispose()
      gl.forceContextLoss()
    } catch {
      // already lost
    }
  }, [gl])
  return null
}
