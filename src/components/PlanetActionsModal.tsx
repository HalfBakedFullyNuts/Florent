"use client";

import React, { useState } from 'react';

interface PlanetActionsModalProps {
  isOpen: boolean;
  planetName: string;
  planetLabel: string;       // e.g. "P2"
  blockReason: string | null; // null = can delete, string = reason it cannot
  onModify: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function PlanetActionsModal({
  isOpen,
  planetName,
  planetLabel,
  blockReason,
  onModify,
  onDelete,
  onClose,
}: PlanetActionsModalProps) {
  const [confirming, setConfirming] = useState(false);

  if (!isOpen) return null;

  const handleDelete = () => {
    onDelete();
    setConfirming(false);
  };

  const handleClose = () => {
    setConfirming(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-pink-nebula-muted">
              {planetLabel}
            </span>
            <h2 className="mt-0.5 text-xl font-black text-pink-nebula-text">{planetName}</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-pink-nebula-muted hover:text-pink-nebula-text transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!confirming ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={onModify}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-cyan-200/35 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-50 shadow-lg shadow-cyan-500/10 transition-all hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-300/25"
            >
              ✏️ Modify Planet
            </button>

            <button
              onClick={() => setConfirming(true)}
              disabled={blockReason !== null}
              title={blockReason ?? undefined}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-2 text-sm font-black text-red-300 transition-all hover:bg-red-700/40 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-300/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🗑 Remove Planet
            </button>

            {blockReason && (
              <p className="text-center text-xs text-orange-400">⚠ {blockReason}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm text-pink-nebula-text">
              Remove <span className="font-bold">{planetName}</span>?
            </p>
            <p className="text-center text-xs text-pink-nebula-muted">
              The outpost ship used to colonise it will be returned.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 min-h-[42px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-pink-nebula-muted hover:text-pink-nebula-text transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 min-h-[42px] rounded-xl border border-red-400/40 bg-red-700/50 px-4 py-2 text-sm font-black text-white shadow-lg shadow-red-900/30 hover:bg-red-600/70 transition-all focus:outline-none focus:ring-2 focus:ring-red-300/25"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
