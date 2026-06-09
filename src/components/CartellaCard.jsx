import React from "react";

// Helper: cell is marked if free (0) or its number was called (number/string tolerant).
function cellIsMarked(num, calledNums) {
  const n = Number(num);
  if (n === 0) return true;
  return calledNums.has(n);
}

function cellsToKeySet(cells) {
  const s = new Set();
  cells.forEach((c) => s.add(`${c.row}-${c.col}`));
  return s;
}

/** True if any non-free cell in this pattern equals the last called number. */
function patternIncludesLastCall(card, patternKeys, lastCallNum) {
  if (!Number.isInteger(lastCallNum)) return false;
  for (const key of patternKeys) {
    const [r, c] = key.split("-").map(Number);
    const v = Number(card[r][c]);
    if (v !== 0 && v === lastCallNum) return true;
  }
  return false;
}

// Collect all valid winning patterns, then prefer one that includes the latest draw
// so the winner screen matches "the call that made BINGO" (not an older completed line).
function detectWinningPattern(card, called) {
  if (!card || !called || called.length === 0) return new Set();

  const calledNums = new Set(called.map((x) => Number(x)));
  const lastCallNum = Number(called[called.length - 1]);

  const candidates = [];

  // Rows
  for (let row = 0; row < 5; row++) {
    let allCalled = true;
    const rowCells = [];
    for (let col = 0; col < 5; col++) {
      const num = card[row][col];
      if (!cellIsMarked(num, calledNums)) {
        allCalled = false;
        break;
      }
      rowCells.push({ row, col });
    }
    if (allCalled) candidates.push(cellsToKeySet(rowCells));
  }

  // Columns
  for (let col = 0; col < 5; col++) {
    let allCalled = true;
    const colCells = [];
    for (let row = 0; row < 5; row++) {
      const num = card[row][col];
      if (!cellIsMarked(num, calledNums)) {
        allCalled = false;
        break;
      }
      colCells.push({ row, col });
    }
    if (allCalled) candidates.push(cellsToKeySet(colCells));
  }

  // Main diagonal
  let mainDiagAllCalled = true;
  const mainDiagCells = [];
  for (let i = 0; i < 5; i++) {
    const num = card[i][i];
    if (!cellIsMarked(num, calledNums)) {
      mainDiagAllCalled = false;
      break;
    }
    mainDiagCells.push({ row: i, col: i });
  }
  if (mainDiagAllCalled) candidates.push(cellsToKeySet(mainDiagCells));

  // Anti-diagonal
  let antiDiagAllCalled = true;
  const antiDiagCells = [];
  for (let i = 0; i < 5; i++) {
    const num = card[i][4 - i];
    if (!cellIsMarked(num, calledNums)) {
      antiDiagAllCalled = false;
      break;
    }
    antiDiagCells.push({ row: i, col: 4 - i });
  }
  if (antiDiagAllCalled) candidates.push(cellsToKeySet(antiDiagCells));

  // Four corners
  const corners = [
    { row: 0, col: 0 },
    { row: 0, col: 4 },
    { row: 4, col: 0 },
    { row: 4, col: 4 },
  ];
  let allCornersCalled = true;
  for (const corner of corners) {
    const num = card[corner.row][corner.col];
    if (!cellIsMarked(num, calledNums)) {
      allCornersCalled = false;
      break;
    }
  }
  if (allCornersCalled) candidates.push(cellsToKeySet(corners));

  if (candidates.length === 0) return new Set();

  const withLast = candidates.find((keys) =>
    patternIncludesLastCall(card, keys, lastCallNum),
  );
  return withLast || candidates[0];
}

