import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DrawData } from '../../types/draw';

interface User {
  id: string;
  username: string;
}

interface Room {
  id: string;
  password: string;
  users: User[];
  drawings: DrawData[];
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
    removeUserFromRoom: (state, action: PayloadAction<string>) => {
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
    addDrawing: (state, action: PayloadAction<DrawData>) => {
      if (state.currentRoom) {
        state.currentRoom.drawings.push(action.payload);
      }
    },
    clearDrawings: (state) => {
      if (state.currentRoom) {
        state.currentRoom.drawings = [];
      }
    },
    clearRoom: (state) => {
      state.currentRoom = null;
      state.currentUser = null;
      state.error = null;
      state.isConnected = false;
    }
  },
});

export const {
  setCurrentUser,
  setCurrentRoom,
  addUserToRoom,
  removeUserFromRoom,
  setConnectionStatus,
  setError,
  addDrawing,
  clearDrawings,
  clearRoom
} = roomSlice.actions;

export default roomSlice.reducer; 