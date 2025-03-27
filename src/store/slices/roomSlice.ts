import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string | undefined;
  username: string;
}

interface Room {
  id: string;
  password: string;
  users: User[];
}

interface RoomState {
  currentUser: User | null;
  currentRoom: Room | null;
  isConnected: boolean;
  error: string | null;
}

const initialState: RoomState = {
  currentUser: null,
  currentRoom: null,
  isConnected: false,
  error: null
};

const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
    },
    setCurrentRoom: (state, action: PayloadAction<Room>) => {
      state.currentRoom = action.payload;
    },
    addUserToRoom: (state, action: PayloadAction<User>) => {
      if (state.currentRoom) {
        state.currentRoom.users.push(action.payload);
      }
    },
    removeUserFromRoom: (state, action: PayloadAction<string | undefined>) => {
      if (state.currentRoom) {
        state.currentRoom.users = state.currentRoom.users.filter(
          user => user.id !== action.payload
        );
      }
    },
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearRoom: (state) => {
      state.currentUser = null;
      state.currentRoom = null;
      state.error = null;
    }
  }
});

export const {
  setCurrentUser,
  setCurrentRoom,
  addUserToRoom,
  removeUserFromRoom,
  setConnectionStatus,
  setError,
  clearRoom
} = roomSlice.actions;

export default roomSlice.reducer; 