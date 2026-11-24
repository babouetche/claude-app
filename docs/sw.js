// Cache de l'application pour un lancement rapide (les modèles IA sont mis en cache par le navigateur)
const CACHE = 'babou-art-v5';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'logo.svg', 'fonts/fredoka.woff2', 'fonts/fredoka-ext.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // réseau d'abord (pour recevoir les mises à jour), cache si hors-ligne
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
