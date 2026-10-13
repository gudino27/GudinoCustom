import React, { forwardRef } from 'react';
import DraggableCabinet, { HousingBadge } from '../DraggableCabinet';
import PantryPlan from './PantryPlan';
import { renderDoorGraphic, renderWallWithDoors, doorSymbol } from '../RenderingHelpers';
import { PLAN, formatFeetInches, formatInches, labelWidth } from './planStyle';
import { getDoorsOnWall } from '../../../utils/designer/wallViewUtils';
import { elementsOnWallFace, parseWallKey, wallFaceKey, wallThicknessPx } from '../../../utils/designer/wallFaces';
import { pantryWallInfo } from '../../../utils/designer/pantry';
import { planTransform } from '../../../utils/designer/rotation';
import { useLanguage } from '../../../contexts/LanguageContext';

// A read-only floor plan of a saved design, drawn with the customer
// designer's own pieces (DraggableCabinet / PlanSymbol, HousingBadge,
// PantryPlan, the hatched walls and door swings of RenderingHelpers), so a
// submitted design looks in the admin viewer the way the customer drew it:
// walls, drawn and pantry walls, openings, room dimensions, item badges and
// names, wall numbers (#1 top, #2 right, #3 bottom, #4 left).
//
// No handlers: nothing here can be dragged or edited. `selectedId` outlines
// one item and shows its dimensions (the admin's item list sets it).
//
// Element x / y are plan px at the designer's fit scale (see
// utils/designer/normalizeDesign.js fitScale); pass that as `scale`.

const OFFSET = 30; // the room's inside corner in the SVG (as the designer)
const FONT = 'Arial, Helvetica, sans-serif';

/** The room's items in the order the designer numbers them (by zIndex, stable). */
export const planOrder = (elements = []) =>
  elements
    .map((el, i) => ({ el, i }))
    .sort((a, b) => (a.el.zIndex || 0) - (b.el.zIndex || 0) || a.i - b.i)
    .map((o) => o.el);

/**
 * Translated name of a wall or wall face key ("7:left"), as the designer's
 * wall view names it.
 */
export const wallLabelFor = (t, roomData, wallKey) => {
  const { wallNumber, face } = parseWallKey(wallKey);
  const names = {
    1: t('designer.wall.north'),
    2: t('designer.wall.east'),
    3: t('designer.wall.south'),
    4: t('designer.wall.west'),
  };
  if (names[wallNumber]) return `#${wallNumber} ${names[wallNumber]}`;
  const info = pantryWallInfo(roomData, wallNumber);
  const name = info
    ? info.number
      ? t('designer.pantry.wallNameN', { n: info.number, letter: info.letter })
      : t('designer.pantry.wallName', { letter: info.letter })
    : t('designer.wall.custom', { n: wallNumber });
  if (!face) return name;
  const wall = (roomData.customWalls || []).find((w) => w.wallNumber === wallNumber);
  const side = wall && wall.pantryId
    ? face === wall.pantryInside
      ? t('designer.pantry.pantrySide')
      : t('designer.pantry.kitchenSide')
    : face === 'right'
    ? t('designer.wall.sideA')
    : t('designer.wall.sideB');
  return t('designer.wall.faceLabel', { wall: name, side });
};

/**
 * Wall views worth showing: walls 1-4 and each face of a drawn or pantry wall
 * with something against it (as the designer's quote does).
 */
export const wallViewKeys = (roomData, scale) => [
  1, 2, 3, 4,
  ...(roomData.customWalls || [])
    .filter((w) => (roomData.walls || []).includes(w.wallNumber))
    .flatMap((w) => {
      const inside = w.pantryInside;
      const faces = inside ? [inside === 'left' ? 'right' : 'left', inside] : ['right', 'left'];
      return faces
        .filter((face) => elementsOnWallFace(w, face, roomData.elements || [], scale).length > 0)
        .map((face) => wallFaceKey(w.wallNumber, face));
    }),
];

