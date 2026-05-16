import type { Board, Cell } from "../board";
import type { OverlayTransform, RecognizedCellState } from "../image/analyzeImage";

type ImageBoardOverlayProps = {
  board: Board;
  states: number[];
  clicks?: number[];
  imageUrl: string | null;
  transform: OverlayTransform;
  recognition: RecognizedCellState[];
  onCellClick: (cellId: number) => void;
};

const viewBoxSize = 1000;

function transformedPoint(cell: Cell, transform: OverlayTransform): { x: number; y: number } {
  return {
    x: (0.5 + (cell.x - 0.5) * transform.scaleX + transform.offsetX) * viewBoxSize,
    y: (0.5 + (cell.y - 0.5) * transform.scaleY + transform.offsetY) * viewBoxSize
  };
}

function arrowRotation(state: number, modulus: number): number {
  return (state * 360) / modulus;
}

function confidenceForCell(recognition: RecognizedCellState[], cellId: number): number | null {
  return recognition.find((cell) => cell.cellId === cellId)?.confidence ?? null;
}

function cellRadius(board: Board, transform: OverlayTransform): number {
  if (board.kind === "square") {
    return (viewBoxSize * Math.min(transform.scaleX, transform.scaleY)) / board.size / 2;
  }

  return viewBoxSize * Math.min(transform.scaleX, transform.scaleY) * 0.07;
}

function SquareCell({
  board,
  point,
  active,
  transform
}: {
  board: Board;
  point: { x: number; y: number };
  active: boolean;
  transform: OverlayTransform;
}) {
  const width = board.kind === "square" ? (viewBoxSize * transform.scaleX) / board.size : 0;
  const height = board.kind === "square" ? (viewBoxSize * transform.scaleY) / board.size : 0;
  const visualWidth = width * 0.9;
  const visualHeight = height * 0.9;

  return (
    <rect
      className={active ? "cellShape cellShapeActive" : "cellShape"}
      x={point.x - visualWidth / 2}
      y={point.y - visualHeight / 2}
      width={visualWidth}
      height={visualHeight}
      rx="7"
    />
  );
}

export function ImageBoardOverlay({
  board,
  states,
  clicks,
  imageUrl,
  transform,
  recognition,
  onCellClick
}: ImageBoardOverlayProps) {
  const radius = cellRadius(board, transform);

  return (
    <div className="imageStage" aria-label="Arrow puzzle board">
      {imageUrl ? (
        <img className="boardImage" src={imageUrl} alt="Uploaded Arrow Puzzle board" />
      ) : (
        <div className="emptyStage">
          <span>Arrow Puzzle</span>
        </div>
      )}

      <svg className="boardOverlay" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}>
        {board.cells.map((cell) => {
          const point = transformedPoint(cell, transform);
          const state = states[cell.id] ?? 0;
          const clickCount = clicks?.[cell.id] ?? 0;
          const confidence = confidenceForCell(recognition, cell.id);
          const active = clickCount > 0;
          const arrowScale = Math.max(radius / 30, 0.72);

          return (
            <g
              key={cell.id}
              className="cell"
              role="button"
              tabIndex={0}
              aria-label={`Cell ${cell.label}, state ${state}`}
              onClick={() => onCellClick(cell.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onCellClick(cell.id);
                }
              }}
            >
              {board.kind === "square" ? (
                <SquareCell board={board} point={point} active={active} transform={transform} />
              ) : (
                <circle
                  className={active ? "cellShape cellShapeActive" : "cellShape"}
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                />
              )}

              <g
                transform={`translate(${point.x} ${point.y}) rotate(${arrowRotation(
                  state,
                  board.modulus
                )}) scale(${arrowScale})`}
              >
                <path className="arrowGlyph" d="M 0 -20 L 14 4 L 5 4 L 5 18 L -5 18 L -5 4 L -14 4 Z" />
              </g>

              <text className="cellLabel" x={point.x} y={point.y + radius * 0.76}>
                {cell.label}
              </text>

              {clickCount > 0 && (
                <g>
                  <circle className="clickBadge" cx={point.x + radius * 0.62} cy={point.y - radius * 0.62} r="18" />
                  <text className="clickBadgeText" x={point.x + radius * 0.62} y={point.y - radius * 0.62 + 5}>
                    x{clickCount}
                  </text>
                </g>
              )}

              {confidence !== null && confidence < 0.28 && (
                <circle className="lowConfidenceMark" cx={point.x - radius * 0.66} cy={point.y - radius * 0.66} r="7" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
