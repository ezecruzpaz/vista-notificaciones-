// Manejo de Service Worker y Push API

const VAPID_PUBLIC_KEY = 'BKth85oDWY_n2DyOS6WR62uV_FRs7lR4MGnf_hqkBWylulbQwaJnP4WJI3YF3Zc8VUsE6VUPS2heyjjmShQBufE';

// URL del backend según entorno
const getApiUrl = () => {
  const isProd = window.location.hostname.includes('vercel.app') || 
                 !window.location.hostname.includes('localhost');
  return isProd 
    ? 'https://notifications-red.vercel.app'
    : 'http://localhost:3000';
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers no están soportados');
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    //console.log('Service Worker registrado:', registration);
    
    await navigator.serviceWorker.ready;
    //console.log('Service Worker activo');
    
    return registration;
  } catch (error) {
    //console.error('Error registrando Service Worker:', error);
    throw error;
  }
}

async function subscribeToPush(registration) {
  if (!('PushManager' in window)) {
    throw new Error('Push notifications no están soportadas');
  }
  
  try {
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      //console.log('Ya existe una suscripción push');
      return subscription;
    }
    
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });
    
    //console.log('Suscripción push creada:', subscription);
    return subscription;
  } catch (error) {
    //console.error('Error suscribiéndose a push:', error);
    throw error;
  }
}

async function sendSubscriptionToServer(username, subscription) {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, subscription })
    });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
     // console.log('Suscripción guardada en el servidor');
      return true;
    } else {
      throw new Error('Error guardando suscripción');
    }
  } catch (error) {
    //console.error('Error enviando suscripción al servidor:', error);
    throw error;
  }
}

export async function registerServiceWorkerAndSubscribe(username) {
  try {
    const registration = await registerServiceWorker();
    const subscription = await subscribeToPush(registration);
    await sendSubscriptionToServer(username, subscription);
    
    //console.log('Proceso completo: SW registrado y suscrito a push');
    return true;
  } catch (error) {
    //console.error('Error en el proceso de registro:', error);
    throw error;
  }
}

export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return true;
    
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;
    
    const success = await subscription.unsubscribe();
    
    if (success) {
      const apiUrl = getApiUrl();
      try {
        await fetch(`${apiUrl}/api/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
      } catch (err) {
        //console.warn('No se pudo notificar al servidor de desuscripción:', err);
      }
      
      //console.log('Desuscrito de push notifications');
      return true;
    }
    
    return false;
  } catch (error) {
    //console.error('Error desuscribiéndose:', error);
    return true;
  }
}

export async function hasActiveSubscription() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (error) {
    //console.error('Error verificando suscripción:', error);
    return false;
  }
}