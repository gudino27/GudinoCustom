import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { STUDIO_LOW } from './canvasProps'

// A light aimed at a fixed world point. three.js only tracks a target's
// matrix when it is in the scene, so it is added alongside.
function useAimedLight(ref, aim) {
  const { scene } = useThree()
  const [x, y, z] = aim
  useEffect(() => {
    const light = ref.current
    if (!light) return undefined
    const target = new THREE.Object3D()
    target.position.set(x, y, z)
    scene.add(target)
    light.target = target
    return () => { scene.remove(target) }
  }, [ref, scene, x, y, z])
}

// shadowBox -> the light's shadow-camera props (only the sides given)
function shadowCameraProps(box) {
  const out = {}
  if (!box) return out
  ;['near', 'far', 'left', 'right', 'top', 'bottom'].forEach((k) => {
    if (box[k] !== undefined) out[`shadow-camera-${k}`] = box[k]
  })
  return out
}

// The key light: a directional sun. Its shadow box must cover the whole room
// (see roomLighting): anything outside it counts as fully sunlit.
function Sun({
  position, target, intensity = 6, color = '#fff5e6', shadowBox, mapSize,
  bias = -0.0003, normalBias = 0.012, radius = 3, castShadow = true, low,
}) {
  const ref = useRef()
  useAimedLight(ref, target)
  const size = mapSize || (low ? 1024 : 2048)
  return (
    <directionalLight
      ref={ref}
      position={position}
      intensity={intensity}
      color={color}
      castShadow={castShadow}
      shadow-mapSize-width={size}
      shadow-mapSize-height={size}
      {...shadowCameraProps(shadowBox)}
      shadow-bias={bias}
      shadow-normalBias={normalBias}
      shadow-radius={radius}
    />
  )
}

// A recessed can as a downward spot: a pool of light on the counters and
// floor rather than a flat wash. Aimed straight down unless given a target.
// Extra keys (angle, intensity, ...) go straight onto the <spotLight>.
function CanLight({ position, target, shadow, low, mapSize, ...rest }) {
  const ref = useRef()
  useAimedLight(ref, target || [position[0], 0, position[2]])
  const size = mapSize || (low ? 512 : 1024)
  return (
    <spotLight
      ref={ref}
      position={position}
      angle={0.6}
      penumbra={0.85}
      intensity={9}
      decay={2}
      color="#fff1dc"
      castShadow={Boolean(shadow)}
      shadow-mapSize-width={size}
      shadow-mapSize-height={size}
      shadow-camera-near={0.2}
      shadow-camera-far={4}
      shadow-bias={-0.0004}
      shadow-normalBias={0.01}
      shadow-radius={4}
      {...rest}
    />
  )
}

const DEFAULT_AMBIENT = { intensity: 0.08, color: '#ffffff' }
const DEFAULT_HEMISPHERE = { sky: '#ffffff', ground: '#bfb6a4', intensity: 0.12 }

/**
 * The studio light rig. World units are metres (the physical decay and the
 * shadow biases are tuned for that).
 *   sun:        { position, target, intensity?, color?, shadowBox?, mapSize? } or null
 *   cans:       [{ position, target?, shadow? }] — keep shadow on three at most
 *   points:     [{ position, intensity, color, distance, decay }] extra fixtures
 *   ambient / hemisphere: override the fill, or false to drop it
 *   low:        small-screen shadow-map sizes (default STUDIO_LOW)
 */
export default function StudioLighting({
  sun, cans = [], points = [], ambient = DEFAULT_AMBIENT, hemisphere = DEFAULT_HEMISPHERE, low = STUDIO_LOW,
}) {
  const amb = ambient && { ...DEFAULT_AMBIENT, ...ambient }
  const hemi = hemisphere && { ...DEFAULT_HEMISPHERE, ...hemisphere }
  return (
    <>
      {amb ? <ambientLight intensity={amb.intensity} color={amb.color} /> : null}
      {hemi ? <hemisphereLight args={[hemi.sky, hemi.ground, hemi.intensity]} /> : null}
      {sun ? <Sun {...sun} low={low} /> : null}
      {cans.map((c) => <CanLight key={c.position.join(',')} low={low} {...c} />)}
      {points.map((pt, i) => <pointLight key={i} {...pt} />)}
    </>
  )
}
