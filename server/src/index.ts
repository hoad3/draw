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
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
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
      console.log('Room created:', data.roomId);
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

      // Check if user is already in the room
      const existingUser = room.users.find(user => user.id === socket.id);
      if (!existingUser) {
        room.users.push({ id: socket.id, username: data.username });
        socket.join(data.roomId);
        console.log('User joined room:', data.roomId);
        
        // Send confirmation to the joining user with the complete user list
        socket.emit('room-joined', { 
          roomId: data.roomId, 
          username: data.username,
          users: room.users // Send the complete user list
        });
        
        // Send existing drawings to the new user
        socket.emit('load-drawings', room.drawings);

        // Notify all users in the room about the new user and send updated user list
        io.to(data.roomId).emit('user-joined', {
          username: data.username,
          users: room.users // Send updated user list to all users
        });
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
      console.log('Received draw data:', drawData);
      const room = rooms.get(drawData.roomId);
      if (!room) {
        console.error('Room not found for drawing:', drawData.roomId);
        return;
      }

      // Add the drawing to the room's drawings array
      room.drawings.push(drawData);

      // Broadcast the drawing to all users in the room including the sender
      io.to(drawData.roomId).emit('draw', drawData);

      // Calculate and broadcast updated scores
      const scores = calculateScores(room.drawings, room.users);
      io.to(drawData.roomId).emit('scores-updated', scores);
    } catch (error) {
      console.error('Error handling draw:', error);
    }
  });

  // Helper function to calculate scores
  function calculateScores(drawings: DrawData[], users: User[]): { username: string; percentage: string }[] {
    const totalPixels = 800 * 600; // Canvas size
    const userScores: { [username: string]: number } = {};

    // Initialize scores for all users
    users.forEach(user => {
      userScores[user.username] = 0;
    });

    // Calculate scores based on drawings
    drawings.forEach(drawing => {
      const pixels = Math.PI * Math.pow(drawing.lineWidth / 2, 2) * drawing.points.length;
      userScores[drawing.username] += pixels;
    });

    // Convert to percentages
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

      // Clear the room's drawings
      room.drawings = [];

      // Broadcast the clear-canvas event to all users in the room
      io.to(roomId).emit('clear-canvas');
    } catch (error) {
      console.error('Error clearing canvas:', error);
    }
  });

  socket.on('game-start', (data: { roomId: string }) => {
    const room = rooms.get(data.roomId);
    if (room) {
      // Broadcast game-start event to all users in the room
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
      // Broadcast game-end event with results to all users in the room
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
    
    // Remove user from all rooms
    rooms.forEach((room, roomId) => {
      const userIndex = room.users.findIndex(user => user.id === socket.id);
      if (userIndex !== -1) {
        const username = room.users[userIndex].username;
        room.users.splice(userIndex, 1);
        
        // If room is empty, delete it
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