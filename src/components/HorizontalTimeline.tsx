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
  currentBuilds?: {
    building?: string | null;
    ship?: string | null;
    colonist?: string | null;
    research?: string | null;
  };
}

/**
 * HorizontalTimeline - Horizontal timeline navigation between dashboard and queues
 *
 * - Simple timeline style
 * - Turn input, slider, and quick jump buttons
 * - First empty turn buttons for each lane
 * - Fits between Population and Space Remaining sections width-wise
 */
export function HorizontalTimeline({ 
  currentTurn, 
  totalTurns, 
  onTurnChange, 
  firstEmptyTurns,
  currentBuilds,
  isAutoJumpEnabled,
  onAutoJumpToggle 
}: HorizontalTimelineProps & { isAutoJumpEnabled?: boolean; onAutoJumpToggle?: (v: boolean) => void }) {
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

  const turnLabels = Array.from(
    new Set([1, 50, 100, 150, 200, totalTurns].filter(t => t <= totalTurns))
  ).sort((a, b) => a - b);
  const buildStatus = currentBuilds
    ? [
        { key: 'building', label: 'B', value: currentBuilds.building },
        { key: 'ship', label: 'S', value: currentBuilds.ship },
        { key: 'colonist', label: 'C', value: currentBuilds.colonist },
        { key: 'research', label: 'R', value: currentBuilds.research },
      ]
    : [];

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-r from-pink-nebula-panel/75 via-slate-950/45 to-pink-nebula-panel/70 p-3 shadow-xl shadow-black/20 backdrop-blur-xl md:p-4">
      {buildStatus.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-pink-nebula-muted">
          <span className="uppercase tracking-wide text-pink-nebula-accent-secondary">Now</span>
          {buildStatus.map((item) => (
            <span key={item.key} className="min-w-0">
              <span className="text-pink-nebula-muted/80">{item.label}:</span>{' '}
              <span className="text-pink-nebula-text">{item.value || '-'}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        {/* Current Turn Input with Step Buttons */}
        <div className="grid w-full grid-cols-[auto_auto_minmax(4rem,5rem)_auto_1fr] items-center gap-2 md:flex md:w-auto">
          <span className="text-pink-nebula-muted text-xs font-semibold">TURN</span>
          <button
            onClick={() => handleButtonClick(Math.max(1, localTurn - 1))}
            disabled={localTurn <= 1}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-all hover:border-pink-nebula-accent-primary/45 hover:bg-pink-nebula-accent-primary/15 disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
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
            className="w-full rounded-xl border border-pink-nebula-border/80 bg-slate-950/60 px-2 py-1 text-center font-bold text-pink-nebula-text outline-none transition-colors focus:border-pink-nebula-accent-secondary focus:ring-2 focus:ring-pink-nebula-accent-primary/25 md:w-16"
          />
          <button
            onClick={() => handleButtonClick(Math.min(totalTurns, localTurn + 1))}
            disabled={localTurn >= totalTurns}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-all hover:border-pink-nebula-accent-primary/45 hover:bg-pink-nebula-accent-primary/15 disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
            aria-label="Next turn"
          >
            ▶
          </button>
          <span className="text-pink-nebula-muted text-xs">/ {totalTurns}</span>
        </div>

        {/* Auto-jump checkbox — moved to its own wrap-friendly group */}
        <div className="flex w-full items-center gap-2 md:w-auto">
          <input
            type="checkbox"
            id="autoJump"
            checked={isAutoJumpEnabled ?? true}
            onChange={(e) => onAutoJumpToggle?.(e.target.checked)}
            className="rounded bg-pink-nebula-bg border-pink-nebula-border text-pink-nebula-accent-primary focus:ring-pink-nebula-accent-primary/50"
          />
          <label htmlFor="autoJump" className="text-pink-nebula-muted text-xs cursor-pointer select-none">
            <span className="md:hidden">auto-jump to next free turn</span>
            <span className="hidden md:inline">automatically jump to first turn with empty structure queue</span>
          </label>
        </div>

        {/* Timeline Slider — full width on mobile so it gets its own row */}
        <div className="flex-1 min-w-full md:min-w-0 relative">
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
        <div className="grid w-full grid-cols-3 gap-2 md:flex md:w-auto md:flex-wrap md:gap-1">
          <button
            onClick={() => handleButtonClick(1)}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold transition-all hover:border-pink-nebula-accent-primary/45 hover:bg-white/10 md:min-h-0"
          >
            Start
          </button>
          <button
            onClick={() => handleButtonClick(Math.round(totalTurns / 2))}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold transition-all hover:border-pink-nebula-accent-primary/45 hover:bg-white/10 md:min-h-0"
          >
            Mid
          </button>
          <button
            onClick={() => handleButtonClick(totalTurns)}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold transition-all hover:border-pink-nebula-accent-primary/45 hover:bg-white/10 md:min-h-0"
          >
            End
          </button>
        </div>

        {/* First Empty Turn Buttons */}
        {firstEmptyTurns && (
          <div className="grid w-full grid-cols-3 gap-2 md:ml-2 md:flex md:w-auto md:flex-wrap md:gap-1 md:border-l md:border-pink-nebula-border md:pl-2">
            {firstEmptyTurns.building !== null && (
              <button
                onClick={() => handleButtonClick(firstEmptyTurns.building!)}
                title={`First turn where building lane is empty (T${firstEmptyTurns.building})`}
                className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl border px-2 py-1 text-xs font-semibold transition-colors md:min-h-0 ${
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
                className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl border px-2 py-1 text-xs font-semibold transition-colors md:min-h-0 ${
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
                className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl border px-2 py-1 text-xs font-semibold transition-colors md:min-h-0 ${
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
