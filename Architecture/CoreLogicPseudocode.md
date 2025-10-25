// ========== Core Types ==========
type ResourceId = 'metal' | 'mineral' | 'food' | 'energy' | string;
type LaneId = 'building' | 'ship' | 'colonist';
type UnitType = 'structure' | 'ship' | 'soldier' | 'scientist';
type Status = 'pending' | 'active' | 'completed'; // blocked/canceled are not states

interface AbundanceMap { [r in ResourceId]?: number }
interface Stocks { [r in ResourceId]?: number }
interface OutputVector { [r in ResourceId]?: number }

interface Costs {
  resources: Stocks;
  workersToReserve: number;
  // Structures may use space; units (ships/colonists) do NOT.
  spaceGround?: number;
  spaceOrbital?: number;
}

interface Upkeep {
  energyPerUnit?: number; // e.g., mines "cost" energy output per turn
  // Add other upkeep hooks if needed (no upkeep for soldiers/scientists per your rule)
}

interface EffectsOnComplete {
  counts?: Record<string, number>;
  housingDelta?: Partial<Record<'worker' | 'soldier' | 'scientist', number>>;
  spaceDelta?: { ground?: number; orbital?: number };
  baseOutputsPerUnit?: OutputVector; // pre-abundance
}

interface ItemDefinition {
  id: string;
  type: UnitType;             // 'structure' | 'ship' | 'soldier' | 'scientist'
  lane: LaneId;               // 'building' | 'ship' | 'colonist'
  durationTurns: number;
  batchable: boolean;         // true for ship/soldier/scientist, false for structure
  requires: string[];         // structures/flags needed to queue
  costsPerUnit: Costs;
  upkeepPerUnit?: Upkeep;     // e.g., energy upkeep for production structures
  effectsOnComplete?: EffectsOnComplete;
  colonistKind?: 'soldier' | 'scientist'; // only for colonist items
}

interface WorkItem {
  defId: string;
  requestedQty: number;       // 1 for structures
  finalQty: number;           // set at activation
  status: Status;
  turnsRemaining: number;     // set when active
  reservedWorkers: number;    // set at activation
  paidResources: Stocks;      // set at activation
  reservedSpace: { ground: number; orbital: number }; // structures only
}

interface LaneState {
  active: WorkItem | null;
  backlog: WorkItem[];        // FIFO of pending entries
  concurrency: 1;
}

interface HousingCaps { worker: number; soldier?: number; scientist?: number }

interface Population {
  workersTotal: number;
  workersIdle: number;                      // total - busy
  busyByLane: Record<LaneId, number>;       // reserved workers per lane
  soldiers: number;
  scientists: number;
}

interface SpaceState {
  groundUsed: number; groundCap: number;
  orbitalUsed: number; orbitalCap: number;
}

interface Counts {
  structures: Record<string, number>;
  ships: Record<string, number>;
}

interface PlanetState {
  turn: number;
  defs: Record<string, ItemDefinition>;
  abundance: AbundanceMap;

  stocks: Stocks;                 // includes energy; no caps
  outputsPerTurn: OutputVector;   // recomputed each turn (net of upkeep)
  population: Population;
  housing: HousingCaps;
  space: SpaceState;
  counts: Counts;

  lanes: Record<LaneId, LaneState>;

  growthBonusPct: number;         // 0.005 per leisure/hospital
  pendingColonistConversions: WorkItem[]; // from this turn's completions in colonist lane
}

// ========== Queueing (editor-time) ==========
function canQueue(state: PlanetState, def: ItemDefinition, requestedQty: number): { ok: boolean; reason?: string } {
  // Disallow queue entries that would be impossible by static rules.
  if (!hasPrereqs(state, def))              return { ok: false, reason: 'REQ_MISSING' };
  if (!energyNonNegativeAfterCompletion(state, def, def.batchable ? requestedQty : 1))
    return { ok: false, reason: 'ENERGY_NEG_AFTER_COMPLETION' };

  // Colonists require housing cap to exist already (for requested qty).
  if (def.colonistKind && !housingExistsForColonist(state, def, requestedQty))
    return { ok: false, reason: 'HOUSING_CAP' };

  // Structures may be limited by space caps (units don't use space).
  if (!spaceCapsAllow(state, def, requestedQty)) return { ok: false, reason: 'NO_SPACE' };

  return { ok: true };
}

