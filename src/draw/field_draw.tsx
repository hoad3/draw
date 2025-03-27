import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SocketManager from '../socket';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  addUserToRoom, 
  removeUserFromRoom, 
  setConnectionStatus, 
  setCurrentRoom,
  addDrawing,
  clearDrawings,
  setError
} from '../store/slices/roomSlice';
import { calculateColorUsage, getTotalColorUsage } from '../utils/drawAnalytics';
import { DrawData, DrawPoint, ColorStat } from '../types/draw';
import { useColorStats } from '../hooks/useColorStats';
import ResultDialog from '../components/ResultDialog';

interface FieldDrawProps {
  width?: number;
  height?: number;
  onDraw?: (points: DrawPoint[]) => void;
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

  const { updateStats, addStats, clearStats, getUserColorUsage } = useColorStats(width, height, roomId);

  const [isGameStarted, setIsGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [showResults, setShowResults] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [userScores, setUserScores] = useState<{ [username: string]: string }>({});

  // Initialize canvas and socket listeners
  useEffect(() => {
    const socket = SocketManager.getInstance().getSocket();
    dispatch(setConnectionStatus(true));

    socket.on('load-drawings', (drawings: DrawData[]) => {
      console.log('Loading drawings:', drawings.length);
      // Clear canvas first
      const context = canvasRef.current?.getContext('2d') as CanvasRenderingContext2D;
      if (context) {
        context.clearRect(0, 0, width, height);
      }
      // Redraw all existing drawings
      drawings.forEach(drawData => {
        drawOnCanvas(drawData);
      });
      // Update color statistics for all drawings
      updateStats(drawings);
    });

    socket.on('draw', (drawData: DrawData) => {
      console.log('Received draw data:', drawData);
      drawOnCanvas(drawData);
    });

    socket.on('scores-updated', (scores: { username: string; percentage: string }[]) => {
      // Update the scores display
      const newScores: { [username: string]: string } = {};
      scores.forEach(score => {
        newScores[score.username] = score.percentage;
      });
      setUserScores(newScores);
    });

    socket.on('clear-canvas', () => {
      console.log('Clearing canvas');
      const context = canvasRef.current?.getContext('2d') as CanvasRenderingContext2D;
      if (context) {
        context.clearRect(0, 0, width, height);
      }
      dispatch(clearDrawings());
      clearStats();
    });

    socket.on('user-joined', (data: { username: string; users: { id: string; username: string }[] }) => {
      console.log(`${data.username} joined the room`);
      if (currentUser && currentRoom) {
        dispatch(setCurrentRoom({
          id: currentRoom.id,
          password: currentRoom.password,
          users: data.users.map(user => ({
            id: user.id,
            username: user.username
          })),
          drawings: currentRoom.drawings
        }));
      }
    });

    socket.on('user-left', (username: string) => {
      console.log(`${username} left the room`);
      if (currentRoom) {
        const updatedUsers = currentRoom.users.filter(user => user.username !== username);
        dispatch(setCurrentRoom({
          ...currentRoom,
          users: updatedUsers
        }));
      }
    });

    socket.on('room-joined', (data: RoomJoinedData) => {
      console.log('Room joined with users:', data.users);
      dispatch(setCurrentRoom({
        id: data.roomId,
        password: currentRoom?.password || '',
        users: data.users.map(user => ({
          id: user.id,
          username: user.username
        })),
        drawings: currentRoom?.drawings || []
      }));
    });

    socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error);
      dispatch(setError(error.message));
    });

