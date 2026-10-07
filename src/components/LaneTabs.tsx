"use client";

import React from 'react';
import type { LaneId } from '../lib/sim/engine/types';
import { ALL_LANES, LANE_CONFIG } from '../lib/constants/lanes';
import { LaneIcon } from './ui/LaneIcon';

interface LaneTabsProps {
  activeTab: LaneId;
  onTabChange: (lane: LaneId) => void;
  /** Optional per-lane count shown after the label (e.g. unfinished queue entries). */
  counts?: Partial<Record<LaneId, number>>;
  className?: string;
}

/** The single lane switcher shared by the catalog and the queue (they always show the same lane). */
function LaneTabsInner({ activeTab, onTabChange, counts, className = '' }: LaneTabsProps) {
  return (
    <div className={`seg grid grid-cols-4 sm:inline-flex ${className}`} role="group" aria-label="Lane">
      {ALL_LANES.map((laneId) => {
        const count = counts?.[laneId] ?? 0;
        return (
          <button
            key={laneId}
            type="button"
            onClick={() => onTabChange(laneId)}
            aria-pressed={activeTab === laneId}
            className="seg-item px-1 text-[13px] sm:px-4 sm:text-sm"
          >
            <LaneIcon laneId={laneId} className="max-sm:hidden" />
            <span>{LANE_CONFIG[laneId].title}</span>
            {count > 0 && <span className="text-xs font-semibold text-ink-3">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export const LaneTabs = React.memo(LaneTabsInner);
