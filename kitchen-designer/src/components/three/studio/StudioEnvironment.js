import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// RoomEnvironment, prefiltered, as scene.environment. At 1.0 the environment
// out-lit the sun ~5x and washed every shadow out; at 0.42 it is a soft fill,
// and the lights do the modelling.
export default function StudioEnvironment({ intensity = 0.42 }) {
  const { gl, scene } = useThree()

  useEffect(() => {
    // shadow-map settings live on <Canvas shadows> (see STUDIO_SHADOWS); just
    // make sure the first frame draws the maps
    gl.shadowMap.needsUpdate = true

    const previous = scene.environment
    const pmrem = new THREE.PMREMGenerator(gl)
    const envScene = new RoomEnvironment()
    const target = pmrem.fromScene(envScene, 0.04)
    scene.environment = target.texture

    return () => {
      scene.environment = previous
      target.dispose()
      pmrem.dispose()
      envScene.traverse((child) => {
        if (child.geometry) child.geometry.dispose?.()
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.())
        else child.material?.dispose?.()
      })
    }
  }, [gl, scene])

  // separate, so changing the intensity does not rebuild the PMREM
  useEffect(() => {
    const previousIntensity = scene.environmentIntensity
    scene.environmentIntensity = intensity
    return () => { scene.environmentIntensity = previousIntensity }
  }, [scene, intensity])

  return null
}
