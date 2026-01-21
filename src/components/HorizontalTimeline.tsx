"use client";

import React, { useState, useEffect } from 'react';

export interface FirstEmptyTurns {
  building: number | null;
  ship: number | null;
  colonist: number | null;
}

export interface HorizontalTimelineProps {
  currentTurn: number;
  totalTurns: number;
  onTurnChange: (turn: number) => void;
  firstEmptyTurns?: FirstEmptyTurns;
}

/**
 * HorizontalTimeline - Horizontal timeline navigation between dashboard and queues
 *
 * - Simple timeline style
 * - Turn input, slider, and quick jump buttons
 * - First empty turn buttons for each lane
 * - Fits between Population and Space Remaining sections width-wise
 */
export function HorizontalTimeline({ currentTurn, totalTurns, onTurnChange, firstEmptyTurns }: HorizontalTimelineProps) {
  const [hoveredTurn, setHoveredTurn] = useState<number | null>(null);
  // Local state for slider to prevent "snap-back" during fast dragging
  const [localTurn, setLocalTurn] = useState(currentTurn);

  // Sync local state when prop changes from external source
  useEffect(() => {
    setLocalTurn(currentTurn);
  }, [currentTurn]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTurn = parseInt(e.target.value, 10);
    setLocalTurn(newTurn); // Update local state immediately for smooth slider
    onTurnChange(newTurn); // Propagate to parent
  };

  const handleTurnInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= totalTurns) {
      setLocalTurn(value);
      onTurnChange(value);
    }
  };

  const handleButtonClick = (turn: number) => {
    setLocalTurn(turn);
    onTurnChange(turn);
  };

  // Generate turn labels (1, 50, 100, 150, 200)
  const turnLabels = [1, 50, 100, 150, 200].filter(t => t <= totalTurns);

  return (
    <div className="w-full bg-pink-nebula-panel/50 rounded-lg border border-pink-nebula-border p-4">
      <div className="flex items-center gap-4">
        {/* Current Turn Input with Step Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-pink-nebula-muted text-xs font-semibold">TURN</span>
          <button
            onClick={() => handleButtonClick(Math.max(1, localTurn - 1))}
            disabled={localTurn <= 1}
            className="w-8 h-8 flex items-center justify-center bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous turn"
          >
            ◀
          </button>
          <input
            type="number"
            value={localTurn}
            onChange={handleTurnInput}
            min={1}
            max={totalTurns}
            aria-label="Turn"
            className="w-16 px-2 py-1 bg-pink-nebula-bg border border-pink-nebula-border rounded text-pink-nebula-text text-center font-bold"
          />
          <button
            onClick={() => handleButtonClick(Math.min(totalTurns, localTurn + 1))}
            disabled={localTurn >= totalTurns}
            className="w-8 h-8 flex items-center justify-center bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next turn"
          >
            ▶
          </button>
          <span className="text-pink-nebula-muted text-xs">/ {totalTurns}</span>
        </div>

        {/* Timeline Slider */}
        <div className="flex-1 relative">
          {/* Turn Labels */}
          <div className="relative h-6 mb-1">
            {turnLabels.map((turn) => {
              const position = ((turn - 1) / (totalTurns - 1)) * 100;
              const isCurrentTurn = turn === localTurn;

              return (
                <div
                  key={turn}
                  className="absolute flex flex-col items-center cursor-pointer hover:text-pink-nebula-text transition-colors"
                  style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                  onClick={() => handleButtonClick(turn)}
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
                left: `${((localTurn - 1) / (totalTurns - 1)) * 100}%`,
                transform: 'translateX(-50%)'
              }}
            />

            <input
              type="range"
              min={1}
              max={totalTurns}
              step={1}
              value={localTurn}
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
            onClick={() => handleButtonClick(1)}
            className="text-xs py-1 px-3 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors"
          >
            Start
          </button>
          <button
            onClick={() => handleButtonClick(Math.round(totalTurns / 2))}
            className="text-xs py-1 px-3 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors"
          >
            Mid
          </button>
          <button
            onClick={() => handleButtonClick(totalTurns)}
            className="text-xs py-1 px-3 bg-pink-nebula-bg hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded transition-colors"
          >
            End
          </button>
        </div>

        {/* First Empty Turn Buttons */}
        {firstEmptyTurns && (
          <div className="flex gap-1 ml-2 pl-2 border-l border-pink-nebula-border">
            {firstEmptyTurns.building !== null && (
              <button
                onClick={() => handleButtonClick(firstEmptyTurns.building!)}
                title={`First turn where building lane is empty (T${firstEmptyTurns.building})`}
                className={`text-xs py-1 px-2 border rounded transition-colors flex items-center gap-1 ${
                  localTurn === firstEmptyTurns.building
                    ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                    : 'bg-pink-nebula-bg hover:bg-amber-600/20 border-pink-nebula-border hover:border-amber-500'
                }`}
              >
                <span>🏗️</span>
                <span className="font-mono">T{firstEmptyTurns.building}</span>
              </button>
            )}
            {firstEmptyTurns.ship !== null && (
              <button
                onClick={() => handleButtonClick(firstEmptyTurns.ship!)}
                title={`First turn where ship lane is empty (T${firstEmptyTurns.ship})`}
                className={`text-xs py-1 px-2 border rounded transition-colors flex items-center gap-1 ${
                  localTurn === firstEmptyTurns.ship
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                    : 'bg-pink-nebula-bg hover:bg-blue-600/20 border-pink-nebula-border hover:border-blue-500'
                }`}
              >
                <span>🚀</span>
                <span className="font-mono">T{firstEmptyTurns.ship}</span>
              </button>
            )}
            {firstEmptyTurns.colonist !== null && (
              <button
                onClick={() => handleButtonClick(firstEmptyTurns.colonist!)}
                title={`First turn where colonist lane is empty (T${firstEmptyTurns.colonist})`}
                className={`text-xs py-1 px-2 border rounded transition-colors flex items-center gap-1 ${
                  localTurn === firstEmptyTurns.colonist
                    ? 'bg-green-600/30 border-green-500 text-green-300'
                    : 'bg-pink-nebula-bg hover:bg-green-600/20 border-pink-nebula-border hover:border-green-500'
                }`}
              >
                <span>👥</span>
                <span className="font-mono">T{firstEmptyTurns.colonist}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
