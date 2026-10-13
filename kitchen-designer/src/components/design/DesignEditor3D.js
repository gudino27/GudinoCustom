import React, { useMemo, useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { getMaterialById, MATERIAL_TYPES, FINISHES } from '../../constants/materials';
import { cameraSetup, clampInside, layoutFocus } from './engine3d/camera.js';
import { enclosedSpaces, interiorWalls, pushOutOfWalls } from './engine3d/interior.js';
import { yawFromQuaternion } from './engine3d/pose.js';
import { housingOf } from '../../utils/designer/housing';
import ContextRelease from '../three/studio/ContextRelease';
import { STUDIO_DPR } from '../three/studio/canvasProps';
import { centerFromTopLeft, normalizeRotation, topLeftFromCenter } from '../../utils/designer/rotation';

// Camera controller component that exposes camera control to parent
const CameraController = forwardRef(({ orbitControlsRef, widthInches, depthInches }, ref) => {
  const { camera } = useThree();
  
  useImperativeHandle(ref, () => ({
    // Set camera to look at a specific wall from center of room
    // Wall 1 = top (looking towards z=0), Wall 2 = right (looking towards x=max)
    // Wall 3 = bottom (looking towards z=max), Wall 4 = left (looking towards x=0)
    setWallView: (wallNumber) => {
      const centerX = widthInches / 2;
      const centerZ = depthInches / 2;
      const eyeHeight = 66; // 5.5 feet eye level
      const viewDistance = 24; // Distance from center towards wall
      
      let cameraPos, targetPos;
      
      switch(wallNumber) {
        case 1: // Top wall - camera looks from center towards z=0
          cameraPos = [centerX, eyeHeight, centerZ + viewDistance];
          targetPos = [centerX, eyeHeight * 0.7, 0];
          break;
        case 2: // Right wall - camera looks from center towards x=max
          cameraPos = [centerX - viewDistance, eyeHeight, centerZ];
          targetPos = [widthInches, eyeHeight * 0.7, centerZ];
          break;
        case 3: // Bottom wall - camera looks from center towards z=max
          cameraPos = [centerX, eyeHeight, centerZ - viewDistance];
          targetPos = [centerX, eyeHeight * 0.7, depthInches];
          break;
        case 4: // Left wall - camera looks from center towards x=0
          cameraPos = [centerX + viewDistance, eyeHeight, centerZ];
          targetPos = [0, eyeHeight * 0.7, centerZ];
          break;
        default:
          return;
      }
      
      camera.position.set(...cameraPos);
      camera.lookAt(...targetPos);
      
      if (orbitControlsRef?.current) {
        orbitControlsRef.current.target.set(...targetPos);
        orbitControlsRef.current.update();
      }
    },
    // Get current camera for direct manipulation
    getCamera: () => camera,
    getControls: () => orbitControlsRef?.current
  }));
  
  return null;
});

// Professional cabinet colors matching Master Build style
const CABINET_COLORS = {
  white: '#f5f5f5',      // Clean white shaker
  cream: '#f8f4e8',      // Warm cream
  gray: '#d4d4d4',       // Light gray
};

// Countertop materials
const COUNTERTOP_COLORS = {
  marble: '#e8e4df',     // Light marble/granite
  granite: '#4a4a4a',    // Dark granite
};

// Shaker Door Panel Component
const ShakerDoorPanel = ({ width, height, depth, color, isSelected }) => {
  const frameWidth = 2;
  const panelInset = 0.3;
  
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.4}
          metalness={0.05}
          emissive={isSelected ? '#4a90e2' : '#000000'}
          emissiveIntensity={isSelected ? 0.15 : 0}
        />
      </mesh>
      <mesh position={[0, 0, -panelInset]} castShadow receiveShadow>
        <boxGeometry args={[width - frameWidth * 2, height - frameWidth * 2, depth * 0.5]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.02} />
      </mesh>
    </group>
  );
};

// Crown Molding Component
const CrownMolding = ({ width, depth, height = 3, color }) => {
  return (
    <group>
      <mesh position={[0, 0, depth / 2]} castShadow>
        <boxGeometry args={[width + 1, height, 1.5]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[width / 2 + 0.5, 0, 0]} castShadow>
        <boxGeometry args={[1.5, height, depth + 1]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[-width / 2 - 0.5, 0, 0]} castShadow>
        <boxGeometry args={[1.5, height, depth + 1]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
};

// Cabinet Handle Component
const CabinetHandle = ({ position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <capsuleGeometry args={[0.25, 4, 8, 16]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.5, -0.3]}>
        <cylinderGeometry args={[0.15, 0.15, 0.6, 8]} />
        <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, -1.5, -0.3]}>
        <cylinderGeometry args={[0.15, 0.15, 0.6, 8]} />
        <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
};

