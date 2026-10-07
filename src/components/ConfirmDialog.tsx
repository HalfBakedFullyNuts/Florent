"use client";

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';

export interface ConfirmDialogProps {
  title: string;
  description: React.ReactNode;
  /** Names the outcome, e.g. "Reset plan" — never a generic "OK". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/** Destructive-action confirmation: Cancel is the safe default, the confirm button names the result. */
export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel, children }: ConfirmDialogProps) {
  return (
    <Modal
      onClose={onCancel}
      title={title}
      description={description}
      tone="danger"
      icon={<AlertTriangle className="h-5 w-5" />}
      widthClass="max-w-md"
      footer={
        <>
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="btn btn-destructive">
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