    return () => {
      dispatch(setConnectionStatus(false));
      socket.off('load-drawings');
      socket.off('draw');
      socket.off('scores-updated');
      socket.off('clear-canvas');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('room-joined');
      socket.off('error');
    };
  }, []); // Empty dependency array to run only once

  // Initialize canvas
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
  }, [width, height]);

  const drawOnCanvas = (drawData: DrawData) => {
    if (!isGameStarted) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d') as CanvasRenderingContext2D;
    if (!canvas || !context) return;

    context.strokeStyle = drawData.color;
    context.lineWidth = drawData.lineWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.beginPath();
    context.moveTo(drawData.points[0].x, drawData.points[0].y);
    for (let i = 1; i < drawData.points.length; i++) {
      context.lineTo(drawData.points[i].x, drawData.points[i].y);
    }
    context.stroke();

    // Add drawing to Redux store
    dispatch(addDrawing(drawData));
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isGameStarted) return; // Don't allow drawing if game hasn't started

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
    if (!isDrawingRef.current || !isGameStarted) return;

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
      const drawData: DrawData = {
        points: [...pointsRef.current],
        color: currentColorRef.current,
        lineWidth: currentLineWidthRef.current,
        roomId,
        username
      };
      console.log('Sending draw data:', drawData);
      socket.emit('draw', drawData);
      lastDrawTimeRef.current = currentTime;
      
      // Update local drawing data
      if (currentRoom) {
        dispatch(addDrawing(drawData));
      }
    }
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    
    isDrawingRef.current = false;
    
    // Send final drawing data
    if (pointsRef.current.length > 0) {
      const socket = SocketManager.getInstance().getSocket();
      const drawData: DrawData = {
        points: [...pointsRef.current],
        color: currentColorRef.current,
        lineWidth: currentLineWidthRef.current,
        roomId,
        username
      };
      console.log('Sending final draw data:', drawData);
      socket.emit('draw', drawData);

      // Update local drawing data
      if (currentRoom) {
        dispatch(addDrawing(drawData));
      }
    }

    if (onDraw) {
      onDraw(pointsRef.current);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d') as CanvasRenderingContext2D;
    if (!canvas || !context) return;

    context.clearRect(0, 0, width, height);
    dispatch(clearDrawings());
    clearStats();
  };

  // Update socket listener for game events
  useEffect(() => {
    const socket = SocketManager.getInstance().getSocket();

    socket.on('game-start', () => {
      setIsGameStarted(true);
      setTimeLeft(30);
      
      // Start timer
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      timerRef.current = timer;
    });

    socket.on('game-end', (data: { results: { username: string; percentage: string }[] }) => {
      const timer = timerRef.current;
      if (timer) {
        clearInterval(timer);
        timerRef.current = null;
      }
      setIsGameStarted(false);
      setTimeLeft(30);
      setShowResults(true);
    });

    return () => {
      socket.off('game-start');
      socket.off('game-end');
      const timer = timerRef.current;
      if (timer) {
        clearInterval(timer);
        timerRef.current = null;
      }
    };
  }, []);

  const startGame = () => {
    if (isGameStarted) return;
    
    // Emit game start event
    const socket = SocketManager.getInstance().getSocket();
    socket.emit('game-start', { roomId });
  };

  const endGame = () => {
    if (!currentRoom) return;

    // Calculate final results using all drawings
    const results = currentRoom.users.map(user => ({
      username: user.username,
      percentage: getUserColorUsage(user.username)
    }));

    // Sort results by percentage in descending order
    const sortedResults = [...results].sort((a, b) => 
      parseFloat(b.percentage) - parseFloat(a.percentage)
    );

    // Emit game end event with sorted results
    const socket = SocketManager.getInstance().getSocket();
    socket.emit('game-end', { roomId, results: sortedResults });
  };

  // Update color statistics whenever drawings change
  useEffect(() => {
    if (currentRoom && currentRoom.drawings.length > 0) {
      updateStats(currentRoom.drawings);
    }
  }, [currentRoom?.drawings]);

  return (
    <div className="flex gap-8">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-4 items-center">
          <div className="bg-gray-100 px-4 py-2 rounded-lg">
            <p className="text-sm text-gray-600">Room: {roomId}</p>
            <p className="text-sm text-gray-600">User: {username}</p>
            {isGameStarted && (
              <p className="text-sm font-semibold text-red-500">
                Time left: {timeLeft}s
              </p>
            )}
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
            disabled={isGameStarted}
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
            disabled={isGameStarted}
          />
          <button
            onClick={clearCanvas}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            disabled={isGameStarted}
          >
            Clear
          </button>
          {!isGameStarted && (
            <button
              onClick={startGame}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Start
            </button>
          )}
        </div>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          style={{ border: '1px solid #ccc' }}
          className={isGameStarted ? 'cursor-crosshair' : 'cursor-not-allowed'}
        />
      </div>

      {currentRoom && (
        <div className="bg-white rounded-lg shadow-lg p-4 min-w-[200px] h-fit">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Users in Room</h3>
          <div className="space-y-2">
            {currentRoom.users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-700">{user.username}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {isGameStarted ? userScores[user.username] || '0' + '%' : '0%'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ResultDialog
        isOpen={showResults}
        onClose={() => setShowResults(false)}
        results={currentRoom?.users
          .map(user => ({
            username: user.username,
            percentage: userScores[user.username] || '0'
          }))
          .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage)) || []}
        roomId={roomId}
      />
    </div>
  );
};

export default FieldDraw;