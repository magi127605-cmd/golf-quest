/* オフライン対応。VERSION を上げると次回起動時に新しいファイルに入れ替わる */
const VERSION = 'gq-v1.6.1';
const FILES = [
  './', './index.html', './style.css?v=1.6.1', './manifest.webmanifest',
  './js/config.js?v=1.6.1', './js/core.js?v=1.6.1', './js/rank.js?v=1.6.1', './js/xp.js?v=1.6.1', './js/home.js?v=1.6.1', './js/program.js?v=1.6.1', './js/maxes.js?v=1.6.1', './js/diagnose.js?v=1.6.1', './js/workout.js?v=1.6.1', './js/train.js?v=1.6.1', './js/range.js?v=1.6.1',
  './js/measure.js?v=1.6.1', './js/yamada.js?v=1.6.1', './js/settings.js?v=1.6.1', './js/boot.js?v=1.6.1',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/maskable-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 休憩おわりの通知を押したらアプリに戻る
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