export default function CartellaCard({
  id,
  card,
  called = [],
  selectedNumber = null,
  isPreview = false,
  showWinningPattern = false,
  missedWinningCalledNumbers = null,
  isAutoMarkOn = true,
  onNumberToggle = null,
  showHeader = true,
  size,
}) {
  console.log(
    `Cartella ${id}: missedWinningCalledNumbers =`,
    missedWinningCalledNumbers,
  );
  const grid = card || null;
  if (!grid) return <div className="text-xs text-white/40">Loading...</div>;

  const letters = ["B", "I", "N", "G", "O"];
  const letterColors = [
    "bg-gradient-to-b from-sky-500/30 to-sky-500/10 text-sky-200 border-sky-400/30",
    "bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 text-emerald-200 border-emerald-400/30",
    "bg-gradient-to-b from-violet-500/30 to-violet-500/10 text-violet-200 border-violet-400/30",
    "bg-gradient-to-b from-rose-500/30 to-rose-500/10 text-rose-200 border-rose-400/30",
    "bg-gradient-to-b from-amber-500/30 to-amber-500/10 text-amber-200 border-amber-400/30",
  ];

  const winningPattern = showWinningPattern
    ? detectWinningPattern(grid, called)
    : new Set();
  const missedWinPattern = Array.isArray(missedWinningCalledNumbers)
    ? detectWinningPattern(grid, missedWinningCalledNumbers)
    : new Set();

  const rawDrawn = Array.isArray(called) ? called : [];
  const drawnSet = new Set(
    rawDrawn
      .map((x) => Number(x))
      .filter((x) => Number.isInteger(x) && x >= 1 && x <= 75),
  );

  const handleCellClick = (number) => {
    if (!isAutoMarkOn && onNumberToggle && number !== 0) {
      onNumberToggle(number);
    }
  };

  return (
    <div
      className={
        size === "fill"
          ? "h-full w-full flex flex-col"
          : `${
              size === "small"
                ? "max-w-[250px]"
                : isPreview
                  ? "max-w-[280px]"
                  : "max-w-[320px]"
            } w-full mx-auto aspect-square`
      }
    >
      {/* BINGO Header */}
      <div className="grid grid-cols-5 gap-1 mb-1.5 flex-shrink-0">
        {letters.map((letter, index) => (
          <div
            key={letter}
            className={`text-center text-sm font-extrabold py-1.5 rounded-lg border ${letterColors[index]}`}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Numbers Grid */}
      <div
        className={`bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur rounded-2xl border p-2 border-white/10 overflow-hidden ${
          size === "fill" ? "flex-1 min-h-0 flex flex-col" : ""
        }`}
      >
        <div
          className={`grid grid-cols-5 ${
            size === "fill" ? "grid-rows-5 flex-1 min-h-0 gap-1" : ""
          }`}
        >
          {grid.map((row, rowIndex) =>
            row.map((number, colIndex) => {
              const n = Number(number);
              const isFree = n === 0;
              const isCalled = !isFree && drawnSet.has(n);
              const isSelected = selectedNumber && number === selectedNumber;
              const isWinningCell = winningPattern.has(
                `${rowIndex}-${colIndex}`,
              );
              const isMissedWinCell = missedWinPattern.has(
                `${rowIndex}-${colIndex}`,
              );
              const isClickable = !isAutoMarkOn && onNumberToggle && !isFree;

              let cellStyle =
                "bg-gradient-to-b from-white/[0.12] to-white/[0.04] text-white border border-white/10";

              if (isFree) {
                if (isMissedWinCell) {
                  cellStyle =
                    "bg-rose-500/60 text-rose-950 border border-rose-400/50 font-bold";
                } else if (isWinningCell) {
                  cellStyle =
                    "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white border border-emerald-300/50 font-bold shadow-[0_2px_10px_rgba(16,185,129,0.45)]";
                } else {
                  cellStyle =
                    "bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 border border-amber-300/40 font-bold shadow-[0_2px_8px_rgba(245,158,11,0.35)]";
                }
              } else if (isMissedWinCell) {
                cellStyle =
                  "bg-rose-500 text-white border border-rose-400/50 font-bold";
              } else if (isWinningCell) {
                cellStyle =
                  "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white border border-emerald-300/50 font-bold shadow-[0_2px_10px_rgba(16,185,129,0.45)]";
              } else if (isSelected) {
                cellStyle =
                  "bg-amber-400 text-slate-900 border border-amber-300/50";
              } else if (isCalled) {
                if (showWinningPattern) {
                  cellStyle =
                    "bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 border border-amber-200/40 shadow-[0_2px_8px_rgba(245,158,11,0.4)]";
                } else {
                  cellStyle =
                    "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white border border-emerald-400/40 shadow-[0_2px_8px_rgba(16,185,129,0.35)]";
                }
              }

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleCellClick(number)}
                  className={`
                    ${size === "fill" ? "w-full h-full" : "aspect-square"} flex items-center justify-center text-xs sm:text-sm font-medium
                    transition-all duration-200 rounded-md m-0.5
                    ${cellStyle}
                    ${isClickable ? "cursor-pointer hover:scale-110 hover:z-10 active:scale-95" : ""}
                    ${isFree ? "text-[10px]" : ""}
                  `}
                  title={
                    isClickable
                      ? "Click to mark/unmark"
                      : isFree
                        ? "FREE"
                        : `Number ${number}`
                  }
                >
                  {isFree ? "★" : number}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
