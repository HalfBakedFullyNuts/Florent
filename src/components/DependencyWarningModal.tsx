import React from 'react';
import { Card } from '@/components/ui/card';
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4">
            <Card className="w-full max-w-md bg-slate-900 border-red-500 ring-2 ring-red-500/50 shadow-2xl p-6 relative overflow-hidden">
                {/* Background glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-32 bg-red-500/10 blur-[50px] pointer-events-none" />

                <div className="relative text-center mb-6">
                    <div className="w-16 h-16 mx-auto bg-red-900/50 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-2xl font-bold text-red-400 mb-2">Prerequisite Warning</h2>
                    <p className="text-pink-nebula-text text-sm">
                        Cancelling <strong className="text-white">{cancelledItemName}</strong> will break the following queued items that require it to be built first:
                    </p>
                </div>

                <div className="bg-slate-800/80 rounded border border-slate-700 p-3 mb-8 max-h-48 overflow-y-auto w-full">
                    <ul className="space-y-2 text-left w-full pl-2">
                        {brokenDependencies.map((dep, index) => (
                            <li key={index} className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-1 last:border-0 last:pb-0">
                                <span className="text-pink-nebula-text font-mono truncate">{dep.itemName} <span className="text-pink-nebula-muted">x{dep.quantity}</span></span>
                                <span className="text-red-400 font-mono text-xs whitespace-nowrap ml-2">Will be cancelled</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold transition-all border border-slate-700 active:scale-95 duration-150"
                    >
                        Keep {cancelledItemName}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:shadow-[0_0_20px_rgba(239,68,68,0.6)] font-bold transition-all active:scale-95 duration-150"
                    >
                        Cancel All
                    </button>
                </div>
            </Card>
        </div>
    );
}
