// A visitor who opened the site before public/sw.js learned to skip design
// links keeps that old service worker until they press Update, and it caches
// every 200 from the API and every page it serves. So the design-link page
// removes, from every Cache Storage cache, each entry for this page or its API
// (on mount, after the model loads, when the link or the model fails, and on
// pagehide). Never throws.

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

// For pagehide: an unloading page does not live long enough for the full
// sweep above (keys, open, keys, delete). openDesignLinkCaches() opens every
// cache ahead of time; deleteNow() then sends one delete per known URL to each
// of them straight away, without waiting on anything first. Never throws.
export async function openDesignLinkCaches(storage = typeof caches !== 'undefined' ? caches : null) {
  if (!storage) return [];
  try {
    const names = await storage.keys();
    const opened = await Promise.all(names.map((name) => storage.open(name).catch(() => null)));
    return opened.filter(Boolean);
  } catch {
    return [];
  }
}

export function deleteNow(openCaches, urls) {
  (openCaches || []).forEach((cache) => {
    urls.filter(isPrivateUrl).forEach((url) => {
      try {
        cache.delete(url, { ignoreSearch: true }).catch(() => {});
      } catch {
        // a closed cache: nothing to do
      }
    });
  });
}
