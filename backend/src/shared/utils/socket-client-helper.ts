/**
 * Socket.IO Client Helper
 * This file provides utilities and examples for connecting to the Socket.IO server
 * Can be used as reference for frontend implementation
 */

export interface SocketClientConfig {
  serverUrl: string;
  token: string;
  options?: {
    transports?: string[];
    timeout?: number;
    forceNew?: boolean;
  };
}

export interface LocationData {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

export interface RideEventData {
  rideId: string;
  customerId: string;
  driverId?: string;
  status: string;
  data?: any;
}

export class SocketClientHelper {
  private socket: any = null;
  private config: SocketClientConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: SocketClientConfig) {
    this.config = config;
  }

  // Connection example (pseudo-code for frontend)
  getConnectionExample(): string {
    return `
// Frontend Socket.IO Client Example (JavaScript/TypeScript)

import { io, Socket } from 'socket.io-client';

const socket: Socket = io('${this.config.serverUrl}', {
  auth: {
    token: '${this.config.token}' // Your JWT token
  },
  transports: ['websocket', 'polling'],
  timeout: 20000,
});

// Connection event handlers
socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

// Listen for notifications
socket.on('notification', (data) => {
  console.log('Notification received:', data);
  // Handle notification in your UI
});

// Listen for ride updates (for customers)
socket.on('ride:accepted', (data) => {
  console.log('Ride accepted:', data);
  // Update ride status in UI
});

socket.on('ride:started', (data) => {
  console.log('Ride started:', data);
  // Show ride in progress UI
});

socket.on('ride:location:update', (data) => {
  console.log('Driver location update:', data);
  // Update driver position on map
});

// For drivers: Send location updates
function sendLocationUpdate(location: LocationData) {
  socket.emit('driver:location:update', location);
}

// For customers: Request a ride
function requestRide(rideData: RideEventData) {
  socket.emit('ride:requested', rideData);
}

// Clean up on app close
function disconnect() {
  socket.disconnect();
}
`;
  }

  // Flutter/Dart client example
  getFlutterExample(): string {
    return `
// Flutter Socket.IO Client Example

import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  late IO.Socket socket;
  
  void connect(String token) {
    socket = IO.io('${this.config.serverUrl}', 
      IO.OptionBuilder()
        .setTransports(['websocket'])
        .setAuth({'token': token})
        .build()
    );

    socket.onConnect((_) {
      print('Connected to server');
    });

    socket.onDisconnect((_) {
      print('Disconnected from server');
    });

    // Listen for notifications
    socket.on('notification', (data) {
      print('Notification: \$data');
      // Handle notification
    });

    // Listen for ride updates
    socket.on('ride:accepted', (data) {
      print('Ride accepted: \$data');
      // Update UI
    });

    socket.on('ride:location:update', (data) {
      print('Location update: \$data');
      // Update map
    });
  }

  // Send location update (for drivers)
  void sendLocationUpdate(Map<String, dynamic> location) {
    socket.emit('driver:location:update', location);
  }

  // Send ride request (for customers)
  void requestRide(Map<String, dynamic> rideData) {
    socket.emit('ride:requested', rideData);
  }

  void disconnect() {
    socket.disconnect();
  }
}
`;
  }

  // React/React Native Hook example
  getReactHookExample(): string {
    return `
// React Hook for Socket.IO

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketProps {
  token: string;
  serverUrl?: string;
}

export const useSocket = ({ token, serverUrl = '${this.config.serverUrl}' }: UseSocketProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from server');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, serverUrl]);

  const sendLocationUpdate = (location: LocationData) => {
    socket?.emit('driver:location:update', location);
  };

  const requestRide = (rideData: RideEventData) => {
    socket?.emit('ride:requested', rideData);
  };

  return {
    socket,
    connected,
    sendLocationUpdate,
    requestRide,
  };
};

// Usage in component
function DriverComponent() {
  const { socket, connected, sendLocationUpdate } = useSocket({ 
    token: 'your-jwt-token' 
  });

  useEffect(() => {
    if (!socket) return;

    socket.on('ride:requested', (data) => {
      console.log('New ride request:', data);
    });

    return () => {
      socket.off('ride:requested');
    };
  }, [socket]);

  const handleLocationUpdate = (location: LocationData) => {
    if (connected) {
      sendLocationUpdate(location);
    }
  };

  return (
    <div>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      {/* Your component JSX */}
    </div>
  );
}
`;
  }

