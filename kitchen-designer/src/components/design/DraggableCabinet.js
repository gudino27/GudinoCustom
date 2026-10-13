import React from 'react';
import { getElementName } from './elementName';
import { useLanguage } from '../../contexts/LanguageContext';
import { footprint, isQuarterTurned, planTransform } from '../../utils/designer/rotation';
import { housedElements, housingOf, isHousable } from '../../utils/designer/housing';
import { housingAround } from '../../utils/designer/collisionUtils';
import { renderPlanSymbol, PlanBadge } from './plan/PlanSymbol';
import { placeLabel, planBox, frontSide, rowAt } from './plan/labelPlacement';
import {
  PLAN,
  BADGE_H,
  badgeWidth,
  finishOf,
  formatInches,
  labelWidth,
  symbolKind
} from './plan/planStyle';

// A fridge and the refrigerator cabinet it stands in share one spot on the
// plan, so their number badges would sit on top of each other: the cabinet's
// badge goes in the back corner of the cabinet over the opening (drawn by
// HousingBadge, above the fridge) and the fridge's at the front of the bay;
// the cabinet's name goes one line under the fridge's.

const LABEL_SIZE = 9;       // item names (the plan used 8)
const LINE = 12;            // one label line
const DIM_GAP = 9;          // footprint edge -> dimension line of a selected item
const FONT = 'Arial, Helvetica, sans-serif';

// Medicine cabinets / mirrors carry hand-tuned per-rotation offsets that line
// them up with the wall view (see utils/designer/rotation.js OLD_PIVOT_TYPES)
const OLD_PIVOT_TYPES = new Set(['medicine', 'medicine-mirror']);
const bodyOffset = (element) => {
  if (element.type !== 'medicine-mirror') return { x: 0, y: 0 };
  return ({ 90: { x: 0, y: 30 }, 270: { x: -40, y: 28 }, '-90': { x: -40, y: 28 } }[element.rotation]) || { x: 0, y: 0 };
};

const isCornerType = (type) => type === 'corner' || type === 'corner-wall';

const roomOf = (roomData, scale) => {
  const dims = (roomData && roomData.dimensions) || {};
  const width = parseFloat(dims.width) * 12 * scale;
  const depth = parseFloat(dims.height) * 12 * scale;
  return Number.isFinite(width) && Number.isFinite(depth) ? { width, depth } : null;
};

const nameWidth = (name) => labelWidth(name, LABEL_SIZE) - 4;

/**
 * Where a housed pair's names go: the fridge's name and, one line further
 * out, its cabinet's. DraggableCabinet (fridge) and HousingBadge (cabinet)
 * both ask, with the same arguments, so they agree.
 */
const placePair = (fridge, scale, roomData, names) => placeLabel(fridge, scale, {
  elements: roomData.elements,
  room: roomOf(roomData, scale),
  width: Math.max(...names.map(nameWidth)),
  lines: 2
});

/** Name text with a white halo (paint-order, no filter) so it reads over the grid. */
const NameText = ({ x, y, children, anchor = 'middle' }) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    dominantBaseline="central"
    fontSize={LABEL_SIZE}
    fontFamily={FONT}
    fill={PLAN.inkSoft}
    stroke={PLAN.paper}
    strokeWidth="3"
    strokeLinejoin="round"
    paintOrder="stroke"
  >
    {children}
  </text>
);

/** A dimension line from (x1, y1) to (x2, y2) with 45-degree ticks and a centred label. */
const DimLine = ({ x1, y1, x2, y2, label, vertical = false }) => {
  const t = 3;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const kw = labelWidth(label, LABEL_SIZE);
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PLAN.accent} strokeWidth="0.8" />
      <line x1={x1 - t} y1={y1 + t} x2={x1 + t} y2={y1 - t} stroke={PLAN.accent} strokeWidth="1" />
      <line x1={x2 - t} y1={y2 + t} x2={x2 + t} y2={y2 - t} stroke={PLAN.accent} strokeWidth="1" />
      <g transform={vertical ? `rotate(-90, ${mx}, ${my})` : undefined}>
        <rect x={mx - kw / 2} y={my - 6} width={kw} height={12} rx="2" fill={PLAN.paper} />
        <text
          x={mx}
          y={my}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={LABEL_SIZE}
          fontWeight="700"
          fontFamily={FONT}
          fill={PLAN.accentInk}
        >
          {label}
        </text>
      </g>
    </g>
  );
};

