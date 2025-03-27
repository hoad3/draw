import React, { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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
}

const FieldDraw: React.FC<FieldDrawProps> = ({
                                               width = 800,
                                               height = 600,
                                               onDraw,
                                             }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<DrawPoint[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const currentColorRef = useRef('#000000');
  const currentLineWidthRef = useRef(2);

  useEffect(() => {
    // Connect to Socket.io server
    socketRef.current = io('http://localhost:3000');

    const socket = socketRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Set up canvas
    canvas.width = width;
    canvas.height = height;
    context.strokeStyle = currentColorRef.current;
    context.lineWidth = currentLineWidthRef.current;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Handle incoming drawings
    socket.on('load-drawings', (drawings: DrawData[]) => {
      drawings.forEach(drawData => {
        drawOnCanvas(drawData);
      });
    });

    socket.on('draw', (drawData: DrawData) => {
      drawOnCanvas(drawData);
    });

    socket.on('clear-canvas', () => {
      context.clearRect(0, 0, width, height);
    });

    return () => {
      socket.disconnect();
    };
  }, [width, height]);

  const drawOnCanvas = (drawData: DrawData) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

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
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    pointsRef.current.push({ x, y });

    // Draw locally
    context.beginPath();
    context.moveTo(pointsRef.current[pointsRef.current.length - 2].x, pointsRef.current[pointsRef.current.length - 2].y);
    context.lineTo(x, y);
    context.stroke();

    // Send drawing data to server
    if (socketRef.current) {
      socketRef.current.emit('draw', {
        points: pointsRef.current,
        color: currentColorRef.current,
        lineWidth: currentLineWidthRef.current
      });
    }
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    if (onDraw) {
      onDraw(pointsRef.current);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.clearRect(0, 0, width, height);
    if (socketRef.current) {
      socketRef.current.emit('clear-canvas');
    }
  };

  return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-4">
          <input
              type="color"
              value={currentColorRef.current}
              onChange={(e) => {
                currentColorRef.current = e.target.value;
                const context = canvasRef.current?.getContext('2d');
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
                const context = canvasRef.current?.getContext('2d');
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
  );
};

export default FieldDraw;