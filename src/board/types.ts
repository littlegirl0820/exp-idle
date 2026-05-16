export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type BoardKind = "square" | "hex";

export type Modulus = 2 | 4 | 6;

export type Cell = {
  id: number;
  label: string;
  x: number;
  y: number;
  row?: number;
  col?: number;
  q?: number;
  r?: number;
};

export type SquareBoard = {
  difficulty: "easy" | "medium";
  kind: "square";
  modulus: 4;
  size: 3 | 4;
  cells: Cell[];
  adjacency: number[][];
};

export type HexBoard = {
  difficulty: "hard" | "expert";
  kind: "hex";
  modulus: 2 | 6;
  sideLength: 4;
  cells: Cell[];
  adjacency: number[][];
};

export type Board = SquareBoard | HexBoard;

export const difficultyLabels: Record<Difficulty, string> = {
  easy: "Easy - 3x3 / mod 4",
  medium: "Medium - 4x4 / mod 4",
  hard: "Hard - hex 37 / mod 2",
  expert: "Expert - hex 37 / mod 6"
};
