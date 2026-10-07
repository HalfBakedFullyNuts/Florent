"use client";

import React, { useState } from 'react';
import { AlertTriangle, Globe2, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

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
    <Modal
      onClose={handleClose}
      eyebrow={planetLabel}
      title={planetName}
      icon={confirming ? <Trash2 className="h-5 w-5" /> : <Globe2 className="h-5 w-5" />}
      tone={confirming ? 'danger' : 'default'}
      widthClass="max-w-sm"
      footer={confirming ? (
        <>
          <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button type="button" onClick={handleDelete} className="btn btn-danger flex-1">
            <Trash2 aria-hidden="true" />
            Confirm remove
          </button>
        </>
      ) : undefined}
    >
      {!confirming ? (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onModify} className="btn btn-primary w-full">
            <Pencil aria-hidden="true" />
            Modify planet
          </button>

          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={blockReason !== null}
            title={blockReason ?? undefined}
            className="btn btn-danger w-full"
          >
            <Trash2 aria-hidden="true" />
            Remove planet
          </button>

          {blockReason && (
            <p className="callout mt-2 border-l-caution text-ink-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-caution" aria-hidden="true" />
              <span>{blockReason}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm text-ink">
            Remove <span className="font-semibold">{planetName}</span>?
          </p>
          <p className="text-sm text-ink-2">
            The outpost ship used to colonise it will be returned.
          </p>
        </div>
      )}
    </Modal>
  );
}
