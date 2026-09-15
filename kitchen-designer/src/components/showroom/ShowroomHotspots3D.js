// ShowroomHotspots3D - Renders interactive hotspot markers in the 3D panorama
// Positioned on the sphere using yaw/pitch coordinates, always facing camera
import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

// Convert yaw/pitch (degrees) to 3D position on sphere
const yawPitchToPosition = (yaw, pitch, radius = 450) => {
  // Pannellum: yaw = horizontal angle (0 = front), pitch = vertical angle (0 = horizon)
  // Convert to radians
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;

  // Calculate position on sphere
  // x = forward/back, y = up/down, z = left/right
  const x = radius * Math.cos(pitchRad) * Math.sin(-yawRad);
  const y = radius * Math.sin(pitchRad);
  const z = radius * Math.cos(pitchRad) * Math.cos(-yawRad);

  return [x, y, z];
};

// Hotspot icon component
const HotspotIcon = ({ type, isHovered, reduceMotion }) => {
  const getIconPath = () => {
    switch (type) {
      case 'info':
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'link_designer':
        return 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4';
      case 'link_room':
        return 'M17 8l4 4m0 0l-4 4m4-4H3';
      case 'link_material':
        return 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01';
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'info':
        return { bg: 'rgba(245, 158, 11, 0.9)', border: '#f59e0b' };
      case 'link_designer':
        return { bg: 'rgba(16, 185, 129, 0.9)', border: '#10b981' };
      case 'link_room':
        return { bg: 'rgba(59, 130, 246, 0.9)', border: '#3b82f6' };
      case 'link_material':
        return { bg: 'rgba(139, 92, 246, 0.9)', border: '#8b5cf6' };
      default:
        return { bg: 'rgba(245, 158, 11, 0.9)', border: '#f59e0b' };
    }
  };

  const colors = getColor();

  return (
    <div
      className="transition-transform duration-200"
      style={{
        transform: isHovered ? 'scale(1.2)' : 'scale(1)',
        cursor: 'pointer'
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
        style={{
          backgroundColor: colors.bg,
          border: `2px solid white`,
          boxShadow: isHovered ? `0 0 20px ${colors.border}` : '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={getIconPath()} />
        </svg>
      </div>

      {/* Pulsing ring animation - off when reduced motion is preferred */}
      {!reduceMotion && (
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            backgroundColor: colors.border,
            opacity: 0.3,
            animationDuration: '2s'
          }}
        />
      )}
    </div>
  );
};

// Individual hotspot component
const Hotspot3D = ({ hotspot, onClick, language, reduceMotion }) => {
  const [isHovered, setIsHovered] = useState(false);
  const meshRef = useRef();

  // Calculate position from yaw/pitch
  const position = useMemo(() => {
    return yawPitchToPosition(hotspot.position_yaw, hotspot.position_pitch);
  }, [hotspot.position_yaw, hotspot.position_pitch]);

  // Get title based on language
  const title = language === 'es' ? hotspot.title_es : hotspot.title_en;

  return (
    <Billboard
      position={position}
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <Html
        center
        style={{
          pointerEvents: 'auto',
          userSelect: 'none'
        }}
        distanceFactor={200}
        occlude={false}
      >
        {/* Pointer-only marker: the same hotspots are listed as buttons below the view */}
        <div
          aria-hidden="true"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            onClick(hotspot);
          }}
          className="relative"
        >
          <HotspotIcon type={hotspot.hotspot_type} isHovered={isHovered} reduceMotion={reduceMotion} />

          {/* Tooltip on hover */}
          {isHovered && title && (
            <div
              className="absolute left-1/2 bottom-full mb-2 transform -translate-x-1/2 whitespace-nowrap"
              style={{ pointerEvents: 'none' }}
            >
              <div className="bg-black/80 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg">
                {title}
              </div>
              <div className="absolute left-1/2 top-full transform -translate-x-1/2 -mt-1">
                <div className="border-4 border-transparent border-t-black/80" />
              </div>
            </div>
          )}
        </div>
      </Html>
    </Billboard>
  );
};

// Main hotspots container
const ShowroomHotspots3D = ({ hotspots = [], onHotspotClick, language }) => {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <group>
      {hotspots.map((hotspot) => (
        <Hotspot3D
          key={hotspot.id}
          hotspot={hotspot}
          onClick={onHotspotClick}
          language={language}
          reduceMotion={reduceMotion}
        />
      ))}
    </group>
  );
};

export default ShowroomHotspots3D;
