"use client";

import React, { useState, useCallback, useEffect } from 'react';
import {
  ClipboardPaste,
  Database,
  Globe2,
  Home,
  Import,
  Layers,
  Route,
  Rocket,
  Save,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  ABUNDANCE_LIMITS,
  DEFAULT_SPACE,
  DEFAULT_ADDED_PLANET_STARTING,
  HOMEWORLD_PLANET_STARTING,
  PLANET_PRESETS,
  STARTER_PACKAGE,
  RESOURCE_COLORS,
  type PlanetStartingSettings,
  validateAbundance,
  validateAllAbundances,
  normalizePlanetStarting,
} from '../lib/constants/planet';
import {
  DEFAULT_EXPANSION_TRAVEL_CHOICE,
  EXPANSION_TRAVEL_CHOICES,
  type ExpansionTravelChoice,
  getExpansionTravelTime,
} from '../lib/constants/travel';

const STARTING_STRUCTURE_FIELDS: Array<{
  id: keyof PlanetStartingSettings['structures'];
  label: string;
}> = [
  { id: 'metal_mine', label: 'Metal Mines' },
  { id: 'mineral_extractor', label: 'Mineral Extractors' },
  { id: 'farm', label: 'Farms' },
  { id: 'solar_generator', label: 'Solar Gens' },
];

const PANEL_CLASS = 'rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-lg shadow-black/15';
const INPUT_CLASS = 'w-full min-h-[42px] rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-pink-nebula-text outline-none transition-all placeholder:text-pink-nebula-muted/60 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-300/20';
const COMPACT_INPUT_CLASS = 'w-20 min-h-[36px] rounded-xl border border-white/10 bg-slate-950/70 px-2 py-1 text-right text-sm text-pink-nebula-text outline-none transition-all focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-300/20';
const SECONDARY_BUTTON_CLASS = 'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-pink-nebula-text transition-all hover:border-cyan-200/35 hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-cyan-300/20';
const PRIMARY_BUTTON_CLASS = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-200/35 bg-emerald-400/15 px-4 py-2 text-sm font-black text-emerald-50 shadow-lg shadow-emerald-500/10 transition-all hover:bg-emerald-400/25 focus:outline-none focus:ring-2 focus:ring-emerald-300/25';
const QUIET_BUTTON_CLASS = 'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-pink-nebula-muted transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-pink-nebula-text focus:outline-none focus:ring-2 focus:ring-cyan-300/20';
const LABEL_CLASS = 'mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-pink-nebula-muted';

export interface BestExpansionSource {
  departureTurn: number;
  sourcePlanetIdx: number;
  travelChoice: ExpansionTravelChoice;
}

interface AddPlanetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlanet: (config: PlanetConfig) => boolean | void;
  currentTurn: number;
  initialConfig?: PlanetConfig;
  mode?: 'add' | 'edit';
  /** Best available expansion source across all planets. Omit in edit mode. */
  expansionSource?: BestExpansionSource;
}

export interface PlanetConfig {
  name: string;
  startTurn: number;
  abundance: {
    metal: number;
    mineral: number;
    food: number;
    energy: number;
    research_points: number;
  };
  space: {
    groundCap: number;
    orbitalCap: number;
  };
  starting?: PlanetStartingSettings;
  expansion?: {
    travelChoice: ExpansionTravelChoice;
    sourcePlanetIndex?: number;
    departureTurn?: number;
  };
}

/**
 * Modal for adding a new planet with custom configuration
 */
