"use client";

import React from 'react';

export interface TurnSliderProps {
  currentTurn: number;
  totalTurns: number;
  onTurnChange: (turn: number) => void;
}

/**
 * TurnSlider - Read-only time navigation component
 *
 * Allows users to navigate through the timeline without mutating state.
 * Displays current turn and provides controls to move backward/forward.
 *
 * Ticket 13: UI component for timeline navigation
 */
export function TurnSlider({ currentTurn, totalTurns, onTurnChange }: TurnSliderProps) {
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

  return (
    <div className="w-full bg-pink-nebula-panel border-b border-pink-nebula-border">
      <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center gap-4">
        {/* Turn Display and Input */}
        <div className="flex items-center gap-2">
          <label htmlFor="turn-input" className="text-pink-nebula-muted font-semibold">
            Turn:
          </label>
          <input
            id="turn-input"
            type="number"
            value={currentTurn}
            onChange={handleTurnInput}
            min={1}
            max={totalTurns}
            className="w-20 px-3 py-2 bg-pink-nebula-bg border border-pink-nebula-border rounded text-pink-nebula-text text-center font-bold"
          />
          <span className="text-pink-nebula-muted">
            / {totalTurns}
          </span>
        </div>

        {/* Slider */}
        <input
          type="range"
          min={1}
          max={totalTurns}
          value={currentTurn}
          onChange={handleSliderChange}
          className="flex-1 h-2 bg-pink-nebula-bg rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-4
                     [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-pink-nebula-accent-primary
                     [&::-moz-range-thumb]:w-4
                     [&::-moz-range-thumb]:h-4
                     [&::-moz-range-thumb]:rounded-full
                     [&::-moz-range-thumb]:bg-pink-nebula-accent-primary
                     [&::-moz-range-thumb]:border-0"
          aria-label="Turn slider"
        />
      </div>
    </div>
  );
}
