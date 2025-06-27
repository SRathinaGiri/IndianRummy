const CACHE_NAME = 'rummy-game-cache-v1';
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'rummy-logic.js',
  'main.js',
  'cards.png',
  'joker.png',
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