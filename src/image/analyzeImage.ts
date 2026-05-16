import type { Board, Cell } from "../board";

export type OverlayTransform = {
  scaleX: number;
  scaleY: number;
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
  suggestedTransform?: OverlayTransform;
};

function toImagePoint(
  cell: Cell,
  image: HTMLImageElement,
  transform: OverlayTransform
): { x: number; y: number } {
  const normalizedX = 0.5 + (cell.x - 0.5) * transform.scaleX + transform.offsetX;
  const normalizedY = 0.5 + (cell.y - 0.5) * transform.scaleY + transform.offsetY;

  return {
    x: normalizedX * image.naturalWidth,
    y: normalizedY * image.naturalHeight
  };
}

function estimateCellRadius(board: Board, image: HTMLImageElement, transform: OverlayTransform): number {
  const shortSide = Math.min(image.naturalWidth, image.naturalHeight);

  if (board.kind === "square") {
    return (shortSide * Math.min(transform.scaleX, transform.scaleY)) / board.size / 3;
  }

  const points = board.cells.map((cell) => toImagePoint(cell, image, transform));
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const distance = Math.hypot(
        points[first].x - points[second].x,
        points[first].y - points[second].y
      );

      if (distance > 1 && distance < nearestDistance) {
        nearestDistance = distance;
      }
    }
  }

  return Number.isFinite(nearestDistance) ? nearestDistance * 0.48 : shortSide * 0.035;
}

function luminance(data: Uint8ClampedArray, offset: number): number {
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
}

function pixelLuminance(imageData: ImageData, x: number, y: number): number {
  const clampedX = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
  const clampedY = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));

  return luminance(imageData.data, (clampedY * imageData.width + clampedX) * 4);
}

type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
};

function detectHexTileBoundingBox(imageData: ImageData): BoundingBox | null {
  const { width, height, data } = imageData;
  const step = Math.max(2, Math.round(Math.min(width, height) / 650));
  const sampledWidth = Math.ceil(width / step);
  const sampledHeight = Math.ceil(height / step);
  const mask = new Uint8Array(sampledWidth * sampledHeight);
  const xStart = Math.floor((width * 0.22) / step);
  const xEnd = Math.ceil((width * 0.78) / step);
  const yStart = Math.floor((height * 0.25) / step);
  const yEnd = Math.ceil((height * 0.86) / step);

  for (let sy = yStart; sy < yEnd; sy += 1) {
    const y = Math.min(height - 1, sy * step);

    for (let sx = xStart; sx < xEnd; sx += 1) {
      const x = Math.min(width - 1, sx * step);
      const value = luminance(data, (y * width + x) * 4);

      if (value < 32 || value > 68) {
        mask[sy * sampledWidth + sx] = 1;
      }
    }
  }

  const seen = new Uint8Array(mask.length);
  let best: BoundingBox | null = null;

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) {
      continue;
    }

    const stack = [start];
    seen[start] = 1;
    let area = 0;
    let minSampleX = Number.POSITIVE_INFINITY;
    let maxSampleX = Number.NEGATIVE_INFINITY;
    let minSampleY = Number.POSITIVE_INFINITY;
    let maxSampleY = Number.NEGATIVE_INFINITY;

    while (stack.length > 0) {
      const current = stack.pop()!;
      const sx = current % sampledWidth;
      const sy = Math.floor(current / sampledWidth);
      area += 1;
      minSampleX = Math.min(minSampleX, sx);
      maxSampleX = Math.max(maxSampleX, sx);
      minSampleY = Math.min(minSampleY, sy);
      maxSampleY = Math.max(maxSampleY, sy);

      const neighbors = [
        [sx + 1, sy],
        [sx - 1, sy],
        [sx, sy + 1],
        [sx, sy - 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= sampledWidth || ny < 0 || ny >= sampledHeight) {
          continue;
        }

        const neighborIndex = ny * sampledWidth + nx;
        if (mask[neighborIndex] && !seen[neighborIndex]) {
          seen[neighborIndex] = 1;
          stack.push(neighborIndex);
        }
      }
    }

    if (area < 400) {
      continue;
    }

    const candidate = {
      minX: minSampleX * step,
      minY: minSampleY * step,
      maxX: Math.min(width - 1, (maxSampleX + 1) * step),
      maxY: Math.min(height - 1, (maxSampleY + 1) * step),
      area: area * step * step
    };
    const candidateWidth = candidate.maxX - candidate.minX;
    const candidateHeight = candidate.maxY - candidate.minY;
    const aspect = candidateWidth / Math.max(candidateHeight, 1);

    if (aspect < 0.45 || aspect > 1.35) {
      continue;
    }

    if (!best || candidate.area > best.area) {
      best = candidate;
    }
  }

  return best;
}

function nearestCellDistance(cells: Cell[]): number {
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let first = 0; first < cells.length; first += 1) {
    for (let second = first + 1; second < cells.length; second += 1) {
      const distance = Math.hypot(
        cells[first].x - cells[second].x,
        cells[first].y - cells[second].y
      );

      if (distance > 0.0001 && distance < nearestDistance) {
        nearestDistance = distance;
      }
    }
  }

  return nearestDistance;
}