const Element3D = ({ element, scale, elementTypes, isSelected, onSelect, onUpdate, interactive, transformMode, orbitControlsRef, roomWidth, roomDepth, onTransformChange }) => {
  const [elementObj, setElementObj] = useState(null);
  const spec = elementTypes[element.type] || { color: '#999' };
  
  // Material Resolution - Default to white shaker style
  const materialData = element.materialId ? getMaterialById(element.materialId) : null;
  const baseColor = materialData ? materialData.hex : CABINET_COLORS.white;
  
  // Determine material properties based on type
  const materialProps = useMemo(() => {
    if (!materialData) return { roughness: 0.4, metalness: 0.05 };
    
    if (materialData.type === MATERIAL_TYPES.PAINT) {
        const finish = element.finish && FINISHES[element.finish] ? FINISHES[element.finish] : FINISHES.satin;
        return { roughness: finish.roughness, metalness: finish.metalness };
    } else if (materialData.type === MATERIAL_TYPES.APPLIANCE) {
        return { roughness: materialData.roughness, metalness: materialData.metalness };
    } else {
        return { roughness: 0.5, metalness: 0 };
    }
  }, [materialData, element.finish]);

  useEffect(() => {
    if (isSelected) {
      console.log('Element selected:', element.id, 'Interactive:', interactive, 'Obj:', !!elementObj);
    }
  }, [isSelected, interactive, elementObj, element.id]);

  // Dimensions are in inches
  const width = element.width;
  const depth = element.depth;
  const height = element.actualHeight || spec.defaultHeight || 30;
  const elevation = element.mountHeight || spec.mountHeight || 0;
  
  // element.x / y (plan px) are the top-left of the rotated footprint; the
  // group stands at the footprint centre (inches) and turns about it, as the
  // floor plan and the engine view do
  const [centerX, centerZ] = centerFromTopLeft(element, element.x, element.y, scale);

  const rotationRad = -(element.rotation || 0) * (Math.PI / 180);

  // Determine if it's a base cabinet (needs countertop)
  const isBaseCabinet = element.category === 'cabinet' && height < 40 && !element.type.includes('wall') && !element.type.includes('tall') && !element.type.includes('linen');
  const isAppliance = element.category === 'appliance';
  const isCorner = (element.type.toLowerCase().includes('corner') || (width === depth && width > 30)) && !isAppliance;
  const standardDepth = 24;
  // Refrigerator cabinet: two side panels and the cabinet over the opening,
  // no solid box, so the fridge inside it shows
  const housing = housingOf(element, elementTypes);

  const handleElementClick = (e) => {
    if (interactive) {
        e.stopPropagation();
        onSelect(element.id);
    }
  };
  
  return (
    <>
      <group 
        ref={setElementObj}
        position={[centerX, elevation, centerZ]}
        rotation={[0, rotationRad, 0]}
      >
      {/* Main Body */}
      {housing ? (() => {
        const panel = Math.min(housing.sidePanel, width / 2);
        const top = Math.min(housing.topHeight, height);
        const bay = Math.max(0, width - 2 * panel);
        const look = (
          <meshStandardMaterial
            color={baseColor}
            metalness={materialProps.metalness}
            roughness={materialProps.roughness}
            emissive={isSelected ? '#4a90e2' : '#000000'}
            emissiveIntensity={isSelected ? 0.3 : 0}
          />
        );
        return (
          <group>
            {[-(width - panel) / 2, (width - panel) / 2].map((px) => (
              <mesh key={px} position={[px, height / 2, 0]} castShadow receiveShadow onClick={handleElementClick}>
                <boxGeometry args={[panel, height, depth]} />
                {look}
              </mesh>
            ))}
            {top > 0 && bay > 0 && (
              <>
                <mesh position={[0, height - top / 2, 0]} castShadow receiveShadow onClick={handleElementClick}>
                  <boxGeometry args={[bay, top, depth]} />
                  {look}
                </mesh>
                {/* Door line on the cabinet over the opening */}
                <mesh position={[0, height - top / 2, depth / 2 + 0.1]}>
                  <planeGeometry args={[0.3, Math.max(0, top - 2)]} />
                  <meshStandardMaterial color="#000" transparent opacity={0.25} />
                </mesh>
              </>
            )}
          </group>
        );
      })() : isCorner ? (
        <group>
            {/* Back Rect (Main width) */}
            <mesh 
                position={[0, height / 2, 12 - depth / 2]} 
                castShadow 
                receiveShadow
                onClick={handleElementClick}
            >
                <boxGeometry args={[width, height, 24]} />
                <meshStandardMaterial 
                    color={baseColor} 
                    metalness={materialProps.metalness}
                    roughness={materialProps.roughness}
                    emissive={isSelected ? '#4a90e2' : '#000000'}
                    emissiveIntensity={isSelected ? 0.3 : 0}
                />
            </mesh>
            {/* Side Extension (Remaining depth) */}
            <mesh 
                position={[12 - width / 2, height / 2, 24 + (depth - 24) / 2 - depth / 2]} 
                castShadow 
                receiveShadow
                onClick={handleElementClick}
            >
                <boxGeometry args={[24, height, depth - 24]} />
                <meshStandardMaterial 
                    color={baseColor} 
                    metalness={materialProps.metalness}
                    roughness={materialProps.roughness}
                    emissive={isSelected ? '#4a90e2' : '#000000'}
                    emissiveIntensity={isSelected ? 0.3 : 0}
                />
            </mesh>
            {/* Countertop for corner - Marble/Granite style */}
            {isBaseCabinet && (
                <group position={[0, height + 0.75, 0]}>
                    <mesh position={[0, 0, 12 - depth / 2]} castShadow receiveShadow onClick={handleElementClick}>
                        <boxGeometry args={[width + 1, 1.5, 25]} />
                        <meshStandardMaterial color="#e8e4df" roughness={0.15} metalness={0.05} />
                    </mesh>
                    <mesh position={[12 - width / 2, 0, 24 + (depth - 24) / 2 - depth / 2]} castShadow receiveShadow onClick={handleElementClick}>
                        <boxGeometry args={[25, 1.5, depth - 24 + 1]} />
                        <meshStandardMaterial color="#e8e4df" roughness={0.15} metalness={0.05} />
                    </mesh>
                </group>
            )}
        </group>
      ) : (
        <mesh 
            position={[0, height / 2, 0]} 
            castShadow 
            receiveShadow
            onClick={handleElementClick}
        >
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial 
                color={baseColor} 
                metalness={isAppliance ? 0.6 : materialProps.metalness}
                roughness={isAppliance ? 0.2 : materialProps.roughness}
                emissive={isSelected ? '#4a90e2' : '#000000'}
                emissiveIntensity={isSelected ? 0.3 : 0}
            />
        </mesh>
      )}

        {/* Countertop for standard base cabinets - Marble/Granite style */}
        {isBaseCabinet && !isCorner && (
            <mesh 
                position={[0, height + 0.75, 0]} 
                castShadow 
                receiveShadow
                onClick={handleElementClick}
            >
              <boxGeometry args={[width + 1, 1.5, depth + 1]} />
              <meshStandardMaterial color="#e8e4df" roughness={0.15} metalness={0.05} />
            </mesh>
        )}

        {/* Door/Drawer Detail for cabinets */}
        {!isAppliance && !isCorner && !housing && (
          <group position={[0, height / 2, depth / 2 + 0.1]}>
              <mesh
                onClick={handleElementClick}
              >
                  <planeGeometry args={[width - 2, height - 2]} />
                  <meshStandardMaterial 
                    color={baseColor} 
                    toneMapped={false}
                    metalness={materialProps.metalness}
                    roughness={materialProps.roughness}
                />
              </mesh>
              {/* Handle */}
              <mesh position={[width > 24 ? width * 0.25 : width * 0.35, height * 0.3, 0.5]}>
                  <cylinderGeometry args={[0.5, 0.5, 3, 8]} />
                  <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Second handle for wide cabinets */}
              {width > 24 && (
                  <mesh position={[-width * 0.25, height * 0.3, 0.5]}>
                      <cylinderGeometry args={[0.5, 0.5, 3, 8]} />
                      <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
                  </mesh>
              )}
          </group>
        )}
        
      {/* Wireframe for definition */}
      {!isCorner && !housing && (
        <lineSegments position={[0, height / 2, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
            <lineBasicMaterial color="#000" transparent opacity={0.1} />
        </lineSegments>
      )}

      {/* Debug Selection Indicator */}
      {isSelected && (
        <mesh position={[0, height + 5, 0]}>
            <sphereGeometry args={[2]} />
            <meshBasicMaterial color="#4a90e2" />
        </mesh>
      )}
    </group>

    {interactive && isSelected && elementObj && (
        <TransformControls
          object={elementObj}
          size={1}
          mode={transformMode}
          rotationSnap={Math.PI / 12} // 15 degrees snap
          showX={transformMode === 'translate'}
          showZ={transformMode === 'translate'}
          showY={transformMode === 'rotate'} // Only allow Y-axis rotation
          onDraggingChanged={(isDragging) => {
             if (orbitControlsRef && orbitControlsRef.current) {
                 orbitControlsRef.current.enabled = !isDragging;
             }
          }}
          onChange={(e) => {
             const object = e?.target?.object || elementObj;
             if (!object || !roomWidth || !roomDepth) return;

             // Calculate effective width/depth based on rotation
             const rotation = object.rotation.y;
             const absCos = Math.abs(Math.cos(rotation));
             const absSin = Math.abs(Math.sin(rotation));
             
             const currentWidth = width * absCos + depth * absSin;
             const currentDepth = width * absSin + depth * absCos;
             
             // Add a small buffer to prevent z-fighting with walls
             const buffer = 0.5;
             
             const minX = currentWidth / 2 + buffer;
             const maxX = roomWidth - currentWidth / 2 - buffer;
             const minZ = currentDepth / 2 + buffer;
             const maxZ = roomDepth - currentDepth / 2 - buffer;
             
             // Clamp position
             // Check if room is too small for object, if so, center it or clamp to min
             if (minX > maxX) {
                 object.position.x = roomWidth / 2;
             } else {
                 if (object.position.x < minX) object.position.x = minX;
                 if (object.position.x > maxX) object.position.x = maxX;
             }

             if (minZ > maxZ) {
                 object.position.z = roomDepth / 2;
             } else {
                 if (object.position.z < minZ) object.position.z = minZ;
                 if (object.position.z > maxZ) object.position.z = maxZ;
             }

             // Real-time update for UI
             if (onTransformChange) {
                onTransformChange(element.id, {
                    rotation: normalizeRotation(-yawFromQuaternion(object.quaternion) * (180 / Math.PI)),
                    mountHeight: object.position.y
                });
             }
          }}
          onMouseUp={(e) => {
             // Only trigger update on mouse up to avoid excessive state updates
             if (onUpdate && elementObj) {
                const object = elementObj;
                
                // The group stands at the footprint centre (inches); the plan
                // stores the footprint top-left (px), which moves with a turn
                const center = [object.position.x, object.position.z];
                if (transformMode === 'translate') {
                    onUpdate(element.id, topLeftFromCenter(element, center, element.rotation, scale));
                } else if (transformMode === 'rotate') {
                    // rotation.y = -degrees in radians; read the heading from
                    // the quaternion (rotation.y alone is wrong past +-90)
                    const rotation = normalizeRotation(Math.round(-yawFromQuaternion(object.quaternion) * (180 / Math.PI)));
                    onUpdate(element.id, { rotation, ...topLeftFromCenter(element, center, rotation, scale) });
                }
             }
          }}
        />
      )}
    </>
  );
};

// Professional wood floor with plank pattern
const RoomFloor = ({ width, depth }) => {
  // Light oak wood floor color
  const woodFloorColor = '#c8a27a';
  const groutColor = '#9a7b5c';
  const plankWidth = 6; // 6 inch wide planks
  const plankLength = 48; // 4 foot planks
  
  const planks = useMemo(() => {
    const p = [];
    for (let x = 0; x < width; x += plankWidth) {
      for (let y = 0; y < depth; y += plankLength) {
        // Offset every other row for staggered pattern
        const xOffset = Math.floor(y / plankLength) % 2 === 0 ? 0 : plankWidth / 2;
        const actualX = x + xOffset;
        if (actualX < width) {
          const pw = Math.min(plankWidth, width - actualX);
          const pl = Math.min(plankLength, depth - y);
          // Slight color variation for realism
          const colorVariation = (Math.random() * 0.1 - 0.05);
          p.push({ x: actualX + pw/2, y: y + pl/2, w: pw - 0.2, l: pl - 0.2, colorVar: colorVariation });
        }
      }
    }
    return p;
  }, [width, depth]);

  return (
    <group>
      {/* Base floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.1, depth / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={groutColor} />
      </mesh>
      {/* Wood planks */}
      {planks.map((plank, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[plank.x, 0, plank.y]} receiveShadow>
          <planeGeometry args={[plank.w, plank.l]} />
          <meshStandardMaterial 
            color={woodFloorColor} 
            roughness={0.6 + plank.colorVar} 
            metalness={0.02}
          />
        </mesh>
      ))}
    </group>
  );
};

