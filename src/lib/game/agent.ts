import { v4 as uuidv4 } from 'uuid'
import GameData, { Cost, Unit as GUnit, Structure as GStructure, Requirement, Effect } from './dataManager'
import type { PlayerState, QueueItem, AgentResult } from './types'

// The agent is now data-driven: queue items by canonical id, use GameData to resolve definitions.

function hasStructure(player: PlayerState, structureId: string) {
  for (const b of player.ownedBuildings) {
    if (b.id === structureId) return true
    if (b.name === structureId) return true
    // if b.name is a display name, try to resolve it in GameData to compare canonical id
    const s = GameData.getAllStructures().find((ss: GStructure) => ss.name === b.name)
    if (s && s.id === structureId) return true
  }
  return false
}

function hasResearch(player: PlayerState, researchId: string) {
  return player.completedResearch.includes(researchId)
}

// Validate requirements array from JSON (structures or research flags). Returns AgentResult-like {ok,reason}
export function validateRequirements(player: PlayerState, requirements: Requirement[] | undefined) {
  if (!requirements || requirements.length === 0) return { ok: true }
  for (const r of requirements) {
    if (r.type === 'structure') {
      if (!hasStructure(player, r.id)) return { ok: false, reason: `Missing structure ${r.id}` }
    } else if (r.type === 'research_flag') {
      // research_flag is a boolean indicator; if true required, assume false means missing
      if (!hasResearch(player, r.id)) return { ok: false, reason: `Missing research flag ${r.id}` }
    }
  }
  return { ok: true }
}

// Backwards-compatible wrapper for previous validatePrereqs signature (tests use this)
export function validatePrereqs(player: PlayerState, prereqs?: Array<{ type: string; name: string }>) {
  if (!prereqs || prereqs.length === 0) return { ok: true }
  const converted: Requirement[] = prereqs.map(p => {
    if (p.type === 'Building') return { type: 'structure', id: p.name }
    if (p.type === 'Research') return { type: 'research_flag', id: p.name }
    return p as unknown as Requirement
  })
  return validateRequirements(player, converted)
}

function isUnitCost(c: Cost): c is { type: 'unit'; id: string; amount: number; is_consumed?: boolean } {
  return (c as any).type === 'unit'
}

const DEFAULT_ABUNDANCES = { metal: 1, mineral: 1, food: 1 }
const MAX_AUTOWAIT_TURNS = 200

type EnqueueOptions = {
  allowAutoWait?: boolean
  allowNegativeStocks?: boolean
}

type EnqueueResult = { ok: true } | { ok: false; reason: string; waitTurns?: number }

function clonePlayerState(player: PlayerState): PlayerState {
  return JSON.parse(JSON.stringify(player))
}

function getResourceAmount(player: PlayerState, id: string): number {
  switch (id) {
    case 'metal':
      return player.resources.mass
    case 'mineral':
      return player.resources.mineral
    case 'food':
      return player.resources.food
    case 'energy':
      return player.resources.energy
    default:
      return 0
  }
}

function hasSufficientCost(player: PlayerState, def: GStructure | GUnit | null, count: number): boolean {
  if (!def) return false
  const costs = def.cost || []
  for (const cost of costs) {
    if ((cost as any).type === 'resource') {
      const required = Math.round((cost as any).amount || 0) * count
      if (getResourceAmount(player, (cost as any).id) < required) return false
    } else if (isUnitCost(cost as Cost)) {
      const required = Math.floor(cost.amount || 0) * count
      const have = Math.floor(player.unitCounts?.[cost.id] || 0)
      if (have < required) return false
    }
  }
  return true
}

function estimateWaitTurns(player: PlayerState, def: GStructure | GUnit | null, count: number): number | null {
  if (!def) return null
  const simPlayer = clonePlayerState(player)
  for (let turns = 0; turns <= MAX_AUTOWAIT_TURNS; turns++) {
    if (hasSufficientCost(simPlayer, def, count)) return turns
    processTick(simPlayer, DEFAULT_ABUNDANCES, 1)
  }
  return null
}

