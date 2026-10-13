import React, { forwardRef, useState } from 'react';
import { formatFeet, formatInchesPlain, parseFeet, parseInches } from '../../utils/designer/planUnits';

// A length box that takes what people type off a tape measure: 24, 24.5,
// 24 1/2, 24-1/2, 24 1/2", 2' 6 1/2". When not being edited it shows the
// value as a fraction to the nearest 1/16 ("24 3/8"), never a decimal.
//
// unit: 'in' (default) or 'ft' (room sizes: a bare number is feet, 12' 6"
//   works too, and a non-whole value shows as 12' 6").
// live: commit each valid value as it is typed (positions, plain sizes).
//   Otherwise commit on Enter or blur only, for sizes that may be declined
//   (a refrigerator cabinet cannot shrink round its fridge), so typing 47
//   does not first try 4.
// enforceRange (default true): values outside min / max are not committed
//   while typing and are brought into range when the field loses focus. Off,
//   any length is passed on and the caller validates (room setup).
// onEmpty: called when the box is left empty; without it an empty box puts
//   the last value back, as does text that is not a length.
// Escape puts the current value back (and only then stops the key, so a
// second Escape still closes the panel).
const InchInput = forwardRef(({
  id,
  value,
  min,
  max,
  onCommit,
  onEmpty,
  describedBy,
  invalid = false,
  live = false,
  enforceRange = true,
  unit = 'in',
  placeholder,
  className = 'w-full p-3 min-h-12 text-sm border rounded',
}, ref) => {
  const [draft, setDraft] = useState(null);
  const feet = unit === 'ft';
  const parse = feet ? parseFeet : parseInches;
  const show = (v) => {
    if (v === '' || v === null || v === undefined) return '';
    return feet ? formatFeet(v) : formatInchesPlain(v);
  };
  const bound = (b, fallback) => (b === null || b === undefined || b === '' || !Number.isFinite(Number(b)) ? fallback : Number(b));
  const lo = enforceRange ? bound(min, -Infinity) : -Infinity;
  const hi = enforceRange ? bound(max, Infinity) : Infinity;
  const current = value === '' || value === null || value === undefined ? null : Number(value);
  const inRange = (n) => n >= lo && n <= hi;
  const clamp = (n) => Math.max(lo, Math.min(hi, n));

  const empty = draft !== null && draft.trim() === '';
  const parsed = draft === null || empty ? null : parse(draft);
  const draftBad = draft !== null && !empty && (parsed === null || !inRange(parsed));

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    if (empty) {
      if (onEmpty && current !== null) onEmpty();
      return;
    }
    if (parsed === null) return;
    const next = clamp(parsed);
    if (next !== current) onCommit(next);
  };

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      // text, not decimal: phone number pads have no space or slash for 24 3/8
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      value={draft ?? show(value)}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        if (!live) return;
        if (!text.trim()) {
          if (onEmpty && current !== null) onEmpty();
          return;
        }
        const n = parse(text);
        if (n !== null && inRange(n) && n !== current) onCommit(n);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape' && draft !== null) {
          e.stopPropagation();
          setDraft(null);
        }
      }}
      aria-describedby={describedBy || undefined}
      aria-invalid={invalid || draftBad || undefined}
      className={className}
    />
  );
});

InchInput.displayName = 'InchInput';

export default InchInput;
