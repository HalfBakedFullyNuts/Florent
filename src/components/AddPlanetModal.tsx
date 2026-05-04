"use client";

import React, { useState, useCallback, useEffect } from 'react';
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

const STARTING_STRUCTURE_FIELDS: Array<{
  id: keyof PlanetStartingSettings['structures'];
  label: string;
}> = [
  { id: 'metal_mine', label: 'Metal Mines' },
  { id: 'mineral_extractor', label: 'Mineral Extractors' },
  { id: 'farm', label: 'Farms' },
  { id: 'solar_generator', label: 'Solar Gens' },
];

interface AddPlanetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlanet: (config: PlanetConfig) => boolean | void;
  currentTurn: number;
  initialConfig?: PlanetConfig;
  mode?: 'add' | 'edit';
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
}: AddPlanetModalProps) {
  const [name, setName] = useState(initialConfig?.name ?? 'Colony');
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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(initialConfig?.name ?? 'Colony');
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
  }, [isOpen, currentTurn, initialConfig]);

  const handleSubmit = useCallback(() => {
    // Validate and clamp all abundances before submitting
    const validatedAbundance = validateAllAbundances(abundance);

    // Convert percentages to multipliers (100% = 1.0)
    const abundanceMultipliers = Object.fromEntries(
      Object.entries(validatedAbundance).map(([key, value]) => [key, value / 100])
    );

    const added = onAddPlanet({
      name,
      startTurn,
      abundance: abundanceMultipliers as typeof abundance,
      space,
      starting: normalizePlanetStarting(starting),
    });
    if (added !== false) onClose();
  }, [name, startTurn, abundance, space, starting, onAddPlanet, onClose]);

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-pink-nebula-panel border-2 border-pink-nebula-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-pink-nebula-accent-primary mb-6">
          {mode === 'edit' ? 'Edit Planet' : 'Add New Planet'}
        </h2>

        {/* Basic Settings */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-pink-nebula-text mb-3">
            Basic Settings
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-pink-nebula-text-secondary mb-1">
                Planet Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none"
                placeholder="Enter planet name"
              />
            </div>

            <div>
              <label className="block text-sm text-pink-nebula-text-secondary mb-1">
                Start Turn
              </label>
              <input
                type="number"
                value={startTurn}
                onChange={(e) => setStartTurn(Math.max(1, parseInt(e.target.value) || 1))}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none"
                min="1"
              />
            </div>
          </div>
        </div>

        {/* Resource Abundances */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-pink-nebula-text">
                Resource Abundances
              </h3>
              <p className="text-sm text-pink-nebula-text-secondary">
                Percentages affect production rates (50% - 200%)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => applyPreset('home-galaxy')}
                className="px-3 py-1 text-xs bg-slate-700 text-pink-nebula-text rounded hover:bg-slate-600 transition-colors"
              >
                Home Galaxy Avg (60%)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('free-galaxy')}
                className="px-3 py-1 text-xs bg-slate-700 text-pink-nebula-text rounded hover:bg-slate-600 transition-colors"
              >
                Free Galaxy Avg (80%)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('homeworld')}
                className="px-3 py-1 text-xs bg-pink-nebula-accent-primary text-white rounded hover:bg-pink-500 transition-colors"
              >
                Homeworld (100%)
              </button>
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="px-3 py-1 text-xs bg-slate-700 text-pink-nebula-text rounded hover:bg-slate-600 transition-colors"
              >
                Import Data
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                      className="w-16 px-2 py-1 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none text-right"
                      min={ABUNDANCE_LIMITS.MIN}
                      max={ABUNDANCE_LIMITS.MAX}
                      step="1"
                    />
                    <span className="text-sm text-pink-nebula-text">%</span>
                  </div>
                  <span className="text-xs text-pink-nebula-text-secondary">
                    {value < 100 ? '(scarce)' : value > 100 ? '(rich)' : '(normal)'}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Space Budgets */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-pink-nebula-text mb-3">
            Space Budgets
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-amber-700 mb-1">
                Ground Space Capacity
              </label>
              <input
                type="number"
                value={space.groundCap}
                onChange={(e) => setSpace(prev => ({
                  ...prev,
                  groundCap: Math.max(10, parseInt(e.target.value) || 25)
                }))}
                className="w-full px-3 py-2 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none"
                min="10"
                max="100"
              />
            </div>

            <div>
              <label className="block text-sm text-blue-800 mb-1">
                Orbital Space Capacity
              </label>
              <input
                type="number"
                value={space.orbitalCap}
                onChange={(e) => setSpace(prev => ({
                  ...prev,
                  orbitalCap: Math.max(5, parseInt(e.target.value) || 15)
                }))}
                className="w-full px-3 py-2 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none"
                min="5"
                max="50"
              />
            </div>
          </div>
        </div>

        {/* Starting Setup */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-pink-nebula-text">
              Starting Setup
            </h3>
            <button
              type="button"
              onClick={applyHomeworldStarting}
              className="px-3 py-1 text-xs bg-pink-nebula-accent-primary text-white rounded hover:bg-pink-500 transition-colors"
            >
              Duplicate Homeworld
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-pink-nebula-text-secondary mb-1">
                Starting Pop
              </label>
              <input
                type="number"
                value={starting.workersTotal}
                onChange={(e) => updateStartingWorkers(parseInt(e.target.value, 10))}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none"
                min="0"
                step="100"
              />
            </div>

            {STARTING_STRUCTURE_FIELDS.map(field => (
              <div key={field.id}>
                <label className="block text-sm text-pink-nebula-text-secondary mb-1">
                  {field.label}
                </label>
                <input
                  type="number"
                  value={starting.structures[field.id]}
                  onChange={(e) => updateStartingStructure(field.id, parseInt(e.target.value, 10))}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-3 py-2 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none"
                  min="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Starter Package Info */}
        <div className="mb-6 p-3 bg-slate-800 rounded border border-pink-nebula-border">
          <p className="text-sm text-pink-nebula-text-secondary">
            <span className="font-semibold">Starter Resources:</span> {STARTER_PACKAGE.METAL.toLocaleString()} metal, {STARTER_PACKAGE.MINERAL.toLocaleString()} mineral, {STARTER_PACKAGE.FOOD.toLocaleString()} food, {STARTER_PACKAGE.ENERGY} energy
          </p>
          <p className="text-sm text-pink-nebula-text-secondary mt-1">
            <span className="font-semibold">Selected Start:</span> {starting.workersTotal.toLocaleString()} workers, Outpost x1, Metal Mine x{starting.structures.metal_mine}, Mineral Extractor x{starting.structures.mineral_extractor}, Farm x{starting.structures.farm}, Solar Gen x{starting.structures.solar_generator}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 text-pink-nebula-text rounded-lg hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-pink-nebula-accent-primary text-white rounded-lg hover:bg-pink-500 transition-colors"
          >
            {mode === 'edit' ? 'Save Planet' : 'Add Planet'}
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
          <div className="bg-pink-nebula-panel border-2 border-pink-nebula-border rounded-lg p-6 max-w-3xl w-full mx-4">
            <h3 className="text-xl font-bold text-pink-nebula-accent-primary mb-4">
              Import Planet Data
            </h3>

            <p className="text-sm text-pink-nebula-text-secondary mb-3">
              Paste planet data from your game. The import will extract:
            </p>
            <ul className="text-sm text-pink-nebula-text-secondary mb-4 list-disc list-inside">
              <li>Ground Space and Orbital Space</li>
              <li>Resource abundance percentages (Metal, Mineral, Food, Energy)</li>
            </ul>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste planet data here..."
              className="w-full h-64 px-3 py-2 bg-slate-800 text-pink-nebula-text rounded border border-pink-nebula-border focus:border-pink-nebula-accent-primary outline-none font-mono text-sm"
              autoFocus
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setImportModalOpen(false);
                  setImportText('');
                }}
                className="px-6 py-2 bg-slate-700 text-pink-nebula-text rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-6 py-2 bg-pink-nebula-accent-primary text-white rounded-lg hover:bg-pink-500 transition-colors"
              >
                Import
              </button>
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
