import { combineMod2Mod3 } from "./crt";

export type Matrix = number[][];

export type PrimeLinearSolution = {
  modulus: 2 | 3;
  particular: number[];
  basis: number[][];
  rank: number;
};

export type ModularSolveResult = {
  modulus: 2 | 3 | 4 | 6;
  solution: number[];
  totalCost: number;
  solutionCount: number;
  rankByModulus: Partial<Record<2 | 3, number>>;
};

export function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function modInverse(value: number, prime: 2 | 3): number {
  const normalized = mod(value, prime);

  for (let candidate = 1; candidate < prime; candidate += 1) {
    if ((normalized * candidate) % prime === 1) {
      return candidate;
    }
  }

  throw new Error(`${value} has no inverse modulo ${prime}`);
}

function dot(row: number[], values: number[]): number {
  return row.reduce((sum, value, index) => sum + value * values[index], 0);
}

export function vectorCost(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

export function solvePrimeLinearSystem(
  matrix: Matrix,
  rhs: number[],
  prime: 2 | 3
): PrimeLinearSolution | null {
  if (matrix.length !== rhs.length) {
    throw new Error("Matrix row count must match RHS length");
  }

  const rowCount = matrix.length;
  const columnCount = matrix[0]?.length ?? 0;
  const augmented = matrix.map((row, rowIndex) => [
    ...row.map((value) => mod(value, prime)),
    mod(rhs[rowIndex], prime)
  ]);

  let pivotRow = 0;
  const pivots: Array<{ row: number; column: number }> = [];

  for (let column = 0; column < columnCount && pivotRow < rowCount; column += 1) {
    let selected = -1;

    for (let row = pivotRow; row < rowCount; row += 1) {
      if (augmented[row][column] !== 0) {
        selected = row;
        break;
      }
    }

    if (selected === -1) {
      continue;
    }

    [augmented[pivotRow], augmented[selected]] = [augmented[selected], augmented[pivotRow]];

    const inverse = modInverse(augmented[pivotRow][column], prime);
    for (let col = column; col <= columnCount; col += 1) {
      augmented[pivotRow][col] = mod(augmented[pivotRow][col] * inverse, prime);
    }

    for (let row = 0; row < rowCount; row += 1) {
      if (row === pivotRow || augmented[row][column] === 0) {
        continue;
      }

      const factor = augmented[row][column];
      for (let col = column; col <= columnCount; col += 1) {
        augmented[row][col] = mod(augmented[row][col] - factor * augmented[pivotRow][col], prime);
      }
    }

    pivots.push({ row: pivotRow, column });
    pivotRow += 1;
  }

  for (let row = 0; row < rowCount; row += 1) {
    const allZero = augmented[row].slice(0, columnCount).every((value) => value === 0);
    if (allZero && augmented[row][columnCount] !== 0) {
      return null;
    }
  }

  const pivotColumns = new Set(pivots.map((pivot) => pivot.column));
  const particular = Array(columnCount).fill(0);

  for (const pivot of pivots) {
    particular[pivot.column] = augmented[pivot.row][columnCount];
  }

  const basis: number[][] = [];
  for (let freeColumn = 0; freeColumn < columnCount; freeColumn += 1) {
    if (pivotColumns.has(freeColumn)) {
      continue;
    }

    const vector = Array(columnCount).fill(0);
    vector[freeColumn] = 1;

    for (const pivot of pivots) {
      vector[pivot.column] = mod(-augmented[pivot.row][freeColumn], prime);
    }

    basis.push(vector);
  }

  return {
    modulus: prime,
    particular,
    basis,
    rank: pivots.length
  };
}

export function enumerateAffineSolutions(
  solution: Pick<PrimeLinearSolution, "particular" | "basis" | "modulus">,
  maxSolutions = 250_000
): number[][] {
  const total = solution.modulus ** solution.basis.length;
  if (total > maxSolutions) {
    throw new Error(
      `Solution space has ${total} candidates; increase the cap or add a smarter optimizer`
    );
  }

  let candidates = [solution.particular.map((value) => mod(value, solution.modulus))];

  for (const basisVector of solution.basis) {
    const expanded: number[][] = [];

    for (const candidate of candidates) {
      for (let coefficient = 0; coefficient < solution.modulus; coefficient += 1) {
        expanded.push(
          candidate.map((value, index) =>
            mod(value + coefficient * basisVector[index], solution.modulus)
          )
        );
      }
    }

    candidates = expanded;
  }

  return candidates;
}

function chooseLowestCost(candidates: number[][]): { solution: number[]; totalCost: number } {
  if (candidates.length === 0) {
    throw new Error("No candidates to choose from");
  }

  return candidates.reduce(
    (best, candidate) => {
      const cost = vectorCost(candidate);
      if (cost < best.totalCost) {
        return { solution: candidate, totalCost: cost };
      }

      return best;
    },
    { solution: candidates[0], totalCost: vectorCost(candidates[0]) }
  );
}

function solveModulo4(
  matrix: Matrix,
  rhs: number[],
  maxSolutions: number
): ModularSolveResult | null {
  const rhsMod2 = rhs.map((value) => mod(value, 2));
  const lowBitSolution = solvePrimeLinearSystem(matrix, rhsMod2, 2);

  if (!lowBitSolution) {
    return null;
  }

  const lowBitCandidates = enumerateAffineSolutions(lowBitSolution, maxSolutions);
  const candidates: number[][] = [];

  for (const lowBits of lowBitCandidates) {
    const liftedRhs = rhs.map((value, rowIndex) => {
      const residual = value - dot(matrix[rowIndex], lowBits);
      if (mod(residual, 2) !== 0) {
        throw new Error("Internal mod 4 lifting error: odd residual");
      }

      return mod(residual / 2, 2);
    });

    const highBitSolution = solvePrimeLinearSystem(matrix, liftedRhs, 2);
    if (!highBitSolution) {
      continue;
    }

    const remainingCapacity = Math.max(maxSolutions - candidates.length, 0);
    const highBitCandidates = enumerateAffineSolutions(highBitSolution, remainingCapacity);

    for (const highBits of highBitCandidates) {
      candidates.push(lowBits.map((value, index) => mod(value + 2 * highBits[index], 4)));
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const best = chooseLowestCost(candidates);
  return {
    modulus: 4,
    ...best,
    solutionCount: candidates.length,
    rankByModulus: { 2: lowBitSolution.rank }
  };
}

function solveModulo6(
  matrix: Matrix,
  rhs: number[],
  maxSolutions: number
): ModularSolveResult | null {
  const mod2Solution = solvePrimeLinearSystem(
    matrix,
    rhs.map((value) => mod(value, 2)),
    2
  );
  const mod3Solution = solvePrimeLinearSystem(
    matrix,
    rhs.map((value) => mod(value, 3)),
    3
  );

  if (!mod2Solution || !mod3Solution) {
    return null;
  }

  const mod2Candidates = enumerateAffineSolutions(mod2Solution, maxSolutions);
  const mod3Candidates = enumerateAffineSolutions(mod3Solution, maxSolutions);

  if (mod2Candidates.length * mod3Candidates.length > maxSolutions) {
    throw new Error(
      `Combined mod 6 solution space has ${
        mod2Candidates.length * mod3Candidates.length
      } candidates`
    );
  }

  const candidates: number[][] = [];
  for (const mod2Candidate of mod2Candidates) {
    for (const mod3Candidate of mod3Candidates) {
      candidates.push(combineMod2Mod3(mod2Candidate, mod3Candidate));
    }
  }

  const best = chooseLowestCost(candidates);
  return {
    modulus: 6,
    ...best,
    solutionCount: candidates.length,
    rankByModulus: { 2: mod2Solution.rank, 3: mod3Solution.rank }
  };
}

export function solveModularLinearSystem(
  matrix: Matrix,
  rhs: number[],
  modulus: 2 | 3 | 4 | 6,
  maxSolutions = 250_000
): ModularSolveResult | null {
  if (modulus === 4) {
    return solveModulo4(matrix, rhs, maxSolutions);
  }

  if (modulus === 6) {
    return solveModulo6(matrix, rhs, maxSolutions);
  }

  const fieldSolution = solvePrimeLinearSystem(
    matrix,
    rhs.map((value) => mod(value, modulus)),
    modulus
  );

  if (!fieldSolution) {
    return null;
  }

  const candidates = enumerateAffineSolutions(fieldSolution, maxSolutions);
  const best = chooseLowestCost(candidates);

  return {
    modulus,
    ...best,
    solutionCount: candidates.length,
    rankByModulus: { [modulus]: fieldSolution.rank }
  };
}