function fitHexTransform(board: Board, imageData: ImageData): OverlayTransform | null {
  if (board.kind !== "hex") {
    return null;
  }

  const boundingBox = detectHexTileBoundingBox(imageData);
  if (!boundingBox) {
    return null;
  }

  const minCellX = Math.min(...board.cells.map((cell) => cell.x));
  const maxCellX = Math.max(...board.cells.map((cell) => cell.x));
  const minCellY = Math.min(...board.cells.map((cell) => cell.y));
  const maxCellY = Math.max(...board.cells.map((cell) => cell.y));
  const radius = nearestCellDistance(board.cells) * 0.56;
  const detectedWidth = (boundingBox.maxX - boundingBox.minX) / imageData.width;
  const detectedHeight = (boundingBox.maxY - boundingBox.minY) / imageData.height;
  const centerX = (boundingBox.minX + boundingBox.maxX) / 2 / imageData.width;
  const centerY = (boundingBox.minY + boundingBox.maxY) / 2 / imageData.height;

  return {
    scaleX: detectedWidth / (maxCellX - minCellX + radius * 2),
    scaleY: detectedHeight / (maxCellY - minCellY + radius * 2),
    offsetX: centerX - 0.5,
    offsetY: centerY - 0.5
  };
}

function sampleTileLuminance(imageData: ImageData, centerX: number, centerY: number, radius: number): number {
  const step = Math.max(1, Math.floor(radius / 14));
  const innerRadius = radius * 0.45;
  const outerRadius = radius * 0.82;
  let total = 0;
  let count = 0;

  for (let y = Math.floor(centerY - outerRadius); y <= centerY + outerRadius; y += step) {
    for (let x = Math.floor(centerX - outerRadius); x <= centerX + outerRadius; x += step) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance < innerRadius || distance > outerRadius) {
        continue;
      }

      const value = pixelLuminance(imageData, x, y);
      if (value > 150) {
        continue;
      }

      total += value;
      count += 1;
    }
  }

  return count > 0 ? total / count : pixelLuminance(imageData, centerX, centerY);
}

function clusterLuminance(values: number[], clusterCount: number): { states: number[]; confidence: number[] } {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  if (maxValue - minValue < 1) {
    return {
      states: values.map(() => 0),
      confidence: values.map(() => 0)
    };
  }

  let centers = Array.from(
    { length: clusterCount },
    (_, index) => minValue + ((maxValue - minValue) * index) / Math.max(clusterCount - 1, 1)
  );
  let assignments = values.map(() => 0);

  for (let iteration = 0; iteration < 16; iteration += 1) {
    assignments = values.map((value) => {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      centers.forEach((center, index) => {
        const distance = Math.abs(value - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      return bestIndex;
    });

    centers = centers.map((center, index) => {
      const assigned = values.filter((_, valueIndex) => assignments[valueIndex] === index);
      return assigned.length > 0
        ? assigned.reduce((sum, value) => sum + value, 0) / assigned.length
        : center;
    });
  }

  const orderedCenters = centers
    .map((center, index) => ({ center, index }))
    .sort((first, second) => first.center - second.center);
  const rankByCluster = new Map(orderedCenters.map((entry, rank) => [entry.index, rank]));
  const range = maxValue - minValue;

  return {
    states: assignments.map((assignment) => rankByCluster.get(assignment) ?? 0),
    confidence: values.map((value, index) => {
      const ownCenter = centers[assignments[index]];
      const ownDistance = Math.abs(value - ownCenter);
      const nearestOtherDistance = Math.min(
        ...centers
        .filter((_, centerIndex) => centerIndex !== assignments[index])
          .map((center) => Math.abs(value - center))
      );

      return Math.max(
        0,
        Math.min(1, (nearestOtherDistance - ownDistance) / Math.max(range / clusterCount, 1))
      );
    })
  };
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
  const suggestedTransform = fitHexTransform(board, imageData) ?? undefined;
  const analysisTransform = suggestedTransform ?? transform;
  const radius = estimateCellRadius(board, image, analysisTransform);

  if (board.kind === "hex") {
    const samples = board.cells.map((cell) => {
      const point = toImagePoint(cell, image, analysisTransform);
      return sampleTileLuminance(imageData, point.x, point.y, radius);
    });
    const clustered = clusterLuminance(samples, board.modulus);
    const cells = board.cells.map((cell) => ({
      cellId: cell.id,
      state: clustered.states[cell.id],
      confidence: clustered.confidence[cell.id]
    }));

    return {
      states: cells.map((cell) => cell.state),
      cells,
      suggestedTransform
    };
  }

  const cells = board.cells.map((cell) => {
    const point = toImagePoint(cell, image, analysisTransform);
    const result = recognizeOneCell(imageData, point.x, point.y, radius, board.modulus);

    return {
      cellId: cell.id,
      state: result.state,
      confidence: result.confidence
    };
  });
  const states = cells.map((cell) => cell.state);

  return { states, cells, suggestedTransform };
}
