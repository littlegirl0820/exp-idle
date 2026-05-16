import { describe, expect, it } from "vitest";
import { createBoard } from ".";

describe("hex board geometry", () => {
  it("matches the in-game diagonal row shape", () => {
    const board = createBoard("hard");
    const rowLengths = Array.from({ length: 7 }, (_, row) =>
      board.cells.filter((cell) => cell.row === row).length
    );

    expect(rowLengths).toEqual([4, 5, 6, 7, 6, 5, 4]);

    const firstRow = board.cells.filter((cell) => cell.row === 0);
    for (let index = 1; index < firstRow.length; index += 1) {
      expect(firstRow[index].x).toBeGreaterThan(firstRow[index - 1].x);
      expect(firstRow[index].y).toBeLessThan(firstRow[index - 1].y);
    }
  });

  it("keeps hex neighbor counts correct", () => {
    const board = createBoard("expert");
    const center = board.cells.find((cell) => cell.q === 0 && cell.r === 0)!;
    const corner = board.cells.find((cell) => cell.row === 0 && cell.col === 0)!;

    expect(board.adjacency[center.id]).toHaveLength(7);
    expect(board.adjacency[corner.id]).toHaveLength(4);
  });
});
