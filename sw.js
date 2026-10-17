const CACHE = 'calculo-v1';
const ASSETS = [
  './', 'index.html', 'manifest.json', 'css/style.css',
  'config/app.json', 'config/levels.json', 'config/badges.json', 'data/shop.json',
  'data/reading/es.json', 'data/reading/en.json',
  'i18n/languages.json', 'i18n/es.json', 'i18n/en.json',
  'gift/gift.js', 'gift/gift-data.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/ctx.js', 'js/dom.js', 'js/i18n.js', 'js/prng.js', 'js/generator.js', 'js/timer.js',
  'js/session.js', 'js/rewards.js', 'js/merge.js', 'js/crypto.js', 'js/store.js', 'js/ui.js',
  'js/layout.js', 'js/sounds.js',
  'js/providers/local.js', 'js/providers/cloud.js',
  'js/screens/welcome.js', 'js/screens/profiles.js', 'js/screens/home.js', 'js/screens/practice.js',
  'js/screens/end.js', 'js/screens/world.js', 'js/screens/reading.js', 'js/screens/parent.js',
  'js/screens/printsheet.js', 'js/screens/info.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    }))
  );
});
