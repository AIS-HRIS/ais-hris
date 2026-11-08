import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';

const output=join(process.cwd(),'dist-pages');
const html=await readFile(join(output,'index.html'),'utf8');
const base=new URL('https://ais-hris.github.io/ais-hris/');
const manifest=JSON.parse(await readFile(join(output,'manifest.webmanifest'),'utf8'));
const paths=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
assert(paths.some(p=>p.endsWith('manifest.webmanifest')),'The static entry advertises its PWA manifest');
assert(paths.some(p=>p.endsWith('.js')),'The static entry loads the application bundle');
for(const path of paths){
 const url=new URL(path,base);if(url.origin!==base.origin)continue;
 assert(url.pathname.startsWith(base.pathname),`Asset escapes repository path: ${path}`);
 await access(join(output,decodeURIComponent(url.pathname.slice(base.pathname.length))));
}
for(const start of ['https://example.test/','https://example.test/ais-hris/']){
 const root=new URL(start);
 for(const key of ['id','scope','start_url'])assert.equal(new URL(manifest[key],root).href,root.href,`${key} must work at root and under the repository`);
 for(const icon of manifest.icons){const url=new URL(icon.src,root);assert(url.href.startsWith(root.href));await access(join(output,url.pathname.slice(root.pathname.length)));}
}
assert((await readFile(join(output,'offline.html'),'utf8')).includes('href="./"'),'Offline retry stays within this app');

// Exercise the service worker under both hosting layouts, without touching browser data.
const worker=await readFile(join(output,'sw.js'),'utf8');
for(const scope of ['https://example.test/','https://example.test/ais-hris/']){
 const handlers={},deleted=[],precached=[],matches=[];let cacheName,pending,response;
 const offline={kind:'public-offline-page'};
 const self={registration:{scope},location:{origin:new URL(scope).origin},addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting(){},clients:{claim(){}}};
 const caches={
  async open(name){cacheName=name;return {async addAll(urls){precached.push(...urls);}};},
  async keys(){return [cacheName,cacheName+'-old','another-app-cache'];},
  async delete(name){deleted.push(name);},
  async match(key){matches.push(key);return offline;},
 };
 runInNewContext(worker,{self,caches,URL,fetch:async()=>{throw Error('offline');}});
 handlers.install({waitUntil(p){pending=p;}});await pending;
 assert.equal(precached.length,4);
 for(const url of precached)assert(url.startsWith(scope),'Precache must not load another app’s files');
 assert(precached.includes(new URL('offline.html',scope).href));
 handlers.activate({waitUntil(p){pending=p;}});await pending;
 assert.deepEqual(deleted,[cacheName+'-old'],'Updating the worker must not delete another app’s caches');
 handlers.fetch({request:{method:'GET',mode:'navigate',url:scope},respondWith(p){response=p;}});
 assert.equal(await response,offline);assert.equal(matches.at(-1),new URL('offline.html',scope).href);
 for(const request of [
  {method:'GET',mode:'cors',url:new URL('api/employees',scope).href},
  {method:'POST',mode:'navigate',url:scope},
  {method:'GET',mode:'navigate',url:'https://another.example.test/'},
  ...(new URL(scope).pathname!=='/'?[{method:'GET',mode:'navigate',url:'https://example.test/another-app/'}]:[]),
 ]){let intercepted=false;handlers.fetch({request,respondWith(){intercepted=true;}});assert.equal(intercepted,false,'HR requests and other origins/apps are not cached or intercepted');}
}
console.log('PASS: built Pages entry/assets, root/subpath PWA URLs, offline retry, scoped worker caches and exclusion of HR requests.');
