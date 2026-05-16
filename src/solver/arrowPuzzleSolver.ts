import type { Board } from "../board";
import { type Matrix, mod, solveModularLinearSystem } from "./modularLinear";

export type ArrowPuzzleSolution = {
  clicks: number[];
  totalClicks: number;
  solved: boolean;
  finalStates: number[];
  solutionCount: number;
  rankByModulus: Partial<Record<2 | 3, number>>;
};

export function buildMoveMatrix(board: Board): Matrix {
  const size = board.cells.length;
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));

  board.adjacency.forEach((affectedCells, pressedCellId) => {
    for (const affectedCellId of affectedCells) {
      matrix[affectedCellId][pressedCellId] = 1;
    }
  });

  return matrix;
}

export function applyClicks(board: Board, states: number[], clicks: number[]): number[] {
  const matrix = buildMoveMatrix(board);

  return states.map((state, rowIndex) => {
    const delta = matrix[rowIndex].reduce(
      (sum, value, columnIndex) => sum + value * clicks[columnIndex],
      0
    );

    return mod(state + delta, board.modulus);
  });
}

export function verifySolution(board: Board, states: number[], clicks: number[]): boolean {
  return applyClicks(board, states, clicks).every((state) => state === 0);
}

export function solveArrowPuzzle(board: Board, states: number[]): ArrowPuzzleSolution | null {
  if (states.length !== board.cells.length) {
    throw new Error(`Expected ${board.cells.length} states, got ${states.length}`);
  }

  const normalizedStates = states.map((state) => mod(state, board.modulus));
  const matrix = buildMoveMatrix(board);
  const rhs = normalizedStates.map((state) => mod(-state, board.modulus));
  const result = solveModularLinearSystem(matrix, rhs, board.modulus);

  if (!result) {
    return null;
  }

  const finalStates = applyClicks(board, normalizedStates, result.solution);

  return {
    clicks: result.solution,
    totalClicks: result.totalCost,
    solved: finalStates.every((state) => state === 0),
    finalStates,
    solutionCount: result.solutionCount,
    rankByModulus: result.rankByModulus
  };
}

export function makeStatesFromClicks(board: Board, clicks: number[]): number[] {
  const zeroStates = Array(board.cells.length).fill(0);
  const forward = applyClicks(board, zeroStates, clicks);

  return forward.map((state) => mod(-state, board.modulus));
}
