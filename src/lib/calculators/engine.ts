export type ResourceId = 'metal' | 'mineral' | 'food' | 'energy';

export interface CargoShipDef {
  id: string;
  name: string;
  metalCap: number;
  mineralCap: number;
  otherCap: number;
  scoreValue: number;
  costs: Record<ResourceId, number>;
}

export interface ShipDef {
  id: string;
  name: string;
  scoreValue: number;
  costs: Record<ResourceId, number>;
}

export interface BuildingDef {
  id: string;
  name: string;
  scoreValue: number;
  workerCost: number;
  groundSpaceCost: number;
  orbitalSpaceCost: number;
  requirements: string[];
  production: Partial<Record<ResourceId, number>>;
  productionIsAbundanceScaled: Partial<Record<ResourceId, boolean>>;
  upkeep: Partial<Record<ResourceId, number>>;
}

export interface ParsedSnapshot {
  planetName?: string;
  assetScore?: number;
  resourcesStored: Record<ResourceId, number>;
  resourcesOutput: Record<ResourceId, number>;
  abundance: Record<ResourceId, number>;
  workersTotal?: number;
  workersBusy?: number;
  workersFree?: number;
  soldiers?: number;
  scientists?: number;
  groundSpaceFree?: number;
  orbitalSpaceFree?: number;
  structures: Record<string, number>;
  ships: Record<string, number>;
  warnings: string[];
}

export interface GameDefs {
  shipsById: Record<string, ShipDef>;
  shipsByName: Record<string, ShipDef>;
  cargoShips: CargoShipDef[];
  structuresById: Record<string, BuildingDef>;
  structureNameToId: Record<string, string>;
  shipNameToId: Record<string, string>;
}

export interface CargoPlan {
  shipCounts: Record<string, number>;
  totals: {
    metalCap: number;
    mineralCap: number;
    otherCap: number;
    ships: number;
  };
  overflow: {
    metal: number;
    mineral: number;
    other: number;
  };
}

export interface FleetEntryBreakdown {
  id: string;
  name: string;
  count: number;
  scoreValue: number;
  totalScoreValue: number;
  totalDisplayedScore: number;
  weightedCost: number;
  scorePerWeightedK: number;
}

export interface FleetScoreBreakdown {
  entries: FleetEntryBreakdown[];
  totalScoreValue: number;
  totalDisplayedScore: number;
  totalCost: Record<ResourceId, number>;
  weightedCost: number;
  scorePerWeightedK: number;
}

export interface FleetBalancePlan {
  targetWeights: Record<string, number>;
  additions: Record<string, number>;
  resulting: Record<string, number>;
  scale: number;
}

export interface BuildRecommendation {
  id: string;
  name: string;
  efficiency: number;
  scoreDelta: number;
  weightedOutputDelta: number;
  outputDelta: Record<ResourceId, number>;
}

export interface BuildOptimizationResult {
  steps: BuildRecommendation[];
  finalOutputs: Record<ResourceId, number>;
  totalScoreDelta: number;
  totalWeightedOutputDelta: number;
  remaining: {
    workersFree: number;
    groundSpaceFree: number;
    orbitalSpaceFree: number;
  };
}

export interface FleetFromBudgetResult {
  multiplier: number;
  composition: Record<string, number>;
  used: Record<ResourceId, number>;
  leftover: Record<ResourceId, number>;
  nextScaleNeeds: Record<ResourceId, number>;
}

const RESOURCE_SCORE_VALUES: Record<ResourceId, number> = {
  metal: 1,
  mineral: 1.5,
  food: 2,
  energy: 2,
};

const BASE_RESOURCES: Record<ResourceId, number> = {
  metal: 0,
  mineral: 0,
  food: 0,
  energy: 0,
};

const RESOURCE_ORDER: ResourceId[] = ['metal', 'mineral', 'food', 'energy'];