const PlanDefs = ({ scale }) => (
  <defs>
    <pattern id="grid" x={OFFSET} y={OFFSET} width={48 * scale} height={48 * scale} patternUnits="userSpaceOnUse">
      <rect width={48 * scale} height={48 * scale} fill={PLAN.paper} />
      <path
        d={[1, 2, 3].map((i) => `M ${i * 12 * scale} 0 V ${48 * scale} M 0 ${i * 12 * scale} H ${48 * scale}`).join(' ')}
        fill="none"
        stroke={PLAN.gridMinor}
        strokeWidth="0.5"
      />
      <path d={`M ${48 * scale} 0 L 0 0 0 ${48 * scale}`} fill="none" stroke={PLAN.gridMajor} strokeWidth="0.75" />
    </pattern>
    <pattern id="kdWallPoche" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill={PLAN.wall} />
      <line x1="0" y1="0" x2="0" y2="6" stroke={PLAN.wallHatch} strokeWidth="1.5" />
    </pattern>
    <pattern id="woodGrain" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M0,8 Q10,6 20,8 T40,8" fill="none" stroke="#c4a882" strokeWidth="0.5" opacity="0.4" />
      <path d="M0,16 Q8,14 18,17 T40,15" fill="none" stroke="#c4a882" strokeWidth="0.5" opacity="0.35" />
      <path d="M0,24 Q12,22 22,25 T40,23" fill="none" stroke="#c4a882" strokeWidth="0.5" opacity="0.4" />
      <path d="M0,32 Q6,30 16,33 T40,31" fill="none" stroke="#c4a882" strokeWidth="0.5" opacity="0.35" />
      <path d="M5,4 Q15,2 25,5" fill="none" stroke="#b89b6a" strokeWidth="0.3" opacity="0.3" />
      <path d="M10,20 Q20,18 30,21" fill="none" stroke="#b89b6a" strokeWidth="0.3" opacity="0.3" />
      <path d="M2,36 Q12,34 22,37" fill="none" stroke="#b89b6a" strokeWidth="0.3" opacity="0.3" />
    </pattern>
    <pattern id="woodGrainDark" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M0,8 Q10,6 20,8 T40,8" fill="none" stroke="#8b7355" strokeWidth="0.6" opacity="0.5" />
      <path d="M0,16 Q8,14 18,17 T40,15" fill="none" stroke="#8b7355" strokeWidth="0.6" opacity="0.45" />
      <path d="M0,24 Q12,22 22,25 T40,23" fill="none" stroke="#8b7355" strokeWidth="0.6" opacity="0.5" />
      <path d="M0,32 Q6,30 16,33 T40,31" fill="none" stroke="#8b7355" strokeWidth="0.6" opacity="0.45" />
      <path d="M5,4 Q15,2 25,5" fill="none" stroke="#6b5344" strokeWidth="0.4" opacity="0.4" />
      <path d="M10,20 Q20,18 30,21" fill="none" stroke="#6b5344" strokeWidth="0.4" opacity="0.4" />
    </pattern>
  </defs>
);

/** Room walls 1-4 (hatched, with their doors) and the openings of removed walls. */
const RoomWalls = ({ roomData, scale, roomW, roomH }) => {
  const present = roomData.walls || [1, 2, 3, 4];
  const removed = roomData.removedWalls || [];
  const customWalls = roomData.customWalls || [];
  const rects = {
    1: { x: 20, y: 20, width: roomW + 20, height: 10, isHorizontal: true },
    3: { x: 20, y: OFFSET + roomH, width: roomW + 20, height: 10, isHorizontal: true },
    4: { x: 20, y: 20, width: 10, height: roomH + 20, isHorizontal: false },
    2: { x: OFFSET + roomW, y: 20, width: 10, height: roomH + 20, isHorizontal: false },
  };
  const opening = (n) => {
    const r = rects[n];
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    return (
      <g key={`opening-${n}`}>
        <rect
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill="#f9fafb"
          stroke={PLAN.hairline}
          strokeWidth="1"
          strokeDasharray="3,3"
        />
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          fontSize="8"
          fill={PLAN.inkSoft}
          transform={r.isHorizontal ? undefined : `rotate(-90, ${cx}, ${cy})`}
        >
          OPENING
        </text>
      </g>
    );
  };
  return (
    <g>
      {[1, 3, 4, 2].map((n) => (present.includes(n) ? (
        <g key={`room-wall-${n}`}>{renderWallWithDoors(n, rects[n], roomData, customWalls, scale)}</g>
      ) : null))}
      {removed.filter((n) => rects[n]).map(opening)}
    </g>
  );
};

