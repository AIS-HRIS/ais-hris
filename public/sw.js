/* Cache only public offline assets. Authenticated HTML, APIs and HR data are never cached. */
const CACHE='ais-people-shell-v1';
const ASSETS=['/offline.html','/favicon.svg','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ais-people-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));return;}if(ASSETS.includes(url.pathname))event.respondWith(caches.match(event.request).then(found=>found||fetch(event.request)));});