/**
 * The number badge and name of a refrigerator cabinet with a fridge in it.
 * Drawn after every item (the fridge covers the cabinet); grabbing the badge
 * drags the cabinet. The cabinet's own <g> carries its accessible name.
 */
export const HousingBadge = ({ element, scale, elementTypes, currentRoomData, onMouseDown }) => {
  const { t } = useLanguage();
  if (!housingOf(element, elementTypes)) return null;
  const [inside] = housedElements(element, currentRoomData.elements, elementTypes, scale);
  if (!inside) return null;
  const w = element.width * scale;
  const n = currentRoomData.elements.indexOf(element) + 1;
  const bw = badgeWidth(n);
  const rot = element.rotation || 0;
  // The cabinet's name goes one line past the fridge's name
  const cabinetName = getElementName(t, element.type, elementTypes);
  const fridgeRow = placePair(inside, scale, currentRoomData, [
    getElementName(t, inside.type, elementTypes),
    cabinetName
  ]);
  const nameY = fridgeRow && (fridgeRow.side === 'above' ? fridgeRow.y - LINE : fridgeRow.y + LINE);
  // Read-only plans (the admin viewer) pass no onMouseDown
  const grab = !onMouseDown ? {} : {
    style: { cursor: 'grab' },
    onMouseDown: (e) => onMouseDown(e, element.id),
    onTouchStart: (e) => {
      e.preventDefault();
      e.stopPropagation();
      onMouseDown(e, element.id);
    }
  };
  return (
    <g aria-hidden="true">
      <g transform={planTransform(element, element.x, element.y, scale)} {...grab}>
        <PlanBadge n={n} cx={w - bw / 2 - 1} cy={BADGE_H / 2 + 1} rotate={-rot} />
      </g>
      {fridgeRow && (
        <g pointerEvents="none">
          <NameText x={fridgeRow.x} y={nameY} anchor={fridgeRow.anchor}>{cabinetName}</NameText>
        </g>
      )}
    </g>
  );
};

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

  // On the whole item, not just its body: grabbing it by the number badge,
  // burners, sink bowl or name has to start a drag too. Read-only plans (the
  // admin viewer) pass no onMouseDown: no drag, no grab cursor.
  const readOnly = !onMouseDown;
  const dragProps = readOnly ? {} : {
    onMouseDown: (e) => onMouseDown(e, element.id),
    onTouchStart: (e) => {
      e.preventDefault();
      e.stopPropagation();
      onMouseDown(e, element.id);
    }
  };

  const corner = isCornerType(element.type);
  const w = element.width * scale;
  // Corner cabinets are square (their width both ways), as they always were
  const d = corner ? w : element.depth * scale;
  const rot = corner ? 0 : (element.rotation || 0);
  const off = bodyOffset(element);
  const kind = symbolKind(element.type, elementSpec);
  const finish = finishOf(element, element.category || elementSpec.category);
  const beingDragged = isDragging && element.id === selectedElement;
  const number = currentRoomData.elements.indexOf(element) + 1;
  const name = getElementName(t, element.type, elementTypes);

  // A cabinet that houses an appliance (refrigerator cabinet) is drawn as a
  // surround: a side panel either side of an open bay, with the cabinet over
  // the bay shown dashed (overhead), so the fridge inside stays visible
  const housing = housingOf(element, elementTypes);
  // Badges of a housed pair (see HousingBadge): the cabinet leaves its badge
  // and name to HousingBadge; the fridge moves its badge to the front left
  const holdsItem = !!housing &&
    housedElements(element, currentRoomData.elements, elementTypes, scale).length > 0;
  const isHoused = !housing && isHousable(element.type, elementTypes) &&
    !!housingAround(element, currentRoomData.elements, elementTypes, scale);

  const renderSurround = () => {
    const p = Math.min(housing.sidePanel * scale, w / 2);
    const bay = Math.max(0, w - 2 * p);
    return (
      <>
        {/* The open bay (a light floor, so an empty cabinet can still be grabbed) */}
        <rect x={p} y={0} width={bay} height={d} fill="#f6f7f8" stroke="none" />
        {/* The cabinet over the bay: dashed outline and cross (overhead) */}
        <g pointerEvents="none">
          <rect x={p} y={0} width={bay} height={d} fill="none" stroke={finish.stroke} strokeWidth="0.75" strokeDasharray="4 2.5" />
          <line x1={p} y1={0} x2={w - p} y2={d} stroke={PLAN.hairline} strokeWidth="0.5" strokeDasharray="4 2.5" />
          <line x1={w - p} y1={0} x2={p} y2={d} stroke={PLAN.hairline} strokeWidth="0.5" strokeDasharray="4 2.5" />
        </g>
        {/* Side panels */}
        {[0, w - p].map((px) => (
          <g key={px}>
            <rect x={px} y={0} width={p} height={d} fill={finish.fill} stroke={finish.stroke} strokeWidth="1" />
            {finish.grain && <rect x={px} y={0} width={p} height={d} fill="url(#woodGrain)" stroke="none" pointerEvents="none" />}
          </g>
        ))}
      </>
    );
  };

  // Upright overlay: badge, name and dimensions are drawn about the centre of
  // the plan footprint and turned back by the item's rotation, so text never
  // reads sideways or upside down
  const pivot = OLD_PIVOT_TYPES.has(element.type)
    ? (() => { const fp = footprint(element, scale); return { x: fp.width / 2, y: fp.depth / 2 }; })()
    : { x: w / 2 + off.x, y: d / 2 + off.y };
  const box = planBox(element, scale);
  const fpW = box.width;
  const fpD = box.depth;
  const quarter = !corner && isQuarterTurned(element.rotation);
  const horizontalIn = quarter ? element.depth : element.width;
  const verticalIn = corner ? element.width : (quarter ? element.width : element.depth);

  // Number badge: inside the item, in its top-left corner as seen on the
  // plan (centred on items too small for that), always upright
  const showBadge = !holdsItem && !isHoused;
  const bw = badgeWidth(number);
  const roomy = fpW >= bw + 6 && fpD >= BADGE_H + 6;
  const badgeAt = roomy
    ? { x: -fpW / 2 + bw / 2 + 3, y: -fpD / 2 + BADGE_H / 2 + 3 }
    : { x: 0, y: 0 };

  // Name: out in the room on the item's front side, or another clear side
  // (labelPlacement). A housed fridge reserves two lines: its cabinet's name
  // (HousingBadge) goes under its own
  const showName = !holdsItem;
  let row = null;
  if (showName) {
    const housedIn = isHoused
      ? housingAround(element, currentRoomData.elements, elementTypes, scale)
      : null;
    row = housedIn && housedIn.type
      ? placePair(element, scale, currentRoomData, [name, getElementName(t, housedIn.type, elementTypes)])
      : placeLabel(element, scale, {
          elements: currentRoomData.elements,
          room: roomOf(currentRoomData, scale),
          width: nameWidth(name)
        });
    // The selected item always shows its name
    if (!row && isSelected) row = { side: frontSide(element), ...rowAt(box, frontSide(element)) };
  }
  // Row position about the footprint centre (the overlay's origin); the
  // selected item's dimension lines run above and left of it, so rows there
  // move one step further out
  const dimShift = isSelected ? DIM_GAP + 6 : 0;
  const rowLocal = row && {
    x: row.x - (box.x + fpW / 2) - (row.side === 'left' ? dimShift : 0),
    y: row.y - (box.y + fpD / 2) - (row.side === 'above' ? dimShift : 0)
  };

  // Selection: accent outline with corner handles (shape, not just colour)
  const hx0 = off.x - 2.5;
  const hy0 = off.y - 2.5;
  const hw = w + 5;
  const hh = d + 5;
  const handle = 4;

  return (
    <g
      key={element.id}
      data-element-id={element.id}
      transform={corner ? `translate(${element.x}, ${element.y})` : planTransform(element, element.x, element.y, scale)}
      style={readOnly ? undefined : { cursor: beingDragged ? 'grabbing' : 'grab' }}
      {...keyboardProps}
      {...dragProps}
    >
      {/* The plan symbol */}
      <g
        transform={off.x || off.y ? `translate(${off.x}, ${off.y})` : undefined}
        style={readOnly ? undefined : {
          cursor: beingDragged ? (dragPreviewPosition?.snapped ? 'copy' : 'grabbing') : 'grab',
          opacity: beingDragged ? 0.75 : 1,
          touchAction: 'none'
        }}
      >
        {housing ? renderSurround() : renderPlanSymbol({ element, kind, w, d, scale, finish, rot })}
      </g>

      {/* Corner cabinet door swing (same arcs as before, for the hinge side) */}
      {corner && renderDoorGraphic && (
        <g pointerEvents="none">
          {element.hingeDirection === 'left'
            ? renderDoorGraphic(w * 0.6, 0, w * 0.9, w * 0.6, 0)
            : renderDoorGraphic(w * -0.1, w * 0.6, w * 0.9, w * 0.5, 90)}
        </g>
      )}

      {/* Housed fridge: its badge at the front left of the bay */}
      {isHoused && (
        <PlanBadge
          n={number}
          cx={badgeWidth(number) / 2 + 1}
          cy={d - BADGE_H / 2 - 1}
          rotate={-rot}
          emphasis={isSelected}
        />
      )}

      {isSelected && (
        <g pointerEvents="none">
          <rect x={hx0} y={hy0} width={hw} height={hh} fill="none" stroke={PLAN.accent} strokeWidth="1.5" rx="1" />
          {[[hx0, hy0], [hx0 + hw, hy0], [hx0, hy0 + hh], [hx0 + hw, hy0 + hh]].map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              x={x - handle / 2}
              y={y - handle / 2}
              width={handle}
              height={handle}
              fill={PLAN.paper}
              stroke={PLAN.accent}
              strokeWidth="1.2"
            />
          ))}
        </g>
      )}

      <g transform={`translate(${pivot.x}, ${pivot.y})${rot ? ` rotate(${-rot})` : ''}`}>
        {showBadge && (
          <PlanBadge n={number} cx={badgeAt.x} cy={badgeAt.y} emphasis={isSelected} />
        )}
        {/* Name (a cabinet with a fridge in it: HousingBadge) */}
        {rowLocal && (
          <NameText x={rowLocal.x} y={rowLocal.y} anchor={row.anchor}>{name}</NameText>
        )}

        {/* Dimensions of the selected item */}
        {isSelected && (
          <>
            <DimLine
              x1={-fpW / 2}
              y1={-fpD / 2 - DIM_GAP}
              x2={fpW / 2}
              y2={-fpD / 2 - DIM_GAP}
              label={formatInches(horizontalIn)}
            />
            <DimLine
              x1={-fpW / 2 - DIM_GAP}
              y1={-fpD / 2}
              x2={-fpW / 2 - DIM_GAP}
              y2={fpD / 2}
              label={formatInches(verticalIn)}
              vertical
            />
          </>
        )}
      </g>

      {onKeyDown && (
        <rect
          className="kd-focus-ring"
          x={off.x - 4}
          y={off.y - 4}
          width={w + 8}
          height={d + 8}
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
});

export default DraggableCabinet;
