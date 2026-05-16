import { useEffect, useMemo, useState } from "react";
import { BoardEditor } from "./components/BoardEditor";
import { ImageBoardOverlay } from "./components/ImageBoardOverlay";
import { createBoard, type Difficulty } from "./board";
import {
  analyzeImageBoard,
  type OverlayTransform,
  type RecognizedCellState
} from "./image/analyzeImage";
import { solveArrowPuzzle, type ArrowPuzzleSolution } from "./solver/arrowPuzzleSolver";

const defaultTransform: OverlayTransform = {
  scale: 0.88,
  offsetX: 0,
  offsetY: 0
};

function normalizeStates(count: number): number[] {
  return Array(count).fill(0);
}

function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const board = useMemo(() => createBoard(difficulty), [difficulty]);
  const [states, setStates] = useState<number[]>(() => normalizeStates(board.cells.length));
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [transform, setTransform] = useState<OverlayTransform>(defaultTransform);
  const [solution, setSolution] = useState<ArrowPuzzleSolution | null>(null);
  const [recognition, setRecognition] = useState<RecognizedCellState[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setStates(normalizeStates(board.cells.length));
    setSolution(null);
    setRecognition([]);
    setMessage(null);
  }, [board]);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const handleImageChange = (file: File | null) => {
    setSolution(null);
    setRecognition([]);
    setMessage(null);

    if (!file) {
      setImageUrl(null);
      return;
    }

    setImageUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return URL.createObjectURL(file);
    });
  };

  const cycleCell = (cellId: number) => {
    setStates((current) =>
      current.map((state, index) => (index === cellId ? (state + 1) % board.modulus : state))
    );
    setSolution(null);
    setMessage(null);
  };

  const resetStates = () => {
    setStates(normalizeStates(board.cells.length));
    setSolution(null);
    setRecognition([]);
    setMessage(null);
  };

  const recognizeImage = async () => {
    if (!imageUrl) {
      return;
    }

    setIsRecognizing(true);
    setMessage(null);
    setSolution(null);

    try {
      const result = await analyzeImageBoard(imageUrl, board, transform);
      setStates(result.states);
      setRecognition(result.cells);
      const lowConfidence = result.cells.filter((cell) => cell.confidence < 0.28).length;
      setMessage(lowConfidence > 0 ? `低信頼: ${lowConfidence} cells` : "認識完了");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "画像認識に失敗しました");
    } finally {
      setIsRecognizing(false);
    }
  };

  const solve = () => {
    try {
      const result = solveArrowPuzzle(board, states);

      if (!result) {
        setSolution(null);
        setMessage("この状態は解けません");
        return;
      }

      setSolution(result);
      setMessage(result.solved ? "検証: solved" : "検証: not solved");
    } catch (error) {
      setSolution(null);
      setMessage(error instanceof Error ? error.message : "Solve に失敗しました");
    }
  };

  const activeClicks =
    solution?.clicks
      .map((count, index) => ({ count, cell: board.cells[index] }))
      .filter((item) => item.count > 0) ?? [];

  const rankText = solution
    ? Object.entries(solution.rankByModulus)
        .map(([modulus, rank]) => `mod ${modulus}: rank ${rank}`)
        .join(" / ")
    : null;

  return (
    <main className="appShell">
      <BoardEditor
        difficulty={difficulty}
        transform={transform}
        hasImage={Boolean(imageUrl)}
        isRecognizing={isRecognizing}
        onDifficultyChange={setDifficulty}
        onImageChange={handleImageChange}
        onRecognize={recognizeImage}
        onSolve={solve}
        onResetStates={resetStates}
        onResetOverlay={() => setTransform(defaultTransform)}
        onTransformChange={(next) => {
          setTransform(next);
          setSolution(null);
          setRecognition([]);
        }}
      />

      <section className="workArea">
        <ImageBoardOverlay
          board={board}
          states={states}
          clicks={solution?.clicks}
          imageUrl={imageUrl}
          transform={transform}
          recognition={recognition}
          onCellClick={cycleCell}
        />

        <section className="resultPanel" aria-label="Solver result">
          <div className="resultMetrics">
            <div>
              <span>Cells</span>
              <strong>{board.cells.length}</strong>
            </div>
            <div>
              <span>Mod</span>
              <strong>{board.modulus}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{solution?.totalClicks ?? 0}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong className={solution?.solved ? "okText" : ""}>{solution ? (solution.solved ? "solved" : "error") : "-"}</strong>
            </div>
          </div>

          {message && <p className="statusLine">{message}</p>}
          {rankText && <p className="rankLine">{rankText}</p>}

          <div className="clickList">
            {activeClicks.length === 0 ? (
              <span className="emptyResult">No clicks</span>
            ) : (
              activeClicks.map(({ cell, count }, order) => (
                <div className="clickItem" key={cell.id}>
                  <span className="orderNumber">{order + 1}</span>
                  <span>Cell {cell.label}</span>
                  <strong>x{count}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
