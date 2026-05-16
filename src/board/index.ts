import { createHexBoard, isHexDifficulty } from "./hex";
import { createSquareBoard } from "./square";
import type { Board, Difficulty } from "./types";

export function createBoard(difficulty: Difficulty): Board {
  return isHexDifficulty(difficulty)
    ? createHexBoard(difficulty)
    : createSquareBoard(difficulty);
}

export type { Board, BoardKind, Cell, Difficulty, HexBoard, Modulus, SquareBoard } from "./types";
export { difficultyLabels } from "./types";
