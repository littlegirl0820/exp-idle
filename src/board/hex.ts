import type { Difficulty, HexBoard } from "./types";

const neighborDirections = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1]
] as const;

export function createHexBoard(difficulty: Extract<Difficulty, "hard" | "expert">): HexBoard {
  const radius = 3;
  const rawCells: Array<{ q: number; r: number; row: number; col: number }> = [];

  for (let r = radius, row = 0; r >= -radius; r -= 1, row += 1) {
    const qMin = Math.max(-radius, -r - radius);
    const qMax = Math.min(radius, -r + radius);

    for (let q = qMin, col = 0; q <= qMax; q += 1, col += 1) {
      rawCells.push({ q, r, row, col });
    }
  }

  const projected = rawCells.map(({ q, r, row, col }) => ({
    q,
    r,
    row,
    col,
    px: 1.5 * q,
    py: -Math.sqrt(3) * (r + q / 2)
  }));
  const minX = Math.min(...projected.map((cell) => cell.px));
  const maxX = Math.max(...projected.map((cell) => cell.px));
  const minY = Math.min(...projected.map((cell) => cell.py));
  const maxY = Math.max(...projected.map((cell) => cell.py));
  const padding = 0.08;

  const cells = projected.map((cell, id) => ({
    id,
    label: String(id + 1),
    q: cell.q,
    r: cell.r,
    row: cell.row,
    col: cell.col,
    x: padding + ((cell.px - minX) / (maxX - minX)) * (1 - padding * 2),
    y: padding + ((cell.py - minY) / (maxY - minY)) * (1 - padding * 2)
  }));

  const byCoordinate = new Map(cells.map((cell) => [`${cell.q},${cell.r}`, cell.id]));
  const adjacency = cells.map((cell) => {
    const affected = [cell.id];

    for (const [dq, dr] of neighborDirections) {
      const neighborId = byCoordinate.get(`${cell.q! + dq},${cell.r! + dr}`);
      if (neighborId !== undefined) {
        affected.push(neighborId);
      }
    }

    return affected;
  });

  return {
    difficulty,
    kind: "hex",
    modulus: difficulty === "hard" ? 2 : 6,
    sideLength: 4,
    cells,
    adjacency
  };
}

export function isHexDifficulty(difficulty: Difficulty): difficulty is HexBoard["difficulty"] {
  return difficulty === "hard" || difficulty === "expert";
}
