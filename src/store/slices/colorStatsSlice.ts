import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ColorStat, RoomColorStats } from '../../types/draw';

interface ColorStatsState {
  roomStats: { [roomId: string]: ColorStat[] };
}

const initialState: ColorStatsState = {
  roomStats: {}
};

const colorStatsSlice = createSlice({
  name: 'colorStats',
  initialState,
  reducers: {
    updateColorStats: (state, action: PayloadAction<{ roomId: string; stats: ColorStat[] }>) => {
      const { roomId, stats } = action.payload;
      
      const existingStats = new Map(
        (state.roomStats[roomId] || []).map(stat => [`${stat.username}-${stat.color}`, stat])
      );
      
      stats.forEach(newStat => {
        const key = `${newStat.username}-${newStat.color}`;
        const existingStat = existingStats.get(key);
        
        if (existingStat) {
          existingStat.pixelCount += newStat.pixelCount;
          existingStat.percentage = newStat.percentage;
        } else {
          existingStats.set(key, newStat);
        }
      });
      
      state.roomStats[roomId] = Array.from(existingStats.values());
    },
    addColorStat: (state, action: PayloadAction<{ roomId: string; stat: ColorStat }>) => {
      const { roomId, stat } = action.payload;
      const existingStats = state.roomStats[roomId] || [];
      const key = `${stat.username}-${stat.color}`;
      const existingStat = existingStats.find(
        s => s.username === stat.username && s.color === stat.color
      );

      if (existingStat) {
        existingStat.pixelCount += stat.pixelCount;
        existingStat.percentage = stat.percentage;
      } else {
        existingStats.push(stat);
      }

      state.roomStats[roomId] = existingStats;
    },
    clearColorStats: (state, action: PayloadAction<string>) => {
      delete state.roomStats[action.payload];
    }
  }
});

export const { updateColorStats, addColorStat, clearColorStats } = colorStatsSlice.actions;
export default colorStatsSlice.reducer; 