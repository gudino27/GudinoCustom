// PanoramaControls - Camera controls for inside-sphere panorama navigation
// Handles mouse drag to look around, scroll to zoom (FOV), touch gestures
import React, { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PanoramaControls = ({
  initialYaw = 0,
  initialPitch = 0,
  sensitivity = 1.0,
  autoRotate = false,
  autoRotateSpeed = 0.5,
  minFov = 30,
  maxFov = 120,
  // Filled with { look(leftDegrees, upDegrees), zoom(fovDelta) } so the on-screen
  // buttons and the arrow / +- keys outside the canvas can drive the camera.
  controlsRef = null,
  // The focusable wrapper around the canvas. The wheel is only taken over while
  // it has focus, so the page can still be scrolled with the mouse.
  viewerRef = null
}) => {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const spherical = useRef(new THREE.Spherical(1, Math.PI / 2, 0));
  const targetSpherical = useRef(new THREE.Spherical(1, Math.PI / 2, 0));
  const isUserInteracting = useRef(false);
  const autoRotateTimeout = useRef(null);

  // Touch handling
  const touchStartDistance = useRef(0);
  const initialFov = useRef(camera.fov);

  // Convert degrees to radians
  const degToRad = (deg) => deg * (Math.PI / 180);

  // Initialize camera orientation from yaw/pitch
  useEffect(() => {
    // Start looking at center of 2D image (u=0.5) which is theta=π (-Z direction)
    // yaw = 0 means looking at center of panorama (matches 2D preview center)
    // Three.js spherical: theta = horizontal angle, phi = vertical angle from top
    const theta = Math.PI + degToRad(-initialYaw); // Start at π (center), then apply yaw offset
    const phi = degToRad(90 - initialPitch); // Convert pitch to phi (from top pole)

    spherical.current.set(1, phi, theta);
    targetSpherical.current.copy(spherical.current);

    updateCameraFromSpherical();
  }, [initialYaw, initialPitch]);

  // Update camera position/orientation from spherical coordinates
  const updateCameraFromSpherical = useCallback(() => {
    // Camera looks from center towards point on sphere
    const lookTarget = new THREE.Vector3();
    lookTarget.setFromSpherical(spherical.current);
    camera.lookAt(lookTarget);
  }, [camera]);

  // Handle mouse/touch start
  const handlePointerDown = useCallback((event) => {
    isDragging.current = true;
    isUserInteracting.current = true;
    previousMousePosition.current = {
      x: event.clientX || event.touches?.[0]?.clientX || 0,
      y: event.clientY || event.touches?.[0]?.clientY || 0
    };

    // Clear auto-rotate timeout
    if (autoRotateTimeout.current) {
      clearTimeout(autoRotateTimeout.current);
    }
  }, []);

  // Handle mouse/touch move
  const handlePointerMove = useCallback((event) => {
    if (!isDragging.current) return;

    const clientX = event.clientX || event.touches?.[0]?.clientX || 0;
    const clientY = event.clientY || event.touches?.[0]?.clientY || 0;

    const deltaX = clientX - previousMousePosition.current.x;
    const deltaY = clientY - previousMousePosition.current.y;

    // Adjust spherical coordinates based on mouse movement
    // Sensitivity factor for smooth control
    const rotationSpeed = 0.002 * sensitivity;

    targetSpherical.current.theta -= deltaX * rotationSpeed;
    targetSpherical.current.phi += deltaY * rotationSpeed;

    // Clamp phi to prevent flipping (keep between ~10 and ~170 degrees)
    targetSpherical.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, targetSpherical.current.phi));

    previousMousePosition.current = { x: clientX, y: clientY };
  }, [sensitivity]);

  // Handle mouse/touch end
  const handlePointerUp = useCallback(() => {
    isDragging.current = false;

    // Resume auto-rotate after delay
    if (autoRotate) {
      autoRotateTimeout.current = setTimeout(() => {
        isUserInteracting.current = false;
      }, 3000);
    }
  }, [autoRotate]);

  // Hold auto-rotate while the visitor is steering, then let it pick up again
  const holdAutoRotate = useCallback(() => {
    isUserInteracting.current = true;
    if (autoRotateTimeout.current) {
      clearTimeout(autoRotateTimeout.current);
    }
    if (autoRotate) {
      autoRotateTimeout.current = setTimeout(() => {
        isUserInteracting.current = false;
      }, 3000);
    }
  }, [autoRotate]);

  // Start moving again as soon as auto-rotate is switched back on
  useEffect(() => {
    if (autoRotate) {
      isUserInteracting.current = false;
    }
  }, [autoRotate]);

  // Handle scroll/wheel for zoom (FOV change)
  const handleWheel = useCallback((event) => {
    // Only take the wheel over while the viewer has focus, otherwise the canvas
    // would swallow every scroll over most of the viewport.
    const viewer = viewerRef?.current;
    if (viewer && !viewer.contains(document.activeElement)) return;

    event.preventDefault();

    const zoomSpeed = 0.05;
    const delta = event.deltaY * zoomSpeed;

    camera.fov = Math.max(minFov, Math.min(maxFov, camera.fov + delta));
    camera.updateProjectionMatrix();
  }, [camera, minFov, maxFov, viewerRef]);

  // Expose look / zoom to the on-screen buttons and the keyboard handler
  useEffect(() => {
    if (!controlsRef) return undefined;

    controlsRef.current = {
      // Positive leftDegrees turns left, positive upDegrees tilts up
      look: (leftDegrees, upDegrees) => {
        holdAutoRotate();
        targetSpherical.current.theta += THREE.MathUtils.degToRad(leftDegrees);
        targetSpherical.current.phi = Math.max(
          0.1,
          Math.min(Math.PI - 0.1, targetSpherical.current.phi - THREE.MathUtils.degToRad(upDegrees))
        );
      },
      // Negative fovDelta zooms in
      zoom: (fovDelta) => {
        camera.fov = Math.max(minFov, Math.min(maxFov, camera.fov + fovDelta));
        camera.updateProjectionMatrix();
      }
    };

    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef, holdAutoRotate, camera, minFov, maxFov]);

  // Handle touch pinch zoom
  const handleTouchStart = useCallback((event) => {
    if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      touchStartDistance.current = Math.sqrt(dx * dx + dy * dy);
      initialFov.current = camera.fov;
    } else if (event.touches.length === 1) {
      handlePointerDown(event);
    }
  }, [camera, handlePointerDown]);

  const handleTouchMove = useCallback((event) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const scale = touchStartDistance.current / distance;
      const newFov = initialFov.current * scale;

      camera.fov = Math.max(minFov, Math.min(maxFov, newFov));
      camera.updateProjectionMatrix();
    } else if (event.touches.length === 1) {
      handlePointerMove(event);
    }
  }, [camera, minFov, maxFov, handlePointerMove]);

  // Set up event listeners
  useEffect(() => {
    const domElement = gl.domElement;

    domElement.addEventListener('pointerdown', handlePointerDown);
    domElement.addEventListener('pointermove', handlePointerMove);
    domElement.addEventListener('pointerup', handlePointerUp);
    domElement.addEventListener('pointerleave', handlePointerUp);
    domElement.addEventListener('wheel', handleWheel, { passive: false });
    domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    domElement.addEventListener('touchend', handlePointerUp);

    // Prevent context menu on right-click
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      domElement.removeEventListener('pointermove', handlePointerMove);
      domElement.removeEventListener('pointerup', handlePointerUp);
      domElement.removeEventListener('pointerleave', handlePointerUp);
      domElement.removeEventListener('wheel', handleWheel);
      domElement.removeEventListener('touchstart', handleTouchStart);
      domElement.removeEventListener('touchmove', handleTouchMove);
      domElement.removeEventListener('touchend', handlePointerUp);

      if (autoRotateTimeout.current) {
        clearTimeout(autoRotateTimeout.current);
      }
    };
  }, [gl, handlePointerDown, handlePointerMove, handlePointerUp, handleWheel, handleTouchStart, handleTouchMove]);

  // Animation frame - smooth interpolation and auto-rotate
  useFrame((state, delta) => {
    // Auto-rotate when not interacting
    if (autoRotate && !isUserInteracting.current) {
      targetSpherical.current.theta += degToRad(autoRotateSpeed * delta * 60);
    }

    // Smooth interpolation towards target
    const lerpFactor = 1 - Math.pow(0.001, delta);
    spherical.current.theta += (targetSpherical.current.theta - spherical.current.theta) * lerpFactor * 10;
    spherical.current.phi += (targetSpherical.current.phi - spherical.current.phi) * lerpFactor * 10;

    updateCameraFromSpherical();
  });

  return null;
};

export default PanoramaControls;
