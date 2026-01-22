//- Cliente WebSocket para notificaciones en tiempo real

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.username = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.isIntentionalClose = false;
    this.onNotificationCallback = null;
  }

  get wsUrl() {
    const isProd = window.location.hostname.includes('vercel.app') || 
                   !window.location.hostname.includes('localhost');
    return isProd 
      ? 'wss://notificaciones-yyaj.onrender.com'
      : 'ws://localhost:10000';
  }

  connect(username) {
    this.username = username;
    this.isIntentionalClose = false;

    try {
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror = (error) => this.handleError(error);
      this.ws.onclose = (event) => this.handleClose(event);
      
    } catch (error) {
      console.error('Error creando conexión WebSocket:', error);
    }
  }

  handleOpen() {
    console.log('WebSocket conectado a:', this.wsUrl);
    this.reconnectAttempts = 0;
    
    this.send({
      type: 'register',
      username: this.username
    });
  }

  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('Mensaje recibido:', data);
      
      switch (data.type) {
        case 'registered':
          console.log('Registrado en el servidor:', data.message);
          break;
          
        case 'notification':
          this.handleNotification(data.notification);
          break;
          
        default:
          console.log('Mensaje desconocido:', data);
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  }

  handleNotification(notification) {
    console.log('Notificación recibida:', notification);
    
    // Llamar al callback si existe
    if (this.onNotificationCallback) {
      this.onNotificationCallback(notification);
    }
  }

  handleError(error) {
    console.error('Error en WebSocket:', error);
  }

  handleClose(event) {
    console.log('WebSocket desconectado', event.code, event.reason);
    
    if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      
      console.log(`Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        if (this.username) {
          this.connect(this.username);
        }
      }, delay);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Máximo de intentos de reconexión alcanzado');
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket no está conectado');
    }
  }

  disconnect() {
    this.isIntentionalClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.username = null;
    console.log('WebSocket desconectado intencionalmente');
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  setOnNotification(callback) {
    this.onNotificationCallback = callback;
  }
}

export const wsClient = new WebSocketClient();