const ANSI_RE = /\u001b\[[0-9;]*m/g;

function safeLower(text: string): string {
  return text.trim().toLowerCase();
}

export function parseHumanNumber(token: string): number {
  const cleaned = token.replace(/,/g, '').trim();
  if (!cleaned) {
    return 0;
  }

  const match = cleaned.match(/^([+-]?\d*\.?\d+)([KMB])?$/i);
  if (!match) {
    const direct = Number(cleaned);
    return Number.isFinite(direct) ? direct : 0;
  }

  const value = Number(match[1]);
  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'K') {
    return value * 1_000;
  }
  if (suffix === 'M') {
    return value * 1_000_000;
  }
  if (suffix === 'B') {
    return value * 1_000_000_000;
  }

  return value;
}

export function formatHumanNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return value.toFixed(0);
}

function parseFleetSpecialCapacities(special: string): { metalCap: number; mineralCap: number; otherCap: number } | null {
  const normalized = special.replace(/,/g, '');
  const match = normalized.match(/Stores up to\s+(\d+)\s+metal\s+and\s+(\d+)\s+mineral;\s+capacity of\s+(\d+)\s+shared/i);
  if (!match) {
    return null;
  }

  return {
    metalCap: Number(match[1]),
    mineralCap: Number(match[2]),
    otherCap: Number(match[3]),
  };
}

function extractResourceBlockDiscord(text: string, snapshot: ParsedSnapshot): void {
  const lineRe = /(Metal|Mineral|Food|Energy)\s+([+-]?\d[\d,.]*\s*[KMB]?)\s+([+-]\d[\d,.]*\s*[KMB]?)\/?tick\s+(\d+)%/gi;

  let match = lineRe.exec(text);
  while (match) {
    const id = safeLower(match[1]) as ResourceId;
    snapshot.resourcesStored[id] = parseHumanNumber(match[2].replace(/\s+/g, ''));
    snapshot.resourcesOutput[id] = parseHumanNumber(match[3].replace(/\s+/g, ''));
    snapshot.abundance[id] = Number(match[4]);
    match = lineRe.exec(text);
  }
}

function extractResourceBlockCtrlA(lines: string[], snapshot: ParsedSnapshot): void {
  const storedIdx = lines.findIndex((line) => safeLower(line) === 'stored');
  const outputIdx = lines.findIndex((line) => safeLower(line) === 'output');
  const abundanceIdx = lines.findIndex((line) => safeLower(line) === 'abundance');

  if (storedIdx < 0 || outputIdx < 0 || abundanceIdx < 0) {
    return;
  }

  const resources: ResourceId[] = ['metal', 'mineral', 'food', 'energy'];
  for (let i = 0; i < resources.length; i += 1) {
    const storedToken = lines[storedIdx + 1 + i] || '0';
    const outputToken = lines[outputIdx + 1 + i] || '0';
    const abundanceToken = lines[abundanceIdx + 1 + i] || '100%';

    snapshot.resourcesStored[resources[i]] = parseHumanNumber(storedToken);
    snapshot.resourcesOutput[resources[i]] = parseHumanNumber(outputToken);
    snapshot.abundance[resources[i]] = Number(abundanceToken.replace('%', '').trim()) || 100;
  }
}

function maybeReadSingleMetric(text: string, key: string): number | undefined {
  const rx = new RegExp(`${key}\\s+([+-]?\\d[\\d,.]*\\s*[KMB]?)`, 'i');
  const match = text.match(rx);
  if (!match) {
    return undefined;
  }

  return parseHumanNumber(match[1].replace(/\s+/g, ''));
}

