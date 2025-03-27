export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawData {
  points: DrawPoint[];
  color: string;
  lineWidth: number;
  roomId: string;
  username: string;
}

export interface Room {
  id: string;
  password: string;
  users: { id: string; username: string }[];
  drawings: DrawData[];
} 