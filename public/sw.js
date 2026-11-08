/* Cache only public offline assets. Authenticated HTML, APIs and HR data are never cached. */
const SCOPE=self.registration.scope;
const PREFIX=`ais-people-shell-${encodeURIComponent(new URL(SCOPE).pathname)}-`;
const CACHE=PREFIX+'v2';
const ASSETS=['offline.html','favicon.svg','icons/icon-192.png','icons/icon-512.png'].map(path=>new URL(path,SCOPE).href);
const OFFLINE=new URL('offline.html',SCOPE).href;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||!url.href.startsWith(SCOPE))return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(OFFLINE)));return;}
 if(ASSETS.includes(url.href))event.respondWith(caches.match(event.request).then(found=>found||fetch(event.request)));
});
