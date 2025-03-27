import React from 'react';
import { useAppSelector } from '../store/hooks';

const UserList: React.FC = () => {
  const currentRoom = useAppSelector(state => state.room.currentRoom);

  if (!currentRoom) return null;

  return (
    <div className="fixed right-4 top-4 bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
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
  );
};

export default UserList; 