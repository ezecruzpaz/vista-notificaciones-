/**
 * Solicitar permiso para mostrar notificaciones
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    throw new Error('Este navegador no soporta notificaciones');
  }
  
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Mostrar una notificación del sistema
 */
export function showNotification(title, options = {}) {
  if (!('Notification' in window)) {
    //console.warn('Notificaciones no soportadas');
    return;
  }
  
  if (Notification.permission !== 'granted') {
    //console.warn('No hay permiso para mostrar notificaciones');
    return;
  }
  
  // Opciones por defecto
  const defaultOptions = {
    vibrate: [200, 100, 200],
    tag: `notification-${Date.now()}`,
    requireInteraction: false,
    silent: false,
    ...options
  };
  
  const notification = new Notification(title, defaultOptions);
  
  // Manejar click en la notificación
  notification.onclick = function(event) {
    event.preventDefault();
    window.focus();
    notification.close();
    
    if (options.data && options.data.url) {
      window.location.href = options.data.url;
    }
  };
  
  notification.onerror = function(error) {
    //console.error('Error mostrando notificación:', error);
  };
  
  return notification;
}

/**
 * Verificar si la página está visible (en foco)
 */
export function isPageVisible() {
  return document.visibilityState === 'visible' && document.hasFocus();
}

/**
 * Mostrar notificación solo si la página no está visible
 */
export function showNotificationIfHidden(title, options) {
  if (!isPageVisible()) {
    showNotification(title, options);
  } else {
   // console.log('Página visible, no mostrar notificación del sistema');
  }
}

/**
 * Obtener el estado actual de los permisos
 */
export function getNotificationPermissionStatus() {
  if (!('Notification' in window)) {
    return 'not-supported';
  }
  return Notification.permission;
}