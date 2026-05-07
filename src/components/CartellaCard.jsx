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
  showHeader = false,
}) {
  const grid = card || null;
  if (!grid) return <div className="text-xs text-white/40">Loading...</div>;

  const letters = ["B", "I", "N", "G", "O"];
  const letterColors = [
    "bg-blue-500/30 text-blue-200 border-blue-400/30",
    "bg-green-500/30 text-green-200 border-green-400/30",
    "bg-purple-500/30 text-purple-200 border-purple-400/30",
    "bg-red-500/30 text-red-200 border-red-400/30",
    "bg-yellow-500/30 text-yellow-200 border-yellow-400/30",
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
      className={`${isPreview ? "max-w-[280px]" : "max-w-[320px]"} w-full mx-auto`}
    >
      {/* BINGO Header */}
      {showHeader && (
        <div className="grid grid-cols-5 gap-1 mb-1.5">
          {letters.map((letter, index) => (
            <div
              key={letter}
              className={`text-center text-sm font-extrabold py-1.5 rounded-lg border ${letterColors[index]}`}
            >
              {letter}
            </div>
          ))}
        </div>
      )}

      {/* Numbers Grid */}
      <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-5">
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
                "bg-white/20 text-white border border-white/5";

              if (isFree) {
                if (isMissedWinCell) {
                  cellStyle =
                    "bg-red-500/60 text-red-900 border border-red-400/50 font-bold";
                } else if (isWinningCell) {
                  cellStyle =
                    "bg-green-500/60 text-green-900 border border-green-400/50 font-bold";
                } else {
                  cellStyle =
                    "bg-amber-500/60 text-amber-900 border border-amber-400/30 font-bold";
                }
              } else if (isMissedWinCell) {
                cellStyle =
                  "bg-red-500/60 text-red-900 border border-red-400/50 font-bold";
              } else if (isWinningCell) {
                cellStyle =
                  "bg-green-500/60 text-green-900 border border-green-400/50 font-bold";
              } else if (isSelected) {
                cellStyle =
                  "bg-blue-500/60 text-blue-900 border border-blue-400/50";
              } else if (isCalled) {
                if (showWinningPattern) {
                  cellStyle =
                    "bg-yellow-500/60 text-yellow-900 border border-yellow-400/20";
                } else {
                  cellStyle =
                    "bg-emerald-500/60 text-emerald-900 border border-emerald-400/40";
                }
              }

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleCellClick(number)}
                  className={`
                    aspect-square flex items-center justify-center text-xs sm:text-sm font-medium
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
