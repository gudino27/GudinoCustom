import { useEffect, useState } from 'react';

// One polite live region for the whole site (WCAG 4.1.3 Status Messages).
// Anything can call announce(t('contact.copied', { item })) and screen readers
// read it out without focus moving. Mounted once in App.js.
const listeners = new Set();

export function announce(message) {
  const text = message == null ? '' : String(message);
  listeners.forEach((fn) => fn(text));
}

export default function LiveRegion() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    let timer;
    const onAnnounce = (text) => {
      // clear first, so the same message twice in a row is still read
      setMessage('');
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(text), 60);
    };
    listeners.add(onAnnounce);
    return () => {
      listeners.delete(onAnnounce);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