function payCost(player: PlayerState, cost: Cost, allowNegative: boolean): boolean {
  if (!allowNegative) return deductCost(player, cost)
  if ((cost as any).type === 'resource') {
    const id = (cost as any).id
    const amount = Math.round((cost as any).amount || 0)
    if (id === 'metal') player.resources.mass -= amount
    else if (id === 'mineral') player.resources.mineral -= amount
    else if (id === 'food') player.resources.food -= amount
    else if (id === 'energy') player.resources.energy -= amount
    return true
  }
  if (isUnitCost(cost)) {
    const required = Math.floor(cost.amount || 0)
    const have = Math.floor(player.unitCounts?.[cost.id] || 0)
    if (have < required) return false
    if (cost.is_consumed) {
      player.unitCounts ||= {}
      player.unitCounts[cost.id] = have - required
      if (player.unitCounts[cost.id] < 0) player.unitCounts[cost.id] = 0
    }
    return true
  }
  return deductCost(player, cost)
}

function resolveStructureDependencies(player: PlayerState, structureIds: string[]): { ok: boolean; dependencies: string[]; missing?: string } {
  if (structureIds.length === 0) return { ok: true, dependencies: [] }
  const ownedStructures = new Set<string>()
  for (const building of player.ownedBuildings) {
    const candidates = [building.name, building.id]
    const byName = GameData.getStructureById(building.name)
    if (byName) candidates.push(byName.id)
    const byId = GameData.getStructureById(building.id)
    if (byId) candidates.push(byId.id)
    const byDisplayName = GameData.getAllStructures().find(s => s.name === building.name)
    if (byDisplayName) candidates.push(byDisplayName.id)
    candidates.filter(Boolean).forEach(id => ownedStructures.add(id))
  }
  const dependencies = new Set<string>()
  for (const structureId of structureIds) {
    if (ownedStructures.has(structureId)) continue
    const provider = player.buildQueue.find(q => q.meta?.itemType === 'structure' && q.name === structureId)
    if (!provider) {
      return { ok: false, dependencies: [], missing: structureId }
    }
    dependencies.add(provider.id)
  }
  return { ok: true, dependencies: Array.from(dependencies) }
}

function dependenciesAreOrdered(queue: QueueItem[]): boolean {
  const indexMap = new Map<string, number>()
  queue.forEach((item, index) => indexMap.set(item.id, index))
  for (const item of queue) {
    const deps = Array.isArray(item.meta?.dependsOn) ? (item.meta!.dependsOn as string[]) : []
    for (const depId of deps) {
      const depIndex = indexMap.get(depId)
      const itemIndex = indexMap.get(item.id)
      if (depIndex === undefined || itemIndex === undefined) continue
      if (depIndex >= itemIndex) return false
    }
  }
  return true
}

function createWaitQueueItem(waitTurns: number, currentTick: number): QueueItem {
  return {
    id: uuidv4(),
    name: 'wait',
    type: 'Wait',
    remainingTime: Math.max(1, waitTurns),
    massReserved: 0,
    energyReserved: 0,
    meta: { itemType: 'wait', waitTurns: Math.max(1, waitTurns), enqueuedTurn: currentTick + 1 },
  }
}

function tryPayDeferredCost(player: PlayerState, qi: QueueItem): boolean {
  const itemType = qi.meta?.itemType as 'structure' | 'unit' | undefined
  if (!itemType) return true
  const def = itemType === 'structure' ? GameData.getStructureById(qi.name) : GameData.getUnitById(qi.name)
  if (!def) return false
  if (!hasSufficientCost(player, def, 1)) return false

  const costs = def.cost || []
  const paid: Cost[] = []
  for (const c of costs) {
    const ok = deductCost(player, c)
    if (!ok) {
      for (const prev of paid) refundCost(player, prev)
      return false
    }
    paid.push(c)
  }
  qi.meta = { ...(qi.meta || {}), costPaid: true }
  return true
}



function deductCost(player: PlayerState, costEntry: Cost) {
  if (!isUnitCost(costEntry)) {
    const id = (costEntry as any).id as string
    const amt = Math.round((costEntry as any).amount || 0)
    if (id === 'metal') {
      if (player.resources.mass < amt) return false
      player.resources.mass -= amt
    } else if (id === 'mineral') {
      if (player.resources.mineral < amt) return false
      player.resources.mineral -= amt
    } else if (id === 'food') {
      if (player.resources.food < amt) return false
      player.resources.food -= amt
    } else if (id === 'energy') {
      if (player.resources.energy < amt) return false
      player.resources.energy -= amt
    }
    return true
  } else if (isUnitCost(costEntry)) {
    const id = costEntry.id
    const amt = Math.floor(costEntry.amount || 0)
    player.unitCounts ||= {}
    const have = Math.floor(player.unitCounts[id] || 0)
    if (have < amt) return false
    if (costEntry.is_consumed) player.unitCounts[id] = have - amt
    // ensure integer
    if (player.unitCounts[id] < 0) player.unitCounts[id] = 0
    return true
  }
  return false
}