function parseCountLines(
  lines: string[],
  knownNameToId: Record<string, string>,
): Record<string, number> {
  const out: Record<string, number> = {};

  const patterns: RegExp[] = [
    /^(\d[\d,]*)\s*[x×]\s+(.+)$/i,
    /^(.+?)\s+[x×]\s*(\d[\d,]*)$/i,
  ];

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) {
        continue;
      }

      let countToken = '';
      let nameToken = '';

      if (pattern === patterns[0]) {
        countToken = match[1];
        nameToken = match[2];
      } else {
        countToken = match[2];
        nameToken = match[1];
      }

      const normalizedName = safeLower(nameToken.replace(/\(.*\)/g, '').trim());
      const id = knownNameToId[normalizedName];
      if (!id) {
        continue;
      }

      const count = Math.max(0, Math.floor(parseHumanNumber(countToken)));
      out[id] = (out[id] || 0) + count;
      break;
    }
  }

  return out;
}

export function buildGameDefs(gameData: any): GameDefs {
  const shipsById: Record<string, ShipDef> = {};
  const shipsByName: Record<string, ShipDef> = {};
  const shipNameToId: Record<string, string> = {};
  const cargoShips: CargoShipDef[] = [];
  const structuresById: Record<string, BuildingDef> = {};
  const structureNameToId: Record<string, string> = {};

  const units: any[] = Array.isArray(gameData?.units) ? gameData.units : [];
  for (const unit of units) {
    if (unit?.category !== 'ship') {
      continue;
    }

    const costs: Record<ResourceId, number> = { ...BASE_RESOURCES };
    for (const cost of unit.cost || []) {
      if (cost?.type === 'resource' && cost.id in costs) {
        costs[cost.id as ResourceId] = Number(cost.amount || 0);
      }
    }

    const ship: ShipDef = {
      id: String(unit.id),
      name: String(unit.name),
      scoreValue: Number(unit.score_value || 0),
      costs,
    };

    shipsById[ship.id] = ship;
    shipsByName[safeLower(ship.name)] = ship;
    shipNameToId[safeLower(ship.name)] = ship.id;

    const capacities = typeof unit.special === 'string' ? parseFleetSpecialCapacities(unit.special) : null;
    if (capacities) {
      cargoShips.push({
        id: ship.id,
        name: ship.name,
        metalCap: capacities.metalCap,
        mineralCap: capacities.mineralCap,
        otherCap: capacities.otherCap,
        scoreValue: ship.scoreValue,
        costs,
      });
    }
  }

  cargoShips.sort((a, b) => b.otherCap - a.otherCap);

  const structures: any[] = Array.isArray(gameData?.structures) ? gameData.structures : [];
  for (const structure of structures) {
    const id = String(structure.id);
    const name = String(structure.name);

    const production: Partial<Record<ResourceId, number>> = {};
    const productionIsAbundanceScaled: Partial<Record<ResourceId, boolean>> = {};
    for (const entry of structure?.operations?.production || []) {
      const resource = safeLower(String(entry.type)) as ResourceId;
      if (RESOURCE_ORDER.includes(resource)) {
        production[resource] = Number(entry.base_amount || 0);
        productionIsAbundanceScaled[resource] = Boolean(entry.is_abundance_scaled);
      }
    }

    const upkeep: Partial<Record<ResourceId, number>> = {};
    for (const entry of structure?.operations?.consumption || []) {
      if (entry?.type === 'resource') {
        const resource = safeLower(String(entry.id || '')) as ResourceId;
        if (RESOURCE_ORDER.includes(resource)) {
          upkeep[resource] = Number(entry.amount || 0);
        }
      }
    }

    let groundSpaceCost = 0;
    let orbitalSpaceCost = 0;
    for (const entry of structure?.build_requirements?.space_cost || []) {
      if (entry.type === 'ground_space') {
        groundSpaceCost += Number(entry.amount || 0);
      }
      if (entry.type === 'orbital_space') {
        orbitalSpaceCost += Number(entry.amount || 0);
      }
    }

    const requirements: string[] = (structure.requirements || [])
      .filter((req: any) => req?.type === 'structure' && req?.id)
      .map((req: any) => String(req.id));

    structuresById[id] = {
      id,
      name,
      scoreValue: Number(structure.score_value || 0),
      workerCost: Number(structure?.build_requirements?.workers_occupied || 0),
      groundSpaceCost,
      orbitalSpaceCost,
      requirements,
      production,
      productionIsAbundanceScaled,
      upkeep,
    };

    structureNameToId[safeLower(name)] = id;
  }

  return {
    shipsById,
    shipsByName,
    cargoShips,
    structuresById,
    structureNameToId,
    shipNameToId,
  };
}

