import React from 'react';

// Small flat line drawings of each palette item (front view unless noted),
// 48 x 48, stroke in currentColor so they follow the card's text colour.
// Fills use the CSS variables from palette.css (body, glass, metal).

const BODY = 'var(--kd-icon-body)';
const GLASS = 'var(--kd-icon-glass)';
const METAL = 'var(--kd-icon-metal)';

const Knob = ({ x, y }) => <circle cx={x} cy={y} r="0.9" fill="currentColor" stroke="none" />;
const Pull = ({ x1, x2, y }) => <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth="1.8" />;
const VPull = ({ x, y1, y2 }) => <line x1={x} y1={y1} x2={x} y2={y2} strokeWidth="1.8" />;
const Floor = () => <line x1="4" y1="44" x2="44" y2="44" opacity="0.35" />;
// Dashed counter line under wall-mounted items
const Counter = ({ y = 40 }) => <line x1="5" y1={y} x2="43" y2={y} strokeDasharray="2 2.5" opacity="0.45" />;
const Faucet = ({ x, y }) => (
  <path d={`M${x} ${y} v-5 h4.5 v1.8`} fill="none" strokeWidth="1.6" />
);
const Glints = ({ x, y, w, h }) => (
  <g opacity="0.7">
    <line x1={x + w * 0.25} y1={y + h * 0.35} x2={x + w * 0.55} y2={y + h * 0.1} />
    <line x1={x + w * 0.3} y1={y + h * 0.6} x2={x + w * 0.75} y2={y + h * 0.2} />
  </g>
);