const Door3D = ({ door, width, depth, height, scale, activeWalls, customWalls }) => {
  const doorWidthInches = door.width || 32;
  const doorHeightInches = 80; // Standard door height
  const wallThickness = 4;
  const doorThickness = 2; // Slightly thicker for visibility

  // Check if this door's wall is active
  if (!activeWalls.includes(door.wallNumber)) return null;

  // More visible door colors based on type
  const doorColors = {
    standard: { main: '#8B6914', light: '#A67C00', dark: '#5C4A0F' },
    pantry: { main: '#5D4037', light: '#8D6E63', dark: '#3E2723' },
    room: { main: '#2E7D32', light: '#4CAF50', dark: '#1B5E20' },
    double: { main: '#1565C0', light: '#42A5F5', dark: '#0D47A1' },
    sliding: { main: '#455A64', light: '#78909C', dark: '#263238' }
  };
  
  const colors = doorColors[door.type] || doorColors.standard;

  // Cased opening (a pantry's doorway): casing on both faces, no leaf
  const isCased = door.type === 'cased-opening';
  const renderCasedOpening = (thickness) => (
    <>
      {[1, -1].map((face) => (
        <group key={face} position={[0, 0, face * (thickness / 2 + 0.5)]}>
          <mesh position={[0, doorHeightInches / 2 + 2, 0]} castShadow>
            <boxGeometry args={[doorWidthInches + 6, 4, 1]} />
            <meshStandardMaterial color="#f5f5f0" roughness={0.5} />
          </mesh>
          <mesh position={[-doorWidthInches / 2 - 2, 0, 0]} castShadow>
            <boxGeometry args={[4, doorHeightInches + 4, 1]} />
            <meshStandardMaterial color="#f5f5f0" roughness={0.5} />
          </mesh>
          <mesh position={[doorWidthInches / 2 + 2, 0, 0]} castShadow>
            <boxGeometry args={[4, doorHeightInches + 4, 1]} />
            <meshStandardMaterial color="#f5f5f0" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </>
  );

  // Render detailed door with panels, frame, and hardware
  const renderDoorDetails = () => (
    <>
      {/* Door frame/casing around the opening */}
      <group position={[0, 0, -doorThickness / 2 - 0.5]}>
        {/* Top casing */}
        <mesh position={[0, doorHeightInches / 2 + 2, 0]} castShadow>
          <boxGeometry args={[doorWidthInches + 6, 4, 1]} />
          <meshStandardMaterial color="#f5f5f0" roughness={0.5} />
        </mesh>
        {/* Left casing */}
        <mesh position={[-doorWidthInches / 2 - 2, 0, 0]} castShadow>
          <boxGeometry args={[4, doorHeightInches + 4, 1]} />
          <meshStandardMaterial color="#f5f5f0" roughness={0.5} />
        </mesh>
        {/* Right casing */}
        <mesh position={[doorWidthInches / 2 + 2, 0, 0]} castShadow>
          <boxGeometry args={[4, doorHeightInches + 4, 1]} />
          <meshStandardMaterial color="#f5f5f0" roughness={0.5} />
        </mesh>
      </group>

      {/* Main door panel */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[doorWidthInches, doorHeightInches, doorThickness]} />
        <meshStandardMaterial color={colors.main} roughness={0.5} metalness={0.05} />
      </mesh>

      {/* Door panel details (raised panels) */}
      <group position={[0, 0, doorThickness / 2 + 0.1]}>
        {/* Upper panel - recessed */}
        <mesh position={[0, doorHeightInches / 4 + 2, 0]}>
          <boxGeometry args={[doorWidthInches - 8, doorHeightInches / 2 - 12, 0.5]} />
          <meshStandardMaterial color={colors.dark} roughness={0.6} />
        </mesh>
        {/* Upper panel - raised center */}
        <mesh position={[0, doorHeightInches / 4 + 2, 0.3]}>
          <boxGeometry args={[doorWidthInches - 12, doorHeightInches / 2 - 16, 0.3]} />
          <meshStandardMaterial color={colors.light} roughness={0.4} />
        </mesh>
        
        {/* Lower panel - recessed */}
        <mesh position={[0, -doorHeightInches / 4 - 2, 0]}>
          <boxGeometry args={[doorWidthInches - 8, doorHeightInches / 2 - 12, 0.5]} />
          <meshStandardMaterial color={colors.dark} roughness={0.6} />
        </mesh>
        {/* Lower panel - raised center */}
        <mesh position={[0, -doorHeightInches / 4 - 2, 0.3]}>
          <boxGeometry args={[doorWidthInches - 12, doorHeightInches / 2 - 16, 0.3]} />
          <meshStandardMaterial color={colors.light} roughness={0.4} />
        </mesh>
      </group>

      {/* Door handle assembly - larger and more visible */}
      <group position={[doorWidthInches * 0.35, 0, doorThickness / 2]}>
        {/* Handle backplate */}
        <mesh position={[0, 0, 0.3]}>
          <boxGeometry args={[2.5, 8, 0.3]} />
          <meshStandardMaterial color="#C0C0C0" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Handle lever */}
        <mesh position={[0, 2, 1.5]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.5, 5, 8, 16]} />
          <meshStandardMaterial color="#B8860B" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Lock/deadbolt */}
        <mesh position={[0, -3, 0.8]}>
          <cylinderGeometry args={[0.8, 0.8, 0.6, 16]} />
          <meshStandardMaterial color="#4A4A4A" roughness={0.3} metalness={0.7} />
        </mesh>
      </group>

      {/* Hinges (3 hinges on opposite side) - larger */}
      {[0.8, 0, -0.8].map((yOffset, i) => (
        <group key={i} position={[-doorWidthInches / 2 + 0.5, doorHeightInches * yOffset / 2, doorThickness / 2]}>
          <mesh>
            <boxGeometry args={[2, 4, 0.8]} />
            <meshStandardMaterial color="#4A4A4A" roughness={0.4} metalness={0.8} />
          </mesh>
        </group>
      ))}
      
      {/* Door type label - floating text above door */}
      {door.type && door.type !== 'standard' && (
        <mesh position={[0, doorHeightInches / 2 + 8, 2]}>
          <planeGeometry args={[20, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
      )}
    </>
  );

  // For standard walls (1-4)
  if (door.wallNumber <= 4) {
    const position = door.position / 100; // Convert percentage to 0-1
    let doorPosition, doorRotation;

    switch (door.wallNumber) {
      case 1: // Top wall - at z = -wallThickness/2
        doorPosition = [width * position, doorHeightInches / 2, -wallThickness / 2];
        doorRotation = [0, 0, 0];
        break;
      case 2: // Right wall - at x = width + wallThickness/2
        doorPosition = [width + wallThickness / 2, doorHeightInches / 2, depth * position];
        doorRotation = [0, Math.PI / 2, 0];
        break;
      case 3: // Bottom wall - at z = depth + wallThickness/2
        doorPosition = [width * position, doorHeightInches / 2, depth + wallThickness / 2];
        doorRotation = [0, Math.PI, 0];
        break;
      case 4: // Left wall - at x = -wallThickness/2
        doorPosition = [-wallThickness / 2, doorHeightInches / 2, depth * position];
        doorRotation = [0, -Math.PI / 2, 0];
        break;
      default:
        return null;
    }

    return (
      <group position={doorPosition} rotation={doorRotation}>
        {isCased ? renderCasedOpening(wallThickness) : renderDoorDetails()}
      </group>
    );
  } else {
    // Custom wall door
    const customWall = customWalls.find(w => w.wallNumber === door.wallNumber);
    if (!customWall) return null;

    // Convert pixel coordinates to inches
    const x1Inches = customWall.x1 / scale;
    const y1Inches = customWall.y1 / scale;
    const x2Inches = customWall.x2 / scale;
    const y2Inches = customWall.y2 / scale;

    const wallLength = Math.sqrt(
      Math.pow(x2Inches - x1Inches, 2) + Math.pow(y2Inches - y1Inches, 2)
    );
    const wallAngle = Math.atan2(y2Inches - y1Inches, x2Inches - x1Inches);

    const position = door.position / 100;
    const doorPosAlongWall = position * wallLength;

    const doorX = x1Inches + Math.cos(wallAngle) * doorPosAlongWall;
    const doorY = y1Inches + Math.sin(wallAngle) * doorPosAlongWall;

    return (
      <group position={[doorX, doorHeightInches / 2, doorY]} rotation={[0, -wallAngle, 0]}>
        {isCased ? renderCasedOpening(customWall.thickness || wallThickness) : renderDoorDetails()}
      </group>
    );
  }
};

// Helper to render wall with door opening
const WallWithDoorOpening = ({
  wallNumber,
  wallPosition,
  wallSize,
  wallRotation,
  doors,
  wallThickness,
  wallHeight,
  wallColor
}) => {
  const doorsOnWall = doors.filter(d => d.wallNumber === wallNumber);

  // If no doors, render solid wall
  if (doorsOnWall.length === 0) {
    return (
      <mesh position={wallPosition} receiveShadow castShadow>
        <boxGeometry args={wallSize} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
    );
  }

  // For walls with doors, split into segments
  const door = doorsOnWall[0]; // Handle first door for now
  const doorWidthInches = door.width || 32;
  const doorHeightInches = 80;
  const doorPosition = door.position / 100; // Convert to 0-1
  const wallLength = wallRotation[1] === 0 ? wallSize[0] : wallSize[2]; // width or depth
  const frameWidth = 4; // Door frame trim width

  // Calculate door center position along wall
  const doorCenter = doorPosition * wallLength;
  const doorHalfWidth = doorWidthInches / 2;

  // Left/bottom segment
  const leftSegmentWidth = doorCenter - doorHalfWidth - frameWidth;
  // Right/top segment
  const rightSegmentWidth = wallLength - doorCenter - doorHalfWidth - frameWidth;

  return (
    <group>
      {/* Left/Bottom wall segment */}
      {leftSegmentWidth > 0 && (
        <mesh
          position={
            wallRotation[1] === 0
              ? [wallPosition[0] - wallLength / 2 + leftSegmentWidth / 2, wallPosition[1], wallPosition[2]]
              : [wallPosition[0], wallPosition[1], wallPosition[2] - wallLength / 2 + leftSegmentWidth / 2]
          }
          receiveShadow
          castShadow
        >
          <boxGeometry args={
            wallRotation[1] === 0
              ? [leftSegmentWidth, wallHeight, wallThickness]
              : [wallThickness, wallHeight, leftSegmentWidth]
          } />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {/* Top header above door */}
      <mesh
        position={
          wallRotation[1] === 0
            ? [wallPosition[0] - wallLength / 2 + doorCenter, doorHeightInches + (wallHeight - doorHeightInches) / 2, wallPosition[2]]
            : [wallPosition[0], doorHeightInches + (wallHeight - doorHeightInches) / 2, wallPosition[2] - wallLength / 2 + doorCenter]
        }
        receiveShadow
        castShadow
      >
        <boxGeometry args={
          wallRotation[1] === 0
            ? [doorWidthInches + frameWidth * 2, wallHeight - doorHeightInches, wallThickness]
            : [wallThickness, wallHeight - doorHeightInches, doorWidthInches + frameWidth * 2]
        } />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Right/Top wall segment */}
      {rightSegmentWidth > 0 && (
        <mesh
          position={
            wallRotation[1] === 0
              ? [wallPosition[0] + wallLength / 2 - rightSegmentWidth / 2, wallPosition[1], wallPosition[2]]
              : [wallPosition[0], wallPosition[1], wallPosition[2] + wallLength / 2 - rightSegmentWidth / 2]
          }
          receiveShadow
          castShadow
        >
          <boxGeometry args={
            wallRotation[1] === 0
              ? [rightSegmentWidth, wallHeight, wallThickness]
              : [wallThickness, wallHeight, rightSegmentWidth]
          } />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {/* Door Frame / Trim around opening */}
      <group>
        {/* Left jamb */}
        <mesh
          position={
            wallRotation[1] === 0
              ? [wallPosition[0] - wallLength / 2 + doorCenter - doorHalfWidth - frameWidth / 2, doorHeightInches / 2, wallPosition[2]]
              : [wallPosition[0], doorHeightInches / 2, wallPosition[2] - wallLength / 2 + doorCenter - doorHalfWidth - frameWidth / 2]
          }
          receiveShadow
          castShadow
        >
          <boxGeometry args={
            wallRotation[1] === 0
              ? [frameWidth, doorHeightInches, wallThickness + 2]
              : [wallThickness + 2, doorHeightInches, frameWidth]
          } />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>

        {/* Right jamb */}
        <mesh
          position={
            wallRotation[1] === 0
              ? [wallPosition[0] - wallLength / 2 + doorCenter + doorHalfWidth + frameWidth / 2, doorHeightInches / 2, wallPosition[2]]
              : [wallPosition[0], doorHeightInches / 2, wallPosition[2] - wallLength / 2 + doorCenter + doorHalfWidth + frameWidth / 2]
          }
          receiveShadow
          castShadow
        >
          <boxGeometry args={
            wallRotation[1] === 0
              ? [frameWidth, doorHeightInches, wallThickness + 2]
              : [wallThickness + 2, doorHeightInches, frameWidth]
          } />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>

        {/* Top header trim */}
        <mesh
          position={
            wallRotation[1] === 0
              ? [wallPosition[0] - wallLength / 2 + doorCenter, doorHeightInches + frameWidth / 2, wallPosition[2]]
              : [wallPosition[0], doorHeightInches + frameWidth / 2, wallPosition[2] - wallLength / 2 + doorCenter]
          }
          receiveShadow
          castShadow
        >
          <boxGeometry args={
            wallRotation[1] === 0
              ? [doorWidthInches + frameWidth * 2, frameWidth, wallThickness + 2]
              : [wallThickness + 2, frameWidth, doorWidthInches + frameWidth * 2]
          } />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      </group>
    </group>
  );
};

const RoomWalls = ({ width, depth, height, roomData, scale = 1 }) => {
  const wallThickness = 4; // 4 inches thick walls
  // Soft sage/green-gray wall color - contrasts nicely with white cabinets
  const wallColor = "#b8c4b8";
  const wallHeight = height || 96; // Default 8ft walls

  const activeWalls = roomData?.walls || [1, 2, 3, 4];
  const customWalls = roomData?.customWalls || [];
  const doors = roomData?.doors || [];

  return (
    <group>
      {/* Standard Walls - only render if in activeWalls array */}
      {/* Wall 1 (Top/Back) - spans width */}
      {activeWalls.includes(1) && (
        <WallWithDoorOpening
          wallNumber={1}
          wallPosition={[width / 2, wallHeight / 2, -wallThickness / 2]}
          wallSize={[width + wallThickness * 2, wallHeight, wallThickness]}
          wallRotation={[0, 0, 0]}
          doors={doors}
          wallThickness={wallThickness}
          wallHeight={wallHeight}
          wallColor={wallColor}
        />
      )}

      {/* Wall 2 (Right) - spans depth */}
      {activeWalls.includes(2) && (
        <WallWithDoorOpening
          wallNumber={2}
          wallPosition={[width + wallThickness / 2, wallHeight / 2, depth / 2]}
          wallSize={[wallThickness, wallHeight, depth]}
          wallRotation={[0, Math.PI / 2, 0]}
          doors={doors}
          wallThickness={wallThickness}
          wallHeight={wallHeight}
          wallColor={wallColor}
        />
      )}

      {/* Wall 3 (Bottom/Front) - spans width */}
      {activeWalls.includes(3) && (
        <WallWithDoorOpening
          wallNumber={3}
          wallPosition={[width / 2, wallHeight / 2, depth + wallThickness / 2]}
          wallSize={[width + wallThickness * 2, wallHeight, wallThickness]}
          wallRotation={[0, 0, 0]}
          doors={doors}
          wallThickness={wallThickness}
          wallHeight={wallHeight}
          wallColor={wallColor}
        />
      )}

      {/* Wall 4 (Left) - spans depth */}
      {activeWalls.includes(4) && (
        <WallWithDoorOpening
          wallNumber={4}
          wallPosition={[-wallThickness / 2, wallHeight / 2, depth / 2]}
          wallSize={[wallThickness, wallHeight, depth]}
          wallRotation={[0, Math.PI / 2, 0]}
          doors={doors}
          wallThickness={wallThickness}
          wallHeight={wallHeight}
          wallColor={wallColor}
        />
      )}
      
      {/* Custom Walls */}
      {customWalls.map((wall) => {
        if (!activeWalls.includes(wall.wallNumber)) return null;
        
        // Convert pixel coordinates to inches
        const x1Inches = wall.x1 / scale;
        const y1Inches = wall.y1 / scale;
        const x2Inches = wall.x2 / scale;
        const y2Inches = wall.y2 / scale;
        
        // Calculate wall length and angle in inches
        const wallLength = Math.sqrt(
          Math.pow(x2Inches - x1Inches, 2) + Math.pow(y2Inches - y1Inches, 2)
        );
        const wallAngle = Math.atan2(y2Inches - y1Inches, x2Inches - x1Inches);
        
        // Center position in inches
        const centerX = (x1Inches + x2Inches) / 2;
        const centerY = (y1Inches + y2Inches) / 2;
        
        // Check if this custom wall has any doors
        const doorsOnWall = doors.filter(d => d.wallNumber === wall.wallNumber);
        
        if (doorsOnWall.length === 0) {
          // No doors - render solid wall
          return (
            <mesh 
              key={wall.id || wall.wallNumber}
              position={[centerX, wallHeight / 2, centerY]}
              rotation={[0, -wallAngle, 0]}
              receiveShadow 
              castShadow
            >
              <boxGeometry args={[wallLength, wallHeight, wall.thickness || wallThickness]} />
              <meshStandardMaterial color={wallColor} />
            </mesh>
          );
        }
        
        // Wall has door(s) - render with opening
        const door = doorsOnWall[0]; // Handle first door
        const doorWidthInches = door.width || 32;
        const doorHeightInches = 80;
        const doorPosition = door.position / 100; // 0-1
        const frameWidth = 4;
        
        // Calculate door center position along wall
        const doorCenter = doorPosition * wallLength;
        const doorHalfWidth = doorWidthInches / 2;
        
        // Left segment
        const leftSegmentLength = doorCenter - doorHalfWidth - frameWidth;
        // Right segment  
        const rightSegmentLength = wallLength - doorCenter - doorHalfWidth - frameWidth;
        
        // Calculate positions for each segment along the wall direction
        const leftSegmentCenter = leftSegmentLength / 2;
        const rightSegmentCenter = wallLength - rightSegmentLength / 2;
        
        return (
          <group key={wall.id || wall.wallNumber}>
            {/* Left wall segment */}
            {leftSegmentLength > 0 && (
              <mesh
                position={[
                  x1Inches + Math.cos(wallAngle) * leftSegmentCenter,
                  wallHeight / 2,
                  y1Inches + Math.sin(wallAngle) * leftSegmentCenter
                ]}
                rotation={[0, -wallAngle, 0]}
                receiveShadow
                castShadow
              >
                <boxGeometry args={[leftSegmentLength, wallHeight, wall.thickness || wallThickness]} />
                <meshStandardMaterial color={wallColor} />
              </mesh>
            )}
            
            {/* Header above door */}
            <mesh
              position={[
                x1Inches + Math.cos(wallAngle) * doorCenter,
                doorHeightInches + (wallHeight - doorHeightInches) / 2,
                y1Inches + Math.sin(wallAngle) * doorCenter
              ]}
              rotation={[0, -wallAngle, 0]}
              receiveShadow
              castShadow
            >
              <boxGeometry args={[doorWidthInches + frameWidth * 2, wallHeight - doorHeightInches, wall.thickness || wallThickness]} />
              <meshStandardMaterial color={wallColor} />
            </mesh>
            
            {/* Right wall segment */}
            {rightSegmentLength > 0 && (
              <mesh
                position={[
                  x1Inches + Math.cos(wallAngle) * rightSegmentCenter,
                  wallHeight / 2,
                  y1Inches + Math.sin(wallAngle) * rightSegmentCenter
                ]}
                rotation={[0, -wallAngle, 0]}
                receiveShadow
                castShadow
              >
                <boxGeometry args={[rightSegmentLength, wallHeight, wall.thickness || wallThickness]} />
                <meshStandardMaterial color={wallColor} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
};

const DesignEditor3D = ({ 
  roomData, 
  elementTypes, 
  scale = 1, 
  interactive = false, 
  selectedElement: parentSelectedElement,
  setSelectedElement: parentSetSelectedElement,
  onUpdateElement,
  onTransformChange,
  cameraRef  // New prop for external camera control
}) => {
  const [transformMode, setTransformMode] = React.useState('translate'); // 'translate' | 'rotate'

  // Use parent's selected element if provided, otherwise use internal state
  const [internalSelectedId, setInternalSelectedId] = React.useState(null);
  const selectedId = parentSelectedElement !== undefined ? parentSelectedElement : internalSelectedId;
  const setSelectedId = parentSetSelectedElement || setInternalSelectedId;
  
  const orbitControlsRef = useRef();
  const internalCameraRef = useRef();
  // where the items are when the view opens (the opening shot looks at them)
  const [focus] = useState(() => layoutFocus(roomData?.elements, scale));

  if (!roomData) return null;

  const widthInches = parseFloat(roomData.dimensions.width) * 12;
  const depthInches = parseFloat(roomData.dimensions.height) * 12;
  // partitions (a pantry): the opening corner avoids them and the camera
  // stays out of their thickness (this view does not fade them; the engine
  // view does)
  const partitions = interiorWalls(roomData, { scale });
  const spaces = enclosedSpaces(roomData, { walls: partitions });
  // the camera opens inside the room and orbit/zoom/pan stop at the walls
  const view = cameraSetup(
    { width: widthInches, depth: depthInches, ceiling: parseFloat(roomData.dimensions.wallHeight || 96) },
    { unit: 1, focus, walls: partitions, spaces }
  );
  const keepInside = (e) => {
    const controls = e?.target;
    if (!controls) return;
    for (const v of [controls.object.position, controls.target]) {
      const now = v.toArray();
      const inside = clampInside(now, view.bounds);
      if (inside !== now) v.fromArray(inside);
    }
    if (partitions.length) {
      const p = controls.object.position;
      const plan = [p.x, p.z];
      const out = pushOutOfWalls(plan, partitions, { height: p.y });
      if (out !== plan) {
        p.x = out[0];
        p.z = out[1];
      }
    }
  };

  return (
    <div className="w-full h-full bg-gray-100 relative" data-designer3d="classic">
      <Canvas
        shadows
        dpr={[1, STUDIO_DPR]}
        camera={{ position: view.position, fov: view.fov, near: view.near, far: view.far }}
        onPointerMissed={() => interactive && setSelectedId(null)}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, preserveDrawingBuffer: true }}
      >
        {/* Light blue-gray sky background - contrasts with sage walls and white cabinets */}
        <color attach="background" args={['#e0e8ef']} />
        <fog attach="fog" args={['#e0e8ef', widthInches * 2, widthInches * 4]} />
        
        <OrbitControls 
          ref={orbitControlsRef}
          target={view.target}
          maxPolarAngle={Math.PI / 2} // Prevent going below floor
          minDistance={view.minDistance}
          maxDistance={view.maxDistance}
          onChange={keepInside}
          enabled={true} // Controlled by TransformControls
          makeDefault
        />
        
        {/* Camera controller for programmatic camera positioning */}
        <CameraController 
          ref={cameraRef || internalCameraRef} 
          orbitControlsRef={orbitControlsRef}
          widthInches={widthInches}
          depthInches={depthInches}
        />
        
        {/* Professional lighting setup */}
        <ambientLight intensity={0.5} color="#fff5eb" />
        
        {/* Main key light - warm sunlight from window */}
        <directionalLight 
          position={[widthInches * 0.8, 150, depthInches * 0.3]} 
          intensity={1.2} 
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={300}
          shadow-camera-left={-widthInches}
          shadow-camera-right={widthInches}
          shadow-camera-top={depthInches}
          shadow-camera-bottom={-depthInches}
          color="#fffaf0"
        />
        
        {/* Fill light from opposite side */}
        <directionalLight 
          position={[-widthInches * 0.5, 80, depthInches * 0.8]} 
          intensity={0.4}
          color="#e8f0ff"
        />
        
        {/* Soft overhead light */}
        <pointLight 
          position={[widthInches / 2, 90, depthInches / 2]} 
          intensity={0.3}
          color="#fffaf0"
        />
        
        {/* Under-cabinet accent lights */}
        <pointLight 
          position={[widthInches * 0.3, 36, 12]} 
          intensity={0.15}
          color="#fff8dc"
          distance={40}
        />
        <pointLight 
          position={[widthInches * 0.7, 36, 12]} 
          intensity={0.15}
          color="#fff8dc"
          distance={40}
        />
        
        <group>
            {/* Floor */}
            <RoomFloor width={widthInches} depth={depthInches} />
            
            {/* Walls */}
            <RoomWalls width={widthInches} depth={depthInches} height={parseFloat(roomData.dimensions.wallHeight || 96)} roomData={roomData} scale={scale} />
            
            {/* Doors */}
            {(roomData.doors || []).map((door, index) => (
              <Door3D
                key={door.id || index}
                door={door}
                width={widthInches}
                depth={depthInches}
                height={parseFloat(roomData.dimensions.wallHeight || 96)}
                scale={scale}
                activeWalls={roomData.walls || [1, 2, 3, 4]}
                customWalls={roomData.customWalls || []}
              />
            ))}
            
            {/* Subtle grid - less visible */}
            <gridHelper 
                args={[Math.max(widthInches, depthInches) * 2, 40, 0xdddddd, 0xeeeeee]} 
                position={[widthInches / 2, 0.05, depthInches / 2]} 
            />

            {/* Elements */}
            
            {roomData.elements.map((element) => (
            <Element3D 
                key={element.id} 
                element={element} 
                elementTypes={elementTypes}
                scale={scale}
                interactive={interactive}
                isSelected={selectedId === element.id}
                onSelect={setSelectedId}
                onUpdate={onUpdateElement}
                transformMode={transformMode}
                orbitControlsRef={orbitControlsRef}
                roomWidth={widthInches}
                roomDepth={depthInches}
                onTransformChange={onTransformChange}
            />
            ))}
        </group>
        {/* free the WebGL context as soon as the view closes */}
        <ContextRelease />
      </Canvas>
      
      {/* Controls UI */}

      <div className="absolute bottom-4 right-4 flex flex-col gap-2 items-end pointer-events-none">
        {interactive && selectedId && (
            <div className="bg-white/90 backdrop-blur shadow-lg rounded-lg p-2 pointer-events-auto flex gap-2">
                <button 
                    onClick={() => setTransformMode('translate')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${transformMode === 'translate' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                    Move
                </button>
                <button 
                    onClick={() => setTransformMode('rotate')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${transformMode === 'rotate' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                    Rotate
                </button>
            </div>
        )}
        <div className="bg-white/80 backdrop-blur px-3 py-1 rounded text-xs text-gray-600">
            Left Click: Rotate • Right Click: Pan • Scroll: Zoom {interactive && "• Click Object to Edit"}
        </div>
      </div>
    </div>
  );
};

export default DesignEditor3D;