function queueItem(state: PlanetState, defId: string, requestedQty: number): void {
  const def = state.defs[defId];
  const check = canQueue(state, def, requestedQty);
  if (!check.ok) throw new Error(check.reason); // cannot queue

  const wi: WorkItem = {
    defId,
    requestedQty,
    finalQty: 0,
    status: 'pending',
    turnsRemaining: 0,
    reservedWorkers: 0,
    paidResources: {},
    reservedSpace: { ground: 0, orbital: 0 }
  };
  state.lanes[def.lane].backlog.push(wi);
}

// ========== Turn sequencing (strict end-of-turn model) ==========
// Order: 1) buildings -> 2) ships -> 3) colonists -> 4) colonist conversions
// -> 5) resource production to stocks -> 6) worker growth -> 7) worker food upkeep
function runTurn(stateT: PlanetState): PlanetState {
  const S = clone(stateT);

  // Start-of-turn: apply non-colonist completions from T-1
  applyQueuedStartOfTurnCompletions(S);
  S.growthBonusPct = computeGrowthBonus(S); // 0.005 per leisure/hospital

  // 1) Buildings
  tryActivateNext(S, 'building');
  progressActive(S, 'building');

  // 2) Ships
  tryActivateNext(S, 'ship');
  progressActive(S, 'ship');

  // 3) Colonists
  tryActivateNext(S, 'colonist');
  progressActive(S, 'colonist');

  // 4) Colonist conversions (refund n-1 workers per unit; convert 1 to colonist)
  applyColonistConversions(S);

  // 5) Resource production (abundance scaling, net of upkeep) into stocks (no caps)
  const net = computeNetOutputsPerTurn(S);
  addOutputsToStocks(S, net);

  // 6) Worker growth (only if food > 0 after production)
  if ((S.stocks.food ?? 0) > 0) {
    const base = 0.01; // 1%
    const growthPct = base + S.growthBonusPct;
    const growth = Math.floor(S.population.workersTotal * growthPct);
    S.population.workersTotal += growth;
    S.population.workersIdle  += growth;
    recordGrowthHint(S, growth);
  } else {
    recordGrowthHint(S, 0);
  }

  // 7) Worker food upkeep (cannot drop below 0)
  const foodUse = foodUpkeepForWorkers(S); // 0.002 per worker
  S.stocks.food = Math.max(0, (S.stocks.food ?? 0) - foodUse);

  S.turn = stateT.turn + 1;
  return S;
}

// ========== Lane operations ==========
function tryActivateNext(state: PlanetState, laneId: LaneId): void {
  const lane = state.lanes[laneId];
  if (lane.active || lane.backlog.length === 0) return;

  const next = lane.backlog[0];
  const def = state.defs[next.defId];

  // Batch clamping at activation (dynamic: resources, workers, space if structure, housing for colonists).
  const qty = def.batchable ? clampBatchAtActivation(state, def, next.requestedQty) : 1;

  // If clamped to 0 (e.g., not enough resources/workers right now), KEEP PENDING.
  if (qty <= 0) return;

  // Deduct resource costs & reserve workers/space NOW.
  const paid: Stocks = {};
  for (const [res, perUnit] of Object.entries(def.costsPerUnit.resources)) {
    const delta = perUnit * qty;
    state.stocks[res] = (state.stocks[res] ?? 0) - delta;
    paid[res] = delta;
  }
  const workersToReserve = def.costsPerUnit.workersToReserve * qty;
  state.population.workersIdle -= workersToReserve;
  state.population.busyByLane[laneId] += workersToReserve;

  // Space reservations for structures only; ships/colonists don't use space.
  const sg = (def.type === 'structure' ? (def.costsPerUnit.spaceGround ?? 0) * qty : 0);
  const so = (def.type === 'structure' ? (def.costsPerUnit.spaceOrbital ?? 0) * qty : 0);
  state.space.groundUsed += sg;
  state.space.orbitalUsed += so;

  lane.active = {
    defId: next.defId,
    requestedQty: next.requestedQty,
    finalQty: qty,
    status: 'active',
    turnsRemaining: def.durationTurns,
    reservedWorkers: workersToReserve,
    paidResources: paid,
    reservedSpace: { ground: sg, orbital: so }
  };
  lane.backlog.shift();
}

