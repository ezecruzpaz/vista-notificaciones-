import React, { useState, useEffect } from 'react';
import { showNotification, getNotificationPermissionStatus } from './lib/notifications';

import Login from './components/Login';
import Header from './components/Header';
import NotificationToggle from './components/NotificationToggle';
import Simulator from './components/Simulator';

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
  const [taskDescription, setTaskDescription] = useState(
    'Tienes una nueva tarea pendiente que requiere tu atención.'
  );

  // useEffects y funciones de lógica (se mantienen igual)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js');
          setServiceWorkerStatus('Registrado');
          const subscription = await registration.pushManager.getSubscription();
          setHasPushSubscription(!!subscription);
        } catch (error) {
          setServiceWorkerStatus('Error');
        }
      };
      registerSW();
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      const key = `user_${currentUser}_notifications`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      setNotifications(saved);
    }
  }, [isLoggedIn, currentUser]);

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

  const handleLogin = () => {
    if (!username.trim()) {
      alert('Por favor ingresa un nombre de usuario');
      return;
    }
    localStorage.setItem('currentUser', username);

    const websocket = new WebSocket('wss://notifications-mv76.onrender.com');

    websocket.onopen = () => {
      websocket.send(JSON.stringify({ type: 'register', username }));
      setIsConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          const notif = data.notification;
          setNotifications((prev) => [notif, ...prev]);
        }
      } catch (error) {
        console.error('Error procesando mensaje WS:', error);
      }
    };

    websocket.onerror = () => {
      setNotificationStatus('Error de conexión con el servidor');
      setIsConnected(false);
    };

    websocket.onclose = () => setIsConnected(false);

    setWs(websocket);
    setCurrentUser(username);
    setIsLoggedIn(true);

    const savedEnabled = localStorage.getItem(`user_${username}_notificationsEnabled`) === 'true';
    setNotificationsEnabled(savedEnabled);
  };

  const handleLogout = () => {
    if (!window.confirm('¿Seguro que quieres cerrar sesión?')) return;

    if (ws) ws.close();

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

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            const notif = data.notification;
            setNotifications((prev) => [notif, ...prev]);
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

      const subscribed = await subscribeToPush();
      if (subscribed) {
        new Notification('Notificaciones Activadas', {
          body: 'Recibirás alertas incluso fuera de la página.',
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

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
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
          targetUser,
          taskTitle,
          taskDescription
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
  // RENDER
  if (!isLoggedIn) {
    return <Login username={username} setUsername={setUsername} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Header
          currentUser={currentUser}
          isConnected={isConnected}
          onLogout={handleLogout}
        />
        {/* Toggle de notificaciones */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
          <NotificationToggle
            notificationsEnabled={notificationsEnabled}
            notificationStatus={notificationStatus}
            onEnable={handleEnableNotifications}
            onDisable={handleDisableNotifications}
          />
        </section>

        {/* Simulador */}
        <Simulator
          targetUser={targetUser}
          setTargetUser={setTargetUser}
          taskTitle={taskTitle}
          setTaskTitle={setTaskTitle}
          taskDescription={taskDescription}
          setTaskDescription={setTaskDescription}
          onSendTask={handleSendTask}
        />

      </div>
    </div>
  );
}