import { configureStore } from '@reduxjs/toolkit';
import roomReducer from './slices/roomSlice';
import colorStatsReducer from './slices/colorStatsSlice';

export const store = configureStore({
  reducer: {
    room: roomReducer,
    colorStats: colorStatsReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 