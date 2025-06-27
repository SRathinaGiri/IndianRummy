const CACHE_NAME = 'rummy-game-cache-v2'; // Updated cache name
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'rummy-logic.js',
  'config.js',
  'ui.js',
  'main-v2.js',      // Renamed file
  'drawing-v2.js',   // Renamed file
  'cards.png',
  'joker.png',
  'card-back.png',   // New card back image
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
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Serve cached content when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});