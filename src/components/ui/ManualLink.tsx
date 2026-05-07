"use client";

import React from 'react';
import { MANUAL_LINKS, type ManualLinkKey } from '../../lib/constants/manualLinks';

interface ManualLinkProps {
  topic: ManualLinkKey;
  label: string;
}

export function ManualLink({ topic, label }: ManualLinkProps) {
  return (
    <a
      href={MANUAL_LINKS[topic]}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex items-center rounded px-1 py-0.5 text-[10px] text-pink-nebula-muted/50 transition-colors hover:text-pink-nebula-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/50"
    >
      ↗
    </a>
  );
}
