import { v4 as uuidv4 } from 'uuid'
import GameData, { Cost, Unit as GUnit, Structure as GStructure, Requirement, Effect } from './dataManager'
import type { PlayerState, QueueItem } from './types'

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
      if (!player.completedResearch.includes(r.id)) return { ok: false, reason: `Missing research flag ${r.id}` }
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
export function enqueueItem(player: PlayerState, itemId: string, itemType: 'structure' | 'unit', count = 1) {
  // resolve definition
  const def = itemType === 'structure' ? GameData.getStructureById(itemId) : GameData.getUnitById(itemId)
  if (!def) return { ok: false, reason: 'Item not found' }

  // check requirements
  const req = validateRequirements(player, def.requirements)
  if (!req.ok) return req

  // attempt to deduct costs for count
  const costs = def.cost || []
  // perform dry-run to ensure sufficient resources
  for (let i = 0; i < count; i++) {
    for (const c of costs) {
      const ok = deductCost(player, c)
      if (!ok) {
        // refund any previous deductions for this loop
        for (const prev of costs) refundCost(player, prev)
        return { ok: false, reason: 'Insufficient resources' }
      }
    }
  }

  // create queue items
  for (let i = 0; i < count; i++) {
    const qi: QueueItem = {
      id: uuidv4(),
      name: itemId,
      type: itemType === 'structure' ? 'Building' : 'Unit',
      remainingTime: def.build_time_turns || def.build_time_turns || 1,
      massReserved: 0,
      energyReserved: 0,
      meta: { itemType }
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
export function cancelQueueItemImpl(player: PlayerState, itemId: string) {
  const idx = player.buildQueue.findIndex(q => q.id === itemId)
  if (idx === -1) return { ok: false, reason: 'Item not found' }
  const qi = player.buildQueue.splice(idx, 1)[0]
  const def = qi.meta?.itemType === 'structure' ? GameData.getStructureById(qi.name) : GameData.getUnitById(qi.name)
  if (def && def.cost) {
    for (const c of def.cost) refundCost(player, c)
  } else {
    // legacy queue item: refund reserved amounts if present
    if (qi.massReserved && qi.massReserved > 0) player.resources.mass += qi.massReserved
    if (qi.energyReserved && qi.energyReserved > 0) player.resources.energy += qi.energyReserved
  }
  return { ok: true }
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

// Move item within buildQueue (simple reorder)
// New global reorder by item id
export function moveQueueItemGlobal(player: PlayerState, itemId: string, toIndex: number) {
  const idx = player.buildQueue.findIndex(q => q.id === itemId)
  if (idx === -1) return { ok: false, reason: 'Item not found' }
  const [it] = player.buildQueue.splice(idx, 1)
  player.buildQueue.splice(Math.max(0, Math.min(player.buildQueue.length, toIndex)), 0, it)
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
  player.tick += delta

  // Apply consumption from owned structures
  for (const b of player.ownedBuildings) {
    const def = GameData.getStructureById(b.name)
    if (!def || !def.operations) continue
    const consumptions = def.operations.consumption || []
    for (const c of consumptions) {
      if (c.type === 'resource') {
        const id = c.id
        const amt = Math.round((c.amount || 0) * delta)
        if (id === 'energy') player.resources.energy -= amt
        else if (id === 'metal') player.resources.mass -= amt
        else if (id === 'mineral') player.resources.mineral -= amt
        else if (id === 'food') player.resources.food -= amt
      }
    }
  }

  // Apply production from owned structures
  for (const b of player.ownedBuildings) {
    const def = GameData.getStructureById(b.name)
    if (!def || !def.operations) continue
    const prods = def.operations.production || []
    for (const p of prods) {
      let amt = p.base_amount || 0
      if (p.is_abundance_scaled) {
        if (p.type === 'metal') amt *= planetAbundances.metal
        if (p.type === 'mineral') amt *= planetAbundances.mineral
        if (p.type === 'food') amt *= planetAbundances.food
      }
  if (p.type === 'metal') player.resources.mass += Math.round(amt * delta)
  else if (p.type === 'mineral') player.resources.mineral += Math.round(amt * delta)
  else if (p.type === 'food') player.resources.food += Math.round(amt * delta)
      else {
        // producing units (e.g., workers) - produce integer units per tick
        const unitId = p.type
        const add = Math.floor(amt * delta)
        if (add > 0) {
          player.unitCounts ||= {}
          player.unitCounts[unitId] = Math.floor(player.unitCounts[unitId] || 0) + add
        }
      }
    }
  }

  // Decrement build queue timers and complete items
  // stalling factor similar to previous behavior: slow if energy income is negative
  const energyIncome = player.income.energy || 0
  const stallingFactor = energyIncome < 0 ? Math.max(0.1, 1 + energyIncome / 100) : 1
  for (const qi of [...player.buildQueue]) {
    qi.remainingTime -= delta * stallingFactor
    if (qi.remainingTime <= 0) {
      completeQueueItem(player, qi)
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
    default:
      // unhandled effects can be added here
      break
  }
}

