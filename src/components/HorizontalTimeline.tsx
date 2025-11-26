"use client";

import React, { useState } from 'react';

export interface HorizontalTimelineProps {
  currentTurn: number;
  totalTurns: number;
  onTurnChange: (turn: number) => void;
}

/**
 * HorizontalTimeline - Horizontal timeline navigation between dashboard and queues
 *
 * - Simple timeline style
 * - Turn input, slider, and quick jump buttons
 * - Fits between Population and Space Remaining sections width-wise
 */
export function HorizontalTimeline({ currentTurn, totalTurns, onTurnChange }: HorizontalTimelineProps) {
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

  // Generate turn labels (1, 50, 100, 150, 200)
  const turnLabels = [1, 50, 100, 150, 200].filter(t => t <= totalTurns);

  return (
    <div className="w-full bg-pink-nebula-panel/50 rounded-lg border border-pink-nebula-border p-4">
      <div className="flex items-center gap-4">
        {/* Current Turn Input */}
        <div className="flex items-center gap-2">
          <span className="text-pink-nebula-muted text-xs font-semibold">TURN</span>
          <input
            type="number"
            value={currentTurn}
            onChange={handleTurnInput}
            min={1}
            max={totalTurns}
            aria-label="Turn"
            className="w-16 px-2 py-1 bg-pink-nebula-bg border border-pink-nebula-border rounded text-pink-nebula-text text-center font-bold"
          />
          <span className="text-pink-nebula-muted text-xs">/ {totalTurns}</span>
        </div>

        {/* Timeline Slider */}
        <div className="flex-1 relative">
          {/* Turn Labels */}
          <div className="relative h-6 mb-1">
            {turnLabels.map((turn) => {
              const position = ((turn - 1) / (totalTurns - 1)) * 100;
              const isCurrentTurn = turn === currentTurn;

              return (
                <div
                  key={turn}
                  className="absolute flex flex-col items-center cursor-pointer hover:text-pink-nebula-text transition-colors"
                  style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
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
                </div>
              );
            })}
          </div>

          {/* Slider Track with Tick Marks */}
          <div className="relative">
            {/* Tick marks */}
            <div className="absolute inset-0 flex justify-between pointer-events-none">
              {turnLabels.map((turn) => {
                const position = ((turn - 1) / (totalTurns - 1)) * 100;
                return (
                  <div
                    key={turn}
                    className="absolute w-[2px] h-2 bg-pink-nebula-border"
                    style={{ left: `${position}%`, transform: 'translateX(-50%)', top: '-4px' }}
                  />
                );
              })}
            </div>

            {/* Current position indicator */}
            <div
              className="absolute top-[-6px] w-[3px] h-3 bg-pink-nebula-accent-primary rounded pointer-events-none"
              style={{
                left: `${((currentTurn - 1) / (totalTurns - 1)) * 100}%`,
                transform: 'translateX(-50%)'
              }}
            />

            <input
              type="range"
              min={1}
              max={totalTurns}
              step={1}
              value={currentTurn}
              onChange={handleSliderChange}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percentage = (e.clientX - rect.left) / rect.width;
                const turn = Math.round(percentage * (totalTurns - 1) + 1);
                setHoveredTurn(turn);
              }}
              onMouseLeave={() => setHoveredTurn(null)}
              className="w-full h-2 bg-pink-nebula-border rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-pink-nebula-accent-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-75 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-95 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-pink-nebula-accent-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:duration-75"
              aria-label="Turn slider"
            />
          </div>

          {/* Hover Tooltip */}
          {hoveredTurn !== null && hoveredTurn !== currentTurn && (
            <div
              className="absolute bottom-full mb-2 px-2 py-1 bg-pink-nebula-bg border border-pink-nebula-border rounded text-xs text-pink-nebula-text pointer-events-none whitespace-nowrap"
              style={{
                left: `${((hoveredTurn - 1) / (totalTurns - 1)) * 100}%`,
                transform: 'translateX(-50%)'
              }}
            >
              Turn {hoveredTurn}
            </div>
          )}
        </div>

        {/* Quick Jump Buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => onTurnChange(1)}
            className="text-xs py-1 px-3 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors"
          >
            Start
          </button>
          <button
            onClick={() => onTurnChange(Math.round(totalTurns / 2))}
            className="text-xs py-1 px-3 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors"
          >
            Mid
          </button>
          <button
            onClick={() => onTurnChange(totalTurns)}
            className="text-xs py-1 px-3 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors"
          >
            End
          </button>
        </div>
      </div>
    </div>
  );
}
