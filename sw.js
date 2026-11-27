// Orbite — service worker : fonctionnement hors ligne et mises à jour
// Changer le numéro de version à chaque mise à jour des fichiers (et APP_VERSION dans index.html)
const CACHE = 'orbite-v122';
const FILES = ['./', './index.html', './engine.js', './niveaux.js', './editeur.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' : récupère les fichiers sur le serveur, pas dans le cache du navigateur
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// hors ligne : tout est servi depuis le cache ; une page demandée (même avec ?paramètres ou une autre adresse)
// retombe sur index.html si le réseau ne répond pas
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() =>
      e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
