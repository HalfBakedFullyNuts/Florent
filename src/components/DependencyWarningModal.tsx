import React from 'react';
import { AlertTriangle, Shield, Trash2, X } from 'lucide-react';
import type { LaneEntry } from '../lib/game/selectors';

export interface DependencyWarningModalProps {
    onConfirm: () => void;
    onCancel: () => void;
    cancelledItemName: string;
    brokenDependencies: LaneEntry[];
}

/**
 * DependencyWarningModal - Shows user a warning when cancelling a building
 * that acts as a prerequisite for other items already in the queue.
 */
export function DependencyWarningModal({
    onConfirm,
    onCancel,
    cancelledItemName,
    brokenDependencies
}: DependencyWarningModalProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:items-center md:p-6 animate-fade-in"
            onClick={onCancel}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dependency-warning-title"
                className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-red-300/25 bg-gradient-to-br from-[#2b1420]/95 via-[#171024]/95 to-[#0d1b2f]/95 shadow-2xl shadow-black/60 ring-1 ring-red-100/10"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="pointer-events-none absolute left-1/2 top-0 h-36 w-[150%] -translate-x-1/2 bg-red-500/10 blur-[60px]" />

                <header className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-6">
                    <div className="flex gap-3">
                        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-200/30 bg-red-500/15 text-red-50 shadow-lg shadow-red-500/10">
                            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-red-100/70">Destructive queue change</div>
                            <h2 id="dependency-warning-title" className="mt-1 text-2xl font-black text-red-50">
                                Prerequisite Warning
                            </h2>
                            <p className="mt-2 text-sm text-pink-nebula-muted">
                                Cancelling <strong className="text-white">{cancelledItemName}</strong> will also cancel items that depend on it.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-pink-nebula-muted transition-all hover:border-red-200/40 hover:bg-white/10 hover:text-pink-nebula-text focus:outline-none focus:ring-2 focus:ring-red-300/30"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </header>

                <div className="relative px-5 py-5 md:px-6">
                    <div className="scroll-nebula max-h-56 overflow-y-auto rounded-2xl border border-red-200/20 bg-slate-950/35 p-3">
                    <ul className="space-y-2 text-left">
                        {brokenDependencies.map((dep, index) => (
                            <li key={index} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm">
                                <span className="min-w-0 truncate font-mono text-pink-nebula-text">
                                    {dep.itemName} <span className="text-pink-nebula-muted">x{dep.quantity}</span>
                                </span>
                                <span className="shrink-0 rounded-full border border-red-200/25 bg-red-500/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-red-100">
                                    Will cancel
                                </span>
                            </li>
                        ))}
                    </ul>
                    </div>
                </div>

                <div className="grid gap-2 border-t border-white/10 px-5 py-4 sm:grid-cols-2 md:px-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-200/35 bg-emerald-400/15 px-4 py-2 text-sm font-black text-emerald-50 shadow-lg shadow-emerald-500/10 transition-all hover:bg-emerald-400/25 focus:outline-none focus:ring-2 focus:ring-emerald-300/25"
                    >
                        <Shield className="h-4 w-4" aria-hidden="true" />
                        Keep {cancelledItemName}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-200/40 bg-red-500/20 px-4 py-2 text-sm font-black text-red-50 shadow-lg shadow-red-500/15 transition-all hover:bg-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-300/30"
                    >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Cancel All
                    </button>
                </div>
            </div>
        </div>
    );
}
