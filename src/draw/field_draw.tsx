import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import SocketManager from '../socket';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addUserToRoom, removeUserFromRoom, setConnectionStatus, setCurrentRoom } from '../store/slices/roomSlice';

interface FieldDrawProps {
  width?: number;
  height?: number;
  onDraw?: (points: { x: number; y: number }[]) => void;
}

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

interface RoomJoinedData {
  roomId: string;
  username: string;
  users: { id: string; username: string }[];
}

const FieldDraw: React.FC<FieldDrawProps> = ({
  width = 800,
  height = 600,
  onDraw,
}) => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room') || '';
  const username = searchParams.get('username') || '';
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(state => state.room.currentUser);
  const currentRoom = useAppSelector(state => state.room.currentRoom);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<DrawPoint[]>([]);
  const currentColorRef = useRef('#000000');
  const currentLineWidthRef = useRef(2);
  const lastDrawTimeRef = useRef(0);
  const DRAW_INTERVAL = 50; // Minimum time between draw events (ms)

  // Initialize canvas and socket listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!context) return;

    // Set up canvas
    canvas.width = width;
    canvas.height = height;
    context.strokeStyle = currentColorRef.current;
    context.lineWidth = currentLineWidthRef.current;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    const socket = SocketManager.getInstance().getSocket();
    dispatch(setConnectionStatus(true));

    // Handle incoming drawings
    socket.on('load-drawings', (drawings: DrawData[]) => {
      console.log('Loading drawings:', drawings.length);
      // Clear canvas first
      context.clearRect(0, 0, width, height);
      // Redraw all existing drawings
      drawings.forEach(drawData => {
        drawOnCanvas(drawData);
      });
    });

    socket.on('draw', (drawData: DrawData) => {
      console.log('Received draw data:', drawData);
      drawOnCanvas(drawData);
    });

    socket.on('clear-canvas', () => {
      console.log('Clearing canvas');
      context.clearRect(0, 0, width, height);
    });

    socket.on('user-joined', (username: string) => {
      console.log(`${username} joined the room`);
      if (currentUser) {
        dispatch(addUserToRoom({ id: socket.id, username }));
      }
    });

    socket.on('user-left', (username: string) => {
      console.log(`${username} left the room`);
      dispatch(removeUserFromRoom(socket.id));
    });

    socket.on('room-joined', (data: RoomJoinedData) => {
      console.log('Room joined with users:', data.users);
      dispatch(setCurrentRoom({
        id: data.roomId,
        password: currentRoom?.password || '',
        users: data.users
      }));
    });

    return () => {
      dispatch(setConnectionStatus(false));
      socket.off('load-drawings');
      socket.off('draw');
      socket.off('clear-canvas');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('room-joined');
    };
  }, []); // Empty dependency array to run only once

  // Update canvas size when width or height changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!context) return;

    canvas.width = width;
    canvas.height = height;
    context.strokeStyle = currentColorRef.current;
    context.lineWidth = currentLineWidthRef.current;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }, [width, height]);

  const drawOnCanvas = (drawData: DrawData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!context) return;

    context.strokeStyle = drawData.color;
    context.lineWidth = drawData.lineWidth;
    context.beginPath();
    context.moveTo(drawData.points[0].x, drawData.points[0].y);
    
    for (let i = 1; i < drawData.points.length; i++) {
      context.lineTo(drawData.points[i].x, drawData.points[i].y);
    }
    
    context.stroke();
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    pointsRef.current = [{ x, y }];
    lastDrawTimeRef.current = Date.now();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    pointsRef.current.push({ x, y });

    // Draw locally
    if (pointsRef.current.length > 1) {
      context.beginPath();
      context.moveTo(pointsRef.current[pointsRef.current.length - 2].x, pointsRef.current[pointsRef.current.length - 2].y);
      context.lineTo(x, y);
      context.stroke();
    }

    // Send drawing data to server with rate limiting
    const currentTime = Date.now();
    if (currentTime - lastDrawTimeRef.current >= DRAW_INTERVAL) {
      const socket = SocketManager.getInstance().getSocket();
      const drawData = {
        points: pointsRef.current,
        color: currentColorRef.current,
        lineWidth: currentLineWidthRef.current,
        roomId
      };
      console.log('Sending draw data:', drawData);
      socket.emit('draw', drawData);
      lastDrawTimeRef.current = currentTime;
    }
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    
    isDrawingRef.current = false;
    
    // Send final drawing data
    if (pointsRef.current.length > 0) {
      const socket = SocketManager.getInstance().getSocket();
      const drawData = {
        points: pointsRef.current,
        color: currentColorRef.current,
        lineWidth: currentLineWidthRef.current,
        roomId
      };
      console.log('Sending final draw data:', drawData);
      socket.emit('draw', drawData);
    }

    if (onDraw) {
      onDraw(pointsRef.current);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!context) return;

    context.clearRect(0, 0, width, height);
    const socket = SocketManager.getInstance().getSocket();
    socket.emit('clear-canvas', roomId);
  };

  return (
    <div className="flex gap-8">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-4 items-center">
          <div className="bg-gray-100 px-4 py-2 rounded-lg">
            <p className="text-sm text-gray-600">Room: {roomId}</p>
            <p className="text-sm text-gray-600">User: {username}</p>
          </div>
          <input
            type="color"
            value={currentColorRef.current}
            onChange={(e) => {
              currentColorRef.current = e.target.value;
              const context = canvasRef.current?.getContext('2d') as CanvasRenderingContext2D;
              if (context) {
                context.strokeStyle = e.target.value;
              }
            }}
            className="w-10 h-10 rounded cursor-pointer"
          />
          <input
            type="range"
            min="1"
            max="20"
            value={currentLineWidthRef.current}
            onChange={(e) => {
              currentLineWidthRef.current = Number(e.target.value);
              const context = canvasRef.current?.getContext('2d') as CanvasRenderingContext2D;
              if (context) {
                context.lineWidth = Number(e.target.value);
              }
            }}
            className="w-32"
          />
          <button
            onClick={clearCanvas}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear
          </button>
        </div>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          style={{ border: '1px solid #ccc' }}
        />
      </div>

      {currentRoom && (
        <div className="bg-white rounded-lg shadow-lg p-4 min-w-[200px] h-fit">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Users in Room</h3>
          <div className="space-y-2">
            {currentRoom.users.map((user) => (
              <div
                key={user.id}
                className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-700">{user.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldDraw;