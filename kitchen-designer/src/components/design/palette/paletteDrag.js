// A tiny shared channel between the item palette (drag source, in the
// sidebar) and the floor plan (drop target). Both mouse (HTML5 drag and drop)
// and touch (pointer events) drags go through it, so the plan has one code
// path for the preview and the drop.
//
// Events sent to subscribers: { phase, type, clientX, clientY }
//   phase "start" | "move" | "drop" | "cancel"
// A "drop" subscriber returns true when it placed the item.

const listeners = new Set();
let current = null; // { type, source: 'mouse' | 'touch' }

const emit = (event) => {
  let handled = false;
  listeners.forEach((fn) => {
    if (fn(event) === true) handled = true;
  });
  return handled;
};

export const paletteDrag = {
  /** The drag in progress ({ type, source }) or null. */
  get: () => current,

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  start(type, source) {
    current = { type, source };
    emit({ phase: 'start', type });
  },

  /** Pointer at (clientX, clientY); null coordinates mean "not over the plan". */
  move(clientX, clientY) {
    if (!current) return;
    emit({ phase: 'move', type: current.type, clientX, clientY });
  },

  /** Release at (clientX, clientY). Returns true when the plan took the item. */
  drop(clientX, clientY) {
    if (!current) return false;
    const { type } = current;
    current = null;
    const handled = emit({ phase: 'drop', type, clientX, clientY });
    if (!handled) emit({ phase: 'cancel', type });
    return handled;
  },

  /** Abandon the drag (Escape, released elsewhere). Returns true if one was running. */
  cancel() {
    if (!current) return false;
    const { type } = current;
    current = null;
    emit({ phase: 'cancel', type });
    return true;
  },
};
