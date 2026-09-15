import React from 'react';
import { getDoorsOnWall } from '../../utils/designer/wallViewUtils';

const WallView = ({
  wallNum,
  currentRoomData,
  selectedWall,
  selectedElement,
  elementTypes,
  scale,
  viewScale = null,
  wallViewRef = null,
  isDraggingWallView,
  isTouch,
  getElementsOnWall,
  handleMouseMove,
  handleMouseUp,
  handleWallViewMouseDown,
  // Keyboard support; only wired up by the designer page
  onElementKeyDown,
  getElementLabel,
  describedBy,
  wallLabel
}) => {
  const wall = wallNum || selectedWall;
  
  // Calculate room dimensions for element filtering
  const roomWidth = parseFloat(currentRoomData.dimensions.width) * 12 * scale;
  const roomHeight = parseFloat(currentRoomData.dimensions.height) * 12 * scale;

  const wallElements = getElementsOnWall(wall, currentRoomData.elements, roomWidth, roomHeight, scale).sort((a, b) => {
    // Sort elements left-to-right or top-to-bottom based on wall orientation
    if (wall === 1 || wall === 3) {
      return a.x - b.x; // Horizontal walls: sort by x position
    } else {
      return a.y - b.y; // Vertical walls: sort by y position
    }
  });

  // Calculate wall dimensions and scale
  const wallWidth = wall === 1 || wall === 3
    ? parseFloat(currentRoomData.dimensions.width) * 12
    : parseFloat(currentRoomData.dimensions.height) * 12;
  const wallHeight = parseFloat(currentRoomData.dimensions.wallHeight);
  const calculatedViewScale = viewScale || Math.min(800 / wallWidth, 400 / wallHeight);

  return (
    <svg
      width={wallWidth * calculatedViewScale + 100}
      height={wallHeight * calculatedViewScale + 60}
      ref={wallNum ? null : wallViewRef}
      role={onElementKeyDown ? 'group' : undefined}
      aria-label={onElementKeyDown ? wallLabel : undefined}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
      style={{
        cursor: isDraggingWallView ? 'ns-resize' : 'default',
        touchAction: isTouch ? 'manipulation' : 'auto'
      }}
    >
      {/* Wall background */}
      <rect x="50" y="30" width={wallWidth * calculatedViewScale} height={wallHeight * calculatedViewScale} fill="#f5f5f5" stroke="#333" strokeWidth="2" />

      {/* Wall title */}
      <text x={50 + (wallWidth * calculatedViewScale) / 2} y="20" textAnchor="middle" fontSize="12" fontWeight="bold">
        Wall {wall} - {(wallWidth / 12).toFixed(1)}'
      </text>

      {/* Room Doors on this wall */}
      {(() => {
        const doorsOnWall = getDoorsOnWall(wall, currentRoomData.doors || []);
        const doorHeight = 80; // Standard door height in inches
        
        return doorsOnWall.map((door, idx) => {
          // Calculate door position based on position percentage
          const doorWidthInches = door.width || 32;
          const doorX = (door.position / 100) * wallWidth - (doorWidthInches / 2);
          const doorYPos = wallHeight - doorHeight; // Door from floor
          
          // Door colors based on type
          const doorColor = door.type === 'pantry' ? '#8B4513' : 
                           door.type === 'room' ? '#6B8E23' : 
                           door.type === 'double' ? '#4682B4' :
                           door.type === 'sliding' ? '#708090' : '#A0522D';
          const doorLightColor = door.type === 'pantry' ? '#A0522D' :
                                door.type === 'room' ? '#9ACD32' :
                                door.type === 'double' ? '#5F9EA0' :
                                door.type === 'sliding' ? '#778899' : '#CD853F';
          
          return (
            <g key={`door-${door.id || idx}`}>
              {/* Door frame/opening */}
              <rect
                x={50 + doorX * calculatedViewScale}
                y={30 + doorYPos * calculatedViewScale}
                width={doorWidthInches * calculatedViewScale}
                height={doorHeight * calculatedViewScale}
                fill="#2c2c2c"
                stroke="#1a1a1a"
                strokeWidth="2"
              />
              
              {/* Door panel */}
              <rect
                x={50 + (doorX + 2) * calculatedViewScale}
                y={30 + (doorYPos + 2) * calculatedViewScale}
                width={(doorWidthInches - 4) * calculatedViewScale}
                height={(doorHeight - 4) * calculatedViewScale}
                fill={doorColor}
                stroke={doorLightColor}
                strokeWidth="1"
              />
              
              {/* Door panel details - top panel */}
              <rect
                x={50 + (doorX + 4) * calculatedViewScale}
                y={30 + (doorYPos + 4) * calculatedViewScale}
                width={(doorWidthInches - 8) * calculatedViewScale}
                height={(doorHeight * 0.35) * calculatedViewScale}
                fill="none"
                stroke={doorLightColor}
                strokeWidth="1.5"
              />
              
              {/* Door panel details - bottom panel */}
              <rect
                x={50 + (doorX + 4) * calculatedViewScale}
                y={30 + (doorYPos + doorHeight * 0.45) * calculatedViewScale}
                width={(doorWidthInches - 8) * calculatedViewScale}
                height={(doorHeight * 0.5) * calculatedViewScale}
                fill="none"
                stroke={doorLightColor}
                strokeWidth="1.5"
              />
              
              {/* Door handle/knob */}
              <circle
                cx={50 + (doorX + doorWidthInches - 6) * calculatedViewScale}
                cy={30 + (doorYPos + doorHeight * 0.55) * calculatedViewScale}
                r={3 * calculatedViewScale}
                fill="#C0C0C0"
                stroke="#808080"
                strokeWidth="1"
              />
              
              {/* Door type label */}
              <text
                x={50 + (doorX + doorWidthInches / 2) * calculatedViewScale}
                y={30 + (doorYPos + doorHeight / 2) * calculatedViewScale}
                textAnchor="middle"
                fontSize="9"
                fill="#fff"
                fontWeight="bold"
              >
                {door.type === 'standard' ? 'DOOR' :
                 door.type === 'pantry' ? 'PANTRY' :
                 door.type === 'room' ? 'ROOM' :
                 door.type === 'double' ? 'DOUBLE' :
                 door.type === 'sliding' ? 'SLIDING' : 'DOOR'}
              </text>
              
              {/* Door width dimension */}
              <text
                x={50 + (doorX + doorWidthInches / 2) * calculatedViewScale}
                y={30 + (doorYPos + doorHeight + 12) * calculatedViewScale}
                textAnchor="middle"
                fontSize="8"
                fill="#666"
              >
                {doorWidthInches}"
              </text>
            </g>
          );
        });
      })()}

      {/* Height reference line */}
      <line x1="40" y1="30" x2="40" y2={30 + wallHeight * calculatedViewScale} stroke="#333" strokeWidth="1" />
      <text x="35" y={30 + (wallHeight * calculatedViewScale) / 2} textAnchor="middle" fontSize="10" transform={`rotate(-90, 35, ${30 + (wallHeight * calculatedViewScale) / 2})`}>
        {wallHeight}"
      </text>

      {/* Render each element on this wall */}
      {wallElements.map((element, index) => {
        const elementSpec = elementTypes[element.type];

        // Skip rendering if elementSpec is missing
        if (!elementSpec) {
          console.warn('Skipping wall element rendering for invalid type:', element.type);
          return null;
        }

        const x = wall === 1 || wall === 3 ? element.x / scale : element.y / scale;
        const width = element.width;
        const height = element.actualHeight || elementSpec.fixedHeight;

        // Calculate Y position based on mount height or floor placement
        const yPos = element.mountHeight
          ? wallHeight - height - element.mountHeight
          : wallHeight - height;

        const isWallCabinet = element.type === 'wall' || element.type === 'medicine';
        const isSelected = element.id === selectedElement;

        // Keyboard access (WCAG 2.1.1): only when the page wires up a key handler
        const keyboardProps = onElementKeyDown ? {
          tabIndex: 0,
          role: 'button',
          'aria-pressed': isSelected,
          'aria-label': getElementLabel ? getElementLabel(element) : undefined,
          'aria-describedby': describedBy,
          className: 'kd-el',
          onKeyDown: (e) => onElementKeyDown(e, element.id)
        } : {};

        return (
          <g key={element.id} data-wall-element-id={element.id} {...keyboardProps}>
            {/* Main element rectangle with enhanced styling */}
            <defs>
              <linearGradient id={`cabinetGradient-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={element.category === 'appliance' ? element.color : '#fafafa'} />
                <stop offset="30%" stopColor={element.category === 'appliance' ? element.color : '#f5f5f5'} />
                <stop offset="70%" stopColor={element.category === 'appliance' ? element.color : '#e8e8e8'} />
                <stop offset="100%" stopColor={element.category === 'appliance' ? element.color : '#d5d5d5'} />
              </linearGradient>
              <filter id={`cabinetShadow-${element.id}`} x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="3" dy="3" stdDeviation="3" floodColor="#00000030" />
                <feDropShadow dx="1" dy="1" stdDeviation="1" floodColor="#00000015" />
              </filter>
              <linearGradient id={`doorGradient-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#f8f8f8" />
                <stop offset="100%" stopColor="#e0e0e0" />
              </linearGradient>
            </defs>
            <rect
              x={50 + x * calculatedViewScale}
              y={30 + yPos * calculatedViewScale}
              width={width * calculatedViewScale}
              height={height * calculatedViewScale}
              fill={`url(#cabinetGradient-${element.id})`}
              stroke={isSelected ? '#3b82f6' : '#6b7280'}
              strokeWidth={isSelected ? '2' : '1'}
              filter={`url(#cabinetShadow-${element.id})`}
              rx="3"
              style={{ cursor: isWallCabinet ? 'ns-resize' : 'default' }}
              onMouseDown={(e) => isWallCabinet ? handleWallViewMouseDown(e, element.id) : null}
              onTouchStart={(e) => isWallCabinet ? handleWallViewMouseDown(e, element.id) : null}
            />

            {/* Special rendering for sink cabinets */}
            {(element.type === 'sink-base' || element.type === 'vanity-sink') && (
              <>
                <rect
                  x={50 + x * calculatedViewScale + width * calculatedViewScale * 0.1}
                  y={30 + yPos * calculatedViewScale + 3}
                  width={width * calculatedViewScale * 0.8}
                  height="10"
                  fill="#4682B4"
                  stroke="#333"
                  strokeWidth="0.5"
                />
                <circle
                  cx={50 + x * calculatedViewScale + width * calculatedViewScale * 0.5}
                  cy={30 + yPos * calculatedViewScale + 8}
                  r="2"
                  fill="#333"
                />
              </>
            )}

            {/* Enhanced Cabinet door details with modern styling */}
            {(element.type === 'base' || element.type === 'wall' || element.type === 'tall' ||
              element.type === 'vanity' || element.type === 'medicine' || element.type === 'linen') && (
                <>
                  {/* Cabinet frame with stronger outline */}
                  <rect
                    x={50 + x * calculatedViewScale + 2}
                    y={30 + yPos * calculatedViewScale + 2}
                    width={width * calculatedViewScale - 4}
                    height={height * calculatedViewScale - 4}
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth="2"
                    rx="2"
                  />

                  {/* Door separation lines (for double door cabinets) */}
                  {width >= 24 && (
                    <line
                      x1={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                      y1={30 + yPos * calculatedViewScale + 4}
                      x2={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                      y2={30 + (yPos + height) * calculatedViewScale - 4}
                      stroke="#4b5563"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Enhanced door panels with stronger definition */}
                  {width >= 24 ? (
                    // Double door panels
                    <>
                      <rect
                        x={50 + x * calculatedViewScale + 8}
                        y={30 + yPos * calculatedViewScale + 8}
                        width={(width * calculatedViewScale - 20) / 2}
                        height={height * calculatedViewScale - 16}
                        fill={`url(#doorGradient-${element.id})`}
                        stroke="#888888"
                        strokeWidth="1.5"
                        rx="2"
                      />
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2 + 4}
                        y={30 + yPos * calculatedViewScale + 8}
                        width={(width * calculatedViewScale - 20) / 2}
                        height={height * calculatedViewScale - 16}
                        fill={`url(#doorGradient-${element.id})`}
                        stroke="#888888"
                        strokeWidth="1.5"
                        rx="2"
                      />
                      {/* Inner door panels for depth */}
                      <rect
                        x={50 + x * calculatedViewScale + 12}
                        y={30 + yPos * calculatedViewScale + 12}
                        width={(width * calculatedViewScale - 28) / 2}
                        height={height * calculatedViewScale - 24}
                        fill="none"
                        stroke="#b0b0b0"
                        strokeWidth="1"
                        rx="1"
                      />
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2 + 8}
                        y={30 + yPos * calculatedViewScale + 12}
                        width={(width * calculatedViewScale - 28) / 2}
                        height={height * calculatedViewScale - 24}
                        fill="none"
                        stroke="#b0b0b0"
                        strokeWidth="1"
                        rx="1"
                      />
                    </>
                  ) : (
                    // Single door panel
                    <>
                      <rect
                        x={50 + x * calculatedViewScale + 8}
                        y={30 + yPos * calculatedViewScale + 8}
                        width={width * calculatedViewScale - 16}
                        height={height * calculatedViewScale - 16}
                        fill={`url(#doorGradient-${element.id})`}
                        stroke="#888888"
                        strokeWidth="1.5"
                        rx="2"
                      />
                      {/* Inner door panel for depth */}
                      <rect
                        x={50 + x * calculatedViewScale + 12}
                        y={30 + yPos * calculatedViewScale + 12}
                        width={width * calculatedViewScale - 24}
                        height={height * calculatedViewScale - 24}
                        fill="none"
                        stroke="#b0b0b0"
                        strokeWidth="1"
                        rx="1"
                      />
                    </>
                  )}

                  {/* Enhanced cabinet handles with metallic appearance */}
                  {width >= 24 ? (
                    // Double door handles
                    <>
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.25 - 2}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 6}
                        width="4"
                        height="12"
                        fill="#4a5568"
                        stroke="#2d3748"
                        strokeWidth="0.5"
                        rx="2"
                      />
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.25 - 1.5}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 5}
                        width="3"
                        height="10"
                        fill="#718096"
                        rx="1.5"
                      />
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.75 - 2}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 6}
                        width="4"
                        height="12"
                        fill="#4a5568"
                        stroke="#2d3748"
                        strokeWidth="0.5"
                        rx="2"
                      />
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.75 - 1.5}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 5}
                        width="3"
                        height="10"
                        fill="#718096"
                        rx="1.5"
                      />
                    </>
                  ) : (
                    // Single door handle
                    <>
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 2}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 6}
                        width="4"
                        height="12"
                        fill="#4a5568"
                        stroke="#2d3748"
                        strokeWidth="0.5"
                        rx="2"
                      />
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 1.5}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 5}
                        width="3"
                        height="10"
                        fill="#718096"
                        rx="1.5"
                      />
                    </>
                  )}
                </>
              )}

            {/* Enhanced drawer cabinet details */}
            {(element.type === 'drawer-base' || element.type === 'double-drawer-base') && (
              <>
                {/* Outer cabinet frame for drawers */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="2"
                  rx="2"
                />

                {element.type === 'double-drawer-base' ? (
                  // Double drawer design with enhanced visibility
                  <>
                    {/* Top drawer */}
                    <rect
                      x={50 + x * calculatedViewScale + 6}
                      y={30 + yPos * calculatedViewScale + 6}
                      width={width * calculatedViewScale - 12}
                      height={(height * calculatedViewScale - 16) / 2}
                      fill="none"
                      stroke="#4b5563"
                      strokeWidth="1.5"
                      rx="1"
                    />
                    {/* Bottom drawer */}
                    <rect
                      x={50 + x * calculatedViewScale + 6}
                      y={30 + yPos * calculatedViewScale + 8 + (height * calculatedViewScale - 16) / 2}
                      width={width * calculatedViewScale - 12}
                      height={(height * calculatedViewScale - 16) / 2}
                      fill="none"
                      stroke="#4b5563"
                      strokeWidth="1.5"
                      rx="1"
                    />
                    {/* Drawer face panels */}
                    <rect
                      x={50 + x * calculatedViewScale + 10}
                      y={30 + yPos * calculatedViewScale + 10}
                      width={width * calculatedViewScale - 20}
                      height={(height * calculatedViewScale - 16) / 2 - 8}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1"
                      rx="1"
                    />
                    <rect
                      x={50 + x * calculatedViewScale + 10}
                      y={30 + yPos * calculatedViewScale + 12 + (height * calculatedViewScale - 16) / 2}
                      width={width * calculatedViewScale - 20}
                      height={(height * calculatedViewScale - 16) / 2 - 8}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1"
                      rx="1"
                    />
                    {/* Enhanced drawer pulls */}
                    <rect
                      x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 2}
                      y={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.25 - 3}
                      width="4"
                      height="6"
                      fill="#374151"
                      rx="2"
                    />
                    <rect
                      x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 2}
                      y={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.75 - 3}
                      width="4"
                      height="6"
                      fill="#374151"
                      rx="2"
                    />
                  </>
                ) : (
                  // Multiple small drawers for single drawer-base (typically 4 drawers)
                  <>
                    {[0, 1, 2, 3].map(drawerIndex => (
                      <g key={drawerIndex}>
                        {/* Drawer outline */}
                        <rect
                          x={50 + x * calculatedViewScale + 6}
                          y={30 + yPos * calculatedViewScale + 6 + (drawerIndex * (height * calculatedViewScale - 12) / 4)}
                          width={width * calculatedViewScale - 12}
                          height={(height * calculatedViewScale - 12) / 4 - 2}
                          fill="none"
                          stroke="#4b5563"
                          strokeWidth="1.5"
                          rx="1"
                        />
                        {/* Drawer face panel */}
                        <rect
                          x={50 + x * calculatedViewScale + 10}
                          y={30 + yPos * calculatedViewScale + 8 + (drawerIndex * (height * calculatedViewScale - 12) / 4)}
                          width={width * calculatedViewScale - 20}
                          height={(height * calculatedViewScale - 12) / 4 - 6}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="1"
                          rx="1"
                        />
                        {/* Drawer pull */}
                        <rect
                          x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 1.5}
                          y={30 + yPos * calculatedViewScale + 6 + (drawerIndex * (height * calculatedViewScale - 12) / 4) + ((height * calculatedViewScale - 12) / 8) - 1.5}
                          width="3"
                          height="3"
                          fill="#374151"
                          rx="1.5"
                        />
                      </g>
                    ))}
                  </>
                )}
              </>
            )}

            {/* Glass door cabinet details */}
            {element.type === 'glass-wall' && (
              <>
                {/* Cabinet frame */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="2"
                  rx="2"
                />
                {/* Glass door frames with stronger outline */}
                <rect
                  x={50 + x * calculatedViewScale + 6}
                  y={30 + yPos * calculatedViewScale + 6}
                  width={width * calculatedViewScale - 12}
                  height={height * calculatedViewScale - 12}
                  fill="none"
                  stroke="#4b5563"
                  strokeWidth="1.5"
                  rx="2"
                />
                {/* Glass effect with enhanced visibility */}
                <rect
                  x={50 + x * calculatedViewScale + 8}
                  y={30 + yPos * calculatedViewScale + 8}
                  width={width * calculatedViewScale - 16}
                  height={height * calculatedViewScale - 16}
                  fill="rgba(135, 206, 235, 0.25)"
                  stroke="rgba(59, 130, 246, 0.6)"
                  strokeWidth="1"
                  rx="1"
                />
                {/* Enhanced glass reflection effect */}
                <rect
                  x={50 + x * calculatedViewScale + 10}
                  y={30 + yPos * calculatedViewScale + 10}
                  width={(width * calculatedViewScale - 20) * 0.35}
                  height={(height * calculatedViewScale - 20) * 0.7}
                  fill="rgba(255, 255, 255, 0.6)"
                  rx="2"
                />
                {/* Door separation for double doors */}
                {width >= 24 && (
                  <line
                    x1={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                    y1={30 + yPos * calculatedViewScale + 6}
                    x2={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                    y2={30 + (yPos + height) * calculatedViewScale - 6}
                    stroke="#4b5563"
                    strokeWidth="1.5"
                  />
                )}
                {/* Enhanced glass door handles */}
                {width >= 24 ? (
                  <>
                    <circle cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.25} cy={30 + (yPos + height / 2) * calculatedViewScale} r="3" fill="#374151" />
                    <circle cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.75} cy={30 + (yPos + height / 2) * calculatedViewScale} r="3" fill="#374151" />
                  </>
                ) : (
                  <circle cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8} cy={30 + (yPos + height / 2) * calculatedViewScale} r="3" fill="#374151" />
                )}
              </>
            )}

            {/* Open shelf cabinet details */}
            {element.type === 'open-shelf' && (
              <>
                {/* Outer frame with enhanced visibility */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="2"
                  rx="2"
                />
                {/* Inner frame to show depth */}
                <rect
                  x={50 + x * calculatedViewScale + 6}
                  y={30 + yPos * calculatedViewScale + 6}
                  width={width * calculatedViewScale - 12}
                  height={height * calculatedViewScale - 12}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  rx="1"
                />
                {/* Enhanced shelves with stronger lines */}
                {[1, 2, 3].map(shelfIndex => (
                  <g key={shelfIndex}>
                    {/* Main shelf line */}
                    <line
                      x1={50 + x * calculatedViewScale + 6}
                      y1={30 + yPos * calculatedViewScale + 6 + (shelfIndex * (height * calculatedViewScale - 12) / 4)}
                      x2={50 + (x + width) * calculatedViewScale - 6}
                      y2={30 + yPos * calculatedViewScale + 6 + (shelfIndex * (height * calculatedViewScale - 12) / 4)}
                      stroke="#4b5563"
                      strokeWidth="2"
                    />
                    {/* Shelf edge to show thickness */}
                    <line
                      x1={50 + x * calculatedViewScale + 6}
                      y1={30 + yPos * calculatedViewScale + 8 + (shelfIndex * (height * calculatedViewScale - 12) / 4)}
                      x2={50 + (x + width) * calculatedViewScale - 6}
                      y2={30 + yPos * calculatedViewScale + 8 + (shelfIndex * (height * calculatedViewScale - 12) / 4)}
                      stroke="#94a3b8"
                      strokeWidth="1"
                    />
                  </g>
                ))}
                {/* Enhanced side supports */}
                <line
                  x1={50 + x * calculatedViewScale + 6}
                  y1={30 + yPos * calculatedViewScale + 6}
                  x2={50 + x * calculatedViewScale + 6}
                  y2={30 + (yPos + height) * calculatedViewScale - 6}
                  stroke="#4b5563"
                  strokeWidth="1.5"
                />
                <line
                  x1={50 + (x + width) * calculatedViewScale - 6}
                  y1={30 + yPos * calculatedViewScale + 6}
                  x2={50 + (x + width) * calculatedViewScale - 6}
                  y2={30 + (yPos + height) * calculatedViewScale - 6}
                  stroke="#4b5563"
                  strokeWidth="1.5"
                />
              </>
            )}

            {/* Pantry cabinet details */}
            {element.type === 'pantry' && (
              <>
                {/* Pantry cabinet frame with enhanced visibility */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="2"
                  rx="2"
                />
                {/* Door frame */}
                <rect
                  x={50 + x * calculatedViewScale + 6}
                  y={30 + yPos * calculatedViewScale + 6}
                  width={width * calculatedViewScale - 12}
                  height={height * calculatedViewScale - 12}
                  fill="none"
                  stroke="#4b5563"
                  strokeWidth="1.5"
                  rx="1"
                />
                {/* Enhanced door panels with stronger lines */}
                <rect
                  x={50 + x * calculatedViewScale + 10}
                  y={30 + yPos * calculatedViewScale + 10}
                  width={width * calculatedViewScale - 20}
                  height={(height * calculatedViewScale - 20) / 3}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  rx="1"
                />
                <rect
                  x={50 + x * calculatedViewScale + 10}
                  y={30 + yPos * calculatedViewScale + 12 + (height * calculatedViewScale - 20) / 3}
                  width={width * calculatedViewScale - 20}
                  height={(height * calculatedViewScale - 20) / 3}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  rx="1"
                />
                <rect
                  x={50 + x * calculatedViewScale + 10}
                  y={30 + yPos * calculatedViewScale + 14 + 2 * ((height * calculatedViewScale - 20) / 3)}
                  width={width * calculatedViewScale - 20}
                  height={(height * calculatedViewScale - 20) / 3}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  rx="1"
                />
                {/* Enhanced door handle */}
                <rect
                  x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 2}
                  y={30 + (yPos + height / 2) * calculatedViewScale - 8}
                  width="4"
                  height="16"
                  fill="#374151"
                  rx="2"
                />
              </>
            )}

            {/* Corner cabinet variations */}
            {element.type === 'corner' && (
              <>
                {element.hingeDirection === 'left' ? (
                  // Single door corner cabinet (hinges on left)
                  <>
                    <rect
                      x={50 + x * calculatedViewScale + 2}
                      y={30 + yPos * calculatedViewScale + 2}
                      width={width * calculatedViewScale - 4}
                      height={height * calculatedViewScale - 4}
                      fill="none"
                      stroke="#6b7280"
                      strokeWidth="2"
                      rx="2"
                    />
                    <rect
                      x={50 + x * calculatedViewScale + 6}
                      y={30 + yPos * calculatedViewScale + 6}
                      width={width * calculatedViewScale - 12}
                      height={height * calculatedViewScale - 12}
                      fill="none"
                      stroke="#4b5563"
                      strokeWidth="1.5"
                      rx="1"
                    />
                    <rect
                      x={50 + x * calculatedViewScale + 10}
                      y={30 + yPos * calculatedViewScale + 10}
                      width={width * calculatedViewScale - 20}
                      height={height * calculatedViewScale - 20}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1"
                      rx="1"
                    />
                    <rect
                      x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.85 - 2}
                      y={30 + (yPos + height / 2) * calculatedViewScale - 5}
                      width="4"
                      height="10"
                      fill="#374151"
                      rx="2"
                    />
                  </>
                ) : (
                  // Double door corner cabinet (default)
                  <>
                    <rect
                      x={50 + x * calculatedViewScale + 2}
                      y={30 + yPos * calculatedViewScale + 2}
                      width={width * calculatedViewScale - 4}
                      height={height * calculatedViewScale - 4}
                      fill="none"
                      stroke="#6b7280"
                      strokeWidth="2"
                      rx="2"
                    />
                    {/* Enhanced door separation */}
                    <line
                      x1={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                      y1={30 + yPos * calculatedViewScale + 6}
                      x2={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                      y2={30 + (yPos + height) * calculatedViewScale - 6}
                      stroke="#4b5563"
                      strokeWidth="1.5"
                    />
                    {/* Enhanced door panels */}
                    <rect
                      x={50 + x * calculatedViewScale + 8}
                      y={30 + yPos * calculatedViewScale + 8}
                      width={(width * calculatedViewScale - 20) / 2}
                      height={height * calculatedViewScale - 16}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1"
                      rx="1"
                    />
                    <rect
                      x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2 + 2}
                      y={30 + yPos * calculatedViewScale + 8}
                      width={(width * calculatedViewScale - 20) / 2}
                      height={height * calculatedViewScale - 16}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1"
                      rx="1"
                    />
                    {/* Enhanced door handles */}
                    <rect
                      x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.25 - 1.5}
                      y={30 + (yPos + height / 2) * calculatedViewScale - 5}
                      width="3"
                      height="10"
                      fill="#374151"
                      rx="1.5"
                    />
                    <rect
                      x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.75 - 1.5}
                      y={30 + (yPos + height / 2) * calculatedViewScale - 5}
                      width="3"
                      height="10"
                      fill="#374151"
                      rx="1.5"
                    />
                  </>
                )}
              </>
            )}

            {/* Corner wall cabinet details - angled corner design */}
            {element.type === 'corner-wall' && (
              <>
                {/* Main cabinet frame */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="2"
                  rx="2"
                />

                {/* Angled corner cabinet front - creates the distinctive corner cabinet look */}
                <path
                  d={`M ${50 + x * calculatedViewScale + 6} ${30 + yPos * calculatedViewScale + 6}
                      L ${50 + x * calculatedViewScale + 6} ${30 + (yPos + height) * calculatedViewScale - 6}
                      L ${50 + (x + width) * calculatedViewScale - 6} ${30 + (yPos + height) * calculatedViewScale - 6}
                      L ${50 + (x + width) * calculatedViewScale - 6} ${30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.3}
                      L ${50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.7} ${30 + yPos * calculatedViewScale + 6}
                      Z`}
                  fill="none"
                  stroke="#4b5563"
                  strokeWidth="1.5"
                  rx="1"
                />

                {/* Angled door panel to match the cabinet shape */}
                <path
                  d={`M ${50 + x * calculatedViewScale + 10} ${30 + yPos * calculatedViewScale + 10}
                      L ${50 + x * calculatedViewScale + 10} ${30 + (yPos + height) * calculatedViewScale - 10}
                      L ${50 + (x + width) * calculatedViewScale - 10} ${30 + (yPos + height) * calculatedViewScale - 10}
                      L ${50 + (x + width) * calculatedViewScale - 10} ${30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.3 + 4}
                      L ${50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.7 - 4} ${30 + yPos * calculatedViewScale + 10}
                      Z`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1"
                />

                {/* Corner cabinet door handle positioned on the angled section */}
                <rect
                  x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.85 - 2}
                  y={30 + (yPos + height / 2) * calculatedViewScale - 5}
                  width="4"
                  height="10"
                  fill="#374151"
                  rx="2"
                />

                {/* Additional detail lines to show the corner cabinet construction */}
                <line
                  x1={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.7}
                  y1={30 + yPos * calculatedViewScale + 6}
                  x2={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.7}
                  y2={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.6}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                <line
                  x1={50 + (x + width) * calculatedViewScale - 6}
                  y1={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.3}
                  x2={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8}
                  y2={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.3}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
              </>
            )}

            {/* ========== BATHROOM CABINET DETAILS ========== */}

            {/* Vanity cabinet details */}
            {(element.type === 'vanity' || element.type === 'double-vanity' || element.type === 'floating-vanity' ||
              element.type === 'corner-vanity' || element.type === 'wall-hung-vanity' || element.type === 'vessel-sink-vanity' ||
              element.type === 'undermount-sink-vanity' || element.type === 'powder-room-vanity' ||
              element.type === 'master-bath-vanity' || element.type === 'kids-bathroom-vanity') && (
                <>
                  {/* Vanity cabinet frame */}
                  <rect
                    x={50 + x * calculatedViewScale + 2}
                    y={30 + yPos * calculatedViewScale + 2}
                    width={width * calculatedViewScale - 4}
                    height={height * calculatedViewScale - 4}
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth="2"
                    rx="2"
                  />

                  {/* Vanity door panels */}
                  {element.type === 'double-vanity' ? (
                    // Double vanity with two separate doors
                    <>
                      <rect
                        x={50 + x * calculatedViewScale + 6}
                        y={30 + yPos * calculatedViewScale + 6}
                        width={(width * calculatedViewScale - 16) / 2}
                        height={height * calculatedViewScale - 12}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1"
                        rx="1"
                      />
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2 + 2}
                        y={30 + yPos * calculatedViewScale + 6}
                        width={(width * calculatedViewScale - 16) / 2}
                        height={height * calculatedViewScale - 12}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1"
                        rx="1"
                      />
                      {/* Door separation line */}
                      <line
                        x1={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                        y1={30 + yPos * calculatedViewScale + 4}
                        x2={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                        y2={30 + (yPos + height) * calculatedViewScale - 4}
                        stroke="#4b5563"
                        strokeWidth="1.5"
                      />
                      {/* Double door handles */}
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.25 - 1}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 4}
                        width="3"
                        height="10"
                        fill="#374151"
                        rx="1.5"
                      />
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.75 - 1}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 4}
                        width="3"
                        height="10"
                        fill="#374151"
                        rx="1.5"
                      />
                    </>
                  ) : width >= 36 ? (
                    // Large vanity with double doors
                    <>
                      <rect
                        x={50 + x * calculatedViewScale + 6}
                        y={30 + yPos * calculatedViewScale + 6}
                        width={(width * calculatedViewScale - 16) / 2}
                        height={height * calculatedViewScale - 12}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1"
                        rx="1"
                      />
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2 + 2}
                        y={30 + yPos * calculatedViewScale + 6}
                        width={(width * calculatedViewScale - 16) / 2}
                        height={height * calculatedViewScale - 12}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1"
                        rx="1"
                      />
                      {/* Door separation */}
                      <line
                        x1={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                        y1={30 + yPos * calculatedViewScale + 4}
                        x2={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                        y2={30 + (yPos + height) * calculatedViewScale - 4}
                        stroke="#9ca3af"
                        strokeWidth="0.5"
                      />
                      {/* Double door handles */}
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.25 - 1}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 4}
                        width="3"
                        height="10"
                        fill="#374151"
                        rx="1.5"
                      />
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.75 - 1}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 4}
                        width="3"
                        height="10"
                        fill="#374151"
                        rx="1.5"
                      />
                    </>
                  ) : (
                    // Single door vanity
                    <>
                      <rect
                        x={50 + x * calculatedViewScale + 6}
                        y={30 + yPos * calculatedViewScale + 6}
                        width={width * calculatedViewScale - 12}
                        height={height * calculatedViewScale - 12}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1"
                        rx="1"
                      />
                      {/* Single door handle */}
                      <rect
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 1}
                        y={30 + (yPos + height / 2) * calculatedViewScale - 4}
                        width="3"
                        height="10"
                        fill="#374151"
                        rx="1.5"
                      />
                    </>
                  )}

                  {/* Floating vanity visual effect */}
                  {element.type === 'floating-vanity' && (
                    <rect
                      x={50 + x * calculatedViewScale}
                      y={30 + (yPos + height) * calculatedViewScale + 2}
                      width={width * calculatedViewScale}
                      height="4"
                      fill="none"
                      stroke="#d1d5db"
                      strokeWidth="0.5"
                      strokeDasharray="2,2"
                    />
                  )}
                </>
              )}

            {/* Vanity with sink details */}
            {(element.type === 'vanity-sink' || element.type === 'double-vanity' || element.type === 'floating-vanity' ||
              element.type === 'corner-vanity' || element.type === 'wall-hung-vanity' || element.type === 'vessel-sink-vanity' ||
              element.type === 'undermount-sink-vanity') && (
                <>
                  {element.type === 'vessel-sink-vanity' ? (
                    // Vessel sink - sits on top of counter
                    <>
                      <circle
                        cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.3}
                        cy={30 + yPos * calculatedViewScale + 8}
                        r="6"
                        fill="#f8fafc"
                        stroke="#475569"
                        strokeWidth="1"
                      />
                      {element.type === 'double-vanity' && (
                        <circle
                          cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.7}
                          cy={30 + yPos * calculatedViewScale + 8}
                          r="6"
                          fill="#f8fafc"
                          stroke="#475569"
                          strokeWidth="1"
                        />
                      )}
                    </>
                  ) : element.type === 'undermount-sink-vanity' ? (
                    // Undermount sink - integrated into counter
                    <>
                      <ellipse
                        cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.3}
                        cy={30 + yPos * calculatedViewScale + 8}
                        rx="8"
                        ry="5"
                        fill="#e2e8f0"
                        stroke="#64748b"
                        strokeWidth="0.5"
                      />
                      {element.type === 'double-vanity' && (
                        <ellipse
                          cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.7}
                          cy={30 + yPos * calculatedViewScale + 8}
                          rx="8"
                          ry="5"
                          fill="#e2e8f0"
                          stroke="#64748b"
                          strokeWidth="0.5"
                        />
                      )}
                    </>
                  ) : (
                    // Standard drop-in sink
                    <>
                      <rect
                        x={50 + x * calculatedViewScale + width * calculatedViewScale * 0.2}
                        y={30 + yPos * calculatedViewScale + 3}
                        width={width * calculatedViewScale * 0.25}
                        height="10"
                        fill="#cbd5e1"
                        stroke="#64748b"
                        strokeWidth="0.5"
                        rx="2"
                      />
                      {element.type === 'double-vanity' && (
                        <rect
                          x={50 + x * calculatedViewScale + width * calculatedViewScale * 0.55}
                          y={30 + yPos * calculatedViewScale + 3}
                          width={width * calculatedViewScale * 0.25}
                          height="10"
                          fill="#cbd5e1"
                          stroke="#64748b"
                          strokeWidth="0.5"
                          rx="2"
                        />
                      )}
                    </>
                  )}
                  {/* Faucet */}
                  <circle
                    cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.3}
                    cy={30 + yPos * calculatedViewScale + 3}
                    r="1"
                    fill="#374151"
                  />
                  {element.type === 'double-vanity' && (
                    <circle
                      cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.7}
                      cy={30 + yPos * calculatedViewScale + 3}
                      r="1"
                      fill="#374151"
                    />
                  )}
                </>
              )}

            {/* Vanity tower details */}
            {element.type === 'vanity-tower' && (
              <>
                {/* Tower frame */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="1"
                  rx="2"
                />
                {/* Multiple shelves/compartments */}
                {[1, 2, 3, 4].map(shelfIndex => (
                  <g key={shelfIndex}>
                    <line
                      x1={50 + x * calculatedViewScale + 4}
                      y1={30 + yPos * calculatedViewScale + 4 + (shelfIndex * (height * calculatedViewScale - 8) / 5)}
                      x2={50 + (x + width) * calculatedViewScale - 4}
                      y2={30 + yPos * calculatedViewScale + 4 + (shelfIndex * (height * calculatedViewScale - 8) / 5)}
                      stroke="#9ca3af"
                      strokeWidth="0.5"
                    />
                    {/* Small door handle for each compartment */}
                    <rect
                      x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 1}
                      y={30 + yPos * calculatedViewScale + 4 + (shelfIndex * (height * calculatedViewScale - 8) / 5) - (height * calculatedViewScale - 8) / 10}
                      width="1"
                      height={(height * calculatedViewScale - 8) / 10}
                      fill="#6b7280"
                      rx="0.5"
                    />
                  </g>
                ))}
              </>
            )}

            {/* Medicine cabinet details - enhanced rectangular appearance */}
            {(element.type === 'medicine' || element.type === 'medicine-mirror') && (
              <>
                {/* Medicine cabinet frame */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="2"
                  rx="2"
                />

                {element.type === 'medicine-mirror' ? (
                  // Mirror cabinet with reflection effect
                  <>
                    <rect
                      x={50 + x * calculatedViewScale + 6}
                      y={30 + yPos * calculatedViewScale + 6}
                      width={width * calculatedViewScale - 12}
                      height={height * calculatedViewScale - 12}
                      fill="rgba(191, 219, 254, 0.3)"
                      stroke="rgba(59, 130, 246, 0.5)"
                      strokeWidth="0.5"
                      rx="1"
                    />
                    {/* Mirror reflection effect */}
                    <rect
                      x={50 + x * calculatedViewScale + 6}
                      y={30 + yPos * calculatedViewScale + 6}
                      width={(width * calculatedViewScale - 12) * 0.4}
                      height={(height * calculatedViewScale - 12) * 0.7}
                      fill="rgba(255, 255, 255, 0.6)"
                      rx="2"
                    />
                  </>
                ) : (
                  // Regular medicine cabinet with shelves
                  <>
                    <rect
                      x={50 + x * calculatedViewScale + 4}
                      y={30 + yPos * calculatedViewScale + 4}
                      width={width * calculatedViewScale - 8}
                      height={height * calculatedViewScale - 8}
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="0.5"
                      rx="1"
                    />
                    {/* Internal shelves */}
                    {[1, 2].map(shelfIndex => (
                      <line
                        key={shelfIndex}
                        x1={50 + x * calculatedViewScale + 6}
                        y1={30 + yPos * calculatedViewScale + 6 + (shelfIndex * (height * calculatedViewScale - 12) / 3)}
                        x2={50 + (x + width) * calculatedViewScale - 6}
                        y2={30 + yPos * calculatedViewScale + 6 + (shelfIndex * (height * calculatedViewScale - 12) / 3)}
                        stroke="#d1d5db"
                        strokeWidth="0.5"
                      />
                    ))}
                  </>
                )}

                {/* Door handle */}
                <rect
                  x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.85 - 1}
                  y={30 + (yPos + height / 2) * calculatedViewScale - 3}
                  width="2"
                  height="6"
                  fill="#6b7280"
                  rx="1"
                />
              </>
            )}

            {/* Linen cabinet details */}
            {(element.type === 'linen' || element.type === 'linen-tower') && (
              <>
                {/* Linen cabinet frame */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="2"
                  rx="2"
                />
                {/* Multiple door panels for tall linen cabinet */}
                {element.type === 'linen-tower' ? (
                  // Tower with multiple compartments
                  <>
                    {[0, 1, 2].map(panelIndex => (
                      <rect
                        key={panelIndex}
                        x={50 + x * calculatedViewScale + 6}
                        y={30 + yPos * calculatedViewScale + 6 + (panelIndex * (height * calculatedViewScale - 12) / 3)}
                        width={width * calculatedViewScale - 12}
                        height={(height * calculatedViewScale - 12) / 3 - 2}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1"
                        rx="1"
                      />
                    ))}
                    {/* Handles for each panel */}
                    {[0, 1, 2].map(panelIndex => (
                      <rect
                        key={panelIndex}
                        x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 1}
                        y={30 + yPos * calculatedViewScale + 6 + (panelIndex * (height * calculatedViewScale - 12) / 3) + ((height * calculatedViewScale - 12) / 6) - 2}
                        width="2"
                        height="4"
                        fill="#6b7280"
                        rx="1"
                      />
                    ))}
                  </>
                ) : (
                  // Standard linen cabinet with two doors
                  <>
                    <rect
                      x={50 + x * calculatedViewScale + 6}
                      y={30 + yPos * calculatedViewScale + 6}
                      width={width * calculatedViewScale - 12}
                      height={(height * calculatedViewScale - 12) / 2 - 1}
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="0.5"
                      rx="1"
                    />
                    <rect
                      x={50 + x * calculatedViewScale + 6}
                      y={30 + yPos * calculatedViewScale + 6 + (height * calculatedViewScale - 12) / 2 + 1}
                      width={width * calculatedViewScale - 12}
                      height={(height * calculatedViewScale - 12) / 2 - 1}
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="0.5"
                      rx="1"
                    />
                    {/* Door handles */}
                    <rect
                      x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 1}
                      y={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.25 - 2}
                      width="2"
                      height="4"
                      fill="#6b7280"
                      rx="1"
                    />
                    <rect
                      x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.8 - 1}
                      y={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.75 - 2}
                      width="2"
                      height="4"
                      fill="#6b7280"
                      rx="1"
                    />
                  </>
                )}
              </>
            )}

            {/* ========== BATHROOM FIXTURE DETAILS ========== */}

            {/* Toilet details */}
            {element.type === 'toilet' && (
              <>
                {/* Toilet tank - positioned at back/top */}
                <rect
                  x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.2}
                  y={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.1}
                  width={(width * calculatedViewScale) * 0.6}
                  height={(height * calculatedViewScale) * 0.35}
                  fill="#f1f5f9"
                  stroke="#64748b"
                  strokeWidth="1"
                  rx="2"
                />
                {/* Toilet bowl - positioned at front/bottom */}
                <ellipse
                  cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.5}
                  cy={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.65}
                  rx={(width * calculatedViewScale) * 0.4}
                  ry={(height * calculatedViewScale) * 0.32}
                  fill="#f8fafc"
                  stroke="#64748b"
                  strokeWidth="1"
                />
                {/* Toilet seat */}
                <ellipse
                  cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.5}
                  cy={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.65}
                  rx={(width * calculatedViewScale) * 0.35}
                  ry={(height * calculatedViewScale) * 0.28}
                  fill="none"
                  stroke="#475569"
                  strokeWidth="1"
                />
                {/* Toilet bowl opening */}
                <ellipse
                  cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.5}
                  cy={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.65}
                  rx={(width * calculatedViewScale) * 0.15}
                  ry={(height * calculatedViewScale) * 0.12}
                  fill="#e0e0e0"
                />
                <text x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} y={30 + (yPos + height * 0.9) * calculatedViewScale} textAnchor="middle" fontSize="6" fill="#64748b" fontWeight="bold">
                  TOILET
                </text>
              </>
            )}

            {/* Bathtub details */}
            {element.type === 'bathtub' && (
              <>
                {/* Tub outline */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="#f8fafc"
                  stroke="#64748b"
                  strokeWidth="2"
                  rx="4"
                />
                {/* Tub interior */}
                <rect
                  x={50 + x * calculatedViewScale + 6}
                  y={30 + yPos * calculatedViewScale + 6}
                  width={width * calculatedViewScale - 12}
                  height={height * calculatedViewScale - 12}
                  fill="#e2e8f0"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  rx="2"
                />
                {/* Drain */}
                <circle
                  cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.3}
                  cy={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.8}
                  r="2"
                  fill="#64748b"
                />
                {/* Faucet */}
                <rect
                  x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.7 - 2}
                  y={30 + yPos * calculatedViewScale + 4}
                  width="4"
                  height="6"
                  fill="#64748b"
                  rx="1"
                />
                <text x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} y={30 + (yPos + height / 2) * calculatedViewScale} textAnchor="middle" fontSize="8" fill="#64748b" fontWeight="bold">
                  TUB
                </text>
              </>
            )}

            {/* Shower details */}
            {element.type === 'shower' && (
              <>
                {/* Shower base */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="#f1f5f9"
                  stroke="#64748b"
                  strokeWidth="2"
                  rx="2"
                />
                {/* Shower pan */}
                <rect
                  x={50 + x * calculatedViewScale + 4}
                  y={30 + yPos * calculatedViewScale + 4}
                  width={width * calculatedViewScale - 8}
                  height={height * calculatedViewScale - 8}
                  fill="#e2e8f0"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  rx="1"
                />
                {/* Shower head */}
                <circle
                  cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.5}
                  cy={30 + yPos * calculatedViewScale + 8}
                  r="3"
                  fill="#64748b"
                />
                {/* Water spray pattern */}
                {[1, 2, 3, 4, 5].map(dropIndex => (
                  <circle
                    key={dropIndex}
                    cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * (0.3 + dropIndex * 0.08)}
                    cy={30 + yPos * calculatedViewScale + 12 + dropIndex * 2}
                    r="0.5"
                    fill="#60a5fa"
                    opacity="0.6"
                  />
                ))}
                {/* Drain */}
                <circle
                  cx={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.5}
                  cy={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.9}
                  r="2"
                  fill="#64748b"
                />
                {/* Shower controls */}
                <rect
                  x={50 + x * calculatedViewScale + (width * calculatedViewScale) * 0.1}
                  y={30 + yPos * calculatedViewScale + (height * calculatedViewScale) * 0.4}
                  width="6"
                  height="8"
                  fill="#64748b"
                  rx="1"
                />
                <text x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} y={30 + (yPos + height * 0.95) * calculatedViewScale} textAnchor="middle" fontSize="6" fill="#64748b" fontWeight="bold">
                  SHOWER
                </text>
              </>
            )}

            {/* Appliance-specific rendering */}
            {element.type === 'stove' && (
              <>
                <rect x={50 + x * calculatedViewScale + 5} y={30 + yPos * calculatedViewScale + 5} width={width * calculatedViewScale - 10} height="20" fill="#333" />
                <circle cx={50 + x * calculatedViewScale + width * calculatedViewScale * 0.3} cy={30 + yPos * calculatedViewScale + 15} r="5" fill="#666" />
                <circle cx={50 + x * calculatedViewScale + width * calculatedViewScale * 0.7} cy={30 + yPos * calculatedViewScale + 15} r="5" fill="#666" />
                <text x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} y={30 + (yPos + height) * calculatedViewScale - 10} textAnchor="middle" fontSize="8" fill="#333" fontWeight="bold">
                  RANGE
                </text>
              </>
            )}

            {element.type === 'refrigerator' && (
              <>
                <line x1={50 + x * calculatedViewScale} y1={30 + (yPos + height * 0.6) * calculatedViewScale} x2={50 + (x + width) * calculatedViewScale} y2={30 + (yPos + height * 0.6) * calculatedViewScale} stroke="#666" strokeWidth="2" />
                <rect x={50 + x * calculatedViewScale + 5} y={30 + yPos * calculatedViewScale + 5} width="15" height="8" fill="#666" rx="1" />
                <text x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} y={30 + (yPos + height / 2) * calculatedViewScale} textAnchor="middle" fontSize="10" fill="#333" fontWeight="bold">
                  FRIDGE
                </text>
              </>
            )}

            {element.type === 'dishwasher' && (
              <>
                <rect x={50 + x * calculatedViewScale + 4} y={30 + yPos * calculatedViewScale + 4} width={width * calculatedViewScale - 8} height={height * calculatedViewScale - 8} fill="none" stroke="#666" strokeWidth="1" />
                <text x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} y={30 + (yPos + height / 2) * calculatedViewScale} textAnchor="middle" fontSize="8" fill="#333" fontWeight="bold">
                  DW
                </text>
              </>
            )}

            {element.type === 'microwave' && (
              <>
                {/* Microwave frame */}
                <rect x={50 + x * calculatedViewScale + 2} y={30 + yPos * calculatedViewScale + 2} width={width * calculatedViewScale - 4} height={height * calculatedViewScale - 4} fill="#333" stroke="#666" strokeWidth="1" rx="2" />
                {/* Microwave door */}
                <rect x={50 + x * calculatedViewScale + 4} y={30 + yPos * calculatedViewScale + 4} width={width * calculatedViewScale - 8} height={height * calculatedViewScale - 8} fill="#1f2937" stroke="#4b5563" strokeWidth="1" rx="1" />
                {/* Door handle */}
                <rect x={50 + x * calculatedViewScale + (width * calculatedViewScale) - 8} y={30 + (yPos + height / 2) * calculatedViewScale - 3} width="4" height="6" fill="#9ca3af" rx="1" />
                {/* Control panel */}
                <rect x={50 + x * calculatedViewScale + 6} y={30 + yPos * calculatedViewScale + 6} width="12" height="8" fill="#374151" rx="1" />
                <text x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} y={30 + (yPos + height / 2) * calculatedViewScale + 6} textAnchor="middle" fontSize="6" fill="#e5e7eb" fontWeight="bold">
                  MICRO
                </text>
              </>
            )}

            {element.type === 'double-oven' && (
              <>
                {/* Double oven frame */}
                <rect x={50 + x * calculatedViewScale + 2} y={30 + yPos * calculatedViewScale + 2} width={width * calculatedViewScale - 4} height={height * calculatedViewScale - 4} fill="#333" stroke="#666" strokeWidth="1" rx="2" />
                {/* Top oven door */}
                <rect x={50 + x * calculatedViewScale + 6} y={30 + yPos * calculatedViewScale + 6} width={width * calculatedViewScale - 12} height={(height * calculatedViewScale - 16) / 2 - 2} fill="#1f2937" stroke="#4b5563" strokeWidth="1" rx="2" />
                {/* Top oven handle */}
                <rect x={50 + x * calculatedViewScale + (width * calculatedViewScale) - 10} y={30 + yPos * calculatedViewScale + 6 + ((height * calculatedViewScale - 16) / 4) - 2} width="4" height="4" fill="#9ca3af" rx="1" />
                {/* Bottom oven door */}
                <rect x={50 + x * calculatedViewScale + 6} y={30 + yPos * calculatedViewScale + 10 + (height * calculatedViewScale - 16) / 2} width={width * calculatedViewScale - 12} height={(height * calculatedViewScale - 16) / 2 - 2} fill="#1f2937" stroke="#4b5563" strokeWidth="1" rx="2" />
                {/* Bottom oven handle */}
                <rect x={50 + x * calculatedViewScale + (width * calculatedViewScale) - 10} y={30 + yPos * calculatedViewScale + 10 + (height * calculatedViewScale - 16) / 2 + ((height * calculatedViewScale - 16) / 4) - 2} width="4" height="4" fill="#9ca3af" rx="1" />
                {/* Center divider */}
                <line x1={50 + x * calculatedViewScale + 6} y1={30 + yPos * calculatedViewScale + 8 + (height * calculatedViewScale - 16) / 2} x2={50 + (x + width) * calculatedViewScale - 6} y2={30 + yPos * calculatedViewScale + 8 + (height * calculatedViewScale - 16) / 2} stroke="#666" strokeWidth="1" />
                <text x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} y={30 + (yPos + height) * calculatedViewScale - 6} textAnchor="middle" fontSize="7" fill="#e5e7eb" fontWeight="bold">
                  DOUBLE OVEN
                </text>
              </>
            )}

            {/* Wine Cooler Graphics */}
            {element.type === 'wine-cooler' && (
              <>
                {/* Wine cooler frame with stainless steel appearance */}
                <rect
                  x={50 + x * calculatedViewScale + 2}
                  y={30 + yPos * calculatedViewScale + 2}
                  width={width * calculatedViewScale - 4}
                  height={height * calculatedViewScale - 4}
                  fill="#d0d0d0"
                  stroke="#999"
                  strokeWidth="2"
                  rx="3"
                />
                {/* Glass door with slight tint */}
                <rect
                  x={50 + x * calculatedViewScale + 6}
                  y={30 + yPos * calculatedViewScale + 6}
                  width={width * calculatedViewScale - 12}
                  height={height * calculatedViewScale - 12}
                  fill="rgba(135, 206, 235, 0.15)"
                  stroke="#666"
                  strokeWidth="1"
                  rx="2"
                />
                {/* Wine racks - horizontal shelves */}
                {[0.25, 0.45, 0.65, 0.85].map((shelfPos, idx) => (
                  <line
                    key={idx}
                    x1={50 + x * calculatedViewScale + 8}
                    y1={30 + yPos * calculatedViewScale + (height * calculatedViewScale * shelfPos)}
                    x2={50 + (x + width) * calculatedViewScale - 8}
                    y2={30 + yPos * calculatedViewScale + (height * calculatedViewScale * shelfPos)}
                    stroke="#8B4513"
                    strokeWidth="2"
                  />
                ))}
                {/* Wine bottles - represented as small rectangles */}
                {[
                  { shelf: 0.25, bottles: 3 }, { shelf: 0.45, bottles: 3 },
                  { shelf: 0.65, bottles: 3 }, { shelf: 0.85, bottles: 2 }
                ].map((rack, rackIdx) =>
                  Array.from({ length: rack.bottles }, (_, bottleIdx) => (
                    <rect
                      key={`${rackIdx}-${bottleIdx}`}
                      x={50 + x * calculatedViewScale + 10 + (bottleIdx * (width * calculatedViewScale - 20) / rack.bottles)}
                      y={30 + yPos * calculatedViewScale + (height * calculatedViewScale * rack.shelf) - 8}
                      width="3"
                      height="16"
                      fill="#722F37"
                      stroke="#5D1A1D"
                      strokeWidth="0.5"
                      rx="1"
                    />
                  ))
                )}
                {/* Door handle */}
                <rect
                  x={50 + x * calculatedViewScale + (width * calculatedViewScale) - 8}
                  y={30 + yPos * calculatedViewScale + (height * calculatedViewScale * 0.4)}
                  width="4"
                  height="12"
                  fill="#666"
                  rx="2"
                />
                {/* Control panel */}
                <rect
                  x={50 + x * calculatedViewScale + 8}
                  y={30 + yPos * calculatedViewScale + 8}
                  width="16"
                  height="8"
                  fill="#333"
                  rx="1"
                />
                {/* LED indicators */}
                <circle cx={50 + x * calculatedViewScale + 12} cy={30 + yPos * calculatedViewScale + 12} r="1" fill="#00ff00" />
                <circle cx={50 + x * calculatedViewScale + 16} cy={30 + yPos * calculatedViewScale + 12} r="1" fill="#ff0000" />
                <text
                  x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                  y={30 + (yPos + height) * calculatedViewScale - 4}
                  textAnchor="middle"
                  fontSize="6"
                  fill="#666"
                  fontWeight="bold"
                >
                  WINE COOLER
                </text>
              </>
            )}

            {/* Range Hood Graphics */}
            {element.type === 'range-hood' && (
              <>
                {/* Range hood main body with realistic proportions */}
                <defs>
                  <linearGradient id={`hoodGradient-${element.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#e5e5e5" />
                    <stop offset="50%" stopColor="#c0c0c0" />
                    <stop offset="100%" stopColor="#a0a0a0" />
                  </linearGradient>
                </defs>
                {/* Main hood chassis */}
                <rect
                  x={50 + x * calculatedViewScale + 1}
                  y={30 + yPos * calculatedViewScale + 1}
                  width={width * calculatedViewScale - 2}
                  height={height * calculatedViewScale - 2}
                  fill={`url(#hoodGradient-${element.id})`}
                  stroke="#999"
                  strokeWidth="2"
                  rx="2"
                />
                {/* Hood canopy (angled front) */}
                <polygon
                  points={`
                    ${50 + x * calculatedViewScale + 4},${30 + yPos * calculatedViewScale + 4} 
                    ${50 + (x + width) * calculatedViewScale - 4},${30 + yPos * calculatedViewScale + 4} 
                    ${50 + (x + width) * calculatedViewScale - 8},${30 + (yPos + height) * calculatedViewScale - 4} 
                    ${50 + x * calculatedViewScale + 8},${30 + (yPos + height) * calculatedViewScale - 4}
                  `}
                  fill="rgba(255, 255, 255, 0.3)"
                  stroke="#bbb"
                  strokeWidth="1"
                />
                {/* Ventilation grilles */}
                {[0.25, 0.5, 0.75].map((pos, idx) => (
                  <g key={idx}>
                    <line
                      x1={50 + x * calculatedViewScale + (width * calculatedViewScale * pos) - 8}
                      y1={30 + yPos * calculatedViewScale + 6}
                      x2={50 + x * calculatedViewScale + (width * calculatedViewScale * pos) + 8}
                      y2={30 + yPos * calculatedViewScale + 6}
                      stroke="#666"
                      strokeWidth="1"
                    />
                    <line
                      x1={50 + x * calculatedViewScale + (width * calculatedViewScale * pos) - 8}
                      y1={30 + yPos * calculatedViewScale + 8}
                      x2={50 + x * calculatedViewScale + (width * calculatedViewScale * pos) + 8}
                      y2={30 + yPos * calculatedViewScale + 8}
                      stroke="#666"
                      strokeWidth="1"
                    />
                    <line
                      x1={50 + x * calculatedViewScale + (width * calculatedViewScale * pos) - 8}
                      y1={30 + yPos * calculatedViewScale + 10}
                      x2={50 + x * calculatedViewScale + (width * calculatedViewScale * pos) + 8}
                      y2={30 + yPos * calculatedViewScale + 10}
                      stroke="#666"
                      strokeWidth="1"
                    />
                  </g>
                ))}
                {/* Control panel */}
                <rect
                  x={50 + x * calculatedViewScale + (width * calculatedViewScale) - 20}
                  y={30 + yPos * calculatedViewScale + (height * calculatedViewScale * 0.6)}
                  width="16"
                  height="6"
                  fill="#333"
                  rx="1"
                />
                {/* Control buttons */}
                <circle cx={50 + x * calculatedViewScale + (width * calculatedViewScale) - 16} cy={30 + yPos * calculatedViewScale + (height * calculatedViewScale * 0.6) + 3} r="1.5" fill="#666" />
                <circle cx={50 + x * calculatedViewScale + (width * calculatedViewScale) - 12} cy={30 + yPos * calculatedViewScale + (height * calculatedViewScale * 0.6) + 3} r="1.5" fill="#666" />
                <circle cx={50 + x * calculatedViewScale + (width * calculatedViewScale) - 8} cy={30 + yPos * calculatedViewScale + (height * calculatedViewScale * 0.6) + 3} r="1.5" fill="#666" />
                {/* LED lights under hood */}
                {[0.3, 0.7].map((lightPos, idx) => (
                  <circle
                    key={idx}
                    cx={50 + x * calculatedViewScale + (width * calculatedViewScale * lightPos)}
                    cy={30 + (yPos + height) * calculatedViewScale - 6}
                    r="2"
                    fill="#ffffcc"
                    stroke="#ffcc00"
                    strokeWidth="0.5"
                  />
                ))}
                {/* Range hood label */}
                <text
                  x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2}
                  y={30 + (yPos + height / 2) * calculatedViewScale}
                  textAnchor="middle"
                  fontSize="6"
                  fill="#333"
                  fontWeight="bold"
                >
                  RANGE HOOD
                </text>
              </>
            )}

            {/* Dimension labels */}
            <text x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} y={30 + (yPos + height) * calculatedViewScale + 15} textAnchor="middle" fontSize="8" fill="#666">
              {width}"
            </text>

            {/* Height labels for tall elements */}
            {(element.type === 'wall' || element.type === 'tall' || element.type === 'medicine' || element.type === 'linen' ||
              element.type === 'medicine-mirror' || element.type === 'linen-tower' || element.type === 'vanity-tower') && (
                <text x={50 + (x + width) * calculatedViewScale + 5} y={30 + (yPos + height / 2) * calculatedViewScale} textAnchor="start" fontSize="8" fill="#666">
                  {height}"
                </text>
              )}

            {/* Mount height indicators for wall cabinets */}
            {element.mountHeight > 0 && (
              <>
                {/* Dashed vertical line from floor to cabinet bottom */}
                <line
                  x1={50 + x * calculatedViewScale - 10}
                  y1={30 + wallHeight * calculatedViewScale}
                  x2={50 + x * calculatedViewScale - 10}
                  y2={30 + (wallHeight - element.mountHeight) * calculatedViewScale}
                  stroke="#999"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
                {/* Mount height measurement label */}
                <text
                  x={50 + x * calculatedViewScale - 15}
                  y={30 + (wallHeight - element.mountHeight / 2) * calculatedViewScale}
                  textAnchor="end"
                  fontSize="7"
                  fill="#999"
                >
                  {element.mountHeight.toFixed(1)}"
                </text>
              </>
            )}

            {/* Element number badge */}
            <circle cx={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} cy={30 + yPos * calculatedViewScale - 10} r="8" fill="white" stroke="#333" strokeWidth="1" />
            <text x={50 + x * calculatedViewScale + (width * calculatedViewScale) / 2} y={30 + yPos * calculatedViewScale - 7} textAnchor="middle" fontSize="8" fontWeight="bold">
              {currentRoomData.elements.indexOf(element) + 1}
            </text>

            {/* Keyboard focus ring (hidden by default so it stays out of the PDF) */}
            {onElementKeyDown && (
              <rect
                className="kd-focus-ring"
                x={50 + x * calculatedViewScale - 4}
                y={30 + yPos * calculatedViewScale - 4}
                width={width * calculatedViewScale + 8}
                height={height * calculatedViewScale + 8}
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
      })}

      {/* Floor line */}
      <line x1="50" y1={30 + wallHeight * calculatedViewScale} x2={50 + wallWidth * calculatedViewScale} y2={30 + wallHeight * calculatedViewScale} stroke="#333" strokeWidth="2" />

      {/* Counter height reference line (34.5 inches from floor) */}
      {wallHeight > 34.5 && (
        <>
          <line x1="50" y1={30 + (wallHeight - 34.5) * calculatedViewScale} x2={50 + wallWidth * calculatedViewScale} y2={30 + (wallHeight - 34.5) * calculatedViewScale} stroke="#999" strokeWidth="0.5" strokeDasharray="2,2" />
          <text x="45" y={30 + (wallHeight - 34.5) * calculatedViewScale} textAnchor="end" fontSize="8" fill="#666">34.5"</text>
        </>
      )}
    </svg>
  );
};

export default WallView;