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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {isCreatingRoom ? 'Create Room' : 'Join Room'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 text-black shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          {!isCreatingRoom && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Room ID</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 text-black shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 text-black shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setIsCreatingRoom(!isCreatingRoom)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {isCreatingRoom ? 'Join existing room' : 'Create new room'}
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isCreatingRoom ? 'Create Room' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login; 