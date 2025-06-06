import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { setCurrentUser, setCurrentRoom, setError } from '../store/slices/roomSlice';
import SocketManager from '../socket';

interface RoomData {
  id: string;
  username: string;
}

interface RoomJoinedData {
  roomId: string;
  users: RoomData[];
}

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(true);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const socket = SocketManager.getInstance().getSocket();

    socket.on('room-created', (data: { roomId: string; username: string; users: RoomData[] }) => {
      console.log('Room created:', data.roomId);
      dispatch(setCurrentUser({ id: socket.id || '', username: data.username }));
      dispatch(setCurrentRoom({
        id: data.roomId,
        password: password || '',
        users: data.users,
        drawings: []
      }));
      navigate(`/draw?room=${data.roomId}&username=${data.username}`);
    });

    socket.on('room-joined', (data: RoomJoinedData) => {
      console.log('Room joined:', data);
      dispatch(setCurrentUser({ id: socket.id || '', username }));
      dispatch(setCurrentRoom({
        id: data.roomId,
        password: password || '',
        users: data.users.map(user => ({
          id: user.id,
          username: user.username
        })),
        drawings: []
      }));
      navigate(`/draw?room=${data.roomId}&username=${username}`);
    });

    socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error);
      dispatch(setError(error.message));
    });

    return () => {
      socket.off('room-created');
      socket.off('room-joined');
      socket.off('error');
    };
  }, [username, password, navigate, dispatch]);

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateRoom = () => {
    if (!username.trim()) {
      dispatch(setError('Please enter a username'));
      return;
    }

    const roomId = generateRoomId();
    const socket = SocketManager.getInstance().getSocket();
    
    socket.emit('create-room', {
      roomId,
      username,
      password: ''
    });
  };

  const handleJoinRoom = () => {
    if (!username.trim()) {
      dispatch(setError('Please enter a username'));
      return;
    }

    if (!roomId.trim()) {
      dispatch(setError('Please enter a room ID'));
      return;
    }

    const socket = SocketManager.getInstance().getSocket();
    
    socket.emit('join-room', {
      roomId,
      username,
      password: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    if (isCreatingRoom) {
      // Create new room
      handleCreateRoom();
    } else {
      // Join existing room
      handleJoinRoom();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500 w-screen">
      <div className="flex flex-col md:flex-row items-center justify-center w-full gap-12 p-6">
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-extrabold mb-8 text-center text-gray-800 dark:text-gray-100 tracking-tight">
              {isCreatingRoom ? 'Create Room' : 'Join Room'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 text-black dark:text-white bg-white dark:bg-gray-700 shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:outline-none px-4 py-2 transition-colors duration-200"
                  placeholder="Enter your username"
                  required
                />
              </div>

              {!isCreatingRoom && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Room ID</label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 text-black dark:text-white bg-white dark:bg-gray-700 shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:outline-none px-4 py-2 transition-colors duration-200"
                    placeholder="Enter room ID"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 text-black dark:text-white bg-white dark:bg-gray-700 shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:outline-none px-4 py-2 transition-colors duration-200"
                  placeholder="Enter password"
                  required
                />
              </div>

              <div className="flex justify-between items-center mt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingRoom(!isCreatingRoom)}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline focus:outline-none transition-colors duration-200"
                >
                  {isCreatingRoom ? 'Join existing room' : 'Create new room'}
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 dark:from-blue-600 dark:to-purple-700 text-white py-2 px-4 rounded-lg font-semibold shadow-md hover:from-blue-600 hover:to-purple-600 dark:hover:from-blue-700 dark:hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all duration-200 mt-4"
              >
                {isCreatingRoom ? 'Create Room' : 'Join Room'}
              </button>
            </form>
          </div>
        </div>
        <div className="hidden md:flex flex-1 flex-col items-center justify-center">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-400 mb-2 text-center">Welcome to Draw Battle!</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 text-center max-w-md">Hợp tác, cạnh tranh và vui vẻ với những nét vẽ cùng bạn bè!</p>
        </div>
      </div>
    </div>
  );
};

export default Login;