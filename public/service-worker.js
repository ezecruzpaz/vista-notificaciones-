// service-worker.js - Service Worker para manejar Push Notifications

const CACHE_NAME = 'notifications-app-v1';

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  
  // MODO DESARROLLO: Caché mínimo, solo para que el SW funcione
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache abierto (modo mínimo)');
      // Solo cachear el service-worker mismo para que funcione
      return cache.addAll([
        '/service-worker.js'
      ]).catch(err => {
        console.error('[SW] Error precacheando:', err);
      });
    })
  );
  
  // Forzar que el SW tome control inmediatamente
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Eliminando cache antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Tomar control de todas las páginas inmediatamente
  return self.clients.claim();
});

// Interceptar requests (opcional - para funcionamiento offline)
self.addEventListener('fetch', (event) => {
  // MODO DESARROLLO: Siempre ir a la red, no usar caché
  // Esto hace que los cambios se vean inmediatamente
  event.respondWith(
    fetch(event.request).catch(() => {
      // Si falla, intenta desde caché como fallback
      return caches.match(event.request).then((response) => {
        return response || new Response('Offline - servidor no disponible', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
  
  /* MODO PRODUCCIÓN: Priorizar caché (descomenta esto para producción)
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retornar del cache si existe, sino hacer fetch
      return response || fetch(event.request);
    }).catch(() => {
      console.log('[SW] Fetch falló, usuario offline');
    })
  );
  */
});

// ========================================
// PUSH NOTIFICATIONS - LO MÁS IMPORTANTE
// ========================================

// Escuchar eventos push del servidor
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido:', event);
  
  let notificationData = {
    title: '🔔 Nueva notificación',
    body: 'Tienes una nueva actualización',
    // icon: '/icon.png', // Comentado hasta que tengamos iconos
    // badge: '/badge.png',
    data: {
      url: '/'
    }
  };
  
  // Parsear datos del push si existen
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        // icon: payload.icon || notificationData.icon,
        // badge: payload.badge || notificationData.badge,
        tag: payload.data?.taskId ? `task-${payload.data.taskId}` : `notif-${Date.now()}`,
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: payload.data || notificationData.data,
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
      console.error('[SW] Error parseando datos del push:', error);
    }
  }
  
  // Mostrar la notificación
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      // icon: notificationData.icon,
      // badge: notificationData.badge,
      tag: notificationData.tag,
      vibrate: notificationData.vibrate,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: notificationData.actions
    })
  );
});

// Manejar click en la notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificación clickeada:', event.action);
  
  event.notification.close(); // Cerrar la notificación
  
  // Si el usuario clickeó "cerrar", no hacer nada más
  if (event.action === 'close') {
    return;
  }
  
  // Obtener URL de los datos de la notificación
  const urlToOpen = event.notification.data?.url || '/';
  
  // Abrir o enfocar la ventana de la aplicación
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Buscar si ya hay una ventana abierta
      for (const client of clientList) {
        if (client.url === self.registration.scope + urlToOpen.substring(1) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Manejar cierre de notificaciones
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notificación cerrada:', event.notification.tag);
});

// Sincronización en segundo plano (opcional - para funcionalidad avanzada)
self.addEventListener('sync', (event) => {
  console.log('[SW] Sincronización en segundo plano:', event.tag);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      // Aquí podrías sincronizar datos con el servidor
      console.log('[SW] Sincronizando...')
    );
  }
});

console.log('[SW] Service Worker cargado correctamente');