/** One drawn or pantry wall, hatched, with its doors / cased openings. */
const CustomWall = ({ storedWall, roomData, scale, existedPriorLabel }) => {
  const wall = storedWall.pantryId
    ? { ...storedWall, thickness: wallThicknessPx(storedWall, scale) }
    : storedWall;
  const x1 = OFFSET + wall.x1;
  const y1 = OFFSET + wall.y1;
  const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  const angle = (Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180) / Math.PI;
  const turn = `rotate(${angle}, ${x1}, ${y1})`;
  const top = y1 - wall.thickness / 2;
  const doors = getDoorsOnWall(wall.wallNumber, roomData.doors || []).sort((a, b) => a.position - b.position);
  const lengthIn = length / scale;

  const piece = (key, from, to) => (to > from ? (
    <g key={key}>
      <rect x={x1 + (from / 100) * length} y={top} width={((to - from) / 100) * length} height={wall.thickness} fill="#666" transform={turn} />
      <rect x={x1 + (from / 100) * length} y={top} width={((to - from) / 100) * length} height={wall.thickness} fill="url(#kdWallPoche)" transform={turn} />
    </g>
  ) : null);

  const parts = [];
  let at = 0;
  doors.forEach((door, i) => {
    const half = lengthIn > 0 ? (door.width / lengthIn) * 50 : 0;
    const start = Math.max(0, door.position - half);
    const end = Math.min(100, door.position + half);
    parts.push(piece(`seg-${i}`, at, start));
    parts.push(
      <g key={`door-${door.id || i}`} transform={turn}>
        {doorSymbol({
          key: `door-symbol-${door.id || i}`,
          type: door.type,
          u0: x1 + (start / 100) * length,
          u1: x1 + (end / 100) * length,
          face: y1 + wall.thickness / 2,
          inward: 1,
          thickness: wall.thickness,
        })}
        <text
          x={x1 + (door.position / 100) * length}
          y={y1 - wall.thickness / 2 - 4}
          textAnchor="middle"
          fontSize="10"
          fill={PLAN.ink}
          stroke={PLAN.paper}
          strokeWidth="3"
          paintOrder="stroke"
        >
          {formatInches(door.width)}
        </text>
      </g>
    );
    at = end;
  });
  parts.push(piece('seg-end', at, 100));

  return (
    <g data-wall-number={wall.wallNumber}>
      {parts}
      {wall.existedPrior && !wall.pantryId && (
        <text
          x={OFFSET + (wall.x1 + wall.x2) / 2}
          y={OFFSET + (wall.y1 + wall.y2) / 2 + 20}
          textAnchor="middle"
          fontSize="8"
          fill="#047857"
          fontWeight="bold"
        >
          {`✓ ${existedPriorLabel}`}
        </text>
      )}
    </g>
  );
};

/** Width above the top wall, depth left of the left wall. */
const RoomDimensions = ({ roomData, roomW, roomH }) => {
  const tick = 3.5;
  const wLabel = formatFeetInches(roomData.dimensions.width);
  const hLabel = formatFeetInches(roomData.dimensions.height);
  const wKnock = labelWidth(wLabel, 10);
  const hKnock = labelWidth(hLabel, 10);
  const cx = OFFSET + roomW / 2;
  const cy = OFFSET + roomH / 2;
  const ext = { stroke: PLAN.line, strokeWidth: 0.6 };
  const dim = { stroke: PLAN.ink, strokeWidth: 0.8 };
  const tk = { stroke: PLAN.ink, strokeWidth: 1.2 };
  const text = {
    textAnchor: 'middle',
    dominantBaseline: 'central',
    fontSize: 10,
    fontWeight: 600,
    fontFamily: FONT,
    fill: PLAN.ink,
  };
  return (
    <g pointerEvents="none">
      <line x1="30" y1="4" x2="30" y2="17" {...ext} />
      <line x1={30 + roomW} y1="4" x2={30 + roomW} y2="17" {...ext} />
      <line x1="30" y1="10" x2={30 + roomW} y2="10" {...dim} />
      <line x1={30 - tick} y1={10 + tick} x2={30 + tick} y2={10 - tick} {...tk} />
      <line x1={30 + roomW - tick} y1={10 + tick} x2={30 + roomW + tick} y2={10 - tick} {...tk} />
      <rect x={cx - wKnock / 2} y="3" width={wKnock} height="14" fill={PLAN.paper} />
      <text x={cx} y="10" {...text}>{wLabel}</text>
      <line x1="4" y1="30" x2="17" y2="30" {...ext} />
      <line x1="4" y1={30 + roomH} x2="17" y2={30 + roomH} {...ext} />
      <line x1="10" y1="30" x2="10" y2={30 + roomH} {...dim} />
      <line x1={10 - tick} y1={30 + tick} x2={10 + tick} y2={30 - tick} {...tk} />
      <line x1={10 - tick} y1={30 + roomH + tick} x2={10 + tick} y2={30 + roomH - tick} {...tk} />
      <g transform={`rotate(-90, 10, ${cy})`}>
        <rect x={10 - hKnock / 2} y={cy - 7} width={hKnock} height="14" fill={PLAN.paper} />
        <text x="10" y={cy} {...text}>{hLabel}</text>
      </g>
    </g>
  );
};

