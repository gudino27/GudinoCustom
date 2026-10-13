import { useEffect } from 'react';

// Two tabs on /design each keep the whole design in memory and write all of
// it to localStorage on every change (useLocalStorage). Without this, the
// tab that was left open overwrote the newer design from the other tab the
// next time anything changed in it: items and pantries added elsewhere were
// lost. Each tab now takes the other's saved version as it is written.

export const STORAGE_KEYS = {
  kitchenDesignState: 'kitchen',
  bathroomDesignState: 'bathroom',
};

/**
 * The room a `storage` event carries: { room: 'kitchen' | 'bathroom', data }
 * or null (another key, a removal, or not a saved room).
 */
export const roomFromStorageEvent = (event) => {
  if (!event || !Object.prototype.hasOwnProperty.call(STORAGE_KEYS, event.key)) return null;
  if (typeof event.newValue !== 'string' || !event.newValue) return null;
  let data;
  try {
    data = JSON.parse(event.newValue);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.elements)) return null;
  return { room: STORAGE_KEYS[event.key], data };
};

export const useCrossTabSync = ({ setKitchenData, setBathroomData }) => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = (event) => {
      const found = roomFromStorageEvent(event);
      if (!found) return;
      (found.room === 'kitchen' ? setKitchenData : setBathroomData)(found.data);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [setKitchenData, setBathroomData]);
};