function refundCost(player: PlayerState, costEntry: Cost) {
  if ((costEntry as any).type === 'resource') {
    const id = (costEntry as any).id
    const amt = Math.round((costEntry as any).amount || 0)
    if (id === 'metal') player.resources.mass += amt
    else if (id === 'mineral') player.resources.mineral += amt
    else if (id === 'food') player.resources.food += amt
    else if (id === 'energy') player.resources.energy += amt
  } else if (isUnitCost(costEntry)) {
    const id = costEntry.id
    const amt = Math.floor(costEntry.amount || 0)
    if (costEntry.is_consumed) {
      player.unitCounts ||= {}
      player.unitCounts[id] = Math.floor(player.unitCounts[id] || 0) + amt
    }
  }
}

// Enqueue an item by id (structure or unit). The UI should pass canonical id and type.
export function enqueueItem(player: PlayerState, itemId: string, itemType: 'structure' | 'unit', count = 1, options: EnqueueOptions = {}): EnqueueResult {
  // resolve definition
  const def = itemType === 'structure' ? GameData.getStructureById(itemId) : GameData.getUnitById(itemId)
  if (!def) return { ok: false, reason: 'Item not found' }

  const { allowAutoWait = false, allowNegativeStocks = false } = options

  const nonStructureRequirements = (def.requirements || []).filter(r => r.type !== 'structure') as Requirement[]
  const req = validateRequirements(player, nonStructureRequirements)
  if (!req.ok) return req as EnqueueResult

  const originalResources = { ...player.resources }
  const originalUnitCounts = player.unitCounts ? { ...player.unitCounts } : null
  const originalQueueLength = player.buildQueue.length

  const revertState = () => {
    player.resources.mass = originalResources.mass
    player.resources.mineral = originalResources.mineral
    player.resources.food = originalResources.food
    player.resources.energy = originalResources.energy
    if (originalUnitCounts) {
      player.unitCounts = { ...originalUnitCounts }
    } else {
      delete player.unitCounts
    }
    player.buildQueue.splice(originalQueueLength)
  }

  for (let i = 0; i < count; i++) {
    const definition = itemType === 'structure' ? GameData.getStructureById(itemId) : GameData.getUnitById(itemId)
    if (!definition) {
      revertState()
      return { ok: false, reason: 'Item not found' }
    }

    const structureRequirements = (definition.requirements || []).filter(r => r.type === 'structure').map(r => r.id)
    const { ok: depsOk, dependencies, missing } = resolveStructureDependencies(player, structureRequirements)
    if (!depsOk) {
      revertState()
      return { ok: false, reason: `Missing structure ${missing}` }
    }

    const turnsUntilStart = player.buildQueue.reduce((sum, item) => sum + Math.max(0, item.remainingTime || 0), 0)
    let deferCost = false
    let waitItem: QueueItem | null = null
    if (!hasSufficientCost(player, definition, 1)) {
      if (allowNegativeStocks) {
        // cost will be deducted immediately allowing resources to go negative
      } else {
        const waitTurns = estimateWaitTurns(player, definition, 1)
        if (!allowAutoWait) {
          if (waitTurns === null) {
            revertState()
            return { ok: false, reason: 'Insufficient resources' }
          }
          const deficit = waitTurns - turnsUntilStart
          revertState()
          return { ok: false, reason: 'wait_required', waitTurns: deficit > 0 ? deficit : 0 }
        }
        if (waitTurns === null) {
          revertState()
          return { ok: false, reason: 'Insufficient resources' }
        }
        const deficit = waitTurns - turnsUntilStart
        if (deficit > 0) {
          waitItem = createWaitQueueItem(deficit, player.tick)
          player.buildQueue.push(waitItem)
        }
        deferCost = true
      }
    }

    if (!deferCost) {
      const costs = definition.cost || []
      const paid: Cost[] = []
      for (const c of costs) {
        const ok = payCost(player, c, allowNegativeStocks)
        if (!ok) {
          for (const prev of paid) refundCost(player, prev)
          revertState()
          return { ok: false, reason: 'Insufficient resources' }
        }
        paid.push(c)
      }
    }

    const qi: QueueItem = {
      id: uuidv4(),
      name: itemId,
      type: itemType === 'structure' ? 'Building' : 'Unit',
      remainingTime: Math.max(1, definition.build_time_turns || 1),
      massReserved: 0,
      energyReserved: 0,
      meta: {
        itemType,
        enqueuedTurn: player.tick + 1,
        deferCost,
        costPaid: !deferCost,
        dependsOn: dependencies,
      },
    }
    if (waitItem) {
      waitItem.meta = { ...(waitItem.meta || {}), waitFor: qi.id }
    }
    player.buildQueue.push(qi)
  }
  return { ok: true }
}

