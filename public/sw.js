const V='lenny-v1';
self.addEventListener('install',()=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(u.origin!==location.origin)return;
 e.respondWith(
  fetch(req).then(res=>{
   const cp=res.clone();
   caches.open(V).then(c=>c.put(req,cp)).catch(()=>{});
   return res;
  }).catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html')))
 );
});