  // Event types and interfaces for TypeScript clients
  getTypeScriptDefinitions(): string {
    return `
// TypeScript Definitions for Socket.IO Events

// Server to Client Events
interface ServerToClientEvents {
  notification: (data: NotificationData) => void;
  'ride:requested': (data: RideEventData) => void;
  'ride:accepted': (data: RideEventData) => void;
  'ride:cancelled': (data: RideEventData) => void;
  'ride:started': (data: RideEventData) => void;
  'ride:completed': (data: RideEventData) => void;
  'ride:location:update': (data: LocationUpdateData) => void;
  'driver:location:update': (data: DriverLocationData) => void;
  'driver:online': (data: DriverStatusData) => void;
}

// Client to Server Events
interface ClientToServerEvents {
  'driver:location:update': (data: LocationData) => void;
  'driver:online': () => void;
  'driver:offline': () => void;
  'ride:requested': (data: RideEventData) => void;
  'ride:accepted': (data: RideEventData) => void;
  'ride:cancelled': (data: RideEventData) => void;
  'ride:started': (data: RideEventData) => void;
  'ride:completed': (data: RideEventData) => void;
  'ride:location:update': (data: { rideId: string; location: LocationData }) => void;
}

// Data Interfaces
interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

interface RideEventData {
  rideId: string;
  customerId: string;
  driverId?: string;
  status: string;
  data?: any;
  timestamp: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

interface LocationUpdateData {
  rideId?: string;
  driverId?: string;
  location: LocationData;
  timestamp: string;
}

interface DriverLocationData {
  driverId: string;
  location: LocationData;
  timestamp: string;
}

interface DriverStatusData {
  driverId: string;
  isOnline: boolean;
  timestamp: string;
}

// Typed Socket
type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Usage
const socket: TypedSocket = io('${this.config.serverUrl}', {
  auth: { token: 'your-jwt-token' }
});
`;
  }

  // Error handling examples
  getErrorHandlingExample(): string {
    return `
// Error Handling and Reconnection Logic

class SocketManager {
  private socket: Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  connect(token: string) {
    this.socket = io('${this.config.serverUrl}', {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('Connected successfully');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected the client, try to reconnect
        this.scheduleReconnect(token);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      
      if (error.message === 'Authentication failed') {
        // Don't retry if auth failed
        console.error('Authentication failed, not retrying');
        return;
      }
      
      this.scheduleReconnect(token);
    });
  }

  private scheduleReconnect(token: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(\`Reconnecting in \${this.reconnectDelay}ms (attempt \${this.reconnectAttempts})\`);

    this.reconnectTimer = setTimeout(() => {
      this.connect(token);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
    }, this.reconnectDelay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}
`;
  }

  // Best practices guide
  getBestPractices(): string {
    return `
// Socket.IO Best Practices

1. **Authentication**
   - Always authenticate before connecting
   - Handle token refresh gracefully
   - Disconnect on logout

2. **Error Handling**
   - Implement exponential backoff for reconnections
   - Handle different error types appropriately
   - Don't retry on authentication failures

3. **Performance**
   - Use rooms for targeted messaging
   - Avoid sending large payloads
   - Implement proper cleanup on disconnect

4. **Mobile Considerations**
   - Handle app backgrounding/foregrounding
   - Manage battery usage with location updates
   - Use appropriate update intervals

5. **Security**
   - Validate all incoming data
   - Use HTTPS/WSS in production
   - Implement rate limiting

6. **Event Management**
   - Remove event listeners to prevent memory leaks
   - Use typed events for better development experience
   - Handle events idempotently where possible

Example cleanup in React:
\`\`\`
useEffect(() => {
  const handleRideUpdate = (data) => {
    // Handle update
  };

  socket.on('ride:updated', handleRideUpdate);

  return () => {
    socket.off('ride:updated', handleRideUpdate);
  };
}, [socket]);
\`\`\`
`;
  }
}

// Export types for use in other files
export interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

export interface DriverLocationData {
  driverId: string;
  location: LocationData;
  timestamp: string;
}

export interface RideLocationUpdate {
  rideId: string;
  location: LocationData;
  timestamp: string;
}