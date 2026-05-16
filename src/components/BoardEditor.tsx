import { ImageIcon, Play, RotateCcw, SlidersHorizontal, Upload, WandSparkles } from "lucide-react";
import type { ChangeEvent } from "react";
import type { Difficulty } from "../board";
import { difficultyLabels } from "../board";
import type { OverlayTransform } from "../image/analyzeImage";

type BoardEditorProps = {
  difficulty: Difficulty;
  transform: OverlayTransform;
  hasImage: boolean;
  isRecognizing: boolean;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onImageChange: (file: File | null) => void;
  onRecognize: () => void;
  onSolve: () => void;
  onResetStates: () => void;
  onResetOverlay: () => void;
  onTransformChange: (transform: OverlayTransform) => void;
};

const difficulties: Difficulty[] = ["easy", "medium", "hard", "expert"];

export function BoardEditor({
  difficulty,
  transform,
  hasImage,
  isRecognizing,
  onDifficultyChange,
  onImageChange,
  onRecognize,
  onSolve,
  onResetStates,
  onResetOverlay,
  onTransformChange
}: BoardEditorProps) {
  const updateTransform = (key: keyof OverlayTransform, value: number) => {
    onTransformChange({ ...transform, [key]: value });
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    onImageChange(event.target.files?.[0] ?? null);
    event.target.value = "";
  };

  return (
    <aside className="editorPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Exponential Idle</p>
          <h1>Arrow Solver</h1>
        </div>
        <ImageIcon size={22} aria-hidden="true" />
      </div>

      <label className="field">
        <span>難易度</span>
        <select
          value={difficulty}
          onChange={(event) => onDifficultyChange(event.target.value as Difficulty)}
        >
          {difficulties.map((value) => (
            <option key={value} value={value}>
              {difficultyLabels[value]}
            </option>
          ))}
        </select>
      </label>

      <div className="buttonGrid">
        <label className="button primaryButton">
          <Upload size={17} aria-hidden="true" />
          画像
          <input className="hiddenInput" type="file" accept="image/*" onChange={handleFile} />
        </label>
        <button className="button" type="button" onClick={onRecognize} disabled={!hasImage || isRecognizing}>
          <WandSparkles size={17} aria-hidden="true" />
          {isRecognizing ? "解析中" : "認識"}
        </button>
        <button className="button solveButton" type="button" onClick={onSolve}>
          <Play size={17} aria-hidden="true" />
          Solve
        </button>
        <button className="button" type="button" onClick={onResetStates}>
          <RotateCcw size={17} aria-hidden="true" />
          状態
        </button>
      </div>

      <section className="controlGroup">
        <div className="controlTitle">
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span>Overlay</span>
          <button className="iconTextButton" type="button" onClick={onResetOverlay}>
            Reset
          </button>
        </div>

        <label className="rangeField">
          <span>Scale X</span>
          <input
            type="range"
            min="0.12"
            max="1.2"
            step="0.01"
            value={transform.scaleX}
            onChange={(event) => updateTransform("scaleX", Number(event.target.value))}
          />
          <output>{transform.scaleX.toFixed(2)}</output>
        </label>
        <label className="rangeField">
          <span>Scale Y</span>
          <input
            type="range"
            min="0.12"
            max="1.2"
            step="0.01"
            value={transform.scaleY}
            onChange={(event) => updateTransform("scaleY", Number(event.target.value))}
          />
          <output>{transform.scaleY.toFixed(2)}</output>
        </label>
        <label className="rangeField">
          <span>X</span>
          <input
            type="range"
            min="-0.35"
            max="0.35"
            step="0.005"
            value={transform.offsetX}
            onChange={(event) => updateTransform("offsetX", Number(event.target.value))}
          />
          <output>{transform.offsetX.toFixed(2)}</output>
        </label>
        <label className="rangeField">
          <span>Y</span>
          <input
            type="range"
            min="-0.35"
            max="0.35"
            step="0.005"
            value={transform.offsetY}
            onChange={(event) => updateTransform("offsetY", Number(event.target.value))}
          />
          <output>{transform.offsetY.toFixed(2)}</output>
        </label>
      </section>
    </aside>
  );
}
