/* ══════════════════════════════════════════
   AI 출제위원 — Service Worker (sw.js)
   PWA 오프라인 지원
══════════════════════════════════════════ */

const CACHE_NAME = 'examgen-v1.0.0';

// 캐시할 파일 목록 (앱 셸)
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

/* ── Install: 앱 셸 사전 캐싱 ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: 구 캐시 정리 ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: 네트워크 우선, 실패 시 캐시 ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Gemini API 요청은 캐시하지 않음 (항상 네트워크)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('google.com')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: { message: '네트워크에 연결되어 있지 않습니다. AI 기능을 사용하려면 인터넷 연결이 필요합니다.' } }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // 외부 CDN (fonts, html2pdf) — 네트워크 우선 + 캐시 폴백
  if (url.hostname !== self.location.hostname && !url.protocol.startsWith('chrome')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        fetch(request)
          .then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cache.match(request))
      )
    );
    return;
  }

  // 앱 파일 — 캐시 우선 + 네트워크 폴백
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // 오프라인 폴백 HTML (index.html이 없을 때)
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
