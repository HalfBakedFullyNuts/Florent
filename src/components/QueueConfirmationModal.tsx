"use client";

import React from 'react';
import {
  CheckCircle2,
  Clock3,
  HelpCircle,
  Home,
  Lock,
  Package,
  PauseCircle,
  X,
  Zap,
} from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:items-center md:p-6">
      <div
        className="absolute inset-0"
        onClick={onCancel}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-wait-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-[#24142d]/95 via-[#171024]/95 to-[#0d1b2f]/95 shadow-2xl shadow-black/60 ring-1 ring-white/10 animate-in fade-in duration-200"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-6">
          <div className="flex gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/25 bg-amber-400/10 text-amber-50 shadow-lg shadow-amber-500/10">
              <PauseCircle className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-100/70">Queue timing</div>
              <h2 id="auto-wait-title" className="mt-1 text-2xl font-black text-pink-nebula-text">
                Auto-Wait Required
              </h2>
              <p className="mt-1 text-sm text-pink-nebula-muted">
                This item can be queued, but the lane needs to pause until blockers clear.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-pink-nebula-muted transition-all hover:border-cyan-200/40 hover:bg-white/10 hover:text-pink-nebula-text focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5 md:px-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-lg shadow-black/15">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-pink-nebula-muted">Queueing</div>
            <div className="mt-1 text-lg font-black text-pink-nebula-text">
              {itemName} {requestedQuantity > 1 && `x${requestedQuantity}`}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200/25 bg-amber-400/10 p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200/25 bg-slate-950/30 text-amber-50">
                <Clock3 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <div className="text-lg font-black text-amber-50">
                  {waitTurnsNeeded} Wait Turn{waitTurnsNeeded !== 1 ? 's' : ''} Will Be Added
                </div>
                <div className="mt-1 text-sm text-amber-50/75">
                  The lane will pause before activating this item.
                </div>
              </div>
            </div>
          </div>

          {blockers.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-pink-nebula-muted">
                Waiting for
              </div>
              <div className="space-y-1">
                {blockers.map((blocker, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3"
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-50">
                      {blockerIcon(blocker.type)}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-pink-nebula-text">
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

          <div className="rounded-2xl border border-sky-200/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-50/80">
            <div>
              <strong>Note:</strong> The wait turns ensure prerequisites are met before
              this item begins construction. You can cancel or reorder items in the queue
              at any time.
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-t border-white/10 px-5 py-4 sm:grid-cols-2 md:px-6">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-pink-nebula-muted transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-pink-nebula-text focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-200/35 bg-emerald-400/15 px-4 py-2 text-sm font-black text-emerald-50 shadow-lg shadow-emerald-500/10 transition-all hover:bg-emerald-400/25 focus:outline-none focus:ring-2 focus:ring-emerald-300/25"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Queue with Wait
          </button>
        </div>
      </div>
    </div>
  );
}

function blockerIcon(type: QueueBlocker['type']) {
  if (type === 'PREREQUISITE') return <Lock className="h-4 w-4" aria-hidden="true" />;
  if (type === 'HOUSING') return <Home className="h-4 w-4" aria-hidden="true" />;
  if (type === 'RESOURCES') return <Package className="h-4 w-4" aria-hidden="true" />;
  if (type === 'ENERGY') return <Zap className="h-4 w-4" aria-hidden="true" />;
  return <HelpCircle className="h-4 w-4" aria-hidden="true" />;
}
