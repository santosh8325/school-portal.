// Bump version to bust the old cache immediately
const CACHE_NAME = 'school-portal-cache-v3';

// Only cache CSS and JS — never HTML (HTML must always be fresh from server)
const STATIC_ASSETS = [
    '/css/style.css',
    '/css/dashboard.css',
    '/js/main.js',
    '/js/auth.js',
    '/js/dashboard.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        // Delete ALL old caches (v1, v2, etc.)
        caches.keys().then(cacheNames => 
            Promise.all(cacheNames.filter(name => name !== CACHE_NAME).map(name => {
                console.log('[SW] Deleting old cache:', name);
                return caches.delete(name);
            }))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // NEVER cache HTML pages — always fetch fresh from server
    if (url.pathname.endsWith('.html') || 
        url.pathname === '/' || 
        url.pathname.startsWith('/school/') ||
        url.pathname === '/admin' ||
        url.pathname === '/dashboard') {
        event.respondWith(fetch(event.request));
        return;
    }

    // NEVER cache API requests — always live
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Cache-first for CSS and JS static assets only
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request).then(networkResponse => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                return networkResponse;
            });
        })
    );
});
