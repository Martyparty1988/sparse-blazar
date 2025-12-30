
const CACHE_VERSION = 'v5';
const CACHE_NAME = `mst-app-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `mst-dynamic-${CACHE_VERSION}`;
const OFFLINE_CACHE_NAME = `mst-offline-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'
];

// Offline fallback page content
const OFFLINE_PAGE_HTML = `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MST - Offline</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #020617 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .container {
      padding: 2rem;
      max-width: 500px;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p { opacity: 0.8; line-height: 1.6; }
    button {
      margin-top: 2rem;
      padding: 1rem 2rem;
      background: rgba(99, 102, 241, 0.8);
      border: none;
      border-radius: 12px;
      color: white;
      font-weight: bold;
      cursor: pointer;
      font-size: 1rem;
    }
    button:hover { background: rgba(99, 102, 241, 1); }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>Jste offline</h1>
    <p>Aplikace MST potřebuje připojení k internetu pro načtení nových dat. Vaše uložená data jsou stále dostupná.</p>
    <button onclick="window.location.reload()">Zkusit znovu</button>
  </div>
</body>
</html>
`;

// Install Event: Cache core assets + offline page
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing MST Service Worker v5');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => {
        console.log('[Service Worker] Caching Shell Assets');
        return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.error('[Service Worker] Cache addAll failed:', err);
        });
      }),
      caches.open(OFFLINE_CACHE_NAME).then(cache => {
        return cache.put('/offline.html', new Response(OFFLINE_PAGE_HTML, {
          headers: { 'Content-Type': 'text/html' }
        }));
      })
    ])
  );
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating MST Service Worker v5');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME && key !== OFFLINE_CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Helper: Check if online
const isOnline = () => {
  return self.navigator.onLine;
};

// Fetch Event with advanced caching strategies
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 1. Navigation Requests (HTML) - Network First with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful navigation responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Try cache first
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Fallback to index.html for SPA routing
              return caches.match('/index.html')
                .then(indexResponse => {
                  if (indexResponse) {
                    return indexResponse;
                  }
                  // Last resort: offline page
                  return caches.match('/offline.html');
                });
            });
        })
    );
    return;
  }

  // 2. Static Assets (Scripts, Styles, Images, Fonts) - Cache First with Network Fallback
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'manifest'
  ) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          // Return cached version immediately
          // Update cache in background if online
          if (isOnline()) {
            fetch(request).then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                  cache.put(request, networkResponse.clone());
                });
              }
            }).catch(() => { });
          }
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. CDN Resources (Tailwind, PDF.js) - Cache First
  if (url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('esm.sh')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        return cachedResponse || fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }



  // 5. Default Strategy: Network First, fallback to Cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200 && url.protocol.startsWith('http')) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Background Sync for offline actions
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background sync:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Notify all clients that sync is happening
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'BACKGROUND_SYNC',
            status: 'syncing'
          });
        });
      })
    );
  }
});

// Push Notifications (for future use)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nová notifikace z MST',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('MST Solar Tracker', options)
  );
});

// Message handler for communication with app
self.addEventListener('message', event => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => {
        return Promise.all(
          keys.map(key => caches.delete(key))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

console.log('[Service Worker] MST Service Worker v5 loaded');
