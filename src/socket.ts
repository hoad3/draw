import { io, Socket } from 'socket.io-client';

class SocketManager {
  private static instance: SocketManager;
  private socket: Socket | null = null;

  private constructor() {
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
    // console.log('Connecting to server:', serverUrl); // Debug log
    this.socket = io(serverUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 45000,
      path: '/socket.io/',
      forceNew: true,
      autoConnect: true,
      secure: true // Enable secure connection
    });
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      console.log('Current server URL:', import.meta.env.VITE_SERVER_URL); // Debug log
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public getSocket(): Socket {
    if (!this.socket) {
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
      // console.log('Connecting to server:', serverUrl); // Debug log
      this.socket = io(serverUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 45000,
        path: '/socket.io/',
        forceNew: true,
        autoConnect: true,
        secure: true // Enable secure connection
      });
      this.setupSocketListeners();
    }
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default SocketManager; 