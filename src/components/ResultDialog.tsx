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
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700 shadow-2xl">
        <h2 className="text-3xl font-extrabold mb-6 text-center text-gray-800 dark:text-gray-100 tracking-tight">Game Results</h2>
        <div className="space-y-3 mb-6">
          {results.map((result, index) => (
            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="font-medium text-gray-700 dark:text-gray-200">{result.username}</span>
              <span className="text-gray-600 dark:text-gray-300">{result.percentage}%</span>
            </div>
          ))}
        </div>
        <button
          onClick={handleEndGame}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 dark:from-blue-600 dark:to-purple-700 text-white py-2 rounded-lg font-semibold shadow-md hover:from-blue-600 hover:to-purple-600 dark:hover:from-blue-700 dark:hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all duration-200"
        >
          End Game
        </button>
      </div>
    </div>
  );
};

export default ResultDialog;