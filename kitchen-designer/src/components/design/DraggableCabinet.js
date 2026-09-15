import React from 'react';
import { getMaterialById } from '../../constants/materials';
import { getElementName } from './elementName';
import { useLanguage } from '../../contexts/LanguageContext';

const DraggableCabinet = React.memo(({
  element,
  scale,
  isSelected,
  isDragging,
  selectedElement,
  dragPreviewPosition,
  onMouseDown,
  onKeyDown,
  ariaLabel,
  describedBy,
  elementTypes,
  renderCornerCabinet,
  renderDoorGraphic,
  currentRoomData
}) => {
  const { t } = useLanguage();
  const elementSpec = elementTypes[element.type];

  // Skip rendering if elementSpec is missing
  if (!elementSpec) {
    console.warn('Skipping rendering for invalid element type:', element.type);
    return null;
  }

  // Get material color if set, otherwise use default
  const materialData = element.materialId ? getMaterialById(element.materialId) : null;
  const materialColor = materialData ? materialData.hex : null;

  // Keyboard access (WCAG 2.1.1): only when the page wires up a key handler
  const keyboardProps = onKeyDown ? {
    tabIndex: 0,
    role: 'button',
    'aria-pressed': isSelected,
    'aria-label': ariaLabel,
    'aria-describedby': describedBy,
    className: 'kd-el',
    onKeyDown: (e) => onKeyDown(e, element.id)
  } : {};

  // Special Rendering for Corner Cabinets
  if (element.type === 'corner' || element.type === 'corner-wall') {
    return (
      <g
        key={element.id}
        data-element-id={element.id}
        transform={`translate(${element.x}, ${element.y})`}
        style={{
          cursor: isDragging && element.id === selectedElement ? 'grabbing' : 'grab'
        }}
        {...keyboardProps}
      >
        {/* Render the corner cabinet with built-in door graphics */}
        {renderCornerCabinet(element)}

        {/* Add single door swing arc for corner cabinet */}
        {element.hingeDirection === 'left' ? (
          // Left-hinged corner cabinet - arc from inner corner outward
          renderDoorGraphic(
            element.width * scale * 0.6, 
            element.depth * scale * 0, 
            element.width * scale * 0.9, 
            element.depth * scale * 0.6, 
            0
          )
        ) : (
          // Right-hinged corner cabinet - arc from inner corner outward  
          renderDoorGraphic(
            element.width * scale * -0.1,
            element.depth * scale * 0.6,
            element.width * scale * 0.9,
            element.depth * scale * 0.5,
            90
          )
        )}

        {/* Corner cabinet number badge */}
        <circle
          cx={(element.width * scale) / 2}
          cy={(element.depth * scale) / 2}
          r="12"
          fill="white"
          stroke="#333"
          strokeWidth="1"
        />
        <text
          x={(element.width * scale) / 2}
          y={(element.depth * scale) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fill="#333"
          fontWeight="bold"
        >
          {currentRoomData.elements.indexOf(element) + 1}
        </text>

        {onKeyDown && (
          <rect
            className="kd-focus-ring"
            x={-4}
            y={-4}
            width={element.width * scale + 8}
            height={element.width * scale + 8}
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="3"
            rx="3"
            opacity="0"
            pointerEvents="none"
          />
        )}
      </g>
    );
  }

  // Standard Element Rendering
  const displayWidth = element.rotation % 180 === 0 ? element.width * scale : element.depth * scale;
  const displayDepth = element.rotation % 180 === 0 ? element.depth * scale : element.width * scale;

  // Visual styling based on element category - use material color if available
  const fillColor = materialColor || (element.category === 'appliance' ? '#e0e0e0' : '#d3d3d3');
  const strokeColor = '#333'; // Consistent stroke color regardless of selection

  return (
    <g 
      key={element.id}
      data-element-id={element.id}
      transform={element.rotation !== 0 
        ? `translate(${element.x + displayWidth / 2}, ${element.y + displayDepth / 2}) rotate(${element.rotation}) translate(${-displayWidth / 2}, ${-displayDepth / 2})`
        : `translate(${element.x}, ${element.y})`}
      style={{
        cursor: isDragging && element.id === selectedElement ? 'grabbing' : 'grab'
      }}
      {...keyboardProps}
    >

      {/* Main Element Body */}
      <rect
        x={(element.type === 'medicine' || element.type === 'medicine-mirror') 
          ? (() => {
              if (element.type === 'medicine-mirror') {
                switch (element.rotation) {
                  case 0: return 0;
                  case 90: return 0;
                  case 180: return 0;
                  case 270: return -40;
                  case -90: return -40;
                  default: return 0;
                }
              }
              return 0;
            })()
          : 0}
        y={(element.type === 'medicine' || element.type === 'medicine-mirror') 
          ? (() => {
              if (element.type === 'medicine-mirror') {
                switch (element.rotation) {
                  case 0: return 0;
                  case 90: return 30;
                  case 180: return 0;
                  case 270: return 28;
                  case -90: return 28;
                  default: return 0;
                }
              }
              return 0;
            })()
          : 0}
        width={element.width * scale}
        height={element.depth * scale}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isSelected ? '2' : '1'}
        style={{
          cursor: isDragging && element.id === selectedElement
            ? (dragPreviewPosition?.snapped ? 'copy' : 'grabbing')
            : 'grab',
          opacity: isDragging && element.id === selectedElement ? 0.7 : 1,
          transition: isDragging ? 'none' : 'opacity 0.2s ease',
          filter: isDragging && element.id === selectedElement
            ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
            : 'none',
          touchAction: 'none'
        }}
        onMouseDown={(e) => onMouseDown(e, element.id)}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onMouseDown(e, element.id);
        }}
      />

      {/* Wood Grain Texture Overlay for Cabinets */}
      {element.category === 'cabinet' && (
        <rect
          x={(element.type === 'medicine' || element.type === 'medicine-mirror') 
            ? (() => {
                if (element.type === 'medicine-mirror') {
                  switch (element.rotation) {
                    case 0: return 0;
                    case 90: return 0;
                    case 180: return 0;
                    case 270: return -40;
                    case -90: return -40;
                    default: return 0;
                  }
                }
                return 0;
              })()
            : 0}
          y={(element.type === 'medicine' || element.type === 'medicine-mirror') 
            ? (() => {
                if (element.type === 'medicine-mirror') {
                  switch (element.rotation) {
                    case 0: return 0;
                    case 90: return 30;
                    case 180: return 0;
                    case 270: return 28;
                    case -90: return 28;
                    default: return 0;
                  }
                }
                return 0;
              })()
            : 0}
          width={element.width * scale}
          height={element.depth * scale}
          fill="url(#woodGrain)"
          stroke="none"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Special rendering for medicine cabinets to show actual shallow depth */}
      {(element.type === 'medicine' || element.type === 'medicine-mirror') && (
        <>
          {(() => {
            // Shift medicine cabinets based on rotation to sync with wall view positioning
            const getOffsetByRotation = () => {
              if (element.type === 'medicine-mirror') {
                switch (element.rotation) {
                  case 0: return { x: 0, y: 0 };
                  case 90: return { x: 0, y: 30 }; // Move back closer to wall
                  case 180: return { x: 0, y: 0 };
                  case 270: return { x: -40, y: 28 }; // Both x and y offset
                  case -90: return { x: -40, y: 28 }; // Handle negative rotation
                  default: return { x: 0, y: 0 };
                }
              }
              return { x: 0, y: 0 }; // Regular medicine cabinet stays at 0
            };
            const offset = getOffsetByRotation();
            return (
              <>
                {/* Show actual shallow depth with hatched pattern */}
                <rect
                  x={2 + offset.x}
                  y={2 + offset.y}
                  width={element.width * scale - 4}
                  height={Math.max(element.depth * scale - 4, 8)} // Minimum 8px to be visible
                  fill="none"
                  stroke="#999"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                {/* Medicine cabinet icon */}
                <rect
                  x={(element.width * scale) * 0.2 + offset.x}
                  y={2 + offset.y}
                  width={(element.width * scale) * 0.6}
                  height={Math.max(element.depth * scale - 4, 6)}
                  fill="rgba(255,255,255,0.3)"
                  stroke="#666"
                  strokeWidth="0.5"
                />
                {/* Mirror indicator for medicine-mirror - show actual wall-mounted depth */}
                {element.type === 'medicine-mirror' && (
                  <rect
                    x={(element.width * scale) * 0.2 + offset.x}
                    y={1 + offset.y}
                    width={(element.width * scale) * 0.6}
                    height={Math.max(element.depth * scale - 2, 8)}
                    fill="rgba(173,216,230,0.5)"
                    stroke="rgba(100,149,237,0.8)"
                    strokeWidth="1"
                    rx="1"
                  />
                )}
                {/* Depth indicator text for shallow medicine cabinets */}
                <text
                  x={(element.width * scale) / 2 + offset.x}
                  y={element.depth * scale / 2 + offset.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="6"
                  fill="#666"
                  fontWeight="bold"
                >
                  {element.depth}"D
                </text>
              </>
            );
          })()}
        </>
      )}

      {/* Door Indication for Regular Cabinets */}
      {element.category === 'cabinet' &&
        element.type !== 'sink-base' &&
        element.type !== 'vanity-sink' &&
        element.type !== 'open-shelf' &&
        element.type !== 'corner' &&
        element.type !== 'corner-wall' &&
        element.type !== 'medicine' &&
        element.type !== 'medicine-mirror' &&
        renderDoorGraphic(0, 0, element.width * scale, element.depth * scale, 0)}

      {/* Special Sink Cabinet Graphics */}
      {(element.type === 'sink-base' || element.type === 'vanity-sink') && (
        <>
          {/* Outer sink rim */}
          <rect
            x={(element.width * scale) * 0.15}
            y={(element.depth * scale) * 0.15}
            width={(element.width * scale) * 0.7}
            height={(element.depth * scale) * 0.7}
            fill="none"
            stroke="#333"
            strokeWidth="1"
            rx="4"
          />
          {/* Inner sink bowl */}
          <rect
            x={(element.width * scale) * 0.2}
            y={(element.depth * scale) * 0.2}
            width={(element.width * scale) * 0.6}
            height={(element.depth * scale) * 0.6}
            fill="none"
            stroke="#333"
            strokeWidth="0.5"
            rx="2"
          />
          {/* Faucet indicator */}
          <circle
            cx={(element.width * scale) * 0.5}
            cy={(element.depth * scale) * 0.3}
            r="3"
            fill="#333"
          />
        </>
      )}

      {/* Stove/Range Graphics */}
      {element.type === 'stove' && (
        <>
          {/* Four burner circles */}
          <circle cx={(element.width * scale) * 0.25} cy={(element.depth * scale) * 0.25} r="8" fill="none" stroke="#666" strokeWidth="1" />
          <circle cx={(element.width * scale) * 0.75} cy={(element.depth * scale) * 0.25} r="8" fill="none" stroke="#666" strokeWidth="1" />
          <circle cx={(element.width * scale) * 0.25} cy={(element.depth * scale) * 0.75} r="8" fill="none" stroke="#666" strokeWidth="1" />
          <circle cx={(element.width * scale) * 0.75} cy={(element.depth * scale) * 0.75} r="8" fill="none" stroke="#666" strokeWidth="1" />
          
          {/* Central control area */}
          <rect
            x={(element.width * scale) * 0.4}
            y={(element.depth * scale) * 0.4}
            width={(element.width * scale) * 0.2}
            height={(element.depth * scale) * 0.2}
            fill="#999"
            stroke="#333"
            strokeWidth="0.5"
          />
        </>
      )}

      {/* Refrigerator Graphics */}
      {element.type === 'refrigerator' && (
        <>
          {/* Vertical divider line for double door */}
          <line
            x1={(element.width * scale) / 2}
            y1={(element.depth * scale) * 0.1}
            x2={(element.width * scale) / 2}
            y2={(element.depth * scale) * 0.9}
            stroke="#333"
            strokeWidth="1"
          />
          {/* Handle indicators */}
          <rect x={(element.width * scale) * 0.45} y={(element.depth * scale) * 0.3} width="2" height="8" fill="#333" />
          <rect x={(element.width * scale) * 0.53} y={(element.depth * scale) * 0.3} width="2" height="8" fill="#333" />
        </>
      )}

      {/* Dishwasher Graphics */}
      {element.type === 'dishwasher' && (
        <>
          {/* Control panel */}
          <rect
            x={(element.width * scale) * 0.1}
            y={(element.depth * scale) * 0.05}
            width={(element.width * scale) * 0.8}
            height={(element.depth * scale) * 0.1}
            fill="#999"
            stroke="#333"
            strokeWidth="0.5"
          />
          {/* Door handle */}
          <rect
            x={(element.width * scale) * 0.05}
            y={(element.depth * scale) * 0.3}
            width="3"
            height={(element.depth * scale) * 0.4}
            fill="#333"
          />
        </>
      )}

      {/* Microwave Graphics */}
      {element.type === 'microwave' && (
        <>
          {/* Door window */}
          <rect
            x={(element.width * scale) * 0.15}
            y={(element.depth * scale) * 0.2}
            width={(element.width * scale) * 0.6}
            height={(element.depth * scale) * 0.5}
            fill="none"
            stroke="#333"
            strokeWidth="1"
          />
          {/* Control panel */}
          <rect
            x={(element.width * scale) * 0.8}
            y={(element.depth * scale) * 0.2}
            width={(element.width * scale) * 0.15}
            height={(element.depth * scale) * 0.6}
            fill="#ccc"
            stroke="#333"
            strokeWidth="0.5"
          />
        </>
      )}

      {/* Element Number Badge */}
      <circle
        cx={(element.width * scale) / 2 + ((element.type === 'medicine' || element.type === 'medicine-mirror') 
          ? (() => {
              if (element.type === 'medicine-mirror') {
                switch (element.rotation) {
                  case 0: return 0;
                  case 90: return 0;
                  case 180: return 0;
                  case 270: return -40;
                  case -90: return -40;
                  default: return 0;
                }
              }
              return 0;
            })()
          : 0)}
        cy={(element.depth * scale) / 2 + ((element.type === 'medicine' || element.type === 'medicine-mirror') 
          ? (() => {
              if (element.type === 'medicine-mirror') {
                switch (element.rotation) {
                  case 0: return 0;
                  case 90: return 30;
                  case 180: return 0;
                  case 270: return 28;
                  case -90: return 28;
                  default: return 0;
                }
              }
              return 0;
            })()
          : 0)}
        r="12"
        fill="white"
        stroke="#333"
        strokeWidth="1"
      />
      <text
        x={(element.width * scale) / 2 + ((element.type === 'medicine' || element.type === 'medicine-mirror') 
          ? (() => {
              if (element.type === 'medicine-mirror') {
                switch (element.rotation) {
                  case 0: return 0;
                  case 90: return 0;
                  case 180: return 0;
                  case 270: return -40;
                  case -90: return -40;
                  default: return 0;
                }
              }
              return 0;
            })()
          : 0)}
        y={(element.depth * scale) / 2 + ((element.type === 'medicine' || element.type === 'medicine-mirror') 
          ? (() => {
              if (element.type === 'medicine-mirror') {
                switch (element.rotation) {
                  case 0: return 0;
                  case 90: return 30;
                  case 180: return 0;
                  case 270: return 28;
                  case -90: return 28;
                  default: return 0;
                }
              }
              return 0;
            })()
          : 0)}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="10"
        fill="#333"
        fontWeight="bold"
      >
        {currentRoomData.elements.indexOf(element) + 1}
      </text>

      {/* Element Type Label */}
      <text
        x={(element.width * scale) / 2 + ((element.type === 'medicine' || element.type === 'medicine-mirror') 
          ? (() => {
              if (element.type === 'medicine-mirror') {
                switch (element.rotation) {
                  case 0: return 0;
                  case 90: return 0;
                  case 180: return 0;
                  case 270: return -40;
                  case -90: return -40;
                  default: return 0;
                }
              }
              return 0;
            })()
          : 0)}
        y={(element.depth * scale) + 15 + ((element.type === 'medicine' || element.type === 'medicine-mirror') 
          ? (() => {
              if (element.type === 'medicine-mirror') {
                switch (element.rotation) {
                  case 0: return 0;
                  case 90: return 30;
                  case 180: return 0;
                  case 270: return 28;
                  case -90: return 28;
                  default: return 0;
                }
              }
              return 0;
            })()
          : 0)}
        textAnchor="middle"
        fontSize="8"
        fill="#666"
        fontFamily="Arial, sans-serif"
      >
        {getElementName(t, element.type, elementTypes)}
      </text>

      {/* Dimension Labels */}
      {isSelected && (
        <g>
          {/* Width dimension */}
          <text
            x={(element.width * scale) / 2}
            y={-8}
            textAnchor="middle"
            fontSize="8"
            fill="#666"
            fontWeight="bold"
          >
            {element.width}"W
          </text>
          {/* Depth dimension */}
          <text
            x={-15}
            y={(element.depth * scale) / 2}
            textAnchor="middle"
            fontSize="8"
            fill="#666"
            fontWeight="bold"
            transform={`rotate(-90, ${-15}, ${(element.depth * scale) / 2})`}
          >
            {element.depth}"D
          </text>
        </g>
      )}

      {onKeyDown && (() => {
        // Same offset the medicine-mirror body uses, so the ring surrounds it
        const ringOffset = element.type === 'medicine-mirror'
          ? ({ 90: { x: 0, y: 30 }, 270: { x: -40, y: 28 }, '-90': { x: -40, y: 28 } }[element.rotation] || { x: 0, y: 0 })
          : { x: 0, y: 0 };
        return (
          <rect
            className="kd-focus-ring"
            x={ringOffset.x - 4}
            y={ringOffset.y - 4}
            width={element.width * scale + 8}
            height={element.depth * scale + 8}
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="3"
            rx="3"
            opacity="0"
            pointerEvents="none"
          />
        );
      })()}
    </g>
  );
});

export default DraggableCabinet;