const CACHE = "caderneta-v8b", SHARE = "partilha-in";
const SHELL = ["./", "index.html", "style.css", "app.js", "game.js", "extras.js", "fun.js", "duel.js", "tools.js", "data.js", "privacidade.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
  ...["pt", "en", "es", "fr", "de"].flatMap(l => [`i18n/ui-${l}.json`, `i18n/content-${l}.json`])];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== SHARE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  // Fotos partilhadas a partir da galeria (Partilhar → Caderneta)
  if (req.method === "POST" && url.origin === location.origin && url.pathname.endsWith("/partilhar")) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const f = fd.getAll("foto").find(x => x && typeof x === "object" && x.size);
        if (f) {
          const c = await caches.open(SHARE);
          await c.put(new URL("./__partilha__", self.registration.scope).href, new Response(f, { headers: {
            "content-type": f.type || "image/jpeg", "x-nome": encodeURIComponent(f.name || "foto.jpg"), "x-mod": String(f.lastModified || 0) } }));
        }
      } catch {}
      return Response.redirect(new URL("./?partilha=1", self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== "GET") return;
  if (url.origin === location.origin) {
    // Rede primeiro (para receber atualizações); sem internet usa a cópia guardada
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
  } else if (url.host.endsWith("googleapis.com") || url.host.endsWith("gstatic.com")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })));
  }
});