export function parseSnapshotInput(rawInput: string, defs: GameDefs): ParsedSnapshot {
  const warnings: string[] = [];
  const withoutAnsi = rawInput.replace(ANSI_RE, '');
  const text = withoutAnsi.replace(/\r/g, '\n');
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  const snapshot: ParsedSnapshot = {
    resourcesStored: { ...BASE_RESOURCES },
    resourcesOutput: { ...BASE_RESOURCES },
    abundance: { metal: 100, mineral: 100, food: 100, energy: 100 },
    structures: {},
    ships: {},
    warnings,
  };

  const planetMatch = text.match(/Command\s*\/\s*Planets\s*\/\s*([^\n]+)/i);
  if (planetMatch) {
    snapshot.planetName = planetMatch[1].trim();
  }

  const assetScoreMatch = text.match(/Asset Score\s+([\d.,]+\s*[KMB]?)/i);
  if (assetScoreMatch) {
    snapshot.assetScore = parseHumanNumber(assetScoreMatch[1].replace(/\s+/g, ''));
  }

  extractResourceBlockDiscord(text, snapshot);
  extractResourceBlockCtrlA(lines, snapshot);

  snapshot.workersTotal = maybeReadSingleMetric(text, 'Worker\\s+([0-9.,]+\\s*[KMB]?)\\s*\\/');
  if (!snapshot.workersTotal) {
    snapshot.workersTotal = maybeReadSingleMetric(text, 'Worker');
  }
  snapshot.workersBusy = maybeReadSingleMetric(text, 'busy\\)') || maybeReadSingleMetric(text, 'workers busy');

  const busyMatch = text.match(/\(([\d.,]+\s*[KMB]?)\s+busy\)/i);
  if (busyMatch) {
    snapshot.workersBusy = parseHumanNumber(busyMatch[1].replace(/\s+/g, ''));
  }

  if (snapshot.workersTotal !== undefined && snapshot.workersBusy !== undefined) {
    snapshot.workersFree = Math.max(0, snapshot.workersTotal - snapshot.workersBusy);
  }

  snapshot.soldiers = maybeReadSingleMetric(text, 'Soldier');
  snapshot.scientists = maybeReadSingleMetric(text, 'Scientist');
  snapshot.groundSpaceFree = maybeReadSingleMetric(text, 'Ground Space');
  snapshot.orbitalSpaceFree = maybeReadSingleMetric(text, 'Orbital Space');

  snapshot.structures = parseCountLines(lines, defs.structureNameToId);
  snapshot.ships = parseCountLines(lines, defs.shipNameToId);

  const parsedResourceCount = RESOURCE_ORDER.filter((resource) => snapshot.resourcesStored[resource] > 0 || snapshot.resourcesOutput[resource] !== 0).length;
  if (parsedResourceCount < 2) {
    warnings.push('Could not confidently parse full resource rows. You may need to paste a larger section.');
  }

  if (!Object.keys(snapshot.structures).length) {
    warnings.push('No structure counts found. Build optimizer will use empty current structures.');
  }

  if (!Object.keys(snapshot.ships).length) {
    warnings.push('No ship counts found in the paste. Fleet calculators can still use manual composition input.');
  }

  return snapshot;
}

