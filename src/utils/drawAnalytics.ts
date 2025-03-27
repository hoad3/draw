import { DrawData, ColorStat } from '../types/draw';

interface ColorUsage {
  username: string;
  color: string;
  percentage: number;
  pixelCount: number;
}

interface UserColorStats {
  username: string;
  totalPixels: number;
  colorBreakdown: {
    [color: string]: number;
  };
}

interface ColorStat {
  username: string;
  color: string;
  percentage: number;
  pixelCount: number;
}

export const calculateColorUsage = (drawings: DrawData[], width: number, height: number): ColorStat[] => {
  const totalPixels = width * height;
  const colorStats = new Map<string, ColorStat>();

  drawings.forEach(drawing => {
    const key = `${drawing.username}-${drawing.color}`;
    const existingStat = colorStats.get(key);

    // Calculate pixels drawn in this stroke
    const pixels = Math.PI * Math.pow(drawing.lineWidth / 2, 2) * drawing.points.length;

    if (existingStat) {
      // Accumulate pixels and update percentage
      existingStat.pixelCount += pixels;
      existingStat.percentage = (existingStat.pixelCount / totalPixels) * 100;
    } else {
      // Create new stat entry
      colorStats.set(key, {
        username: drawing.username,
        color: drawing.color,
        pixelCount: pixels,
        percentage: (pixels / totalPixels) * 100
      });
    }
  });

  return Array.from(colorStats.values());
};

export const getTotalColorUsage = (drawings: DrawData[], canvasWidth: number, canvasHeight: number): ColorStat[] => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const totalPixels = canvasWidth * canvasHeight;

  // Draw all strokes
  drawings.forEach(draw => {
    ctx.strokeStyle = draw.color;
    ctx.lineWidth = draw.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(draw.points[0].x, draw.points[0].y);
    for (let i = 1; i < draw.points.length; i++) {
      ctx.lineTo(draw.points[i].x, draw.points[i].y);
    }
    ctx.stroke();
  });

  // Get image data to analyze pixels
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const data = imageData.data;

  // Count colored pixels for each color
  const colorBreakdown: { [color: string]: number } = {};
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) { // If pixel is not transparent
      const color = `rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]})`;
      colorBreakdown[color] = (colorBreakdown[color] || 0) + 1;
    }
  }

  // Convert to percentage format
  const colorUsage: ColorStat[] = Object.entries(colorBreakdown).map(([color, pixelCount]) => ({
    username: 'Total',
    color,
    percentage: Number(((pixelCount / totalPixels) * 100).toFixed(2)),
    pixelCount
  }));

  // Sort by percentage in descending order
  return colorUsage.sort((a, b) => b.percentage - a.percentage);
}; 