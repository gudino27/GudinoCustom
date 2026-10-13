// A visitor who opened the site before public/sw.js learned to skip design
// links keeps that old service worker until they press Update, and it caches
// every 200 from the API and every page it serves. So the design-link page
// removes, from every Cache Storage cache, each entry for this page or its API
// (on mount, after the model loads, and on a 404/410). Never throws.

export const PRIVATE_PATHS = ['/api/design-links/', '/view/'];

export function isPrivateUrl(url) {
  try {
    const { pathname } = new URL(url, 'https://gudinocustom.com');
    return PRIVATE_PATHS.some((p) => pathname.startsWith(p));
  } catch {
    return false;
  }
}

export async function clearDesignLinkCaches(storage = typeof caches !== 'undefined' ? caches : null) {
  if (!storage) return 0;
  let removed = 0;
  try {
    const names = await storage.keys();
    await Promise.all(names.map(async (name) => {
      try {
        const cache = await storage.open(name);
        const requests = await cache.keys();
        await Promise.all(requests.map(async (request) => {
          if (isPrivateUrl(request.url) && await cache.delete(request)) removed += 1;
        }));
      } catch {
        // one cache failing must not stop the others
      }
    }));
  } catch {
    // Cache Storage blocked (private mode, insecure origin)
  }
  return removed;
}
