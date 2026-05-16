import type { Board, Difficulty, SquareBoard } from "./types";

const squareDifficulties = {
  easy: 3,
  medium: 4
} as const;

export function createSquareBoard(difficulty: Extract<Difficulty, "easy" | "medium">): SquareBoard {
  const size = squareDifficulties[difficulty];
  const cells = Array.from({ length: size * size }, (_, id) => {
    const row = Math.floor(id / size);
    const col = id % size;

    return {
      id,
      label: String(id + 1),
      row,
      col,
      x: (col + 0.5) / size,
      y: (row + 0.5) / size
    };
  });

  const adjacency = cells.map((pressed) =>
    cells
      .filter(
        (cell) =>
          Math.abs(cell.row! - pressed.row!) <= 1 &&
          Math.abs(cell.col! - pressed.col!) <= 1
      )
      .map((cell) => cell.id)
  );

  return {
    difficulty,
    kind: "square",
    modulus: 4,
    size,
    cells,
    adjacency
  };
}

export function isSquareDifficulty(difficulty: Difficulty): difficulty is SquareBoard["difficulty"] {
  return difficulty === "easy" || difficulty === "medium";
}

export function assertSquareBoard(board: Board): asserts board is SquareBoard {
  if (board.kind !== "square") {
    throw new Error(`Expected a square board, got ${board.kind}`);
  }
}