function progressActive(state: PlanetState, laneId: LaneId): void {
  const lane = state.lanes[laneId];
  if (!lane.active) return;

  lane.active.turnsRemaining -= 1;

  if (lane.active.turnsRemaining <= 0) {
    const def = state.defs[lane.active.defId];

    if (def.type === 'soldier' || def.type === 'scientist') {
      // These complete in this turn and convert before production (step 4).
      state.pendingColonistConversions.push(lane.active);
    } else {
      // Structures/ships complete at START of next turn.
      queueStartOfNextTurnCompletion(state, lane.active);
    }

    // Mark done in the lane; actual worker/space release timing differs by type (handled in completion steps).
    lane.active.status = 'completed';
    lane.active = null;
  }
}

// ========== Validation & Clamping ==========
function hasPrereqs(state: PlanetState, def: ItemDefinition): boolean {
  return def.requires.every(id => (state.counts.structures[id] ?? 0) > 0);
}

function housingExistsForColonist(state: PlanetState, def: ItemDefinition, qty: number): boolean {
  if (!def.colonistKind) return true;
  const cap = state.housing[def.colonistKind] ?? 0;
  const current = def.colonistKind === 'soldier' ? state.population.soldiers : state.population.scientists;
  return current + qty <= cap; // cap must be available at activation (and thus at queue time for requested qty)
}

function energyNonNegativeAfterCompletion(state: PlanetState, def: ItemDefinition, qty: number): boolean {
  const sim = clone(state);
  applyEffectsOnComplete(sim, def, qty); // add generators/housing/space/etc.
  const net = computeNetOutputsPerTurn(sim);
  return (net.energy ?? 0) >= 0; // strict non-negative net energy output after completion
}

function clampBatchAtActivation(state: PlanetState, def: ItemDefinition, requested: number): number {
  let maxByRes = Infinity;
  for (const [res, perUnit] of Object.entries(def.costsPerUnit.resources)) {
    const have = state.stocks[res] ?? 0;
    if (perUnit > 0) maxByRes = Math.min(maxByRes, Math.floor(have / perUnit));
  }

  const idle = state.population.workersIdle;
  const maxByWorkers = def.costsPerUnit.workersToReserve > 0
    ? Math.floor(idle / def.costsPerUnit.workersToReserve)
    : Infinity;

  // Structures may require per-unit space; ships/colonists do not.
  const freeGround = state.space.groundCap - state.space.groundUsed;
  const freeOrb   = state.space.orbitalCap - state.space.orbitalUsed;
  const sg = def.type === 'structure' ? (def.costsPerUnit.spaceGround ?? 0) : 0;
  const so = def.type === 'structure' ? (def.costsPerUnit.spaceOrbital ?? 0) : 0;
  const maxByGround = sg > 0 ? Math.floor(freeGround / sg) : Infinity;
  const maxByOrb    = so > 0 ? Math.floor(freeOrb / so) : Infinity;

  // Colonist housing clamp
  let maxByHousing = Infinity;
  if (def.colonistKind) {
    const cap = state.housing[def.colonistKind] ?? 0;
    const current = def.colonistKind === 'soldier' ? state.population.soldiers : state.population.scientists;
    maxByHousing = Math.max(0, cap - current);
  }

  // Energy strictness after completion — ensure some q ≤ requested keeps net energy ≥ 0.
  let q = Math.min(requested, maxByRes, maxByWorkers, maxByGround, maxByOrb, maxByHousing);
  while (q > 0 && !energyNonNegativeAfterCompletion(state, def, q)) q--;
  return Math.max(0, q);
}

// ========== Completions & Conversions ==========
function queueStartOfNextTurnCompletion(state: PlanetState, wi: WorkItem): void {
  enqueueCompletionForTurn(state, state.turn + 1, wi);
}

function applyQueuedStartOfTurnCompletions(state: PlanetState): void {
  const list = drainCompletionsForTurn(state, state.turn);
  for (const wi of list) {
    const def = state.defs[wi.defId];

    // Apply structural effects
    applyEffectsOnComplete(state, def, wi.finalQty);

    // Release reservations/space (structures & ships release here)
    const laneId = def.lane;
    state.population.busyByLane[laneId] -= wi.reservedWorkers;
    state.population.workersIdle += wi.reservedWorkers;

    state.space.groundUsed -= wi.reservedSpace.ground;
    state.space.orbitalUsed -= wi.reservedSpace.orbital;

    // Count produced ships if needed (omitted for brevity)
  }
}

