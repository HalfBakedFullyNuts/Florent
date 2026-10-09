"use client";

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import type { Warning } from '../lib/game/selectors';

export interface WarningsPanelProps {
  warnings: Warning[];
  className?: string;
}

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

const SEVERITY_STYLE: Record<string, { border: string; icon: React.ReactNode; label: string }> = {
  error: { border: 'border-l-danger', icon: <AlertOctagon className="h-4 w-4 text-danger" aria-hidden="true" />, label: 'Error' },
  warning: { border: 'border-l-caution', icon: <AlertTriangle className="h-4 w-4 text-caution" aria-hidden="true" />, label: 'Warning' },
  info: { border: 'border-l-res-energy', icon: <Info className="h-4 w-4 text-res-energy" aria-hidden="true" />, label: 'Note' },
};

function styleFor(warning: Warning) {
  return SEVERITY_STYLE[warning.severity] ?? SEVERITY_STYLE.info;
}

/**
 * WarningsPanel - permanent alert slot in the lane-switcher row for action errors, engine warnings
 * and cascade-removal notices. It stays mounted (empty when all is well) so alerts appearing or
 * clearing never move the page; the most severe shows inline, the rest open from a "+N" button.
 */
function WarningsPanelInner({ warnings, className = '' }: WarningsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismiss(isOpen, containerRef, () => setIsOpen(false));

  if (warnings.length === 0) {
    return (
      <div className={`flex min-w-0 items-center ${className}`} role="status" aria-live="polite" data-empty="true">
        <div className="callout min-w-0 flex-1 items-center border-l-filament py-1.5" aria-hidden="true">
          <span className="h-4 w-4 shrink-0" />
          <span className="font-semibold">&nbsp;</span>
        </div>
      </div>
    );
  }

  const sorted = [...warnings].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));
  const [first, ...rest] = sorted;
  const firstStyle = styleFor(first);

  return (
    <div ref={containerRef} className={`relative flex min-w-0 items-center gap-2 ${className}`} role="status" aria-live="polite" data-empty="false">
      <div className={`callout min-w-0 flex-1 items-center py-1.5 ${firstStyle.border}`} title={first.message}>
        <span className="shrink-0">{firstStyle.icon}</span>
        <span className="sr-only">{firstStyle.label}:</span>
        <span className="truncate font-semibold">{first.message}</span>
      </div>
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label={`Show all ${sorted.length} warnings`}
          className="btn btn-secondary btn-sm shrink-0"
        >
          +{rest.length}
        </button>
      )}
      {isOpen && (
        <ul aria-label="All warnings" className="panel absolute right-0 top-full z-40 mt-1 w-[min(32rem,calc(100vw-2rem))] space-y-1.5 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
          {sorted.map((warning) => {
            const style = styleFor(warning);
            return (
              <li key={`${warning.type}:${warning.message}`} className={`callout ${style.border}`}>
                <span className="mt-0.5 shrink-0">{style.icon}</span>
                <span className="sr-only">{style.label}:</span>
                <span className="font-semibold">{warning.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Closes the popover on Escape or a click outside the warnings row. */
function useDismiss(isOpen: boolean, ref: React.RefObject<HTMLElement | null>, onDismiss: () => void) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    if (!isOpen) return;
    const handlePointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismissRef.current();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismissRef.current();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, ref]);
}

export const WarningsPanel = React.memo(WarningsPanelInner);
