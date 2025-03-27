import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateColorStats, addColorStat, clearColorStats } from '../store/slices/colorStatsSlice';
import { calculateColorUsage } from '../utils/drawAnalytics';
import { DrawData, ColorStat } from '../types/draw';

export const useColorStats = (width: number, height: number, roomId: string) => {
  const dispatch = useAppDispatch();
  const colorStats = useAppSelector(state => state.colorStats.roomStats[roomId] || []);

  const updateStats = useCallback((drawings: DrawData[]) => {
    const stats = calculateColorUsage(drawings, width, height);
    dispatch(updateColorStats({ roomId, stats }));
  }, [dispatch, width, height, roomId]);

  const addStats = useCallback((drawing: DrawData) => {
    const stats = calculateColorUsage([drawing], width, height);
    stats.forEach(stat => {
      dispatch(addColorStat({ roomId, stat }));
    });
  }, [dispatch, width, height, roomId]);

  const clearStats = useCallback(() => {
    dispatch(clearColorStats(roomId));
  }, [dispatch, roomId]);

  const getUserColorUsage = useCallback((username: string) => {
    const userStats = colorStats.filter(stat => stat.username === username);
    const totalPercentage = userStats.reduce((sum, stat) => sum + stat.percentage, 0);
    return totalPercentage.toFixed(2);
  }, [colorStats]);

  return {
    colorStats,
    updateStats,
    addStats,
    clearStats,
    getUserColorUsage
  };
}; 