function applyColonistConversions(state: PlanetState): void {
  for (const wi of state.pendingColonistConversions) {
    const def = state.defs[wi.defId];
    const qty = wi.finalQty;

    // First free the lane reservation entirely…
    state.population.busyByLane['colonist'] -= wi.reservedWorkers;

    // …then convert: each unit reserved n workers, on completion return (n-1) to idle; 1 becomes the colonist.
    const n = def.costsPerUnit.workersToReserve;
    const refundPerUnit = Math.max(0, n - 1);
    const totalRefund = refundPerUnit * qty;

    state.population.workersIdle  += totalRefund;
    state.population.workersTotal -= qty; // those workers turned into colonists

    if (def.type === 'soldier')   state.population.soldiers   += qty;
    if (def.type === 'scientist') state.population.scientists += qty;
  }
  state.pendingColonistConversions = [];
}

// ========== Outputs, Effects, Growth, Upkeep ==========
function computeNetOutputsPerTurn(state: PlanetState): OutputVector {
  const net: OutputVector = {};

  // 1) Production from completed structures (baseOutputsPerUnit * abundance * count)
  for (const [structId, count] of Object.entries(state.counts.structures)) {
    const def = state.defs[structId];
    const base = def?.effectsOnComplete?.baseOutputsPerUnit;
    if (!base || count <= 0) continue;
    for (const [res, v] of Object.entries(base)) {
      const a = state.abundance[res as ResourceId] ?? 1;
      net[res] = (net[res] ?? 0) + v * a * count;
    }
  }

  // 2) Subtract per-unit upkeep (e.g., energy upkeep for production buildings)
  forEachCompletedStructureInstance(state, (def) => {
    const up = def.upkeepPerUnit;
    if (!up) return;
    if (up.energyPerUnit) net.energy = (net.energy ?? 0) - up.energyPerUnit;
  });

  return net;
}

function addOutputsToStocks(state: PlanetState, out: OutputVector): void {
  for (const [res, delta] of Object.entries(out)) {
    state.stocks[res] = (state.stocks[res] ?? 0) + delta;
  }
}

function applyEffectsOnComplete(state: PlanetState, def: ItemDefinition, qty: number): void {
  const fx = def.effectsOnComplete;
  if (!fx) return;

  if (fx.counts) {
    for (const [id, d] of Object.entries(fx.counts)) {
      state.counts.structures[id] = (state.counts.structures[id] ?? 0) + d * qty;
    }
  }
  if (fx.housingDelta) {
    for (const [k, d] of Object.entries(fx.housingDelta)) {
      const key = k as keyof HousingCaps;
      state.housing[key] = (state.housing[key] ?? 0) + (d ?? 0) * qty;
    }
  }
  if (fx.spaceDelta) {
    state.space.groundCap  += (fx.spaceDelta.ground  ?? 0) * qty;
    state.space.orbitalCap += (fx.spaceDelta.orbital ?? 0) * qty;
  }
}

function computeGrowthBonus(state: PlanetState): number {
  const leisure = state.counts.structures['leisure_center']   ?? 0;
  const hosp    = state.counts.structures['hospital']         ?? 0;
  return 0.005 * (leisure + hosp); // +0.5% each
}

function foodUpkeepForWorkers(state: PlanetState): number {
  const perWorker = 0.002; // your rule
  return Math.floor(state.population.workersTotal * perWorker);
}

// ========== Small Helpers (stubs to implement concretely) ==========
function clone<T>(x: T): T { /* deep clone */ return x }
function enqueueCompletionForTurn(state: PlanetState, turn: number, wi: WorkItem): void { /* impl */ }
function drainCompletionsForTurn(state: PlanetState, turn: number): WorkItem[] { return [] }
function forEachCompletedStructureInstance(state: PlanetState, cb: (def: ItemDefinition)=>void): void { /* impl */ }
function spaceCapsAllow(state: PlanetState, def: ItemDefinition, qty: number): boolean { return true }
function recordGrowthHint(state: PlanetState, growth: number): void { /* for UI */ }
