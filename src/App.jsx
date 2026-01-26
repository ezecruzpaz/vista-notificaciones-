import React, { useState, useEffect } from 'react';

// Clave VAPID pública (debe coincidir con tu backend)
const VAPID_PUBLIC_KEY = 'BKth85oDWY_n2DyOS6WR62uV_FRs7lR4MGnf_hqkBWylulbQwaJnP4WJI3YF3Zc8VUsE6VUPS2heyjjmShQBufE';

// Utilidad para convertir clave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Función helper para verificar si las notificaciones están realmente activas
const checkIfNotificationsAreActive = async () => {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (error) {
    console.error('Error checking notification status:', error);
    return false;
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState('');
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [ws, setWs] = useState(null);
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState('No registrado');
  const [hasPushSubscription, setHasPushSubscription] = useState(false);

  const [targetUser, setTargetUser] = useState('');
  const [taskTitle, setTaskTitle] = useState('Nueva tarea asignada');
  const [taskDescription, setTaskDescription] = useState('Tienes una nueva tarea pendiente que requiere tu atención.');

  // Registrar Service Worker al cargar la app
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js');
          setServiceWorkerStatus('Registrado');
        } catch (error) {
          setServiceWorkerStatus('Error');
        }
      };
      registerSW();
    }
  }, []);

  // Cargar notificaciones guardadas
  useEffect(() => {
    if (isLoggedIn) {
      const key = `user_${currentUser}_notifications`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      setNotifications(saved);
    }
  }, [isLoggedIn, currentUser]);

  // Guardar notificaciones en localStorage
  useEffect(() => {
    if (isLoggedIn) {
      const key = `user_${currentUser}_notifications`;
      localStorage.setItem(key, JSON.stringify(notifications));
    }
  }, [notifications, isLoggedIn, currentUser]);

  const subscribeToPush = async () => {
    
    if (!('serviceWorker' in navigator)) {
      setNotificationStatus('Service Worker no soportado');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setNotificationStatus('Permiso denegado para notificaciones');
        return false;
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      

      // Enviar al backend
      const response = await fetch('https://notifications-mv76.onrender.com/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser,
          subscription: subscription
        })
      });

      if (response.ok) {
        setHasPushSubscription(true);
        setNotificationStatus('✅ Notificaciones Web Push activadas correctamente');
        return true;
      } else {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
    } catch (error) {
      setNotificationStatus(`Error: ${error.message}`);
      return false;
    }
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      alert('Por favor ingresa un nombre de usuario');
      return;
    }
    localStorage.setItem('currentUser', username);

    const websocket = new WebSocket('wss://notifications-mv76.onrender.com');

    websocket.onopen = () => {
      websocket.send(JSON.stringify({ type: 'register', username: username }));
      setIsConnected(true);
    };

    // Solo actualizar el historial, NO mostrar notificaciones del navegador
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          const notif = data.notification;
          // Solo agregar al historial, Web Push se encarga de las notificaciones
          setNotifications(prev => [notif, ...prev]);
        }
      } catch (error) {
      }
    };

    websocket.onerror = (error) => {
      setNotificationStatus('Error de conexión con el servidor');
      setIsConnected(false);
    };

    websocket.onclose = () => {
      setIsConnected(false);
    };

    setWs(websocket);
    setCurrentUser(username);
    setIsLoggedIn(true);

    // Verificar estado real de las notificaciones
    const isActive = await checkIfNotificationsAreActive();
    setNotificationsEnabled(isActive);
    setHasPushSubscription(isActive);
  };

  const handleLogout = () => {
    if (!window.confirm('¿Seguro que quieres cerrar sesión?')) return;

    if (ws) ws.close();

    // Limpiar localStorage
    localStorage.removeItem('currentUser');
    if (currentUser) {
      localStorage.removeItem(`user_${currentUser}_notifications`);
      localStorage.removeItem(`user_${currentUser}_notificationsEnabled`);
    }

    setCurrentUser('');
    setUsername('');
    setIsLoggedIn(false);
    setNotificationsEnabled(false);
    setNotificationStatus('');
    setNotifications([]);
    setIsConnected(false);
    setWs(null);
    setHasPushSubscription(false);
  };

  // Auto-login
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUsername(savedUser);
      setCurrentUser(savedUser);
      setIsLoggedIn(true);

      const websocket = new WebSocket('wss://notifications-mv76.onrender.com');
      websocket.onopen = () => {
        websocket.send(JSON.stringify({ type: 'register', username: savedUser }));
        setIsConnected(true);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            const notif = data.notification;
            setNotifications(prev => [notif, ...prev]);
          }
        } catch (error) {
          console.error('Error procesando mensaje WS:', error);
        }
      };

      websocket.onerror = () => setIsConnected(false);
      websocket.onclose = () => setIsConnected(false);
      setWs(websocket);

      const savedNotifs = JSON.parse(localStorage.getItem(`user_${savedUser}_notifications`) || '[]');
      setNotifications(savedNotifs);

      // Verificar estado real de notificaciones
      const checkStatus = async () => {
        const isActive = await checkIfNotificationsAreActive();
        setNotificationsEnabled(isActive);
        setHasPushSubscription(isActive);
      };
      
      checkStatus();
    }
  }, []);

  const handleEnableNotifications = async () => {
    
    if (!('Notification' in window)) {
      setNotificationStatus('Este navegador no soporta notificaciones.');
      return;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }


    if (permission === 'granted') {
      // Suscribirse a Web Push
      const subscribed = await subscribeToPush();
      if (subscribed) {
        setNotificationsEnabled(true);
        localStorage.setItem(`user_${currentUser}_notificationsEnabled`, 'true');
        
        new Notification('🎉 Notificaciones Activadas', {
          body: 'Recibirás alertas incluso cuando cierres esta página.',
          icon: '/favicon.ico'
        });
      }
    } else {
      setNotificationsEnabled(false);
      setNotificationStatus(
        permission === 'denied'
          ? 'Las notificaciones están bloqueadas. Haz clic en el 🔒 de la barra de direcciones para habilitarlas.'
          : 'No se otorgó permiso para notificaciones.'
      );
      localStorage.setItem(`user_${currentUser}_notificationsEnabled`, 'false');
    }
  };

  const handleDisableNotifications = async () => {
    if (!window.confirm('¿Deseas desactivar las notificaciones?')) return;
    
    // Desuscribir del servicio push
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
    } catch (error) {
    }
    
    setNotificationsEnabled(false);
    setHasPushSubscription(false);
    setNotificationStatus('Notificaciones desactivadas');
    localStorage.setItem(`user_${currentUser}_notificationsEnabled`, 'false');
  };

  const handleSendTask = async () => {
    if (!targetUser.trim()) {
      alert('Por favor ingresa el usuario destino');
      return;
    }

    try {
      const response = await fetch('https://notifications-mv76.onrender.com/api/simulate-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUser: targetUser,
          taskTitle: taskTitle,
          taskDescription: taskDescription
        })
      });

      if (response.ok) {
        alert(` Notificación enviada a ${targetUser}`);
        setTargetUser('');
      } else {
        const errorData = await response.json();
        alert(` Error: ${errorData.error || 'No se pudo enviar'}`);
      }
    } catch (error) {
      alert(' No se pudo conectar con el servidor.');
    }
  };

  const clearNotifications = () => {
    if (!window.confirm('¿Eliminar todas las notificaciones?')) return;
    setNotifications([]);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Notificaciones</h1>
            <p className="text-gray-500 mt-2">Sistema de alertas en tiempo real</p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Nombre de usuario"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={handleLogin}
              className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold text-lg hover:bg-blue-600 transition-colors"
            >
              Iniciar Sesión
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              Recibe notificaciones incluso con la app cerrada
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <header className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Hola, <span className="text-blue-600">{currentUser}</span> 
              </h1>
              <p className="text-sm text-gray-500 mt-1">Sistema de notificaciones Web Push</p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isConnected ? '● Conectado' : '● Desconectado'}
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </header>
        {/* Panel de control de notificaciones - SOLO si NO están activas */}
        {!notificationsEnabled && (
          <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4"> Control de Notificaciones</h3>
            
            <div className="space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                <p className="text-yellow-800 text-sm font-medium">
                   Las notificaciones están desactivadas
                </p>
                <p className="text-yellow-700 text-xs mt-1">
                  Actívalas para recibir alertas incluso cuando cierres la página
                </p>
              </div>

              <button
                onClick={handleEnableNotifications}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg font-semibold text-base hover:bg-green-600 transition-colors"
              >
                 Activar Notificaciones Web Push
              </button>
            </div>

            {notificationStatus && (
              <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                <p className="text-blue-800 text-sm font-medium">{notificationStatus}</p>
              </div>
            )}
          </section>
        )}

        {/* Simulador */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900"> Simulador de Asignaciones</h2>
            <p className="text-sm text-gray-500">Envía notificaciones de prueba a otros usuarios</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                Usuario destino
              </label>
              <input
                type="text"
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                placeholder="Nombre del usuario"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                Título de la tarea
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">
                Descripción
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <button
              onClick={handleSendTask}
              className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold text-lg hover:bg-blue-600 transition-colors"
            >
               Enviar Notificación
            </button>
          </div>
        </section>

       
      </div>
    </div>
  );
}