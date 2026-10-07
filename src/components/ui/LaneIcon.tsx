"use client";

import React from 'react';
import { Building2, FlaskConical, Rocket, Users, type LucideProps } from 'lucide-react';
import type { LaneId } from '../../lib/sim/engine/types';

const LANE_ICONS: Record<LaneId, React.ComponentType<LucideProps>> = {
  building: Building2,
  ship: Rocket,
  colonist: Users,
  research: FlaskConical,
};

interface LaneIconProps {
  laneId: LaneId;
  size?: number;
  className?: string;
}

/** One line-icon per production lane; decorative — pair it with the lane's text label. */
export function LaneIcon({ laneId, size = 16, className = '' }: LaneIconProps) {
  const Icon = LANE_ICONS[laneId];
  return <Icon width={size} height={size} className={className} aria-hidden="true" />;
}
