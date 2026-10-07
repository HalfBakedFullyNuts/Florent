"use client";

import React from 'react';
import { ExternalLink } from 'lucide-react';
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
      className="inline-flex items-center rounded-sm p-1 text-ink-3 transition-colors hover:text-ink"
    >
      <ExternalLink aria-hidden="true" className="h-3 w-3" />
    </a>
  );
}