/** #1 top, #2 right, #3 bottom, #4 left: tagged on the wall, clear of its doors. */
const WallTags = ({ roomData, roomW, roomH }) => (
  <g pointerEvents="none" aria-hidden="true">
    {[1, 2, 3, 4].map((n) => {
      const horizontal = n === 1 || n === 3;
      const spanPx = (horizontal ? roomW : roomH) + 20;
      const lengthIn = parseFloat(horizontal ? roomData.dimensions.width : roomData.dimensions.height) * 12;
      const doorsHere = getDoorsOnWall(n, roomData.doors || []);
      const removed = (roomData.removedWalls || []).includes(n);
      const clear = (p) => doorsHere.every((d) => Math.abs(p - d.position) > (d.width / lengthIn) * 50 + 6);
      const candidates = removed ? [25, 75, 12, 88] : [50, 25, 75, 12, 88];
      const pos = candidates.find(clear) ?? candidates[0];
      const along = 20 + (pos / 100) * spanPx;
      const cx = horizontal ? along : n === 4 ? 25 : 35 + roomW;
      const cy = horizontal ? (n === 1 ? 25 : 35 + roomH) : along;
      return (
        <g key={`wall-tag-${n}`}>
          <rect x={cx - 10} y={cy - 6.5} width="20" height="13" rx="3" fill={PLAN.paper} stroke={PLAN.wall} strokeWidth="1" />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="700" fontFamily={FONT} fill={PLAN.ink}>
            {`#${n}`}
          </text>
        </g>
      );
    })}
  </g>
);

/** An item of a type this version does not know: a dashed box with its type. */
const UnknownItem = ({ element, scale, number }) => {
  const w = (Number(element.width) || 24) * scale;
  const d = (Number(element.depth) || 24) * scale;
  return (
    <g transform={planTransform(element, element.x, element.y, scale)} data-unknown-type={element.type}>
      <rect width={w} height={d} fill="#fef3c7" stroke="#b45309" strokeWidth="1" strokeDasharray="4 2" />
      <text
        x={w / 2}
        y={d / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="8"
        fontFamily={FONT}
        fill="#78350f"
        transform={element.rotation ? `rotate(${-element.rotation}, ${w / 2}, ${d / 2})` : undefined}
      >
        {`#${number} ${element.type || '?'}`}
      </text>
    </g>
  );
};

const PlanView = forwardRef(({ roomData, elementTypes, scale, selectedId = null, title, className, style }, ref) => {
  const { t } = useLanguage();
  if (!roomData || !roomData.dimensions) return null;
  const roomW = (parseFloat(roomData.dimensions.width) || 0) * 12 * scale;
  const roomH = (parseFloat(roomData.dimensions.height) || 0) * 12 * scale;
  if (!roomW || !roomH) return null;
  // the designer numbers items in this order (see planOrder)
  const room = { ...roomData, elements: planOrder(roomData.elements || []) };
  const pantries = room.pantries || [];
  const pantryLabel = (p) => {
    const i = pantries.findIndex((q) => q.id === p.id);
    return pantries.length > 1 ? t('designer.pantry.labelN', { n: i + 1 }) : t('designer.pantry.label');
  };
  const width = roomW + 60;
  const height = roomH + 60;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title}
      className={className}
      style={{ maxWidth: '100%', height: 'auto', ...style }}
    >
      {title ? <title>{title}</title> : null}
      <PlanDefs scale={scale} />
      <rect x="0" y="0" width={width} height={height} fill="white" />
      <rect x={OFFSET} y={OFFSET} width={roomW} height={roomH} fill="url(#grid)" />

      <RoomWalls roomData={room} scale={scale} roomW={roomW} roomH={roomH} />
      {(room.customWalls || [])
        .filter((w) => (room.walls || []).includes(w.wallNumber))
        .map((w) => (
          <CustomWall
            key={w.id || w.wallNumber}
            storedWall={w}
            roomData={room}
            scale={scale}
            existedPriorLabel={t('designer.existedPriorLabel')}
          />
        ))}

      <g transform={`translate(${OFFSET}, ${OFFSET})`}>
        <PantryPlan
          layer="floor"
          pantries={pantries}
          roomData={room}
          scale={scale}
          interactive={false}
          labelFor={pantryLabel}
          existedPriorLabel={t('designer.existedPriorLabel')}
        />
      </g>

      <RoomDimensions roomData={room} roomW={roomW} roomH={roomH} />

      <g transform={`translate(${OFFSET}, ${OFFSET})`}>
        {room.elements.map((element, i) => (elementTypes[element.type] ? (
          <DraggableCabinet
            key={element.id}
            element={element}
            scale={scale}
            isSelected={selectedId !== null && String(element.id) === String(selectedId)}
            isDragging={false}
            selectedElement={selectedId}
            elementTypes={elementTypes}
            renderDoorGraphic={renderDoorGraphic}
            currentRoomData={room}
          />
        ) : (
          <UnknownItem key={element.id} element={element} scale={scale} number={i + 1} />
        )))}
        {room.elements.map((element) => (elementTypes[element.type] ? (
          <HousingBadge
            key={`housing-badge-${element.id}`}
            element={element}
            scale={scale}
            elementTypes={elementTypes}
            currentRoomData={room}
          />
        ) : null))}
      </g>

      <WallTags roomData={room} roomW={roomW} roomH={roomH} />
    </svg>
  );
});

PlanView.displayName = 'PlanView';

export default PlanView;