// Backwards-compatible enqueueUnit (keeps previous test behavior)
export function enqueueUnit(player: PlayerState, factoryId: string, unit: { name: string; cost?: { mass?: number; energy?: number; time?: number }; prerequisites?: Array<{ type: string; name: string }> }, count = 1) {
  // validate prereqs (unit.prerequisites uses old shape)
  const v = validatePrereqs(player, unit.prerequisites)
  if (!v.ok) return v

  // ensure factory exists
  if (!player.ownedBuildings.some(b => b.id === factoryId)) return { ok: false, reason: 'Factory not owned' }

  const queue = player.unitQueueByFactory[factoryId] ||= []
  for (let i = 0; i < count; i++) {
    const mass = unit.cost?.mass || 0
    if (player.resources.mass < mass) return { ok: false, reason: 'Insufficient resources to reserve' }
    player.resources.mass -= mass
    const qi: QueueItem = {
      id: uuidv4(),
      name: unit.name,
      type: 'Unit',
      remainingTime: unit.cost?.time || 1,
      massReserved: mass,
      energyReserved: unit.cost?.energy || 0,
      meta: { legacy: true }
    }
    queue.push(qi)
    player.buildQueue.push(qi)
  }
  return { ok: true }
}

// Cancel queue item and refund costs by re-adding resources from the def
function cancelQueueItemInternal(player: PlayerState, itemId: string, visited: Set<string>): AgentResult {
  if (visited.has(itemId)) return { ok: true }
  visited.add(itemId)
  const idx = player.buildQueue.findIndex(q => q.id === itemId)
  if (idx === -1) return { ok: false, reason: 'Item not found' }
  const qi = player.buildQueue.splice(idx, 1)[0]
  const def = qi.meta?.itemType === 'structure' ? GameData.getStructureById(qi.name) : GameData.getUnitById(qi.name)
  const costPaid = qi.meta?.costPaid
  if (def && def.cost && costPaid !== false) {
    for (const c of def.cost) refundCost(player, c)
  } else {
    if (qi.massReserved && qi.massReserved > 0) player.resources.mass += qi.massReserved
    if (qi.energyReserved && qi.energyReserved > 0) player.resources.energy += qi.energyReserved
  }

  const dependents = player.buildQueue
    .filter(item => Array.isArray(item.meta?.dependsOn) && (item.meta!.dependsOn as string[]).includes(itemId))
    .map(item => item.id)

  const waitDependents = player.buildQueue
    .filter(item => item.meta && (item.meta as any).waitFor === itemId)
    .map(item => item.id)

  for (const depId of [...dependents, ...waitDependents]) {
    cancelQueueItemInternal(player, depId, visited)
  }

  return { ok: true }
}

export function cancelQueueItemImpl(player: PlayerState, itemId: string) {
  return cancelQueueItemInternal(player, itemId, new Set())
}

// Backwards-compatible cancel signature: (player, factoryId, itemId)
export function cancelQueueItemLegacy(player: PlayerState, factoryId: string, itemId: string) {
  // remove from factory queue if present
  const fq = player.unitQueueByFactory[factoryId]
  if (fq) {
    const idx = fq.findIndex(q => q.id === itemId)
    if (idx !== -1) fq.splice(idx, 1)
  }
  return cancelQueueItemImpl(player, itemId)
}

// Export legacy name to keep tests working (they call cancelQueueItem with 3 args)
export { cancelQueueItemLegacy as cancelQueueItem }
export type { EnqueueOptions, EnqueueResult }

// Move item within buildQueue (simple reorder)
// New global reorder by item id
export function moveQueueItemGlobal(player: PlayerState, itemId: string, toIndex: number) {
  const idx = player.buildQueue.findIndex(q => q.id === itemId)
  if (idx === -1) return { ok: false, reason: 'Item not found' }
  const [it] = player.buildQueue.splice(idx, 1)
  player.buildQueue.splice(Math.max(0, Math.min(player.buildQueue.length, toIndex)), 0, it)
  if (!dependenciesAreOrdered(player.buildQueue)) {
    player.buildQueue.splice(player.buildQueue.indexOf(it), 1)
    player.buildQueue.splice(idx, 0, it)
    return { ok: false, reason: 'Cannot move item before its dependencies' }
  }
  return { ok: true }
}

