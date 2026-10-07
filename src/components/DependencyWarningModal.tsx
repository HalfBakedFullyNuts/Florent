import React from 'react';
import { AlertTriangle, Shield, Trash2 } from 'lucide-react';
import type { LaneEntry } from '../lib/game/selectors';
import { Modal } from './ui/Modal';

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
    const footer = (
        <>
            <button type="button" onClick={onCancel} className="btn btn-secondary">
                <Shield aria-hidden="true" />
                Keep {cancelledItemName}
            </button>
            <button type="button" onClick={onConfirm} className="btn btn-danger">
                <Trash2 aria-hidden="true" />
                Cancel all
            </button>
        </>
    );

    return (
        <Modal
            onClose={onCancel}
            titleId="dependency-warning-title"
            tone="danger"
            icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
            eyebrow="Queue change"
            title="Prerequisite warning"
            description={
                <>
                    Cancelling <strong className="font-semibold text-ink">{cancelledItemName}</strong> will also cancel items that depend on it.
                </>
            }
            footer={footer}
        >
            <ul className="well divide-y divide-filament">
                {brokenDependencies.map((dep, index) => (
                    <li key={index} className="flex h-10 items-center justify-between gap-3 px-3 text-sm">
                        <span className="min-w-0 truncate text-ink">
                            {dep.itemName} <span className="text-ink-3">×{dep.quantity}</span>
                        </span>
                        <span className="chip text-danger">Will cancel</span>
                    </li>
                ))}
            </ul>
        </Modal>
    );
}
