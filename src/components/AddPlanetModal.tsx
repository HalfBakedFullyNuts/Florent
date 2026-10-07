"use client";

import React, { useState, useCallback, useEffect, useId } from 'react';
import {
  AlertTriangle,
  ClipboardPaste,
  Globe2,
  Home,
  Import,
  Layers,
  Route,
  Rocket,
  Save,
  Sparkles,
  Users,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  ABUNDANCE_LIMITS,
  DEFAULT_SPACE,
  DEFAULT_ADDED_PLANET_STARTING,
  HOMEWORLD_PLANET_STARTING,
  PLANET_PRESETS,
  STARTER_PACKAGE,
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

const SECTION_CLASS = 'border-b border-filament pb-5 mb-5 last:mb-0 last:border-b-0 last:pb-0';
const LABEL_CLASS = 'eyebrow mb-1.5 block';

const RESOURCE_TEXT: Record<string, string> = {
  metal: 'text-res-metal',
  mineral: 'text-res-mineral',
  food: 'text-res-food',
  energy: 'text-res-energy',
  research_points: 'text-res-rp',
};

type AbundanceState = PlanetConfig['abundance'];
type SpaceState = PlanetConfig['space'];

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

  const closeImport = useCallback(() => {
    setImportModalOpen(false);
    setImportText('');
  }, []);

  if (!isOpen) return null;

  return (
    <Modal
      onClose={onClose}
      eyebrow="Planet setup"
      title={mode === 'edit' ? 'Edit planet' : 'Add new planet'}
      titleId="planet-modal-title"
      description="Configure start turn, abundance, space, and the starting colony package."
      icon={<Globe2 className="h-5 w-5" />}
      widthClass="max-w-3xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} className="btn btn-primary">
            {mode === 'edit' ? <Save aria-hidden="true" /> : <Rocket aria-hidden="true" />}
            {mode === 'edit' ? 'Save planet' : 'Add planet'}
          </button>
        </>
      }
    >
      <StartTurnSection
        startTurn={startTurn}
        minTravelStart={minTravelStart}
        showAdjustNote={mode === 'add' && startTurn < minTravelStart}
        onChange={(value) => setStartTurn(Math.max(minTravelStart, value || minTravelStart))}
      />

      {mode === 'add' && (
        <TravelSection
          travelChoice={travelChoice}
          onSelect={setTravelChoice}
          minTravelStart={minTravelStart}
          expansionSource={expansionSource}
          currentTurn={currentTurn}
        />
      )}

      <AbundanceSection
        abundance={abundance}
        onPreset={applyPreset}
        onOpenImport={() => setImportModalOpen(true)}
        onChange={updateAbundance}
        onBlur={validateAbundanceField}
      >
        {importModalOpen && (
          <ImportPanel
            value={importText}
            onChange={setImportText}
            onCancel={closeImport}
            onImport={handleImport}
          />
        )}
      </AbundanceSection>

      <SpaceSection space={space} onChange={setSpace} />

      <StartingSection
        starting={starting}
        onWorkersChange={updateStartingWorkers}
        onStructureChange={updateStartingStructure}
        onDuplicateHomeworld={applyHomeworldStarting}
      />

      <StarterSummary starting={starting} />
    </Modal>
  );
}