// Backwards-compatible legacy factory move: (player, factoryId, itemId, toIndex)
export function moveQueueItem(player: PlayerState, factoryId: string, itemId: string, toIndex: number) {
  const fq = player.unitQueueByFactory[factoryId]
  if (!fq) return { ok: false, reason: 'Factory queue not found' }
  const idx = fq.findIndex(q => q.id === itemId)
  if (idx === -1) return { ok: false, reason: 'Item not found' }
  const [it] = fq.splice(idx, 1)
  fq.splice(Math.max(0, Math.min(fq.length, toIndex)), 0, it)
  return { ok: true }
}

// Process one game tick: apply upkeep (consumption), production, and decrement build timers
export function processTick(player: PlayerState, planetAbundances: { metal: number; mineral: number; food: number }, delta = 1) {
  for (let step = 0; step < delta; step++) {
    player.tick += 1

    if (player.buildQueue.length > 0) {
      const qi = player.buildQueue[0]
      const isWait = qi.meta?.itemType === 'wait' || qi.type === 'Wait'
      if (!isWait && qi.meta?.deferCost && qi.meta.costPaid !== true) {
        tryPayDeferredCost(player, qi)
      }
      const dependenciesMet = (Array.isArray(qi.meta?.dependsOn) ? (qi.meta!.dependsOn as string[]) : []).every(depId =>
        !player.buildQueue.some(item => item.id === depId)
      )
      const canAdvance = dependenciesMet && (isWait || !qi.meta?.deferCost || qi.meta.costPaid === true)
      if (canAdvance) {
        qi.remainingTime -= 1
        if (qi.remainingTime <= 0) {
          if (isWait) {
            player.buildQueue.shift()
          } else {
            completeQueueItem(player, qi)
          }
        }
      }
    }

    let foodDelta = 0

    for (const b of player.ownedBuildings) {
      const def = GameData.getStructureById(b.name)
      if (!def?.operations) continue
      for (const c of def.operations.consumption || []) {
        if (c.type !== 'resource') continue
        const amt = Math.round(c.amount || 0)
        if (amt <= 0) continue
        if (c.id === 'energy') {
          continue
        } else if (c.id === 'metal') {
          player.resources.mass = Math.max(0, player.resources.mass - amt)
        } else if (c.id === 'mineral') {
          player.resources.mineral = Math.max(0, player.resources.mineral - amt)
        } else if (c.id === 'food') {
          const consumed = Math.min(player.resources.food, amt)
          player.resources.food -= consumed
          foodDelta -= amt
        }
      }
    }

    for (const b of player.ownedBuildings) {
      const def = GameData.getStructureById(b.name)
      if (!def?.operations) continue
      for (const p of def.operations.production || []) {
        let amt = p.base_amount || 0
        if (p.is_abundance_scaled) {
          if (p.type === 'metal') amt *= planetAbundances.metal
          if (p.type === 'mineral') amt *= planetAbundances.mineral
          if (p.type === 'food') amt *= planetAbundances.food
        }
        if (p.type === 'metal') player.resources.mass += Math.round(amt)
        else if (p.type === 'mineral') player.resources.mineral += Math.round(amt)
        else if (p.type === 'food') {
          const produced = Math.round(amt)
          player.resources.food += produced
          foodDelta += produced
        } else {
          const unitId = p.type
          const add = Math.floor(amt)
          if (add > 0) {
            player.unitCounts ||= {}
            player.unitCounts[unitId] = Math.floor(player.unitCounts[unitId] || 0) + add
          }
        }
      }
    }

    for (const [unitId, count] of Object.entries(player.unitCounts || {})) {
      const unitDef = GameData.getUnitById(unitId)
      if (!unitDef?.consumption) continue
      for (const c of unitDef.consumption) {
        if (c.type !== 'resource') continue
        let amt = 0
        if ('amount_per_100_pop' in c) {
          amt = Math.round((count / 100) * (c.amount_per_100_pop || 0))
        } else if ('amount' in c) {
          amt = Math.round((c.amount as number) || 0)
        }
        if (amt <= 0) continue
        if (c.id === 'food') {
          const consumed = Math.min(player.resources.food, amt)
          player.resources.food -= consumed
          foodDelta -= amt
        } else if (c.id === 'energy') {
          continue
        } else if (c.id === 'metal') {
          player.resources.mass = Math.max(0, player.resources.mass - amt)
        } else if (c.id === 'mineral') {
          player.resources.mineral = Math.max(0, player.resources.mineral - amt)
        }
      }
    }

    const leisureCount = player.ownedBuildings.filter(b => b.name === 'leisure_centre' || b.name === 'leisure_center').length
    const hospitalCount = player.ownedBuildings.filter(b => b.name === 'hospital').length
    const workerCount = Math.floor(player.unitCounts?.worker || 0)
    const baseGrowth = 0
    const percentGrowth = Math.floor(workerCount * 0.01)
    const bonusGrowth = Math.floor(workerCount * 0.005 * (leisureCount + hospitalCount))
    const foodShortfall = foodDelta < 0 ? Math.abs(foodDelta) : 0
    const canSustainGrowth = player.resources.food >= 0 && (foodDelta >= 0 || player.resources.food >= foodShortfall)
    const totalGrowth = canSustainGrowth ? baseGrowth + percentGrowth + bonusGrowth : 0
    if (totalGrowth > 0) {
      player.unitCounts ||= {}
      player.unitCounts['worker'] = Math.floor(player.unitCounts['worker'] || 0) + totalGrowth
    }
  }
}

