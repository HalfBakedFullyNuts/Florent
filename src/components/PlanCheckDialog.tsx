"use client";

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { describePlanProblem, type PlanProblem } from '../lib/game/planDiagnostics';

export interface PlanCheckAction {
  label: string;
  onSelect: () => void;
  tone?: 'primary' | 'danger';
}

export interface PlanCheckDialogProps {
  title: string;
  description?: React.ReactNode;
  problems: PlanProblem[];
  nameOf: (itemId: string) => string;
  /** Choices besides Cancel, e.g. "Do it anyway" or "Wait for resources". */
  actions: PlanCheckAction[];
  onCancel: () => void;
}

/** Lists the problems a queue change would cause; Cancel undoes it, actions accept it in some form. */
export function PlanCheckDialog({ title, description, problems, nameOf, actions, onCancel }: PlanCheckDialogProps) {
  const footer = (
    <>
      <button type="button" onClick={onCancel} className="btn btn-secondary">
        Cancel change
      </button>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onSelect}
          className={`btn ${action.tone === 'danger' ? 'btn-destructive' : 'btn-primary'}`}
        >
          {action.label}
        </button>
      ))}
    </>
  );

  return (
    <Modal
      onClose={onCancel}
      title={title}
      description={description}
      tone="danger"
      icon={<AlertTriangle className="h-5 w-5" />}
      widthClass="max-w-xl"
      footer={footer}
    >
      <ul className="max-h-72 space-y-1.5 overflow-y-auto">
        {problems.map((problem) => {
          const text = describePlanProblem(problem, nameOf);
          return (
            <li key={`${problem.kind}:${problem.entryId ?? ''}:${problem.turn}:${problem.detail}`} className="callout border-l-danger items-baseline">
              <span className="w-20 shrink-0 font-semibold text-danger">{text.turnLabel}</span>
              <span className="min-w-0">
                <span className="font-semibold text-ink">{text.title}</span>
                <span className="block text-ink-2">{text.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
