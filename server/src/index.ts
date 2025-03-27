import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite's default port
    methods: ["GET", "POST"]
  }
});

interface DrawPoint {
  x: number;
  y: number;
}

interface DrawData {
  points: DrawPoint[];
  color: string;
  lineWidth: number;
}

// Store all drawings
let drawings: DrawData[] = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send existing drawings to new user
  socket.emit('load-drawings', drawings);

  // Handle new drawing
  socket.on('draw', (data: DrawData) => {
    drawings.push(data);
    // Broadcast to all other clients
    socket.broadcast.emit('draw', data);
  });

  // Handle clear canvas
  socket.on('clear-canvas', () => {
    drawings = [];
    io.emit('clear-canvas');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});