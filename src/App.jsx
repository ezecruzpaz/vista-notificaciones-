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
          console.log('✅ Service Worker registrado:', registration);
          setServiceWorkerStatus('Registrado');
          
          // Verificar si ya hay suscripción
          const subscription = await registration.pushManager.getSubscription();
          setHasPushSubscription(!!subscription);
        } catch (error) {
          console.error('❌ Error registrando Service Worker:', error);
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
    console.log('🔍 Iniciando suscripción a Web Push...');
    
    if (!('serviceWorker' in navigator)) {
      console.error('❌ Service Worker no soportado');
      setNotificationStatus('Service Worker no soportado');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service Worker listo:', registration);
      
      const permission = await Notification.requestPermission();
      console.log('🔐 Permiso obtenido:', permission);
      
      if (permission !== 'granted') {
        console.warn('⚠️ Permiso no concedido');
        setNotificationStatus('Permiso denegado para notificaciones');
        return false;
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      console.log('🔑 Clave VAPID convertida');
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      
      console.log('✅ Suscripción creada:', subscription);

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
        console.log('✅ Suscripción guardada en el servidor');
        setHasPushSubscription(true);
        setNotificationStatus('✅ Notificaciones Web Push activadas correctamente');
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ Error del servidor:', errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('💥 Error completo en suscripción:', error);
      setNotificationStatus(`Error: ${error.message}`);
      return false;
    }
  };

  const handleLogin = () => {
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
        console.error('Error procesando mensaje WS:', error);
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

    const savedEnabled = localStorage.getItem(`user_${username}_notificationsEnabled`) === 'true';
    setNotificationsEnabled(savedEnabled);
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

      const savedEnabled = localStorage.getItem(`user_${savedUser}_notificationsEnabled`) === 'true';
      setNotificationsEnabled(savedEnabled);

      const websocket = new WebSocket('wss://notifications-mv76.onrender.com');
      websocket.onopen = () => {
        websocket.send(JSON.stringify({ type: 'register', username: savedUser }));
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
          console.error('Error procesando mensaje WS:', error);
        }
      };

      websocket.onerror = () => setIsConnected(false);
      websocket.onclose = () => setIsConnected(false);
      setWs(websocket);

      const savedNotifs = JSON.parse(localStorage.getItem(`user_${savedUser}_notifications`) || '[]');
      setNotifications(savedNotifs);
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
      setNotificationsEnabled(true);
      localStorage.setItem(`user_${currentUser}_notificationsEnabled`, 'true');

      // Suscribirse a Web Push
      const subscribed = await subscribeToPush();
      if (subscribed) {
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
        console.log('✅ Desuscrito de Web Push');
      }
    } catch (error) {
      console.error('Error al desuscribirse:', error);
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
        alert(`✅ Notificación enviada a ${targetUser}`);
        setTargetUser('');
      } else {
        const errorData = await response.json();
        alert(`❌ Error: ${errorData.error || 'No se pudo enviar'}`);
      }
    } catch (error) {
      alert('❌ No se pudo conectar con el servidor.');
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
            <div className="text-5xl mb-4">🔔</div>
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
                Hola, <span className="text-blue-600">{currentUser}</span> 👋
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

        {/* Estado del sistema */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Estado del Sistema</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${serviceWorkerStatus === 'Registrado' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="text-xs font-semibold text-gray-600 mb-1">Service Worker</p>
              <p className={`text-lg font-bold ${serviceWorkerStatus === 'Registrado' ? 'text-green-700' : 'text-red-700'}`}>
                {serviceWorkerStatus === 'Registrado' ? '✅ Activo' : '❌ Inactivo'}
              </p>
            </div>
            
            <div className={`p-4 rounded-lg ${hasPushSubscription ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              <p className="text-xs font-semibold text-gray-600 mb-1">Suscripción Push</p>
              <p className={`text-lg font-bold ${hasPushSubscription ? 'text-green-700' : 'text-yellow-700'}`}>
                {hasPushSubscription ? '✅ Activa' : '⚠️ Pendiente'}
              </p>
            </div>
            
            <div className={`p-4 rounded-lg ${Notification.permission === 'granted' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="text-xs font-semibold text-gray-600 mb-1">Permisos</p>
              <p className={`text-lg font-bold ${Notification.permission === 'granted' ? 'text-green-700' : 'text-red-700'}`}>
                {Notification.permission === 'granted' ? '✅ Concedido' : 
                 Notification.permission === 'denied' ? '❌ Denegado' : '🟡 Pendiente'}
              </p>
            </div>
          </div>
        </section>

        {/* Panel de control de notificaciones */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🔔 Control de Notificaciones</h3>
          
          {!notificationsEnabled ? (
            <div className="space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                <p className="text-yellow-800 text-sm font-medium">
                  🔕 Las notificaciones están desactivadas
                </p>
                <p className="text-yellow-700 text-xs mt-1">
                  Actívalas para recibir alertas incluso cuando cierres la página
                </p>
              </div>

              <button
                onClick={handleEnableNotifications}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg font-semibold text-base hover:bg-green-600 transition-colors"
              >
                ✅ Activar Notificaciones Web Push
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <p className="text-green-800 text-sm font-medium">
                  ✅ Notificaciones activadas
                </p>
                <p className="text-green-700 text-xs mt-1">
                  Recibirás alertas incluso con la app cerrada
                </p>
              </div>

              <button
                onClick={handleDisableNotifications}
                className="w-full px-6 py-3 bg-red-500 text-white rounded-lg font-semibold text-base hover:bg-red-600 transition-colors"
              >
                🔕 Desactivar Notificaciones
              </button>
            </div>
          )}

          {notificationStatus && (
            <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-blue-800 text-sm font-medium">{notificationStatus}</p>
            </div>
          )}
        </section>

        {/* Simulador */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">📤 Simulador de Asignaciones</h2>
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
              📨 Enviar Notificación
            </button>
          </div>
        </section>

        {/* Historial de notificaciones */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">📋 Historial de Notificaciones</h3>
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Limpiar todo
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">📭</p>
              <p className="text-gray-500 text-sm mt-2">No hay notificaciones</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.map((notif, index) => (
                <div key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                  <p className="font-semibold text-gray-900">{notif.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{notif.body}</p>
                  {notif.timestamp && (
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(notif.timestamp).toLocaleString('es-MX')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}