function weightedResourceValue(resources: Record<ResourceId, number>): number {
  return (resources.metal * RESOURCE_SCORE_VALUES.metal)
    + (resources.mineral * RESOURCE_SCORE_VALUES.mineral)
    + (resources.food * RESOURCE_SCORE_VALUES.food)
    + (resources.energy * RESOURCE_SCORE_VALUES.energy);
}

function subtractResources(left: Record<ResourceId, number>, right: Record<ResourceId, number>): Record<ResourceId, number> {
  return {
    metal: left.metal - right.metal,
    mineral: left.mineral - right.mineral,
    food: left.food - right.food,
    energy: left.energy - right.energy,
  };
}

function addResources(left: Record<ResourceId, number>, right: Record<ResourceId, number>): Record<ResourceId, number> {
  return {
    metal: left.metal + right.metal,
    mineral: left.mineral + right.mineral,
    food: left.food + right.food,
    energy: left.energy + right.energy,
  };
}

export function calculateCargoPlan(snapshot: ParsedSnapshot, cargoShips: CargoShipDef[]): CargoPlan | null {
  if (!cargoShips.length) {
    return null;
  }

  const targetMetal = snapshot.resourcesStored.metal;
  const targetMineral = snapshot.resourcesStored.mineral;
  const targetOther = snapshot.resourcesStored.food + snapshot.resourcesStored.energy;

  if (targetMetal <= 0 && targetMineral <= 0 && targetOther <= 0) {
    return {
      shipCounts: {},
      totals: { metalCap: 0, mineralCap: 0, otherCap: 0, ships: 0 },
      overflow: { metal: 0, mineral: 0, other: 0 },
    };
  }

  const freighter = cargoShips[cargoShips.length - 1];
  const bestShip = cargoShips[0];
  const maxByBest = Math.ceil(
    Math.max(
      targetMetal / Math.max(1, bestShip.metalCap),
      targetMineral / Math.max(1, bestShip.mineralCap),
      targetOther / Math.max(1, bestShip.otherCap),
    ),
  ) + 8;

  let best: CargoPlan | null = null;

  const first = cargoShips[0];
  const second = cargoShips[1] || cargoShips[0];

  for (let i = 0; i <= maxByBest; i += 1) {
    for (let j = 0; j <= maxByBest; j += 1) {
      const capMetal = i * first.metalCap + j * second.metalCap;
      const capMineral = i * first.mineralCap + j * second.mineralCap;
      const capOther = i * first.otherCap + j * second.otherCap;

      const neededFreighters = Math.max(
        0,
        Math.ceil((targetMetal - capMetal) / Math.max(1, freighter.metalCap)),
        Math.ceil((targetMineral - capMineral) / Math.max(1, freighter.mineralCap)),
        Math.ceil((targetOther - capOther) / Math.max(1, freighter.otherCap)),
      );

      const totalMetal = capMetal + neededFreighters * freighter.metalCap;
      const totalMineral = capMineral + neededFreighters * freighter.mineralCap;
      const totalOther = capOther + neededFreighters * freighter.otherCap;

      const overflowMetal = Math.max(0, totalMetal - targetMetal);
      const overflowMineral = Math.max(0, totalMineral - targetMineral);
      const overflowOther = Math.max(0, totalOther - targetOther);

      const shipCounts: Record<string, number> = {};
      if (i > 0) {
        shipCounts[first.id] = i;
      }
      if (j > 0) {
        shipCounts[second.id] = (shipCounts[second.id] || 0) + j;
      }
      if (neededFreighters > 0) {
        shipCounts[freighter.id] = (shipCounts[freighter.id] || 0) + neededFreighters;
      }

      const ships = i + j + neededFreighters;
      const overflowPenalty = overflowMetal + overflowMineral + overflowOther;

      const candidate: CargoPlan = {
        shipCounts,
        totals: {
          metalCap: totalMetal,
          mineralCap: totalMineral,
          otherCap: totalOther,
          ships,
        },
        overflow: {
          metal: overflowMetal,
          mineral: overflowMineral,
          other: overflowOther,
        },
      };

      if (!best) {
        best = candidate;
        continue;
      }

      const bestPenalty = best.overflow.metal + best.overflow.mineral + best.overflow.other;
      if (overflowPenalty < bestPenalty || (overflowPenalty === bestPenalty && ships < best.totals.ships)) {
        best = candidate;
      }
    }
  }

  return best;
}

