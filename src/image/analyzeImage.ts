import type { Board, Cell } from "../board";

export type OverlayTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type RecognizedCellState = {
  cellId: number;
  state: number;
  confidence: number;
};

export type RecognitionResult = {
  states: number[];
  cells: RecognizedCellState[];
};

function toImagePoint(
  cell: Cell,
  image: HTMLImageElement,
  transform: OverlayTransform
): { x: number; y: number } {
  const normalizedX = 0.5 + (cell.x - 0.5) * transform.scale + transform.offsetX;
  const normalizedY = 0.5 + (cell.y - 0.5) * transform.scale + transform.offsetY;

  return {
    x: normalizedX * image.naturalWidth,
    y: normalizedY * image.naturalHeight
  };
}

function estimateCellRadius(board: Board, image: HTMLImageElement, transform: OverlayTransform): number {
  const shortSide = Math.min(image.naturalWidth, image.naturalHeight);

  if (board.kind === "square") {
    return (shortSide * transform.scale) / board.size / 3;
  }

  return shortSide * transform.scale * 0.045;
}

function luminance(data: Uint8ClampedArray, offset: number): number {
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
}

function stateFromVector(dx: number, dy: number, modulus: number): number {
  const angle = Math.atan2(dy, dx);
  const clockwiseFromUp = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
  const step = (Math.PI * 2) / modulus;

  return Math.round(clockwiseFromUp / step) % modulus;
}

function recognizeOneCell(
  imageData: ImageData,
  centerX: number,
  centerY: number,
  radius: number,
  modulus: number
): { state: number; confidence: number } {
  const { data, width, height } = imageData;
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(height - 1, Math.ceil(centerY + radius));
  const samples: Array<{ x: number; y: number; luma: number }> = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.hypot(dx, dy);

      if (distance > radius || distance < radius * 0.08) {
        continue;
      }

      const offset = (y * width + x) * 4;
      samples.push({ x, y, luma: luminance(data, offset) });
    }
  }

  if (samples.length === 0) {
    return { state: 0, confidence: 0 };
  }

  const averageLuma = samples.reduce((sum, sample) => sum + sample.luma, 0) / samples.length;
  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;

  for (const sample of samples) {
    const distance = Math.hypot(sample.x - centerX, sample.y - centerY);
    const centerWeight = Math.max(0, 1 - distance / radius);
    const contrastWeight = Math.abs(sample.luma - averageLuma);
    const weight = contrastWeight * (0.45 + centerWeight);

    weightedX += (sample.x - centerX) * weight;
    weightedY += (sample.y - centerY) * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0.0001) {
    return { state: 0, confidence: 0 };
  }

  const vectorX = weightedX / totalWeight;
  const vectorY = weightedY / totalWeight;
  const confidence = Math.min(1, Math.hypot(vectorX, vectorY) / Math.max(radius * 0.12, 1));

  return {
    state: stateFromVector(vectorX, vectorY, modulus),
    confidence
  };
}

export async function analyzeImageBoard(
  imageUrl: string,
  board: Board,
  transform: OverlayTransform
): Promise<RecognitionResult> {
  const image = new Image();
  image.src = imageUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Could not create canvas context");
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const radius = estimateCellRadius(board, image, transform);
  const cells = board.cells.map((cell) => {
    const point = toImagePoint(cell, image, transform);
    const result = recognizeOneCell(imageData, point.x, point.y, radius, board.modulus);

    return {
      cellId: cell.id,
      state: result.state,
      confidence: result.confidence
    };
  });
  const states = cells.map((cell) => cell.state);

  return { states, cells };
}