export function AddPlanetModal({
  isOpen,
  onClose,
  onAddPlanet,
  currentTurn,
  initialConfig,
  mode = 'add',
  expansionSource,
}: AddPlanetModalProps) {
  const [name, setName] = useState(initialConfig?.name ?? 'Planet');
  const [startTurn, setStartTurn] = useState(initialConfig?.startTurn ?? currentTurn);
  // Explicitly type to avoid readonly literal types
  const [abundance, setAbundance] = useState<{
    metal: number;
    mineral: number;
    food: number;
    energy: number;
    research_points: number;
  }>({ ...PLANET_PRESETS.HOMEWORLD.abundance });
  const [space, setSpace] = useState<{
    groundCap: number;
    orbitalCap: number;
  }>({ ...PLANET_PRESETS.HOMEWORLD.space });
  const [starting, setStarting] = useState<PlanetStartingSettings>(() =>
    normalizePlanetStarting(initialConfig?.starting ?? DEFAULT_ADDED_PLANET_STARTING)
  );
  const [travelChoice, setTravelChoice] = useState<ExpansionTravelChoice>(
    initialConfig?.expansion?.travelChoice ?? expansionSource?.travelChoice ?? DEFAULT_EXPANSION_TRAVEL_CHOICE
  );
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(initialConfig?.name ?? 'Planet');
    setStartTurn(initialConfig?.startTurn ?? currentTurn);
    setAbundance(initialConfig
      ? {
        metal: Math.round(initialConfig.abundance.metal * 100),
        mineral: Math.round(initialConfig.abundance.mineral * 100),
        food: Math.round(initialConfig.abundance.food * 100),
        energy: Math.round(initialConfig.abundance.energy * 100),
        research_points: Math.round(initialConfig.abundance.research_points * 100),
      }
      : { ...PLANET_PRESETS.HOMEWORLD.abundance });
    setSpace(initialConfig ? { ...initialConfig.space } : { ...PLANET_PRESETS.HOMEWORLD.space });
    setStarting(normalizePlanetStarting(initialConfig?.starting ?? DEFAULT_ADDED_PLANET_STARTING));
    setTravelChoice(initialConfig?.expansion?.travelChoice ?? expansionSource?.travelChoice ?? DEFAULT_EXPANSION_TRAVEL_CHOICE);
  }, [isOpen, currentTurn, initialConfig, expansionSource]);

  const travelDelay = getExpansionTravelTime(travelChoice);
  const travelBase = expansionSource?.departureTurn ?? currentTurn;
  const minTravelStart = mode === 'add' ? travelBase + travelDelay : 1;

  const handleSubmit = useCallback(() => {
    // Validate and clamp all abundances before submitting
    const validatedAbundance = validateAllAbundances(abundance);

    // Convert percentages to multipliers (100% = 1.0)
    const abundanceMultipliers = Object.fromEntries(
      Object.entries(validatedAbundance).map(([key, value]) => [key, value / 100])
    );

    const added = onAddPlanet({
      name,
      startTurn: Math.max(startTurn, minTravelStart),
      abundance: abundanceMultipliers as typeof abundance,
      space,
      starting: normalizePlanetStarting(starting),
      expansion:
        mode === 'add' || initialConfig?.expansion
          ? {
              ...initialConfig?.expansion,
              travelChoice,
              // Thread best source planet index so planPlanetExpansion uses the right source
              sourcePlanetIndex: initialConfig?.expansion?.sourcePlanetIndex
                ?? expansionSource?.sourcePlanetIdx,
            }
          : undefined,
    });
    if (added !== false) onClose();
  }, [name, startTurn, minTravelStart, abundance, space, starting, mode, initialConfig, travelChoice, expansionSource, onAddPlanet, onClose]);

  const updateAbundance = useCallback((resource: string, value: number) => {
    // Allow free typing - validation happens on blur and submit
    setAbundance(prev => ({
      ...prev,
      [resource]: value,
    }));
  }, []);

  const validateAbundanceField = useCallback((resource: string, value: number) => {
    // Clamp to valid range and round
    setAbundance(prev => ({
      ...prev,
      [resource]: validateAbundance(value),
    }));
  }, []);

  const applyPreset = useCallback((preset: string) => {
    const presetKey = preset.toUpperCase().replace('-', '_') as keyof typeof PLANET_PRESETS;
    const presetData = PLANET_PRESETS[presetKey];
    if (!presetData) return;
    // Create mutable copies to satisfy TypeScript
    setAbundance({ ...presetData.abundance });
    setSpace({ ...presetData.space });
  }, []);

  const applyHomeworldStarting = useCallback(() => {
    setStarting(normalizePlanetStarting(HOMEWORLD_PLANET_STARTING));
  }, []);

  const updateStartingWorkers = useCallback((value: number) => {
    setStarting(prev => ({
      ...prev,
      workersTotal: Math.max(0, Math.floor(value) || 0),
    }));
  }, []);

  const updateStartingStructure = useCallback((
    structureId: keyof PlanetStartingSettings['structures'],
    value: number
  ) => {
    setStarting(prev => ({
      ...prev,
      structures: {
        ...prev.structures,
        [structureId]: Math.max(0, Math.floor(value) || 0),
      },
    }));
  }, []);

  const parseImportData = useCallback((text: string) => {
    const result: {
      groundCap: number;
      orbitalCap: number;
      abundance: { metal: number; mineral: number; food: number; energy: number; research_points: number };
    } = {
      groundCap: DEFAULT_SPACE.GROUND as number,
      orbitalCap: DEFAULT_SPACE.ORBITAL as number,
      abundance: { ...PLANET_PRESETS.HOMEWORLD.abundance },
    };

    // Extract Ground Space - look for "Ground Space" followed by a number
    const groundMatch = text.match(/Ground\s+Space\s*\n?\s*(\d+)/i);
    if (groundMatch) {
      result.groundCap = parseInt(groundMatch[1]);
    }

    // Extract Orbital Space
    const orbitalMatch = text.match(/Orbital\s+Space\s*\n?\s*(\d+)/i);
    if (orbitalMatch) {
      result.orbitalCap = parseInt(orbitalMatch[1]);
    }

    // More robust extraction for abundances - look for resource name followed by percentage within next few lines
    const metalMatch = text.match(/Metal[\s\S]*?(\d+)%/i);
    if (metalMatch) {
      result.abundance.metal = parseInt(metalMatch[1]);
    }

    const mineralMatch = text.match(/Mineral[\s\S]*?(\d+)%/i);
    if (mineralMatch) {
      result.abundance.mineral = parseInt(mineralMatch[1]);
    }

    const foodMatch = text.match(/Food[\s\S]*?(\d+)%/i);
    if (foodMatch) {
      result.abundance.food = parseInt(foodMatch[1]);
    }

    const energyMatch = text.match(/Energy[\s\S]*?(\d+)%/i);
    if (energyMatch) {
      result.abundance.energy = parseInt(energyMatch[1]);
    }

    return result;
  }, []);

  const handleImport = useCallback(() => {
    const parsed = parseImportData(importText);
    setAbundance(parsed.abundance);
    setSpace({ groundCap: parsed.groundCap, orbitalCap: parsed.orbitalCap });
    setImportModalOpen(false);
    setImportText('');
  }, [importText, parseImportData]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:items-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planet-modal-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-[#24142d]/95 via-[#171024]/95 to-[#0d1b2f]/95 shadow-2xl shadow-black/60 ring-1 ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 md:px-6">
          <div className="flex gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-50 shadow-lg shadow-cyan-500/10">
              <Globe2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">
                Planet setup
              </div>
              <h2 id="planet-modal-title" className="mt-1 text-2xl font-black text-pink-nebula-text">
                {mode === 'edit' ? 'Edit Planet' : 'Add New Planet'}
              </h2>
              <p className="mt-1 text-sm text-pink-nebula-muted">
                Configure start turn, abundance, space, and the starting colony package.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-pink-nebula-muted transition-all hover:border-cyan-200/40 hover:bg-white/10 hover:text-pink-nebula-text focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="scroll-nebula overflow-y-auto px-4 py-4 md:px-6 md:py-5">

        {/* Basic Settings */}
        <div className={`${PANEL_CLASS} mb-4`}>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-pink-nebula-text">
            <Rocket className="h-5 w-5 text-cyan-100" aria-hidden="true" />
            Basic Settings
          </h3>

          <div>
            <label className={LABEL_CLASS}>
              Start Turn
            </label>
            <input
              type="number"
              value={startTurn}
              onChange={(e) => setStartTurn(Math.max(minTravelStart, parseInt(e.target.value) || minTravelStart))}
              onFocus={(e) => e.target.select()}
              className={INPUT_CLASS}
              min={minTravelStart}
            />
            {mode === 'add' && startTurn < minTravelStart && (
              <p className="mt-1 text-xs text-yellow-400">Will be adjusted to T{minTravelStart} on submit.</p>
            )}
          </div>
        </div>

        {mode === 'add' && (
          <div className={`${PANEL_CLASS} mb-4`}>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-pink-nebula-text">
              <Route className="h-5 w-5 text-cyan-100" aria-hidden="true" />
              Travel
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(EXPANSION_TRAVEL_CHOICES) as ExpansionTravelChoice[]).map((choice) => {
                const selected = travelChoice === choice;
                const config = EXPANSION_TRAVEL_CHOICES[choice];
                const turns = getExpansionTravelTime(choice);
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setTravelChoice(choice)}
                    className={`rounded-xl border px-3 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-cyan-300/25 ${
                      selected
                        ? 'border-cyan-200/55 bg-cyan-300/15 text-cyan-50 shadow-lg shadow-cyan-500/10'
                        : 'border-white/10 bg-white/[0.04] text-pink-nebula-text hover:border-cyan-200/35 hover:bg-white/[0.08]'
                    }`}
                    aria-pressed={selected}
                  >
                    <span className="block text-sm font-black">
                      {config.label}
                    </span>
                    <span className="mt-1 block text-xs text-pink-nebula-muted">
                      {turns} turns travel
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-pink-nebula-muted">
              Earliest start: T{minTravelStart}
              {expansionSource === undefined
                ? <span className="ml-1 text-red-400">⚠ No spare outpost ship — build one first</span>
                : expansionSource.departureTurn > currentTurn && (
                  <span className="ml-1 text-yellow-400">⚠ outpost ship departs T{expansionSource.departureTurn}</span>
                )
              }
            </div>
          </div>
        )}

        {/* Resource Abundances */}
        <div className={`${PANEL_CLASS} mb-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-pink-nebula-text">
                <Sparkles className="h-5 w-5 text-cyan-100" aria-hidden="true" />
                Resource Abundances
              </h3>
              <p className="mt-1 text-sm text-pink-nebula-muted">
                Percentages affect production rates (50% - 200%)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('home-galaxy')}
                className={SECONDARY_BUTTON_CLASS}
              >
                Home Galaxy Avg (60%)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('free-galaxy')}
                className={SECONDARY_BUTTON_CLASS}
              >
                Free Galaxy Avg (80%)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('homeworld')}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-cyan-200/35 bg-cyan-300/15 px-3 py-2 text-xs font-black text-cyan-50 shadow-lg shadow-cyan-500/10 transition-all hover:bg-cyan-300/25 focus:outline-none focus:ring-2 focus:ring-cyan-300/25"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Homeworld (100%)
              </button>
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className={SECONDARY_BUTTON_CLASS}
              >
                <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
                Import Data
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(abundance)
              .filter(([resource]) => resource !== 'research_points')
              .map(([resource, value]) => (
                <div key={resource} className="flex items-center gap-2">
                  <label className={`w-24 text-sm capitalize ${getResourceColor(resource)}`}>
                    {resource.replace('_', ' ')}:
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => updateAbundance(resource, parseFloat(e.target.value))}
                      onBlur={(e) => validateAbundanceField(resource, parseFloat(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      className={COMPACT_INPUT_CLASS}
                      min={ABUNDANCE_LIMITS.MIN}
                      max={ABUNDANCE_LIMITS.MAX}
                      step="1"
                    />
                    <span className="text-sm text-pink-nebula-text">%</span>
                  </div>
                  <span className="text-xs text-pink-nebula-muted">
                    {value < 100 ? '(scarce)' : value > 100 ? '(rich)' : '(normal)'}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Space Budgets */}
        <div className={`${PANEL_CLASS} mb-4`}>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-pink-nebula-text">
            <Layers className="h-5 w-5 text-cyan-100" aria-hidden="true" />
            Space Budgets
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-amber-100/80">
                Ground Space Capacity
              </label>
              <input
                type="number"
                value={space.groundCap}
                onChange={(e) => setSpace(prev => ({
                  ...prev,
                  groundCap: Math.max(10, parseInt(e.target.value) || 25)
                }))}
                className={INPUT_CLASS}
                min="10"
                max="100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-sky-100/80">
                Orbital Space Capacity
              </label>
              <input
                type="number"
                value={space.orbitalCap}
                onChange={(e) => setSpace(prev => ({
                  ...prev,
                  orbitalCap: Math.max(5, parseInt(e.target.value) || 15)
                }))}
                className={INPUT_CLASS}
                min="5"
                max="50"
              />
            </div>
          </div>
        </div>

        {/* Starting Setup */}
        <div className={`${PANEL_CLASS} mb-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-lg font-black text-pink-nebula-text">
              <Users className="h-5 w-5 text-cyan-100" aria-hidden="true" />
              Starting Setup
            </h3>
            <button
              type="button"
              onClick={applyHomeworldStarting}
              className={SECONDARY_BUTTON_CLASS}
            >
              Duplicate Homeworld
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>
                Starting Pop
              </label>
              <input
                type="number"
                value={starting.workersTotal}
                onChange={(e) => updateStartingWorkers(parseInt(e.target.value, 10))}
                onFocus={(e) => e.target.select()}
                className={INPUT_CLASS}
                min="0"
                step="100"
              />
            </div>

            {STARTING_STRUCTURE_FIELDS.map(field => (
              <div key={field.id}>
                <label className={LABEL_CLASS}>
                  {field.label}
                </label>
                <input
                  type="number"
                  value={starting.structures[field.id]}
                  onChange={(e) => updateStartingStructure(field.id, parseInt(e.target.value, 10))}
                  onFocus={(e) => e.target.select()}
                  className={INPUT_CLASS}
                  min="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Starter Package Info */}
        <div className="mb-4 rounded-2xl border border-sky-200/20 bg-sky-400/10 p-4">
          <p className="text-sm text-sky-50/85">
            <span className="font-semibold">Starter Resources:</span> {STARTER_PACKAGE.METAL.toLocaleString()} metal, {STARTER_PACKAGE.MINERAL.toLocaleString()} mineral, {STARTER_PACKAGE.FOOD.toLocaleString()} food, {STARTER_PACKAGE.ENERGY} energy
          </p>
          <p className="mt-1 text-sm text-sky-50/75">
            <span className="font-semibold">Selected Start:</span> {starting.workersTotal.toLocaleString()} workers, Outpost x1, Metal Mine x{starting.structures.metal_mine}, Mineral Extractor x{starting.structures.mineral_extractor}, Farm x{starting.structures.farm}, Solar Gen x{starting.structures.solar_generator}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className={`${QUIET_BUTTON_CLASS} order-2 sm:order-1`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={`${PRIMARY_BUTTON_CLASS} order-1 sm:order-2`}
          >
            {mode === 'edit' ? <Save className="h-4 w-4" aria-hidden="true" /> : <Rocket className="h-4 w-4" aria-hidden="true" />}
            {mode === 'edit' ? 'Save Planet' : 'Add Planet'}
          </button>
        </div>
        </div>
      </div>

      {/* Import Modal */}
      {importModalOpen && (
        <div
          className="absolute inset-0 z-10 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center md:p-4"
          onClick={(event) => {
            event.stopPropagation();
            setImportModalOpen(false);
            setImportText('');
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="planet-import-title"
            className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-[#24142d]/95 via-[#171024]/95 to-[#0d1b2f]/95 shadow-2xl shadow-black/60 ring-1 ring-white/10"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 md:px-6">
              <div className="flex gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-50">
                  <Database className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200/70">Planet import</div>
                  <h3 id="planet-import-title" className="mt-1 text-2xl font-black text-pink-nebula-text">
                    Import Planet Data
                  </h3>
                  <p className="mt-1 text-sm text-pink-nebula-muted">
                    Paste planet data from your game. We extract ground/orbital space and resource abundance percentages.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setImportText('');
                }}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-pink-nebula-muted transition-all hover:border-cyan-200/40 hover:bg-white/10 hover:text-pink-nebula-text focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                aria-label="Close import"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="px-4 py-4 md:px-6 md:py-5">
            <div className="mb-4 rounded-2xl border border-sky-200/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-50/80">
              Extracts Ground Space, Orbital Space, and abundance percentages for Metal, Mineral, Food, and Energy.
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste planet data here..."
              className="h-64 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 font-mono text-sm text-pink-nebula-text outline-none transition-all placeholder:text-pink-nebula-muted/55 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-300/20"
              autoFocus
            />

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setImportText('');
                }}
                className={`${QUIET_BUTTON_CLASS} order-2 sm:order-1`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                className={`${PRIMARY_BUTTON_CLASS} order-1 sm:order-2`}
              >
                <Import className="h-4 w-4" aria-hidden="true" />
                Import
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Get Tailwind color class for a resource type
 */
function getResourceColor(resource: string): string {
  return RESOURCE_COLORS[resource as keyof typeof RESOURCE_COLORS] || 'text-pink-nebula-text';
}