function SectionHeading({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-ink-3" aria-hidden="true">{icon}</span>
      <h3 className="panel-title">{title}</h3>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

function StartTurnSection({
  startTurn,
  minTravelStart,
  showAdjustNote,
  onChange,
}: {
  startTurn: number;
  minTravelStart: number;
  showAdjustNote: boolean;
  onChange: (value: number) => void;
}) {
  const inputId = useId();
  return (
    <section className={SECTION_CLASS}>
      <SectionHeading icon={<Rocket className="h-4 w-4" />} title="Basic settings" />
      <label htmlFor={inputId} className={LABEL_CLASS}>Start turn</label>
      <input
        id={inputId}
        type="number"
        value={startTurn}
        onChange={(e) => onChange(parseInt(e.target.value))}
        onFocus={(e) => e.target.select()}
        className="field sm:max-w-48"
        min={minTravelStart}
      />
      {showAdjustNote && (
        <p className="mt-1.5 text-xs text-caution">Will be adjusted to T{minTravelStart} on submit.</p>
      )}
    </section>
  );
}

function TravelSection({
  travelChoice,
  onSelect,
  minTravelStart,
  expansionSource,
  currentTurn,
}: {
  travelChoice: ExpansionTravelChoice;
  onSelect: (choice: ExpansionTravelChoice) => void;
  minTravelStart: number;
  expansionSource?: BestExpansionSource;
  currentTurn: number;
}) {
  return (
    <section className={SECTION_CLASS}>
      <SectionHeading icon={<Route className="h-4 w-4" />} title="Travel" />
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(EXPANSION_TRAVEL_CHOICES) as ExpansionTravelChoice[]).map((choice) => {
          const selected = travelChoice === choice;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => onSelect(choice)}
              aria-pressed={selected}
              className={`rounded-ctl border bg-veil px-3 py-2.5 text-left transition-colors ${
                selected ? 'border-oiii' : 'border-filament hover:border-edge'
              }`}
            >
              <span className="block text-sm font-semibold text-ink">
                {EXPANSION_TRAVEL_CHOICES[choice].label}
              </span>
              <span className="mt-0.5 block text-xs text-ink-2">
                {getExpansionTravelTime(choice)} turns travel
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        <span>Earliest start: T{minTravelStart}</span>
        {expansionSource === undefined ? (
          <span className="inline-flex items-center gap-1 text-danger">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            No spare outpost ship — build one first
          </span>
        ) : expansionSource.departureTurn > currentTurn && (
          <span className="inline-flex items-center gap-1 text-caution">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Outpost ship departs T{expansionSource.departureTurn}
          </span>
        )}
      </div>
    </section>
  );
}

function AbundanceSection({
  abundance,
  onPreset,
  onOpenImport,
  onChange,
  onBlur,
  children,
}: {
  abundance: AbundanceState;
  onPreset: (preset: string) => void;
  onOpenImport: () => void;
  onChange: (resource: string, value: number) => void;
  onBlur: (resource: string, value: number) => void;
  children?: React.ReactNode;
}) {
  const idPrefix = useId();
  return (
    <section className={SECTION_CLASS}>
      <SectionHeading icon={<Sparkles className="h-4 w-4" />} title="Resource abundances" />
      <p className="-mt-2 mb-3 text-sm text-ink-2">Percentages affect production rates (50% - 200%)</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onPreset('home-galaxy')} className="btn btn-secondary btn-sm">
          Home galaxy avg (60%)
        </button>
        <button type="button" onClick={() => onPreset('free-galaxy')} className="btn btn-secondary btn-sm">
          Free galaxy avg (80%)
        </button>
        <button type="button" onClick={() => onPreset('homeworld')} className="btn btn-secondary btn-sm">
          <Home aria-hidden="true" />
          Homeworld (100%)
        </button>
        <button type="button" onClick={onOpenImport} className="btn btn-ghost btn-sm">
          <ClipboardPaste aria-hidden="true" />
          Import data
        </button>
      </div>
      {children}
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {Object.entries(abundance)
          .filter(([resource]) => resource !== 'research_points')
          .map(([resource, value]) => (
            <div key={resource} className="flex items-center gap-2">
              <label
                htmlFor={`${idPrefix}-${resource}`}
                className={`w-20 text-sm font-semibold capitalize ${RESOURCE_TEXT[resource] ?? 'text-ink'}`}
              >
                {resource.replace('_', ' ')}
              </label>
              <input
                id={`${idPrefix}-${resource}`}
                type="number"
                value={value}
                onChange={(e) => onChange(resource, parseFloat(e.target.value))}
                onBlur={(e) => onBlur(resource, parseFloat(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="field field-sm w-20 text-right"
                min={ABUNDANCE_LIMITS.MIN}
                max={ABUNDANCE_LIMITS.MAX}
                step="1"
              />
              <span className="text-sm text-ink-2">%</span>
              <span className="text-xs text-ink-3">
                {value < 100 ? 'scarce' : value > 100 ? 'rich' : 'normal'}
              </span>
            </div>
          ))}
      </div>
    </section>
  );
}

function ImportPanel({
  value,
  onChange,
  onCancel,
  onImport,
}: {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onImport: () => void;
}) {
  const textareaId = useId();
  return (
    <div role="group" aria-labelledby={`${textareaId}-title`} className="well mb-4 p-4">
      <div id={`${textareaId}-title`} className="panel-title">Import planet data</div>
      <p className="mt-1 text-sm text-ink-2">
        Paste planet data from your game. Ground space, orbital space and the metal, mineral, food
        and energy abundance percentages are extracted.
      </p>
      <label htmlFor={textareaId} className="sr-only">Planet data</label>
      <textarea
        id={textareaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste planet data here..."
        className="field mt-3 h-48 resize-y py-2 font-mono text-sm"
        autoFocus
      />
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm">
          Cancel
        </button>
        <button type="button" onClick={onImport} className="btn btn-primary btn-sm">
          <Import aria-hidden="true" />
          Import
        </button>
      </div>
    </div>
  );
}

function SpaceSection({
  space,
  onChange,
}: {
  space: SpaceState;
  onChange: React.Dispatch<React.SetStateAction<SpaceState>>;
}) {
  const groundId = useId();
  const orbitalId = useId();
  return (
    <section className={SECTION_CLASS}>
      <SectionHeading icon={<Layers className="h-4 w-4" />} title="Space budgets" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={groundId} className={`${LABEL_CLASS} text-res-ground`}>Ground space capacity</label>
          <input
            id={groundId}
            type="number"
            value={space.groundCap}
            onChange={(e) => onChange(prev => ({
              ...prev,
              groundCap: Math.max(10, parseInt(e.target.value) || 25)
            }))}
            className="field"
            min="10"
            max="100"
          />
        </div>
        <div>
          <label htmlFor={orbitalId} className={`${LABEL_CLASS} text-res-orbital`}>Orbital space capacity</label>
          <input
            id={orbitalId}
            type="number"
            value={space.orbitalCap}
            onChange={(e) => onChange(prev => ({
              ...prev,
              orbitalCap: Math.max(5, parseInt(e.target.value) || 15)
            }))}
            className="field"
            min="5"
            max="50"
          />
        </div>
      </div>
    </section>
  );
}

function StartingSection({
  starting,
  onWorkersChange,
  onStructureChange,
  onDuplicateHomeworld,
}: {
  starting: PlanetStartingSettings;
  onWorkersChange: (value: number) => void;
  onStructureChange: (id: keyof PlanetStartingSettings['structures'], value: number) => void;
  onDuplicateHomeworld: () => void;
}) {
  const idPrefix = useId();
  return (
    <section className={SECTION_CLASS}>
      <SectionHeading
        icon={<Users className="h-4 w-4" />}
        title="Starting setup"
        action={
          <button type="button" onClick={onDuplicateHomeworld} className="btn btn-secondary btn-sm">
            Duplicate homeworld
          </button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={`${idPrefix}-workers`} className={LABEL_CLASS}>Starting pop</label>
          <input
            id={`${idPrefix}-workers`}
            type="number"
            value={starting.workersTotal}
            onChange={(e) => onWorkersChange(parseInt(e.target.value, 10))}
            onFocus={(e) => e.target.select()}
            className="field"
            min="0"
            step="100"
          />
        </div>
        {STARTING_STRUCTURE_FIELDS.map(field => (
          <div key={field.id}>
            <label htmlFor={`${idPrefix}-${field.id}`} className={`${LABEL_CLASS} truncate`}>{field.label}</label>
            <input
              id={`${idPrefix}-${field.id}`}
              type="number"
              value={starting.structures[field.id]}
              onChange={(e) => onStructureChange(field.id, parseInt(e.target.value, 10))}
              onFocus={(e) => e.target.select()}
              className="field"
              min="0"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function StarterSummary({ starting }: { starting: PlanetStartingSettings }) {
  return (
    <div className="well space-y-1 px-4 py-3 text-sm text-ink-2">
      <p>
        <span className="font-semibold text-ink">Starter resources:</span>{' '}
        {STARTER_PACKAGE.METAL.toLocaleString()} metal, {STARTER_PACKAGE.MINERAL.toLocaleString()} mineral,{' '}
        {STARTER_PACKAGE.FOOD.toLocaleString()} food, {STARTER_PACKAGE.ENERGY} energy
      </p>
      <p>
        <span className="font-semibold text-ink">Selected start:</span>{' '}
        {starting.workersTotal.toLocaleString()} workers, Outpost x1, Metal Mine x{starting.structures.metal_mine},
        Mineral Extractor x{starting.structures.mineral_extractor}, Farm x{starting.structures.farm},
        Solar Gen x{starting.structures.solar_generator}
      </p>
    </div>
  );
}
