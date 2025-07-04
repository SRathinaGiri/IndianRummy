const CACHE_NAME = 'rummy-game-cache-v3'; // Updated cache name to force a new install
const urlsToCache = [
  './',
  'index.html',
  'how-to-play.html', // Added for offline access
  'style.css',
  'rummy-logic.js',
  'config.js',
  'ui.js',
  'main-v2.js',      // Our renamed file
  'drawing-v2.js',   // Our renamed file
  'cards.png',
  'joker.png',
  'card-back.png',   // Your new card back image
  'icon-192x192.png',
  'icon-512x512.png',
  'shuffle.mp3',
  'draw.mp3',
  'discard.mp3',
  'meld.mp3',
  'declare.mp3',
  'win.mp3',
  'error.mp3',
  'click.mp3'
];

// Install the service worker and cache all the game assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching all assets');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force the new service worker to activate
  );
});

// Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('rummy-game-cache-') && cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Serve cached content when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});