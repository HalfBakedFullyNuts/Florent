"use client";

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  /** Max width class, e.g. 'max-w-lg' (default) or 'max-w-3xl'. */
  widthClass?: string;
  /** Tone of the icon tile; 'danger' for destructive confirmations. */
  tone?: 'default' | 'danger';
  /** Accessible name override when `title` is not plain text. */
  titleId?: string;
  closeLabel?: string;
  children?: React.ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared dialog shell: backdrop click and Escape close it, focus moves to the dialog on open,
 * Tab cycles inside it, and focus returns to the opener on close.
 */
export function Modal({
  onClose,
  title,
  eyebrow,
  description,
  icon,
  footer,
  widthClass = 'max-w-lg',
  tone = 'default',
  titleId,
  closeLabel = 'Close',
  children,
}: ModalProps) {
  const generatedId = useId();
  const headingId = titleId ?? `modal-title-${generatedId}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab') trapTab(event, dialogRef.current);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      opener?.focus?.();
    };
  }, []);

  const iconTone = tone === 'danger'
    ? 'border-danger/40 bg-danger/10 text-danger'
    : 'border-filament bg-veil text-oiii';

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className={`modal ${widthClass} outline-hidden`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={`modal-head ${children ? "" : "border-b-0"}`}>
          {icon && (
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-ctl border ${iconTone}`} aria-hidden="true">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2 id={headingId} className="modal-title">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon -mr-2 -mt-1" aria-label={closeLabel}>
            <X aria-hidden="true" />
          </button>
        </header>
        {children && <div className="modal-body scroll-nebula">{children}</div>}
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

function trapTab(event: KeyboardEvent, dialog: HTMLElement | null) {
  if (!dialog) return;
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
