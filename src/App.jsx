import React, { useState, useEffect } from 'react';
// Ajusta la ruta si tu archivo notificaciones.js está en otra carpeta
import { showNotification, getNotificationPermissionStatus } from './lib/notifications';

export default function App() {
  const [currentUser, setCurrentUser] = useState('');
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [ws, setWs] = useState(null); // ← Conexión WebSocket

  const [targetUser, setTargetUser] = useState('');
  const [taskTitle, setTaskTitle] = useState('Nueva tarea asignada');
  const [taskDescription, setTaskDescription] = useState('Tienes una nueva tarea pendiente que requiere tu atención.');

  // Cargar notificaciones guardadas (opcional)
  useEffect(() => {
    if (isLoggedIn) {
      const key = `user_${currentUser}_notifications`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      setNotifications(saved);
    }
  }, [isLoggedIn, currentUser]);

  // Guardar notificaciones en localStorage cuando cambien
  useEffect(() => {
    if (isLoggedIn) {
      const key = `user_${currentUser}_notifications`;
      localStorage.setItem(key, JSON.stringify(notifications));
    }
  }, [notifications, isLoggedIn, currentUser]);

  const handleLogin = () => {
    if (!username.trim()) {
      alert('Por favor ingresa un nombre de usuario');
      return;
    }
    localStorage.setItem('currentUser', username); // ← ¡AGREGA ESTA LÍNEA!

    // Crear conexión WebSocket
    const websocket = new WebSocket('wss://notifications-mv76.onrender.com');

    websocket.onopen = () => {
      //console.log('✅ WebSocket conectado al servidor');
      // Registrar usuario en el servidor
      websocket.send(JSON.stringify({
        type: 'register',
        username: username
      }));
      setIsConnected(true);
    };

    websocket.onmessage = (event) => {
      //console.log('📥 Mensaje recibido del servidor:', event.data);

      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          const notif = data.notification;

          // ✅ Verificar permiso REAL en el momento de recibir la notificación
          if (Notification.permission === 'granted') {
            showNotification(notif.title, {
              body: notif.body,
              icon: '/favicon.ico'
            });
          } else if (Notification.permission === 'default') {
            // Opcional: solicitar permiso automáticamente al recibir la primera notificación
            // (no recomendado, mejor hacerlo solo al activar notificaciones)
          }

          setNotifications(prev => [notif, ...prev]);
        }
      } catch (error) {
        //console.error('Error procesando mensaje WS:', error);
      }
    };

    websocket.onerror = (error) => {
      //console.error('❌ Error en WebSocket:', error);
      setNotificationStatus('Error de conexión con el servidor');
      setIsConnected(false);
    };

    websocket.onclose = () => {
      //console.log('🔌 WebSocket desconectado');
      setIsConnected(false);
    };

    setWs(websocket);
    setCurrentUser(username);
    setIsLoggedIn(true);

    // Cargar estado previo
    const savedEnabled = localStorage.getItem(`user_${username}_notificationsEnabled`) === 'true';
    setNotificationsEnabled(savedEnabled);
    setNotificationPermission(getNotificationPermissionStatus());
  };

  const handleLogout = () => {
  if (!window.confirm('¿Seguro que quieres cerrar sesión?')) return;

  // Cerrar conexión WebSocket
  if (ws) {
    ws.close();
  }

  // Limpiar localStorage
  localStorage.removeItem('currentUser');
  if (currentUser) {
    localStorage.removeItem(`user_${currentUser}_notifications`);
    localStorage.removeItem(`user_${currentUser}_notificationsEnabled`);
  }

  // Resetear todos los estados
  setCurrentUser('');
  setUsername('');
  setIsLoggedIn(false);
  setNotificationsEnabled(false);
  setNotificationStatus('');
  setNotifications([]);
  setIsConnected(false);
  setWs(null);
};

  // 👇 AGREGA ESTE useEffect AL INICIO DEL COMPONENTE
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');

    if (savedUser) {
      // Restaurar estado del usuario
      setUsername(savedUser);
      setCurrentUser(savedUser);
      setIsLoggedIn(true);

      // Cargar preferencia de notificaciones
      const savedEnabled = localStorage.getItem(`user_${savedUser}_notificationsEnabled`) === 'true';
      setNotificationsEnabled(savedEnabled);

      // Conectar al WebSocket
      const websocket = new WebSocket('wss://notifications-mv76.onrender.com');

      websocket.onopen = () => {
       // console.log('✅ WebSocket conectado (sesión restaurada)');
        websocket.send(JSON.stringify({ type: 'register', username: savedUser }));
        setIsConnected(true);
      };

      websocket.onmessage = (event) => {
        //console.log('📥 Mensaje recibido del servidor:', event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            const notif = data.notification;
            if (Notification.permission === 'granted') {
              showNotification(notif.title, {
                body: notif.body,
                icon: '/favicon.ico'
              });
            }
            setNotifications(prev => [notif, ...prev]);
          }
        } catch (error) {
          //console.error('Error procesando mensaje WS:', error);
        }
      };

      websocket.onerror = (error) => {
        //console.error('❌ Error en WebSocket:', error);
        setIsConnected(false);
      };

      websocket.onclose = () => {
        //console.log('🔌 WebSocket desconectado');
        setIsConnected(false);
      };

      setWs(websocket);

      // Cargar notificaciones guardadas
      const savedNotifs = JSON.parse(localStorage.getItem(`user_${savedUser}_notifications`) || '[]');
      setNotifications(savedNotifs);
    }
  }, []); // ← ¡Importante: array vacío para ejecutar solo al montar!
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationStatus('Este navegador no soporta notificaciones.');
      return;
    }

    let permission = Notification.permission;

    // Solo pedimos permiso si está en 'default'
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    // Actualizamos el estado local de "activado/desactivado"
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      setNotificationStatus('Notificaciones del sistema activadas');
      localStorage.setItem(`user_${currentUser}_notificationsEnabled`, 'true');

      // Notificación de prueba
      new Notification('Notificaciones Activadas', {
        body: 'Recibirás alertas incluso fuera de la página.',
        icon: '/favicon.ico'
      });
    } else {
      setNotificationsEnabled(false);
      setNotificationStatus(
        permission === 'denied'
          ? ' Las notificaciones están bloqueadas. Haz clic en el  de la barra de direcciones para habilitarlas.'
          : ' No se otorgó permiso para notificaciones.'
      );
      localStorage.setItem(`user_${currentUser}_notificationsEnabled`, 'false');
    }
  };

  const handleDisableNotifications = () => {
    if (!window.confirm('¿Deseas desactivar las notificaciones?')) return;

    setNotificationsEnabled(false);
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
        alert(`Notificación enviada a ${targetUser}`);
        setTargetUser('');
      } else {
        const errorData = await response.json();
        alert(` Error: ${errorData.error || 'No se pudo enviar'}`);
      }
    } catch (error) {
      //console.error('Error al enviar tarea:', error);
      alert('No se pudo conectar con el servidor. ¿Está corriendo en localhost:3000?');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Notificaciones</h1>
            <p className="text-gray-500 mt-2">Inicia sesión para continuar</p>
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
            <p className="text-sm text-gray-400">
              Sistema de notificaciones en tiempo real
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Hola, <span className="text-blue-600">{currentUser}</span>
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Indicador de conexión */}
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {isConnected ? '● Conectado' : '● Desconectado'}
              </div>

              {/* Botón de cerrar sesión */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-1 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors"
                aria-label="Cerrar sesión"
              >
                
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </header>

        {/* Panel de usuario */}
        {/* Panel de usuario - Solo visible si las notificaciones NO están activadas */}
        {!notificationsEnabled && (
          <section className="bg-white border border-gray-200 rounded-xl shadow-lg p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                 Notificaciones desactivadas
              </p>

              {(() => {
                const perm = Notification.permission;
                return (
                  <div className={`mt-2 px-3 py-1 rounded-full text-xs font-semibold ${perm === 'granted'
                    ? 'bg-green-100 text-green-800'
                    : perm === 'denied'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    Permiso: {perm === 'granted' ? ' Concedido' :
                      perm === 'denied' ? ' Denegado' : ' Pendiente'}
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleEnableNotifications}
                className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold text-base hover:bg-green-600 transition-colors"
              >
                Activar Notificaciones
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
            <h2 className="text-xl font-bold text-gray-900">Simulador de Asignaciones</h2>
            <p className="text-sm text-gray-500">Envía notificaciones de prueba</p>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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