const icons = {
  base: (
    <>
      <Floor />
      <rect x="12" y="11" width="24" height="33" fill={BODY} />
      <rect x="10" y="8" width="28" height="3" rx="0.8" fill={METAL} />
      <rect x="14" y="13.5" width="20" height="6" rx="0.8" />
      <Pull x1="21" x2="27" y="16.5" />
      <rect x="14" y="21.5" width="20" height="20" rx="0.8" />
      <Knob x="31" y="25" />
    </>
  ),
  'sink-base': (
    <>
      <Floor />
      <rect x="8" y="15" width="32" height="29" fill={BODY} />
      <rect x="6" y="12" width="36" height="3" rx="0.8" fill={METAL} />
      <Faucet x="22" y="12" />
      <rect x="10" y="17.5" width="28" height="4" rx="0.8" />
      <rect x="10" y="23.5" width="13" height="18" rx="0.8" />
      <rect x="25" y="23.5" width="13" height="18" rx="0.8" />
      <Knob x="21" y="27" />
      <Knob x="27" y="27" />
    </>
  ),
  'drawer-base': (
    <>
      <Floor />
      <rect x="13" y="11" width="22" height="33" fill={BODY} />
      <rect x="11" y="8" width="26" height="3" rx="0.8" fill={METAL} />
      <rect x="15" y="13.5" width="18" height="7" rx="0.8" />
      <rect x="15" y="22.5" width="18" height="9" rx="0.8" />
      <rect x="15" y="33.5" width="18" height="8.5" rx="0.8" />
      <Pull x1="21" x2="27" y="17" />
      <Pull x1="21" x2="27" y="27" />
      <Pull x1="21" x2="27" y="37.7" />
    </>
  ),
  'double-drawer-base': (
    <>
      <Floor />
      <rect x="8" y="11" width="32" height="33" fill={BODY} />
      <rect x="6" y="8" width="36" height="3" rx="0.8" fill={METAL} />
      <rect x="10" y="13.5" width="28" height="13" rx="0.8" />
      <rect x="10" y="28.5" width="28" height="13.5" rx="0.8" />
      <Pull x1="20" x2="28" y="20" />
      <Pull x1="20" x2="28" y="35" />
    </>
  ),
  wall: (
    <>
      <Counter />
      <rect x="9" y="5" width="30" height="24" fill={BODY} />
      <rect x="11" y="7" width="12.5" height="20" rx="0.8" />
      <rect x="24.5" y="7" width="12.5" height="20" rx="0.8" />
      <Knob x="21.5" y="24" />
      <Knob x="26.5" y="24" />
    </>
  ),
  'glass-wall': (
    <>
      <Counter />
      <rect x="9" y="5" width="30" height="24" fill={BODY} />
      <rect x="11" y="7" width="12.5" height="20" rx="0.8" fill={GLASS} />
      <rect x="24.5" y="7" width="12.5" height="20" rx="0.8" fill={GLASS} />
      <Glints x={11} y={7} w={12.5} h={20} />
      <Glints x={24.5} y={7} w={12.5} h={20} />
      <Knob x="21.5" y="24" />
      <Knob x="26.5" y="24" />
    </>
  ),
  'open-shelf': (
    <>
      <Counter />
      <rect x="7" y="6" width="34" height="24" fill={BODY} />
      <line x1="7" y1="14" x2="41" y2="14" />
      <line x1="7" y1="22" x2="41" y2="22" />
      <rect x="10" y="9" width="2.5" height="5" fill={METAL} />
      <rect x="13" y="8.5" width="2.5" height="5.5" fill={METAL} />
      <circle cx="33" cy="11.5" r="2.5" fill={GLASS} />
      <rect x="27" y="17" width="8" height="5" rx="1" fill={METAL} />
      <rect x="11" y="25" width="6" height="5" rx="2.5" fill={GLASS} />
    </>
  ),
  'corner-wall': (
    <>
      <Counter />
      <path d="M7 9 L17 5 V29 L7 33 Z" fill={BODY} />
      <rect x="17" y="5" width="24" height="24" fill={BODY} />
      <rect x="19" y="7" width="20" height="20" rx="0.8" />
      <path d="M9 11.5 L15 9 V26.5 L9 29 Z" />
      <Knob x="22" y="24" />
    </>
  ),
  tall: (
    <>
      <Floor />
      <rect x="14" y="4" width="20" height="40" fill={BODY} />
      <rect x="16" y="6" width="16" height="16" rx="0.8" />
      <rect x="16" y="24" width="16" height="18" rx="0.8" />
      <Knob x="29.5" y="19" />
      <Knob x="29.5" y="27" />
    </>
  ),
  pantry: (
    <>
      <Floor />
      <rect x="9" y="4" width="30" height="40" fill={BODY} />
      <rect x="11" y="6" width="12.5" height="36" rx="0.8" />
      <rect x="24.5" y="6" width="12.5" height="36" rx="0.8" />
      <VPull x="21.5" y1="21" y2="27" />
      <VPull x="26.5" y1="21" y2="27" />
    </>
  ),
  'refrigerator-cabinet': (
    <>
      <Floor />
      <rect x="6" y="4" width="36" height="40" fill={BODY} />
      <rect x="8" y="6" width="15.5" height="9" rx="0.8" />
      <rect x="24.5" y="6" width="15.5" height="9" rx="0.8" />
      <rect x="10" y="17" width="28" height="27" fill="var(--kd-icon-bg, #fff)" />
      <rect x="12.5" y="19" width="23" height="25" rx="1" strokeDasharray="2 2" opacity="0.6" />
    </>
  ),
  corner: (
    // Plan view: an L of counter with the lazy Susan turntable in the corner
    <>
      <path d="M6 6 H42 V20 H20 V42 H6 Z" fill={BODY} />
      <circle cx="15" cy="15" r="6.5" fill={METAL} />
      <path d="M15 8.5 A6.5 6.5 0 0 1 21.5 15" fill="none" strokeWidth="1.8" />
      <path d="M21.5 15 l-1.8 -1.4 M21.5 15 l1.3 -1.8" />
      <line x1="30" y1="6" x2="30" y2="20" opacity="0.5" />
      <line x1="6" y1="30" x2="20" y2="30" opacity="0.5" />
    </>
  ),
  'island-base': (
    <>
      <Floor />
      <rect x="3" y="15" width="42" height="4" rx="0.8" fill={METAL} />
      <rect x="6" y="19" width="36" height="25" fill={BODY} />
      <rect x="8" y="21.5" width="10" height="20.5" rx="0.8" />
      <rect x="19" y="21.5" width="10" height="20.5" rx="0.8" />
      <rect x="30" y="21.5" width="10" height="20.5" rx="0.8" />
      <Knob x="16" y="25" />
      <Knob x="21" y="25" />
      <Knob x="32" y="25" />
    </>
  ),
  'peninsula-base': (
    <>
      <Floor />
      <rect x="3" y="4" width="4" height="40" fill={METAL} />
      <rect x="7" y="17" width="37" height="4" rx="0.8" fill={METAL} />
      <rect x="7" y="21" width="28" height="23" fill={BODY} />
      <rect x="9" y="23.5" width="11.5" height="18.5" rx="0.8" />
      <rect x="21.5" y="23.5" width="11.5" height="18.5" rx="0.8" />
      <Knob x="18.5" y="27" />
      <Knob x="23.5" y="27" />
    </>
  ),
  vanity: (
    <>
      <Floor />
      <rect x="9" y="19" width="30" height="25" fill={BODY} />
      <rect x="7" y="16" width="34" height="3" rx="0.8" fill={METAL} />
      <rect x="11" y="21.5" width="12.5" height="20.5" rx="0.8" />
      <rect x="24.5" y="21.5" width="12.5" height="20.5" rx="0.8" />
      <Knob x="21.5" y="25" />
      <Knob x="26.5" y="25" />
    </>
  ),
  'vanity-sink': (
    <>
      <Floor />
      <rect x="9" y="19" width="30" height="25" fill={BODY} />
      <rect x="7" y="16" width="34" height="3" rx="0.8" fill={METAL} />
      <path d="M17 16 Q24 12.5 31 16" fill={GLASS} />
      <Faucet x="22" y="13" />
      <rect x="11" y="21.5" width="12.5" height="20.5" rx="0.8" />
      <rect x="24.5" y="21.5" width="12.5" height="20.5" rx="0.8" />
      <Knob x="21.5" y="25" />
      <Knob x="26.5" y="25" />
    </>
  ),
  'double-vanity': (
    <>
      <Floor />
      <rect x="4" y="21" width="40" height="23" fill={BODY} />
      <rect x="2.5" y="18" width="43" height="3" rx="0.8" fill={METAL} />
      <path d="M8 18 Q13 15 18 18" fill={GLASS} />
      <path d="M30 18 Q35 15 40 18" fill={GLASS} />
      <Faucet x="11.5" y="15" />
      <Faucet x="33.5" y="15" />
      <rect x="6" y="23.5" width="11" height="18.5" rx="0.8" />
      <rect x="18.5" y="23.5" width="11" height="18.5" rx="0.8" />
      <rect x="31" y="23.5" width="11" height="18.5" rx="0.8" />
      <Pull x1="21" x2="27" y="27" />
    </>
  ),
  'floating-vanity': (
    <>
      <line x1="4" y1="44" x2="44" y2="44" strokeDasharray="2 2.5" opacity="0.45" />
      <rect x="7" y="19" width="34" height="14" fill={BODY} />
      <rect x="6" y="16" width="36" height="3" rx="0.8" fill={METAL} />
      <path d="M17 16 Q24 12.5 31 16" fill={GLASS} />
      <Faucet x="22" y="13" />
      <rect x="9" y="21.5" width="30" height="9" rx="0.8" />
      <Pull x1="20" x2="28" y="26" />
    </>
  ),
  'corner-vanity': (
    <>
      <Floor />
      <path d="M6 18 L14 15 V41 L6 44 Z" fill={BODY} />
      <path d="M34 15 L42 18 V44 L34 41 Z" fill={BODY} />
      <rect x="14" y="15" width="20" height="26" fill={BODY} />
      <path d="M4 16 L14 12.5 H34 L44 16 L34 15 H14 Z" fill={METAL} />
      <path d="M18 14 Q24 11 30 14" fill={GLASS} />
      <rect x="16" y="18" width="16" height="21" rx="0.8" />
      <Knob x="29" y="22" />
    </>
  ),
  'vanity-tower': (
    <>
      <Floor />
      <rect x="17" y="4" width="14" height="40" fill={BODY} />
      <rect x="19" y="6" width="10" height="17" rx="0.8" />
      <rect x="19" y="25" width="10" height="17" rx="0.8" />
      <Knob x="26.5" y="20" />
      <Knob x="26.5" y="28" />
    </>
  ),
  linen: (
    <>
      <Floor />
      <rect x="15" y="4" width="18" height="40" fill={BODY} />
      <rect x="17" y="6" width="14" height="22" rx="0.8" />
      <rect x="17" y="30" width="14" height="5" rx="0.8" />
      <rect x="17" y="37" width="14" height="5" rx="0.8" />
      <Knob x="28.5" y="25" />
      <Pull x1="22" x2="26" y="32.5" />
      <Pull x1="22" x2="26" y="39.5" />
    </>
  ),
  'linen-tower': (
    <>
      <Floor />
      <rect x="13" y="4" width="22" height="40" fill={BODY} />
      <rect x="15" y="6" width="18" height="14" rx="0.8" />
      <line x1="15" y1="23.5" x2="33" y2="23.5" />
      <rect x="17" y="21" width="14" height="2.5" rx="1" fill={GLASS} />
      <rect x="15" y="26" width="18" height="16" rx="0.8" />
      <Knob x="30.5" y="17" />
      <Knob x="30.5" y="29" />
    </>
  ),
  medicine: (
    <>
      <Counter y={42} />
      <rect x="12" y="6" width="24" height="30" fill={BODY} />
      <rect x="14" y="8" width="20" height="26" rx="0.8" fill={GLASS} />
      <Knob x="31.5" y="21" />
    </>
  ),
  'medicine-mirror': (
    <>
      <Counter y={42} />
      <rect x="9" y="5" width="30" height="33" rx="1.5" fill={BODY} />
      <rect x="11.5" y="7.5" width="25" height="28" rx="1" fill={GLASS} />
      <Glints x={11.5} y={7.5} w={25} h={28} />
      <line x1="24" y1="7.5" x2="24" y2="35.5" opacity="0.5" />
    </>
  ),
  refrigerator: (
    <>
      <Floor />
      <rect x="11" y="3" width="26" height="41" rx="1.5" fill={METAL} />
      <line x1="11" y1="29" x2="37" y2="29" />
      <line x1="24" y1="3" x2="24" y2="29" />
      <VPull x="22" y1="10" y2="22" />
      <VPull x="26" y1="10" y2="22" />
      <Pull x1="19" x2="29" y="32" />
    </>
  ),
  stove: (
    // Range: back guard with knobs, oven door with window
    <>
      <Floor />
      <rect x="8" y="9" width="32" height="5" rx="0.8" fill={METAL} />
      <circle cx="13" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="30" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="35" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <rect x="8" y="14" width="32" height="30" fill={METAL} />
      <rect x="7" y="14" width="34" height="2.5" rx="0.8" fill={BODY} />
      <Pull x1="13" x2="35" y="20" />
      <rect x="12" y="23" width="24" height="14" rx="1" fill={GLASS} />
      <line x1="8" y1="40" x2="40" y2="40" />
    </>
  ),
  dishwasher: (
    <>
      <Floor />
      <rect x="11" y="8" width="26" height="36" rx="0.8" fill={METAL} />
      <line x1="11" y1="13" x2="37" y2="13" />
      <circle cx="31" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="34" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <Pull x1="16" x2="32" y="16.5" />
      <line x1="11" y1="40" x2="37" y2="40" />
    </>
  ),
  microwave: (
    <>
      <Counter />
      <rect x="6" y="12" width="36" height="21" rx="1.5" fill={METAL} />
      <rect x="9" y="15" width="22" height="15" rx="1" fill={GLASS} />
      <line x1="33.5" y1="15" x2="33.5" y2="30" opacity="0.5" />
      <circle cx="36" cy="17.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="39" cy="17.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="36" cy="20.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="39" cy="20.5" r="0.8" fill="currentColor" stroke="none" />
      <rect x="35" y="24" width="5" height="3" rx="0.8" />
    </>
  ),
  'wine-cooler': (
    <>
      <Floor />
      <rect x="12" y="6" width="24" height="38" rx="0.8" fill={METAL} />
      <rect x="14.5" y="8.5" width="19" height="31" rx="0.8" fill={GLASS} />
      {[14, 21, 28, 35].map((y) => (
        <g key={y}>
          <circle cx="19" cy={y} r="2" fill={BODY} />
          <circle cx="24" cy={y} r="2" fill={BODY} />
          <circle cx="29" cy={y} r="2" fill={BODY} />
        </g>
      ))}
      <line x1="12" y1="41.5" x2="36" y2="41.5" />
    </>
  ),
  'range-hood': (
    <>
      <Counter y={42} />
      <rect x="20" y="3" width="8" height="15" fill={METAL} />
      <path d="M9 31 L19 18 H29 L39 31 Z" fill={METAL} />
      <rect x="7" y="31" width="34" height="3.5" rx="0.8" fill={BODY} />
      <circle cx="12" cy="32.8" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="32.8" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  'double-oven': (
    <>
      <Floor />
      <rect x="10" y="4" width="28" height="40" rx="0.8" fill={METAL} />
      <line x1="10" y1="9" x2="38" y2="9" />
      <Pull x1="15" x2="33" y="12" />
      <rect x="14" y="14" width="20" height="10" rx="1" fill={GLASS} />
      <line x1="10" y1="26" x2="38" y2="26" />
      <Pull x1="15" x2="33" y="29" />
      <rect x="14" y="31" width="20" height="10" rx="1" fill={GLASS} />
    </>
  ),
  toilet: (
    <>
      <Floor />
      <rect x="14" y="5" width="20" height="12" rx="2" fill={BODY} />
      <line x1="17" y1="8.5" x2="21" y2="8.5" strokeWidth="1.8" />
      <path d="M12 21 Q12 34 24 35 Q36 34 36 21 Z" fill={BODY} />
      <ellipse cx="24" cy="21" rx="12" ry="2.8" fill={METAL} />
      <path d="M19 34.5 L17.5 44 H30.5 L29 34.5" fill={BODY} />
    </>
  ),
  bathtub: (
    <>
      <Floor />
      <path d="M4 20 H44 V25 Q44 37 33 37 H15 Q4 37 4 25 Z" fill={BODY} />
      <line x1="3" y1="20" x2="45" y2="20" strokeWidth="2" />
      <path d="M9 20 V13 H14 V15" fill="none" strokeWidth="1.6" />
      <path d="M12 37 L10 43 M36 37 L38 43" strokeWidth="1.8" />
    </>
  ),
  shower: (
    <>
      <rect x="6" y="4" width="36" height="40" fill={GLASS} />
      <line x1="26" y1="4" x2="26" y2="41" />
      <rect x="4" y="41" width="40" height="3" rx="0.8" fill={METAL} />
      <path d="M10 4 V8 H15" fill="none" />
      <path d="M13 9 H19 L18 11 H14 Z" fill={METAL} />
      <g strokeDasharray="1.5 2.5" opacity="0.7">
        <line x1="14.5" y1="13" x2="13" y2="24" />
        <line x1="16" y1="13" x2="16" y2="25" />
        <line x1="17.5" y1="13" x2="19" y2="24" />
      </g>
      <VPull x="23.5" y1="20" y2="28" />
      <Glints x={26} y={4} w={16} h={37} />
    </>
  ),
};

const fallback = (
  <>
    <Floor />
    <rect x="12" y="10" width="24" height="34" fill={BODY} />
    <rect x="14" y="12" width="20" height="30" rx="0.8" />
  </>
);

/** Drawing for palette `type`; decorative (the card carries the name). */
const PaletteIcon = ({ type, size = 48, className }) => (
  <svg
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={className}
    aria-hidden="true"
    focusable="false"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {icons[type] || fallback}
  </svg>
);

export const hasPaletteIcon = (type) => Boolean(icons[type]);

export default PaletteIcon;
