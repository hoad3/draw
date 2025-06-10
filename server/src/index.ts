import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { DrawData, Room } from './types';

interface User {
  id: string;
  username: string;
}

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://drawbattle.daongochoa.click']
    : 'http://localhost:5173',
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e8,
  path: '/socket.io/',
  allowUpgrades: true,
  upgradeTimeout: 30000
});

const rooms = new Map<string, Room>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create-room', (data: { roomId: string; username: string; password: string }) => {
    try {
      console.log('Creating room:', data);
      if (rooms.has(data.roomId)) {
        console.error('Room already exists:', data.roomId);
        socket.emit('error', { message: 'Room already exists' });
        return;
      }

      const newRoom: Room = {
        id: data.roomId,
        password: data.password,
        users: [{ id: socket.id, username: data.username }],
        drawings: []
      };

      rooms.set(data.roomId, newRoom);
      socket.join(data.roomId);
      socket.emit('room-created', {
        roomId: data.roomId,
        username: data.username,
        users: newRoom.users
      });
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

      const existingUser = room.users.find(user => user.id === socket.id);
      if (!existingUser) {
        room.users.push({ id: socket.id, username: data.username });
        socket.join(data.roomId);

        socket.emit('room-joined', {
          roomId: data.roomId, 
          username: data.username,
          users: room.users
        });
        
        socket.emit('load-drawings', room.drawings);

        io.to(data.roomId).emit('user-joined', {
          username: data.username,
          users: room.users
        });
      } else {
        socket.emit('room-joined', {
          roomId: data.roomId, 
          username: data.username,
          users: room.users
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
      if (!room) {
        console.error('Room not found for drawing:', drawData.roomId);
        return;
      }

      room.drawings.push(drawData);

      io.to(drawData.roomId).emit('draw', drawData);

      const scores = calculateScores(room.drawings, room.users);
      io.to(drawData.roomId).emit('scores-updated', scores);
    } catch (error) {
      console.error('Error handling draw:', error);
    }
  });

  function calculateScores(drawings: DrawData[], users: User[]): { username: string; percentage: string }[] {
    const totalPixels = 800 * 600; // Canvas size
    const userScores: { [username: string]: number } = {};

    users.forEach(user => {
      userScores[user.username] = 0;
    });

    drawings.forEach(drawing => {
      const pixels = Math.PI * Math.pow(drawing.lineWidth / 2, 2) * drawing.points.length;
      userScores[drawing.username] += pixels;
    });

    return users.map(user => ({
      username: user.username,
      percentage: ((userScores[user.username] / totalPixels) * 100).toFixed(2)
    }));
  }

  socket.on('update-scores', (data: { roomId: string; scores: { username: string; percentage: string }[] }) => {
    try {
      const room = rooms.get(data.roomId);
      if (!room) {
        console.error('Room not found for updating scores:', data.roomId);
        return;
      }

      // Broadcast the updated scores to all users in the room
      io.to(data.roomId).emit('scores-updated', data.scores);
    } catch (error) {
      console.error('Error updating scores:', error);
    }
  });

  socket.on('clear-canvas', (roomId: string) => {
    try {
      console.log('Clearing canvas for room:', roomId);
      const room = rooms.get(roomId);
      if (!room) {
        console.error('Room not found for clearing canvas:', roomId);
        return;
      }

      room.drawings = [];

      io.to(roomId).emit('clear-canvas');
    } catch (error) {
      console.error('Error clearing canvas:', error);
    }
  });

  socket.on('game-start', (data: { roomId: string }) => {
    const room = rooms.get(data.roomId);
    if (room) {
      room.users.forEach(user => {
        const userSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.id === user.id);
        if (userSocket) {
          userSocket.emit('game-start');
        }
      });
    }
  });

  socket.on('game-end', (data: { roomId: string; results: { username: string; percentage: string }[] }) => {
    const room = rooms.get(data.roomId);
    if (room) {
      room.users.forEach(user => {
        const userSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.id === user.id);
        if (userSocket) {
          userSocket.emit('game-end', { results: data.results });
        }
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    rooms.forEach((room, roomId) => {
      const userIndex = room.users.findIndex(user => user.id === socket.id);
      if (userIndex !== -1) {
        const username = room.users[userIndex].username;
        room.users.splice(userIndex, 1);
        
        if (room.users.length === 0) {
          rooms.delete(roomId);
        } else {
          // Notify remaining users about the user who left
          io.to(roomId).emit('user-left', username);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});