// Complete queue item and apply effects
export function completeQueueItem(player: PlayerState, qi: QueueItem) {
  // remove from queue
  player.buildQueue = player.buildQueue.filter(x => x.id !== qi.id)
  // Determine item type (prefer meta.itemType, fallback to legacy qi.type)
  let itemType: 'structure' | 'unit' | 'research' | null = null
  if (qi.meta?.itemType) itemType = qi.meta.itemType as any
  else if (qi.type === 'Building') itemType = 'structure'
  else if (qi.type === 'Unit') itemType = 'unit'
  else if (qi.type === 'Research') itemType = 'research'

  let def: GStructure | GUnit | null = null
  if (itemType === 'structure') def = GameData.getStructureById(qi.name) || null
  else if (itemType === 'unit') def = GameData.getUnitById(qi.name) || null

  if (itemType === 'structure') {
    // Add OwnedBuilding entry. Use def.id if available, otherwise use the queued name.
    player.ownedBuildings.push({ id: qi.id, name: def ? def.id : qi.name, builtAtTick: player.tick })
    // apply effects if definition exists
        if (def && 'operations' in def && def.operations && def.operations.effects) {
          for (const e of def.operations.effects) applyEffect(player, e)
        }
  } else if (itemType === 'unit') {
    // Add produced unit to population counts
    if (def && def.id) {
      player.unitCounts ||= {}
      player.unitCounts[def.id] = (player.unitCounts[def.id] || 0) + 1
    }
    // apply any unit effects if present
      if (def && 'operations' in def && def.operations && def.operations.effects) {
        for (const e of def.operations.effects) applyEffect(player, e)
      }
  } else if (itemType === 'research') {
    // Add research completion by name
    player.completedResearch.push(qi.name)
  }
}

function applyEffect(player: PlayerState, effect: Effect) {
  player.meta ||= {}
  switch (effect.type) {
    case 'PROVIDE_HOUSING':
      player.meta['housing_' + (effect as any).category] = Number(player.meta['housing_' + (effect as any).category] || 0) + Number((effect as any).amount || 0)
      break
    case 'UNLOCK_CATEGORY':
      player.meta['unlocked_' + (effect as any).category] = true
      break
    case 'MODIFY_ATTRIBUTE':
      player.meta['attr_' + (effect as any).attribute] = Number(player.meta['attr_' + (effect as any).attribute] || 0) + Number((effect as any).value || 0)
      break
    case 'ENABLE_ACTION':
      player.meta['action_' + (effect as any).action] = true
      break
    case 'INCREASE_BIRTH_RATE':
      player.meta['birth_rate_bonus'] = Number(player.meta['birth_rate_bonus'] || 0) + Number((effect as any).amount_percent || 0)
      break
    case 'INCREASE_SPACE':
      if ((effect as any).space_type === 'ground') {
        player.meta['ground_space_max'] = Number(player.meta['ground_space_max'] || 0) + Number((effect as any).amount || 0)
      } else if ((effect as any).space_type === 'orbital') {
        player.meta['orbital_space_max'] = Number(player.meta['orbital_space_max'] || 0) + Number((effect as any).amount || 0)
      }
      break
    default:
      // unhandled effects can be added here
      break
  }
}
