import React from 'react';
import { PLAN, formatFeetInches, labelWidth } from './planStyle';
import { partitionSides, sideSegment } from '../../../utils/designer/pantry';

// A pantry on the floor plan (its walls are drawn with the other custom
// walls, hatched like every wall). Two layers, both in room coordinates
// (draw them inside the plan's translate(30, 30) group):
//
//   layer 'floor'    a faint tint over its inside and the "Pantry" tag with
//                    its size: the handle to drag it by (and to reach it
//                    from the keyboard). Drawn under the items.
//   layer 'handles'  when selected: a dashed outline and a grip on each
//                    partition to drag that wall in or out. Drawn over the
//                    items.
//
// onPointerDown(event, pantryId, mode 'move' | 'resize', side?) starts a drag;
// the page does the moving (utils/designer/pantry.js).
const PantryPlan = ({
  layer,
  pantries = [],
  roomData,
  scale,
  selectedId,
  interactive = true,
  labelFor,
  ariaLabelFor,
  existedPriorLabel,
  sideLabel,
  onPointerDown,
  onKeyDown,
}) => {
  if (!pantries.length) return null;

  if (layer === 'floor') {
    return (
      <g>
        {pantries.map((p) => {
          const name = labelFor(p);
          const size = `${formatFeetInches(p.width / scale / 12)} × ${formatFeetInches(p.depth / scale / 12)}`;
          const cx = p.x + p.width / 2;
          const cy = p.y + p.depth / 2;
          const prior = p.existedPrior && existedPriorLabel ? `✓ ${existedPriorLabel}` : null;
          const w = Math.max(labelWidth(name, 11), labelWidth(size, 9), prior ? labelWidth(prior, 8) : 0) + 8;
          const h = prior ? 42 : 30;
          const top = prior ? -6 : 0;
          const selected = selectedId === p.id;
          const start = (e) => interactive && onPointerDown(e, p.id, 'move');
          return (
            <g key={p.id} data-pantry-id={p.id}>
              <rect
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.depth}
                fill={PLAN.accent}
                fillOpacity={selected ? 0.07 : 0.035}
                pointerEvents="none"
              />
              <g
                transform={`translate(${cx}, ${cy})`}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={interactive ? ariaLabelFor(p) : undefined}
                aria-pressed={interactive ? selected : undefined}
                className="kd-el"
                style={{ cursor: interactive ? 'move' : 'default' }}
                onMouseDown={start}
                onTouchStart={start}
                onKeyDown={(e) => interactive && onKeyDown(e, p.id)}
              >
                <rect
                  x={-w / 2}
                  y={-h / 2}
                  width={w}
                  height={h}
                  rx="4"
                  fill={PLAN.paper}
                  stroke={selected ? PLAN.accent : PLAN.wall}
                  strokeWidth={selected ? 1.5 : 1}
                />
                <text
                  y={top - 4}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fill={selected ? PLAN.accentInk : PLAN.ink}
                  pointerEvents="none"
                >
                  {name}
                </text>
                <text
                  y={top + 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="9"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fill={PLAN.inkSoft}
                  pointerEvents="none"
                >
                  {size}
                </text>
                {prior && (
                  <text
                    y={top + 19}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="8"
                    fontWeight="700"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fill="#047857"
                    pointerEvents="none"
                  >
                    {prior}
                  </text>
                )}
              </g>
            </g>
          );
        })}
      </g>
    );
  }

  // layer 'handles': only for the selected pantry
  const p = pantries.find((q) => q.id === selectedId);
  if (!p || !interactive) return null;
  const parts = partitionSides(p, roomData, scale);
  return (
    <g data-pantry-handles={p.id}>
      <rect
        x={p.x}
        y={p.y}
        width={p.width}
        height={p.depth}
        fill="none"
        stroke={PLAN.accent}
        strokeWidth="1.5"
        strokeDasharray="6 4"
        pointerEvents="none"
      />
      {parts.map((side) => {
        const seg = sideSegment(p, side, parts, scale);
        const mx = (seg.x1 + seg.x2) / 2;
        const my = (seg.y1 + seg.y2) / 2;
        const horizontal = side === 'n' || side === 's';
        const gw = horizontal ? 26 : 12;
        const gh = horizontal ? 12 : 26;
        const start = (e) => onPointerDown(e, p.id, 'resize', side);
        return (
          <g
            key={side}
            style={{ cursor: horizontal ? 'ns-resize' : 'ew-resize' }}
            onMouseDown={start}
            onTouchStart={start}
          >
            <title>{sideLabel(side)}</title>
            {/* a bigger invisible target for fingers */}
            <rect x={mx - 18} y={my - 18} width="36" height="36" fill="transparent" />
            <rect
              x={mx - gw / 2}
              y={my - gh / 2}
              width={gw}
              height={gh}
              rx="3"
              fill={PLAN.accent}
              stroke={PLAN.paper}
              strokeWidth="2"
            />
            <path
              d={horizontal ? `M ${mx - 5} ${my - 2} H ${mx + 5} M ${mx - 5} ${my + 2} H ${mx + 5}` : `M ${mx - 2} ${my - 5} V ${my + 5} M ${mx + 2} ${my - 5} V ${my + 5}`}
              stroke={PLAN.paper}
              strokeWidth="1.2"
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
};

export default PantryPlan;
