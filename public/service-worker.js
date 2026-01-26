const CACHE_NAME = 'notifications-app-v1';

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/service-worker.js'
      ]).catch(err => {
        //console.error('[SW] Error precacheando:', err);
      });
    })
  );
  
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  return self.clients.claim();
});

// Interceptar requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        return response || new Response('Offline - servidor no disponible', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});


// PUSH NOTIFICATIONS - ACTUALIZADO


self.addEventListener('push', (event) => {
  //console.log('[SW] Push recibido:', event.data?.text());
  
  let notificationData = {
    title: '🔔 Nueva notificación',
    body: 'Tienes una nueva actualización',
    icon: '/favicon.ico',
    badge: '/favicon.ico'
  };
  
  if (event.data) {
    try {
      // Soporta tanto JSON como texto plano
      const payload = event.data.json ? event.data.json() : { 
        title: 'Nueva notificación', 
        body: event.data.text() 
      };
      
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || '/favicon.ico',
        badge: payload.badge || '/favicon.ico',
        tag: payload.data?.taskId ? `task-${payload.data.taskId}` : `notif-${Date.now()}`,
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: payload.data || { url: '/' },
        actions: [
          {
            action: 'open',
            title: '👁️ Ver'
          },
          {
            action: 'close',
            title: '❌ Cerrar'
          }
        ]
      };
    } catch (error) {
      //console.error('[SW] Error parseando datos del push:', error);
      // Si falla el JSON, usa el texto directamente
      notificationData.body = event.data.text() || notificationData.body;
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      vibrate: notificationData.vibrate,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: notificationData.actions
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  //console.log('[SW] Notificación clickeada:', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Buscar si la app ya está abierta
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Si no está abierta, abrir nueva ventana
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  //console.log('[SW] Notificación cerrada:', event.notification.tag);
});

// Evento de sincronización en segundo plano (opcional)
self.addEventListener('sync', (event) => {
 //console.log('[SW] Sincronización en segundo plano:', event.tag);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      //console.log('[SW] Sincronizando notificaciones pendientes...')
    );
  }
});

//console.log('[SW] Service Worker cargado correctamente');