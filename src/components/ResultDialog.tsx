import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { clearRoom } from '../store/slices/roomSlice';
import { clearColorStats } from '../store/slices/colorStatsSlice';
import SocketManager from '../socket';

interface ResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  results: {
    username: string;
    percentage: string;
  }[];
  roomId: string;
}

const ResultDialog: React.FC<ResultDialogProps> = ({ isOpen, onClose, results, roomId }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleEndGame = () => {
    // Clear all Redux data
    dispatch(clearRoom());
    dispatch(clearColorStats(roomId));
    
    // Disconnect socket
    const socket = SocketManager.getInstance().getSocket();
    socket.disconnect();
    
    // Navigate to login page
    navigate('/login');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Game Results</h2>
        <div className="space-y-3 mb-6">
          {results.map((result, index) => (
            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span className="font-medium text-gray-700">{result.username}</span>
              <span className="text-gray-600">{result.percentage}%</span>
            </div>
          ))}
        </div>
        <button
          onClick={handleEndGame}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition-colors"
        >
          End Game
        </button>
      </div>
    </div>
  );
};

export default ResultDialog; 