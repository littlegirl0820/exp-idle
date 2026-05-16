import { describe, expect, it } from "vitest";
import { createBoard } from ".";

describe("hex board geometry", () => {
  it("keeps the axial side-length-4 row shape", () => {
    const board = createBoard("hard");
    const rowLengths = Array.from({ length: 7 }, (_, row) =>
      board.cells.filter((cell) => cell.row === row).length
    );

    expect(rowLengths).toEqual([4, 5, 6, 7, 6, 5, 4]);
  });

  it("matches the in-game point-up visual rows", () => {
    const board = createBoard("hard");
    const visualRows = new Map<string, number>();

    for (const cell of board.cells) {
      const key = cell.y.toFixed(4);
      visualRows.set(key, (visualRows.get(key) ?? 0) + 1);
    }

    const rowLengths = [...visualRows.entries()]
      .sort(([first], [second]) => Number(first) - Number(second))
      .map(([, count]) => count);

    expect(rowLengths).toEqual([1, 2, 3, 4, 3, 4, 3, 4, 3, 4, 3, 2, 1]);
  });

  it("keeps hex neighbor counts correct", () => {
    const board = createBoard("expert");
    const center = board.cells.find((cell) => cell.q === 0 && cell.r === 0)!;
    const corner = board.cells.find((cell) => cell.row === 0 && cell.col === 0)!;

    expect(board.adjacency[center.id]).toHaveLength(7);
    expect(board.adjacency[corner.id]).toHaveLength(4);
  });
});
