"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LaneId } from '../lib/sim/engine/types';
import { ALL_LANES, LANE_CONFIG } from '../lib/constants/lanes';
import { LaneIcon } from './ui/LaneIcon';

export interface FirstEmptyTurns {
  building: number | null;
  ship: number | null;
  colonist: number | null;
}

/** Inclusive turn span a queue entry occupies in its lane; `label` names it in the hover card. */
export interface LaneSpan {
  start: number;
  end: number;
  label?: string;
}

interface SpectrumHover {
  turn: number;
  laneIndex: number;
}

export interface HorizontalTimelineProps {
  currentTurn: number;
  totalTurns: number;
  onTurnChange: (turn: number) => void;
  firstEmptyTurns?: FirstEmptyTurns;
  currentBuilds?: {
    building?: string | null;
    ship?: string | null;
    colonist?: string | null;
    research?: string | null;
  };
  laneSpans?: Partial<Record<LaneId, LaneSpan[]>>;
  isAutoJumpEnabled?: boolean;
  onAutoJumpToggle?: (v: boolean) => void;
  /** Plan problems to mark: a red band over their turns and a marker that jumps to the first turn. */
  problemMarkers?: ProblemMarker[];
}

export interface ProblemMarker {
  turn: number;
  endTurn?: number;
  label: string;
}

const ROW_HEIGHT = 20;
const THUMB_PX = 14;

/** Horizontal position of a turn along the range track, matching the native thumb mapping. */
function turnPosition(turn: number, totalTurns: number): string {
  const fraction = totalTurns > 1 ? (turn - 1) / (totalTurns - 1) : 0;
  return `calc(${THUMB_PX / 2}px + (100% - ${THUMB_PX}px) * ${fraction})`;
}

function spanWidth(span: LaneSpan, totalTurns: number): string {
  const fraction = totalTurns > 1 ? (span.end - span.start + 1) / (totalTurns - 1) : 1;
  return `max(2px, calc((100% - ${THUMB_PX}px) * ${fraction} - 1px))`;
}

/**
 * Turn deck — the planner's time axis. Turn controls on top; below, one track per lane draws
 * every queued item as a bar across turns 1..N so idle gaps are visible, with the H-alpha
 * cursor marking the viewed turn. A transparent native range input over the tracks keeps
 * click, drag and keyboard behaviour.
 */
function HorizontalTimelineInner({
  currentTurn,
  totalTurns,
  onTurnChange,
  firstEmptyTurns,
  currentBuilds,
  laneSpans,
  isAutoJumpEnabled,
  onAutoJumpToggle,
  problemMarkers,
}: HorizontalTimelineProps) {
  // Local state keeps the slider from snapping back while dragging fast.
  const [localTurn, setLocalTurn] = useState(currentTurn);
  useEffect(() => {
    setLocalTurn(currentTurn);
  }, [currentTurn]);

  const goTo = (turn: number) => {
    const clamped = Math.min(totalTurns, Math.max(1, turn));
    setLocalTurn(clamped);
    onTurnChange(clamped);
  };

  const handleTurnInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= totalTurns) {
      setLocalTurn(value);
      onTurnChange(value);
    }
  };

  return (
    <section aria-label="Turn navigation" className="panel px-3 py-3 md:px-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Turn</span>
          <button type="button" onClick={() => goTo(localTurn - 1)} disabled={localTurn <= 1} className="btn btn-secondary btn-icon" aria-label="Previous turn">
            <ChevronLeft aria-hidden="true" />
          </button>
          <input
            type="number"
            value={localTurn}
            onChange={handleTurnInput}
            min={1}
            max={totalTurns}
            aria-label="Turn"
            className="field w-18 text-center text-lg font-bold text-halpha-soft [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" onClick={() => goTo(localTurn + 1)} disabled={localTurn >= totalTurns} className="btn btn-secondary btn-icon" aria-label="Next turn">
            <ChevronRight aria-hidden="true" />
          </button>
          <span className="text-sm text-ink-3">of {totalTurns}</span>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Jump to">
          <button type="button" onClick={() => goTo(1)} className="btn btn-ghost btn-sm">Start</button>
          <button type="button" onClick={() => goTo(Math.round(totalTurns / 2))} className="btn btn-ghost btn-sm">Mid</button>
          <button type="button" onClick={() => goTo(totalTurns)} className="btn btn-ghost btn-sm">End</button>
        </div>

        <label
          className="ml-auto flex cursor-pointer select-none items-center gap-2 text-sm text-ink-2"
          title="After you queue an item, move to the turn right after it completes"
        >
          <input
            type="checkbox"
            checked={isAutoJumpEnabled ?? true}
            onChange={(e) => onAutoJumpToggle?.(e.target.checked)}
            className="h-4 w-4 rounded-sm border-edge bg-void text-halpha checked:bg-current checked:border-transparent focus:ring-0 focus:ring-offset-0"
          />
          Advance after queuing
        </label>
      </div>

      <LaneSpectrum
        localTurn={localTurn}
        totalTurns={totalTurns}
        onSlide={goTo}
        laneSpans={laneSpans}
        currentBuilds={currentBuilds}
        firstEmptyTurns={firstEmptyTurns}
        problemMarkers={problemMarkers ?? []}
      />
    </section>
  );
}

