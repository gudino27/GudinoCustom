// Service Worker for Gudino Custom Admin Panel PWA
// Network-first strategy for always-online experience

const CACHE_NAME = 'gudino-admin-v2'; // Updated version to force cache refresh
const OFFLINE_URL = '/offline.html';
const API_BASE = 'https://api.gudinocustom.com';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/admin',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  OFFLINE_URL 
];

// Install event - cache static assets
self.addEventListener('install', (event) => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS.filter(url => url !== OFFLINE_URL));
      })
      .then(() => {
        // Cache offline page separately to handle errors gracefully
        return caches.open(CACHE_NAME)
          .then(cache => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })));
      })
      .catch((error) => {
        console.warn('[SW] Failed to cache some assets:', error);
      })
  );

  // Removed self.skipWaiting() - only skip when user clicks "Update" button
  // This prevents automatic activation and potential mobile reloads
  // Skip waiting is now controlled by message event handler (line 44-48)
});

// Listen for skip waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - network-first strategy with intelligent caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Private client design links and staff requests are never cached: no
  // respondWith, so the browser fetches them as if there were no worker
  if (url.pathname.startsWith('/api/design-links/') ||
      url.pathname.startsWith('/api/admin/') ||
      request.headers.has('Authorization') ||
      (request.mode === 'navigate' && url.pathname.startsWith('/view/'))) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle different types of requests
  if (isAPIRequest(url)) {
    // API requests: Network-first with 3-second timeout
    event.respondWith(handleAPIRequest(request));
  } else if (isNavigationRequest(request)) {
    // Navigation requests: Network-first with fallback to cached pages
    event.respondWith(handleNavigationRequest(request));
  } else if (isStaticAsset(url)) {
    // Static assets: Cache-first for performance
    event.respondWith(handleStaticAsset(request));
  } else {
    // Other requests: Network-first with cache fallback
    event.respondWith(handleGenericRequest(request));
  }
});

// Helper functions
function isAPIRequest(url) {
  return url.origin === API_BASE || url.pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

function isStaticAsset(url) {
  return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/);
}

// API request handler - Network-first with timeout
async function handleAPIRequest(request) {
  const timeoutDuration = 10000; // 10 seconds - increased for slower connections

  try {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Network timeout')), timeoutDuration);
    });

    // Race between fetch and timeout
    const response = await Promise.race([
      fetch(request.clone()),
      timeoutPromise
    ]);

    // Only cache successful full responses (not partial 206)
    if (response.status === 200) {
      // Cache successful API responses for short-term use
      const cache = await caches.open(CACHE_NAME);
      cache.put(request.clone(), response.clone());
    }

    return response;
  } catch (error) {

    // Fallback to cache if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return error response for API calls with CORS headers
    return new Response(
      JSON.stringify({
        error: 'Network unavailable',
        message: 'Please check your internet connection and try again.',
        cached: false
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://gudinocustom.com',
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    );
  }
}

// Navigation request handler
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);

    // Only cache successful full responses (not partial 206)
    if (response.status === 200) {
      // Cache successful navigation responses
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {

    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return caches.match(OFFLINE_URL);
  }
}

// Static asset handler - Cache-first
async function handleStaticAsset(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // If not in cache, fetch and cache
    const response = await fetch(request);
    // Only cache successful full responses (not partial 206)
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Return cached version if available
    return caches.match(request);
  }
}

// Generic request handler
async function handleGenericRequest(request) {
  try {
    const response = await fetch(request);

    // Only cache successful full responses (not partial 206)
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Fallback to cache
    return caches.match(request);
  }
}

self.addEventListener('sync', (event) => {

  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});


self.addEventListener('push', (event) => {

  const options = {
    body: 'You have new notifications in Gudino Admin',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    tag: 'gudino-notification',
    renotify: true,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Gudino Admin', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {

  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/admin')
    );
  }
});

