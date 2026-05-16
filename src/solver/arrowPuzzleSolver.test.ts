import { describe, expect, it } from "vitest";
import { createBoard, type Difficulty } from "../board";
import { applyClicks, buildMoveMatrix, makeStatesFromClicks, solveArrowPuzzle } from "./arrowPuzzleSolver";
import { mod } from "./modularLinear";

function pseudoRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

function randomClicks(count: number, modulus: number, seed: number): number[] {
  const next = pseudoRandom(seed);
  return Array.from({ length: count }, () => Math.floor(next() * modulus));
}

function matrixVectorMod(matrix: number[][], vector: number[], modulus: number): number[] {
  return matrix.map((row) =>
    mod(
      row.reduce((sum, value, index) => sum + value * vector[index], 0),
      modulus
    )
  );
}

describe("Arrow Puzzle solver", () => {
  const difficulties: Difficulty[] = ["easy", "medium", "hard", "expert"];

  it.each(difficulties)("solves generated %s boards", (difficulty) => {
    const board = createBoard(difficulty);
    const clicks = randomClicks(board.cells.length, board.modulus, board.cells.length * 97);
    const states = makeStatesFromClicks(board, clicks);
    const solution = solveArrowPuzzle(board, states);

    expect(solution).not.toBeNull();
    expect(solution?.solved).toBe(true);
    expect(applyClicks(board, states, solution!.clicks)).toEqual(Array(board.cells.length).fill(0));
  });

  it.each(difficulties)("satisfies A x + b = 0 mod m for %s", (difficulty) => {
    const board = createBoard(difficulty);
    const expectedClicks = randomClicks(board.cells.length, board.modulus, board.cells.length * 131);
    const states = makeStatesFromClicks(board, expectedClicks);
    const solution = solveArrowPuzzle(board, states)!;
    const matrix = buildMoveMatrix(board);
    const product = matrixVectorMod(matrix, solution.clicks, board.modulus);

    expect(product.map((value, index) => mod(value + states[index], board.modulus))).toEqual(
      Array(board.cells.length).fill(0)
    );
  });

  it("returns zero clicks for an already solved board", () => {
    const board = createBoard("expert");
    const solution = solveArrowPuzzle(board, Array(board.cells.length).fill(0));

    expect(solution?.totalClicks).toBe(0);
    expect(solution?.clicks.every((count) => count === 0)).toBe(true);
  });
});
