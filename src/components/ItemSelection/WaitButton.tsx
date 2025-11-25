"use client";

import React, { useState } from 'react';
import type { LaneId } from '../../lib/sim/engine/types';

export interface WaitButtonProps {
  laneId: LaneId;
  onQueueWait: (waitTurns: number) => void;
  disabled?: boolean;
}

/**
 * WaitButton - Allows user to queue a wait item for a specific lane
 * Shows an input for specifying the number of turns to wait
 */
export function WaitButton({ laneId, onQueueWait, disabled = false }: WaitButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [waitTurns, setWaitTurns] = useState('5'); // Default to 5 turns

  const handleQueue = () => {
    const turns = parseInt(waitTurns, 10);
    if (isNaN(turns) || turns <= 0) {
      return; // Invalid input
    }

    onQueueWait(turns);
    setIsExpanded(false);
    setWaitTurns('5'); // Reset to default
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleQueue();
    } else if (e.key === 'Escape') {
      setIsExpanded(false);
      setWaitTurns('5');
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        disabled={disabled}
        className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-pink-nebula-text rounded-lg border-2 border-slate-600 hover:border-slate-500 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Add a wait/pause to this lane"
      >
        <span className="text-lg">⏸️</span>
        <span className="font-semibold">Add Wait</span>
      </button>
    );
  }

  return (
    <div className="w-full p-3 bg-slate-700 rounded-lg border-2 border-slate-600 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-lg">⏸️</span>
        <span className="font-semibold text-pink-nebula-text">Wait for:</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="1"
          max="1000"
          value={waitTurns}
          onChange={(e) => setWaitTurns(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 bg-slate-800 text-pink-nebula-text border-2 border-slate-600 rounded focus:border-pink-nebula-accent-primary focus:outline-none"
          placeholder="Enter turns"
          autoFocus
        />
        <span className="text-pink-nebula-muted text-sm">turns</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleQueue}
          disabled={disabled || !waitTurns || parseInt(waitTurns, 10) <= 0}
          className="flex-1 px-3 py-2 bg-pink-nebula-accent-primary hover:bg-pink-nebula-accent-hover text-white rounded font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Queue Wait
        </button>
        <button
          onClick={() => {
            setIsExpanded(false);
            setWaitTurns('5');
          }}
          className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-pink-nebula-text rounded transition-all duration-200"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-pink-nebula-muted">
        Lane will pause for specified turns before processing next item
      </p>
    </div>
  );
}