export function parseRatioInput(ratioInput: string, nameToId: Record<string, string>): Record<string, number> {
  const normalized = ratioInput
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const out: Record<string, number> = {};

  for (const token of normalized) {
    const match = token.match(/^(.+?)\s*[:=]\s*(\d*\.?\d+)$/);
    if (!match) {
      continue;
    }

    const name = safeLower(match[1]);
    const id = nameToId[name] || name;
    const weight = Number(match[2]);
    if (!Number.isFinite(weight) || weight <= 0) {
      continue;
    }

    out[id] = weight;
  }

  return out;
}

export function parseCompositionInput(compositionInput: string, nameToId: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  const lines = compositionInput.split(/\n|,/).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const matchA = line.match(/^(\d[\d,]*)\s*[x×]?\s+(.+)$/i);
    const matchB = line.match(/^(.+?)\s*[x×:]\s*(\d[\d,]*)$/i);

    let count = 0;
    let name = '';

    if (matchA) {
      count = Math.floor(parseHumanNumber(matchA[1]));
      name = safeLower(matchA[2]);
    } else if (matchB) {
      count = Math.floor(parseHumanNumber(matchB[2]));
      name = safeLower(matchB[1]);
    } else {
      continue;
    }

    const id = nameToId[name] || name;
    if (!count || count < 0) {
      continue;
    }

    out[id] = (out[id] || 0) + count;
  }

  return out;
}

export function calculateFleetScoreBreakdown(composition: Record<string, number>, shipsById: Record<string, ShipDef>): FleetScoreBreakdown {
  const entries: FleetEntryBreakdown[] = [];
  const totalCost: Record<ResourceId, number> = { ...BASE_RESOURCES };

  let totalScoreValue = 0;

  for (const [id, countRaw] of Object.entries(composition)) {
    const ship = shipsById[id];
    if (!ship) {
      continue;
    }

    const count = Math.max(0, Math.floor(countRaw));
    const shipCost: Record<ResourceId, number> = {
      metal: ship.costs.metal * count,
      mineral: ship.costs.mineral * count,
      food: ship.costs.food * count,
      energy: ship.costs.energy * count,
    };

    totalCost.metal += shipCost.metal;
    totalCost.mineral += shipCost.mineral;
    totalCost.food += shipCost.food;
    totalCost.energy += shipCost.energy;

    const totalShipScore = ship.scoreValue * count;
    totalScoreValue += totalShipScore;

    const weightedCost = weightedResourceValue(ship.costs);
    const scorePerWeightedK = weightedCost > 0 ? ship.scoreValue / (weightedCost / 1000) : 0;

    entries.push({
      id: ship.id,
      name: ship.name,
      count,
      scoreValue: ship.scoreValue,
      totalScoreValue: totalShipScore,
      totalDisplayedScore: totalShipScore / 1000,
      weightedCost,
      scorePerWeightedK,
    });
  }

  entries.sort((a, b) => b.totalScoreValue - a.totalScoreValue);

  const weightedCost = weightedResourceValue(totalCost);
  const totalDisplayedScore = totalScoreValue / 1000;

  return {
    entries,
    totalScoreValue,
    totalDisplayedScore,
    totalCost,
    weightedCost,
    scorePerWeightedK: weightedCost > 0 ? totalScoreValue / (weightedCost / 1000) : 0,
  };
}

