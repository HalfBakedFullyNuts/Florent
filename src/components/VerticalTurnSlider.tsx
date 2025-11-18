"use client";

import React, { useState } from 'react';

export interface VerticalTurnSliderProps {
  currentTurn: number;
  totalTurns: number;
  onTurnChange: (turn: number) => void;
}

/**
 * VerticalTurnSlider - Vertical timeline navigation on right side
 *
 * TICKET-9: Vertical turn slider with numbered increments
 * - Positioned on right side of screen
 * - Shows turn numbers every 20 turns
 * - Click on labels to jump to turn
 */
export function VerticalTurnSlider({ currentTurn, totalTurns, onTurnChange }: VerticalTurnSliderProps) {
  const [hoveredTurn, setHoveredTurn] = useState<number | null>(null);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTurn = parseInt(e.target.value, 10);
    onTurnChange(newTurn);
  };

  const handleTurnInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= totalTurns) {
      onTurnChange(value);
    }
  };

  const handleLabelClick = (turn: number) => {
    onTurnChange(turn);
  };

  // Generate turn labels (1, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200)
  const turnLabels = [];
  turnLabels.push(1); // Always show turn 1
  for (let i = 20; i <= totalTurns; i += 20) {
    turnLabels.push(i);
  }

  return (
    <div className="fixed right-0 top-0 h-screen w-16 bg-pink-nebula-panel border-l border-pink-nebula-border flex flex-col z-30">
      {/* Current Turn Display */}
      <div className="p-4 border-b border-pink-nebula-border">
        <div className="text-pink-nebula-muted text-xs font-semibold mb-1">TURN</div>
        <input
          type="number"
          value={currentTurn}
          onChange={handleTurnInput}
          min={1}
          max={totalTurns}
          className="w-full px-2 py-1 bg-pink-nebula-bg border border-pink-nebula-border rounded text-pink-nebula-text text-center font-bold text-lg"
        />
        <div className="text-pink-nebula-muted text-xs text-center mt-1">/ {totalTurns}</div>
      </div>

      {/* Vertical Slider Container */}
      <div className="flex-1 relative px-4 py-6">
        {/* Turn Labels */}
        <div className="absolute inset-x-0 inset-y-6 px-4">
          {turnLabels.map((turn) => {
            // Calculate position (inverted: turn 1 at bottom, turn 200 at top)
            const position = ((totalTurns - turn) / (totalTurns - 1)) * 100;
            const isCurrentTurn = turn === currentTurn;

            return (
              <div
                key={turn}
                className="absolute left-0 right-0 flex items-center cursor-pointer hover:text-pink-nebula-text transition-colors"
                style={{ top: `${position}%`, transform: 'translateY(-50%)' }}
                onClick={() => handleLabelClick(turn)}
              >
                <span
                  className={`text-xs font-mono ${
                    isCurrentTurn
                      ? 'text-pink-nebula-accent-primary font-bold'
                      : 'text-pink-nebula-muted'
                  }`}
                >
                  {turn}
                </span>
                <div
                  className={`ml-2 flex-1 h-[1px] ${
                    isCurrentTurn
                      ? 'bg-pink-nebula-accent-primary'
                      : 'bg-pink-nebula-border'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Vertical Slider */}
        <div className="absolute right-2 inset-y-6 w-2 flex items-center">
          <input
            type="range"
            min={1}
            max={totalTurns}
            value={currentTurn}
            onChange={handleSliderChange}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percentage = 1 - (e.clientY - rect.top) / rect.height;
              const turn = Math.round(percentage * (totalTurns - 1) + 1);
              setHoveredTurn(turn);
            }}
            onMouseLeave={() => setHoveredTurn(null)}
            className="vertical-slider"
            aria-label="Turn slider"
          />
        </div>

        {/* Hover Tooltip */}
        {hoveredTurn !== null && (
          <div
            className="absolute right-full mr-2 px-2 py-1 bg-pink-nebula-bg border border-pink-nebula-border rounded text-xs text-pink-nebula-text pointer-events-none"
            style={{
              top: `${((totalTurns - hoveredTurn) / (totalTurns - 1)) * 100}%`,
              transform: 'translateY(-50%)'
            }}
          >
            Turn {hoveredTurn}
          </div>
        )}
      </div>

      {/* Quick Jump Buttons */}
      <div className="p-2 border-t border-pink-nebula-border space-y-1">
        <button
          onClick={() => onTurnChange(1)}
          className="w-full text-xs py-1 px-2 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors"
        >
          Start
        </button>
        <button
          onClick={() => onTurnChange(Math.round(totalTurns / 2))}
          className="w-full text-xs py-1 px-2 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors"
        >
          Mid
        </button>
        <button
          onClick={() => onTurnChange(totalTurns)}
          className="w-full text-xs py-1 px-2 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors"
        >
          End
        </button>
      </div>
    </div>
  );
}