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

  useEffect(() => {
    const socket = SocketManager.getInstance().getSocket();
    dispatch(setConnectionStatus(true));

    socket.on('load-drawings', (drawings: DrawData[]) => {
      const context = canvasRef.current?.getContext('2d') as CanvasRenderingContext2D;
      if (context) {
        context.clearRect(0, 0, width, height);
      }
      drawings.forEach(drawData => {
        drawOnCanvas(drawData);
      });
      updateStats(drawings);
    });

    socket.on('draw', (drawData: DrawData) => {
      drawOnCanvas(drawData);
    });

    socket.on('scores-updated', (scores: { username: string; percentage: string }[]) => {
      const newScores: { [username: string]: string } = {};
      scores.forEach(score => {
        newScores[score.username] = score.percentage;
      });
      setUserScores(newScores);
    });

    socket.on('clear-canvas', () => {
      const context = canvasRef.current?.getContext('2d') as CanvasRenderingContext2D;
      if (context) {
        context.clearRect(0, 0, width, height);
      }
      dispatch(clearDrawings());
      clearStats();
    });

    socket.on('user-joined', (data: { username: string; users: { id: string; username: string }[] }) => {
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
      if (currentRoom) {
        const updatedUsers = currentRoom.users.filter(user => user.username !== username);
        dispatch(setCurrentRoom({
          ...currentRoom,
          users: updatedUsers
        }));
      }
    });

    socket.on('room-joined', (data: RoomJoinedData) => {
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
  }, []);

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
      // console.log('Sending draw data:', drawData);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500 w-full">
      <div className="flex flex-col md:flex-row items-center justify-center w-full gap-12 p-6">
        <div className="flex-1 flex flex-col items-center gap-4">
          <div className="flex gap-4 items-center mb-4">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-200">Room: {roomId}</p>
              <p className="text-sm text-gray-600 dark:text-gray-200">User: {username}</p>
              {isGameStarted && (
                <p className="text-sm font-semibold text-red-500">Time left: {timeLeft}s</p>
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
          <div className="w-full flex justify-center">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              style={{ border: '1px solid #ccc', background: '#fff' }}
              className={
                'rounded-lg shadow-lg ' +
                (isGameStarted ? 'cursor-crosshair' : 'cursor-not-allowed')
              }
              width={width}
              height={height}
            />
          </div>
        </div>
        {currentRoom && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 min-w-[220px] h-fit border border-gray-200 dark:border-gray-700 flex flex-col items-center">
            <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-100">Users in Room</h3>
            <div className="space-y-2 w-full">
              {currentRoom.users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700 dark:text-gray-200">{user.username}</span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-300">
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
    </div>
  );
};

export default FieldDraw;