export function calculateFleetBalancePlan(current: Record<string, number>, targetWeights: Record<string, number>): FleetBalancePlan {
  const filteredWeights = Object.entries(targetWeights)
    .filter(([, weight]) => Number.isFinite(weight) && weight > 0)
    .reduce<Record<string, number>>((acc, [id, weight]) => {
      acc[id] = weight;
      return acc;
    }, {});

  if (!Object.keys(filteredWeights).length) {
    return {
      targetWeights: {},
      additions: {},
      resulting: { ...current },
      scale: 0,
    };
  }

  let minScale = 0;
  for (const [id, weight] of Object.entries(filteredWeights)) {
    const count = current[id] || 0;
    minScale = Math.max(minScale, count / weight);
  }

  const additions: Record<string, number> = {};
  const resulting: Record<string, number> = { ...current };

  for (const [id, weight] of Object.entries(filteredWeights)) {
    const target = Math.ceil(minScale * weight);
    const currentCount = current[id] || 0;
    const needed = Math.max(0, target - currentCount);
    additions[id] = needed;
    resulting[id] = currentCount + needed;
  }

  return {
    targetWeights: filteredWeights,
    additions,
    resulting,
    scale: minScale,
  };
}

function buildingIsAvailable(def: BuildingDef, built: Record<string, number>): boolean {
  for (const req of def.requirements) {
    if ((built[req] || 0) <= 0) {
      return false;
    }
  }

  return true;
}

function computeBuildingOutputDelta(def: BuildingDef, abundance: Record<ResourceId, number>): Record<ResourceId, number> {
  const out: Record<ResourceId, number> = { ...BASE_RESOURCES };

  for (const resource of RESOURCE_ORDER) {
    const baseProduction = def.production[resource] || 0;
    if (baseProduction > 0) {
      const scale = def.productionIsAbundanceScaled[resource] ? (abundance[resource] || 100) / 100 : 1;
      out[resource] += baseProduction * scale;
    }

    const upkeep = def.upkeep[resource] || 0;
    if (upkeep > 0) {
      out[resource] -= upkeep;
    }
  }

  return out;
}

export function optimizeBuildForScore(snapshot: ParsedSnapshot, structuresById: Record<string, BuildingDef>, maxSteps: number): BuildOptimizationResult {
  const built = { ...snapshot.structures };
  const currentOutputs = { ...snapshot.resourcesOutput };

  let workersFree = snapshot.workersFree ?? 0;
  let groundSpaceFree = snapshot.groundSpaceFree ?? 0;
  let orbitalSpaceFree = snapshot.orbitalSpaceFree ?? 0;

  const steps: BuildRecommendation[] = [];
  let totalScoreDelta = 0;
  let totalWeightedOutputDelta = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    let best: BuildRecommendation | null = null;

    for (const def of Object.values(structuresById)) {
      if (!def.scoreValue || def.scoreValue <= 0) {
        continue;
      }
      if (!buildingIsAvailable(def, built)) {
        continue;
      }
      if (def.workerCost > workersFree) {
        continue;
      }
      if (def.groundSpaceCost > groundSpaceFree) {
        continue;
      }
      if (def.orbitalSpaceCost > orbitalSpaceFree) {
        continue;
      }

      const outputDelta = computeBuildingOutputDelta(def, snapshot.abundance);
      const weightedOutputDelta = weightedResourceValue(outputDelta);
      if (weightedOutputDelta <= 0) {
        continue;
      }

      const efficiency = weightedOutputDelta / def.scoreValue;

      const candidate: BuildRecommendation = {
        id: def.id,
        name: def.name,
        efficiency,
        scoreDelta: def.scoreValue,
        weightedOutputDelta,
        outputDelta,
      };

      if (!best || candidate.efficiency > best.efficiency) {
        best = candidate;
      }
    }

    if (!best) {
      break;
    }

    steps.push(best);
    built[best.id] = (built[best.id] || 0) + 1;

    currentOutputs.metal += best.outputDelta.metal;
    currentOutputs.mineral += best.outputDelta.mineral;
    currentOutputs.food += best.outputDelta.food;
    currentOutputs.energy += best.outputDelta.energy;

    const def = structuresById[best.id];
    workersFree -= def.workerCost;
    groundSpaceFree -= def.groundSpaceCost;
    orbitalSpaceFree -= def.orbitalSpaceCost;

    totalScoreDelta += best.scoreDelta;
    totalWeightedOutputDelta += best.weightedOutputDelta;
  }

  return {
    steps,
    finalOutputs: currentOutputs,
    totalScoreDelta,
    totalWeightedOutputDelta,
    remaining: {
      workersFree,
      groundSpaceFree,
      orbitalSpaceFree,
    },
  };
}