interface LaneSpectrumProps {
  localTurn: number;
  totalTurns: number;
  onSlide: (turn: number) => void;
  laneSpans?: HorizontalTimelineProps['laneSpans'];
  currentBuilds?: HorizontalTimelineProps['currentBuilds'];
  firstEmptyTurns?: FirstEmptyTurns;
  problemMarkers: ProblemMarker[];
}

function markerTurns(marker: ProblemMarker): string {
  return marker.endTurn !== undefined && marker.endTurn !== marker.turn ? `T${marker.turn}–T${marker.endTurn}` : `T${marker.turn}`;
}

/** Three aligned columns: lane + item in progress | spectrum tracks | first free turn. */
function LaneSpectrum({ localTurn, totalTurns, onSlide, laneSpans, currentBuilds, firstEmptyTurns, problemMarkers }: LaneSpectrumProps) {
  const ticks = Array.from(new Set([1, 50, 100, 150, 200, totalTurns].filter((t) => t <= totalTurns))).sort((a, b) => a - b);
  const [hover, setHover] = useState<SpectrumHover | null>(null);
  const hoveredTurn = hover?.turn ?? null;

  // The range input covers all tracks, so the pointer position decides which lane and turn are hovered.
  const handleHover = (e: React.MouseEvent<HTMLInputElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left - THUMB_PX / 2) / (rect.width - THUMB_PX);
    const turn = Math.min(totalTurns, Math.max(1, Math.round(fraction * (totalTurns - 1) + 1)));
    const laneIndex = Math.min(ALL_LANES.length - 1, Math.max(0, Math.floor((e.clientY - rect.top) / ROW_HEIGHT)));
    setHover((prev) => (prev?.turn === turn && prev.laneIndex === laneIndex ? prev : { turn, laneIndex }));
  };

  return (
    <div className="mt-3 grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_3.25rem] gap-x-3 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_4rem]">
      <div className="eyebrow h-[18px]">In progress</div>
      <div className="relative h-[18px]">
        {ticks.map((turn) => (
          <span key={turn} aria-hidden="true" className={`absolute -translate-x-1/2 text-[11px] leading-[18px] text-ink-3 ${turn === 50 || turn === 150 ? 'max-sm:hidden' : ''}`} style={{ left: turnPosition(turn, totalTurns) }}>
            {turn}
          </span>
        ))}
        {hoveredTurn !== null && hoveredTurn !== localTurn && (
          <span aria-hidden="true" className="absolute z-10 -translate-x-1/2 rounded-sm bg-veil-hi px-1 text-[11px] font-semibold leading-[18px] text-ink" style={{ left: turnPosition(hoveredTurn, totalTurns) }}>
            T{hoveredTurn}
          </span>
        )}
        <span aria-hidden="true" className="absolute z-20 -translate-x-1/2 rounded-sm bg-halpha px-1 text-[11px] font-bold leading-[18px] text-void" style={{ left: turnPosition(localTurn, totalTurns) }}>
          T{localTurn}
        </span>
        {problemMarkers.map((marker) => (
          <button
            key={`${marker.turn}:${marker.label}`}
            type="button"
            onClick={() => onSlide(marker.turn)}
            aria-label={`Problem at ${markerTurns(marker)}: ${marker.label}`}
            title={`${markerTurns(marker)}: ${marker.label}`}
            className="pointer-events-auto absolute top-0 z-30 h-[18px] w-3 -translate-x-1/2 rounded-sm bg-danger text-[10px] font-bold leading-[18px] text-void hover:brightness-110"
            style={{ left: turnPosition(marker.turn, totalTurns) }}
          >
            !
          </button>
        ))}
      </div>
      <div className="eyebrow h-[18px] text-right">Free</div>

      <ul className="flex min-w-0 flex-col">
        {ALL_LANES.map((laneId) => (
          <LaneLabel key={laneId} laneId={laneId} current={currentBuilds?.[laneId] ?? null} isHovered={hover?.laneIndex === ALL_LANES.indexOf(laneId)} />
        ))}
      </ul>

      <div className="relative" style={{ height: ROW_HEIGHT * ALL_LANES.length }}>
        {ticks.map((turn) => (
          <span key={turn} aria-hidden="true" className="absolute inset-y-0 w-px bg-filament/70" style={{ left: turnPosition(turn, totalTurns) }} />
        ))}
        {problemMarkers.map((marker) => (
          <span
            key={`band:${marker.turn}:${marker.label}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 min-w-0.5 bg-danger/25 shadow-[inset_1px_0_0_#FF7A7A]"
            style={{ left: turnPosition(marker.turn, totalTurns), width: spanWidth({ start: marker.turn, end: marker.endTurn ?? marker.turn }, totalTurns) }}
          />
        ))}
        {hover && (
          <span aria-hidden="true" className="absolute inset-x-0 rounded-[4px] bg-oiii/10" style={{ top: hover.laneIndex * ROW_HEIGHT, height: ROW_HEIGHT }} />
        )}
        {ALL_LANES.map((laneId, index) => (
          <LaneTrack
            key={laneId}
            index={index}
            spans={laneSpans?.[laneId] ?? []}
            localTurn={localTurn}
            totalTurns={totalTurns}
            hoveredTurn={hover?.laneIndex === index ? hover.turn : null}
          />
        ))}
        {hover && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 w-px -translate-x-1/2 bg-oiii/80" style={{ left: turnPosition(hover.turn, totalTurns) }} />
        )}
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-halpha shadow-[0_0_8px_rgba(242,80,140,0.7)]" style={{ left: turnPosition(localTurn, totalTurns) }} />
        {hover && <SpectrumHoverCard hover={hover} laneSpans={laneSpans} totalTurns={totalTurns} />}
        <input
          type="range"
          min={1}
          max={totalTurns}
          step={1}
          value={localTurn}
          onChange={(e) => onSlide(parseInt(e.target.value, 10))}
          onMouseMove={handleHover}
          onMouseLeave={() => setHover(null)}
          aria-label="Turn slider"
          aria-valuetext={`Turn ${localTurn} of ${totalTurns}`}
          className="turn-range absolute inset-0 z-20 rounded-[4px]"
        />
      </div>

      <div className="flex flex-col">
        {ALL_LANES.map((laneId) => (
          <FreeTurnCell key={laneId} laneId={laneId} turn={laneId === 'research' ? null : firstEmptyTurns?.[laneId] ?? null} localTurn={localTurn} onJump={onSlide} />
        ))}
      </div>
    </div>
  );
}

/** Names what the hovered lane is doing at the hovered turn, e.g. "Metal Mine · T21–T24". */
function SpectrumHoverCard({ hover, laneSpans, totalTurns }: { hover: SpectrumHover; laneSpans?: HorizontalTimelineProps['laneSpans']; totalTurns: number }) {
  const laneId = ALL_LANES[hover.laneIndex];
  const span = (laneSpans?.[laneId] ?? []).find((s) => s.start <= hover.turn && hover.turn <= s.end);
  const above = hover.laneIndex >= 2;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-ctl border border-oiii/60 bg-veil-hi px-2.5 py-1.5 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
      style={{
        left: turnPosition(hover.turn, totalTurns),
        top: above ? hover.laneIndex * ROW_HEIGHT - 34 : (hover.laneIndex + 1) * ROW_HEIGHT + 4,
      }}
    >
      <LaneIcon laneId={laneId} size={14} className="text-oiii" />
      {span ? (
        <>
          <span className="font-semibold text-ink">{span.label ?? LANE_CONFIG[laneId].title}</span>
          <span className="font-semibold text-ink-2">T{span.start}–T{span.end}</span>
        </>
      ) : (
        <span className="font-semibold text-ink-2">{LANE_CONFIG[laneId].title} idle · T{hover.turn}</span>
      )}
    </div>
  );
}

function LaneLabel({ laneId, current, isHovered }: { laneId: LaneId; current: string | null; isHovered: boolean }) {
  const title = LANE_CONFIG[laneId].title;
  const iconTone = isHovered ? 'text-oiii' : current ? 'text-ink-2' : 'text-ink-3';
  return (
    <li
      className="flex min-w-0 items-center gap-2 text-[13px] font-semibold"
      style={{ height: ROW_HEIGHT }}
      title={`${title}: ${current ?? 'idle'}`}
    >
      <LaneIcon laneId={laneId} size={14} className={`shrink-0 ${iconTone}`} />
      <span className="sr-only">{title}:</span>
      <span className={`truncate ${current ? 'text-ink' : 'text-ink-3'}`}>{current ?? 'Idle'}</span>
    </li>
  );
}

interface LaneTrackProps {
  index: number;
  spans: LaneSpan[];
  localTurn: number;
  totalTurns: number;
  /** Turn under the pointer when this lane is hovered; the bar covering it lights up in O-III. */
  hoveredTurn: number | null;
}

function LaneTrack({ index, spans, localTurn, totalTurns, hoveredTurn }: LaneTrackProps) {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 h-2 overflow-hidden rounded-[2px] bg-filament/35" style={{ top: index * ROW_HEIGHT + (ROW_HEIGHT - 8) / 2 }}>
      {spans.filter((span) => span.start <= totalTurns).map((raw) => {
        const span = { start: raw.start, end: Math.min(raw.end, totalTurns) };
        const isCurrent = span.start <= localTurn && localTurn <= span.end;
        const isPast = span.end < localTurn;
        const isHovered = hoveredTurn !== null && span.start <= hoveredTurn && hoveredTurn <= span.end;
        const tone = isHovered ? 'bg-oiii' : isCurrent ? 'bg-halpha' : isPast ? 'bg-ink-3/45' : 'bg-ink-2/70';
        return (
          <span
            key={`${raw.start}-${raw.end}`}
            className={`absolute inset-y-0 rounded-[2px] ${tone}`}
            style={{ left: turnPosition(span.start, totalTurns), width: spanWidth(span, totalTurns) }}
          />
        );
      })}
    </div>
  );
}

function FreeTurnCell({ laneId, turn, localTurn, onJump }: { laneId: LaneId; turn: number | null; localTurn: number; onJump: (t: number) => void }) {
  if (turn === null) {
    return <span className="flex items-center justify-end text-[13px] text-ink-3" style={{ height: ROW_HEIGHT }} aria-hidden="true">—</span>;
  }
  const isHere = turn === localTurn;
  return (
    <button
      type="button"
      onClick={() => onJump(turn)}
      aria-pressed={isHere}
      title={`First turn where the ${LANE_CONFIG[laneId].title} lane is empty (T${turn})`}
      aria-label={`Jump to first free ${LANE_CONFIG[laneId].title} turn, T${turn}`}
      className={`flex items-center justify-end rounded-[4px] px-1 text-[13px] font-semibold transition-colors hover:bg-veil ${isHere ? 'text-oiii' : 'text-ink-2 hover:text-ink'}`}
      style={{ height: ROW_HEIGHT }}
    >
      T{turn}
    </button>
  );
}

export const HorizontalTimeline = React.memo(HorizontalTimelineInner);
