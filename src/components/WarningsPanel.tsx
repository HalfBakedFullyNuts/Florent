"use client";

import React from 'react';
import type { Warning } from '../lib/game/selectors';

export interface WarningsPanelProps {
  warnings: Warning[];
}

/**
 * WarningsPanel - Display game state warnings and errors
 *
 * Shows warnings from the engine about energy shortages, food shortages,
 * housing issues, space constraints, and idle lanes.
 *
 * Ticket 19: Warnings & errors surfacing
 */
export function WarningsPanel({ warnings }: WarningsPanelProps) {
  if (warnings.length === 0) {
    return null;
  }

  const getWarningColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-900/20 border-red-400 text-red-400';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-400 text-yellow-400';
      case 'info':
        return 'bg-blue-900/20 border-blue-400 text-blue-400';
      default:
        return 'bg-pink-nebula-bg border-pink-nebula-border text-pink-nebula-muted';
    }
  };

  const getWarningIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  return (
    <div className="space-y-2">
      {warnings.map((warning, index) => (
        <div
          key={index}
          className={`flex items-start gap-3 p-3 rounded border-l-4 ${getWarningColor(
            warning.severity
          )}`}
        >
          <div className="text-lg">{getWarningIcon(warning.severity)}</div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{warning.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
