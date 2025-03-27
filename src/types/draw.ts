export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawData {
  points: DrawPoint[];
  color: string;
  lineWidth: number;
  username: string;
  roomId: string;
}

export interface ColorStat {
  username: string;
  color: string;
  percentage: number;
  pixelCount: number;
}

export interface RoomColorStats {
  roomId: string;
  stats: ColorStat[];
} 