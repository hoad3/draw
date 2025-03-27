import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling']
});

interface DrawPoint {
  x: number;
  y: number;
}

interface DrawData {
  points: DrawPoint[];
  color: string;
  lineWidth: number;
  roomId: string;
}

interface Room {
  id: string;
  password: string;
  drawings: DrawData[];
  users: { id: string; username: string }[];
}

const rooms = new Map<string, Room>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', (data: { username: string; password: string }) => {
    try {
      console.log('Creating room:', data);
      const roomId = Math.random().toString(36).substring(2, 8);
      
      if (rooms.has(roomId)) {
        console.error('Room already exists:', roomId);
        socket.emit('error', { message: 'Room already exists' });
        return;
      }

      const room: Room = {
        id: roomId,
        password: data.password,
        drawings: [],
        users: [{ id: socket.id, username: data.username }]
      };

      rooms.set(roomId, room);
      socket.join(roomId);
      console.log('Room created:', roomId);
      socket.emit('room-created', { roomId, username: data.username });
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  socket.on('join-room', (data: { roomId: string; username: string; password: string }) => {
    try {
      console.log('Joining room:', data);
      const room = rooms.get(data.roomId);
      
      if (!room) {
        console.error('Room not found:', data.roomId);
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.password !== data.password) {
        console.error('Invalid password for room:', data.roomId);
        socket.emit('error', { message: 'Invalid password' });
        return;
      }

      // Check if user is already in the room
      const existingUser = room.users.find(user => user.id === socket.id);
      if (!existingUser) {
        room.users.push({ id: socket.id, username: data.username });
        socket.join(data.roomId);
        console.log('User joined room:', data.roomId);
        
        // Notify all users in the room about the new user
        io.to(data.roomId).emit('user-joined', data.username);
        
        // Send confirmation to the joining user with the complete user list
        socket.emit('room-joined', { 
          roomId: data.roomId, 
          username: data.username,
          users: room.users // Send the complete user list
        });
        
        // Send existing drawings to the new user
        socket.emit('load-drawings', room.drawings);
      } else {
        console.log('User already in room:', data.roomId);
        socket.emit('room-joined', { 
          roomId: data.roomId, 
          username: data.username,
          users: room.users // Send the complete user list
        });
        socket.emit('load-drawings', room.drawings);
      }
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('draw', (drawData: DrawData) => {
    try {
      const room = rooms.get(drawData.roomId);
      if (room) {
        room.drawings.push(drawData);
        socket.to(drawData.roomId).emit('draw', drawData);
      }
    } catch (error) {
      console.error('Error handling draw:', error);
    }
  });

  socket.on('clear-canvas', (roomId: string) => {
    try {
      const room = rooms.get(roomId);
      if (room) {
        room.drawings = [];
        io.to(roomId).emit('clear-canvas');
      }
    } catch (error) {
      console.error('Error clearing canvas:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from all rooms
    rooms.forEach((room, roomId) => {
      const userIndex = room.users.findIndex(user => user.id === socket.id);
      if (userIndex !== -1) {
        const username = room.users[userIndex].username;
        room.users.splice(userIndex, 1);
        io.to(roomId).emit('user-left', username);
        
        // Delete room if empty
        if (room.users.length === 0) {
          rooms.delete(roomId);
          console.log('Room deleted:', roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});