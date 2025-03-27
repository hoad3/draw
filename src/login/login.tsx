import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { setCurrentUser, setCurrentRoom, setError } from '../store/slices/roomSlice';
import SocketManager from '../socket';

interface RoomData {
  roomId: string;
  username: string;
}

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const socket = SocketManager.getInstance().getSocket();

  useEffect(() => {
    // Set up socket event listeners
    socket.on('room-created', (data: RoomData) => {
      console.log('Room created:', data);
      dispatch(setCurrentUser({ id: socket.id, username: data.username }));
      dispatch(setCurrentRoom({
        id: data.roomId,
        password,
        users: [{ id: socket.id, username: data.username }]
      }));
      navigate(`/draw?room=${data.roomId}&username=${data.username}`);
    });

    socket.on('room-joined', (data: RoomData) => {
      console.log('Room joined:', data);
      dispatch(setCurrentUser({ id: socket.id, username: data.username }));
      dispatch(setCurrentRoom({
        id: data.roomId,
        password,
        users: [{ id: socket.id, username: data.username }]
      }));
      navigate(`/draw?room=${data.roomId}&username=${data.username}`);
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
  }, [dispatch, navigate, password]);

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8);
  };

  const handleCreateRoom = () => {
    if (!username.trim()) {
      dispatch(setError('Please enter a username'));
      return;
    }

    setIsCreatingRoom(true);
    setIsJoiningRoom(false);
    setRoomId(generateRoomId());
  };

  const handleJoinRoom = () => {
    if (!username.trim()) {
      dispatch(setError('Please enter a username'));
      return;
    }

    setIsJoiningRoom(true);
    setIsCreatingRoom(false);
    setRoomId(''); // Reset room ID when joining
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setError(null));

    if (isCreatingRoom) {
      console.log('Creating room:', { username, password });
      socket.emit('create-room', { username, password });
    } else if (isJoiningRoom) {
      console.log('Joining room:', { roomId, username, password });
      socket.emit('join-room', { roomId, username, password });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Drawing Room</h1>
        
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

          {!isCreatingRoom && !isJoiningRoom && (
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleCreateRoom}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Create Room
              </button>
              <button
                type="button"
                onClick={handleJoinRoom}
                className="flex-1 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Join Room
              </button>
            </div>
          )}

          {(isCreatingRoom || isJoiningRoom) && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Room ID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 text-black shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  readOnly={isCreatingRoom}
                  placeholder={isCreatingRoom ? "Room ID will be generated" : "Enter room ID"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 text-black shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  placeholder="Enter room password"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  {isCreatingRoom ? 'Create' : 'Join'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingRoom(false);
                    setIsJoiningRoom(false);
                    setRoomId('');
                    setPassword('');
                  }}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login; 