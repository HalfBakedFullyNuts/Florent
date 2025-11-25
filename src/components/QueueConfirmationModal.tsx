"use client";

import React from 'react';
import type { QueueBlocker } from '../lib/sim/engine/queueValidation';

export interface QueueConfirmationModalProps {
  isOpen: boolean;
  itemName: string;
  waitTurnsNeeded: number;
  blockers: QueueBlocker[];
  requestedQuantity: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * QueueConfirmationModal - Shows user that auto-wait will be added
 * Allows user to confirm or cancel the queueing operation
 */
export function QueueConfirmationModal({
  isOpen,
  itemName,
  waitTurnsNeeded,
  blockers,
  requestedQuantity,
  onConfirm,
  onCancel,
}: QueueConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative z-10 bg-pink-nebula-panel border-2 border-pink-nebula-border rounded-lg shadow-2xl max-w-md w-full mx-4 animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-pink-nebula-border">
          <h2 className="text-xl font-bold text-pink-nebula-text flex items-center gap-2">
            <span className="text-2xl">⏸️</span>
            Auto-Wait Required
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Item Info */}
          <div className="p-3 bg-pink-nebula-bg rounded-lg border border-pink-nebula-border">
            <div className="text-sm text-pink-nebula-muted mb-1">Queueing:</div>
            <div className="text-lg font-semibold text-pink-nebula-text">
              {itemName} {requestedQuantity > 1 && `×${requestedQuantity}`}
            </div>
          </div>

          {/* Wait Info */}
          <div className="p-3 bg-yellow-900/20 rounded-lg border border-yellow-700/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⏱️</span>
              <div className="text-lg font-semibold text-yellow-200">
                {waitTurnsNeeded} Wait Turn{waitTurnsNeeded !== 1 ? 's' : ''} Will Be Added
              </div>
            </div>
            <div className="text-sm text-yellow-100/80">
              The lane will pause before activating this item
            </div>
          </div>

          {/* Blockers List */}
          {blockers.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-pink-nebula-muted">
                Waiting for:
              </div>
              <div className="space-y-1">
                {blockers.map((blocker, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 bg-pink-nebula-bg/50 rounded border border-pink-nebula-border/50"
                  >
                    <span className="text-lg mt-0.5">
                      {blocker.type === 'PREREQUISITE' ? '🔒' :
                       blocker.type === 'HOUSING' ? '🏠' :
                       blocker.type === 'RESOURCES' ? '📦' :
                       blocker.type === 'ENERGY' ? '⚡' : '❓'}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm text-pink-nebula-text">
                        {blocker.message}
                      </div>
                      {blocker.turnsUntilReady && (
                        <div className="text-xs text-pink-nebula-muted mt-0.5">
                          Ready in T+{blocker.turnsUntilReady}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="p-3 bg-blue-900/20 rounded border border-blue-700/50">
            <div className="text-xs text-blue-200/80">
              <strong>Note:</strong> The wait turns ensure prerequisites are met before
              this item begins construction. You can cancel or reorder items in the queue
              at any time.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-pink-nebula-border flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-pink-nebula-text rounded-lg font-semibold transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-pink-nebula-accent-primary hover:bg-pink-nebula-accent-hover text-white rounded-lg font-semibold transition-all duration-200"
          >
            Queue with Wait
          </button>
        </div>
      </div>
    </div>
  );
}