function canAfford(resources: Record<ResourceId, number>, costs: Record<ResourceId, number>): boolean {
  return RESOURCE_ORDER.every((resource) => resources[resource] >= costs[resource]);
}

function multiplyResources(base: Record<ResourceId, number>, multiplier: number): Record<ResourceId, number> {
  return {
    metal: base.metal * multiplier,
    mineral: base.mineral * multiplier,
    food: base.food * multiplier,
    energy: base.energy * multiplier,
  };
}

export function fleetFromBudget(
  available: Record<ResourceId, number>,
  selectedRatio: Record<string, number>,
  shipsById: Record<string, ShipDef>,
): FleetFromBudgetResult {
  const ids = Object.keys(selectedRatio).filter((id) => selectedRatio[id] > 0 && shipsById[id]);

  if (!ids.length) {
    return {
      multiplier: 0,
      composition: {},
      used: { ...BASE_RESOURCES },
      leftover: { ...available },
      nextScaleNeeds: { ...BASE_RESOURCES },
    };
  }

  const bundleCosts: Record<ResourceId, number> = { ...BASE_RESOURCES };
  for (const id of ids) {
    const weight = selectedRatio[id];
    const ship = shipsById[id];
    bundleCosts.metal += ship.costs.metal * weight;
    bundleCosts.mineral += ship.costs.mineral * weight;
    bundleCosts.food += ship.costs.food * weight;
    bundleCosts.energy += ship.costs.energy * weight;
  }

  let low = 0;
  let high = 1;
  while (canAfford(available, multiplyResources(bundleCosts, high))) {
    high *= 2;
    if (high > 1_000_000) {
      break;
    }
  }

  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (canAfford(available, multiplyResources(bundleCosts, mid))) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const multiplier = low;
  const composition: Record<string, number> = {};
  for (const id of ids) {
    composition[id] = Math.floor(selectedRatio[id] * multiplier);
  }

  const used = multiplyResources(bundleCosts, multiplier);
  const leftover = subtractResources(available, used);
  const nextScaleNeeds = subtractResources(multiplyResources(bundleCosts, multiplier + 1), available);

  return {
    multiplier,
    composition,
    used,
    leftover,
    nextScaleNeeds: {
      metal: Math.max(0, nextScaleNeeds.metal),
      mineral: Math.max(0, nextScaleNeeds.mineral),
      food: Math.max(0, nextScaleNeeds.food),
      energy: Math.max(0, nextScaleNeeds.energy),
    },
  };
}

export function projectAvailableResources(snapshot: ParsedSnapshot, ticks: number): Record<ResourceId, number> {
  const outputProjection: Record<ResourceId, number> = {
    metal: snapshot.resourcesOutput.metal * ticks,
    mineral: snapshot.resourcesOutput.mineral * ticks,
    food: snapshot.resourcesOutput.food * ticks,
    energy: snapshot.resourcesOutput.energy * ticks,
  };

  const projected = addResources(snapshot.resourcesStored, outputProjection);

  return {
    metal: Math.max(0, projected.metal),
    mineral: Math.max(0, projected.mineral),
    food: Math.max(0, projected.food),
    energy: Math.max(0, projected.energy),
  };
}
