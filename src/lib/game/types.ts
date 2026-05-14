// Core game types for buildings, units, research and player state

export type ResourcePool = {
  mass: number
  mineral: number
  food: number
  energy: number
  rp?: number // research points (optional)
}

export type Prerequisite = { type: 'Building' | 'Research'; name: string }

export type Building = {
  id: string
  name: string
  faction?: string
  type: string
  cost: { mass: number; energy?: number; time: number }
  prerequisites?: Prerequisite[]
  function?: string
  productionList?: string[] // unit names this building can produce
}

export type Unit = {
  id: string
  name: string
  faction?: string
  type: string
  cost: { mass: number; energy?: number; time: number }
  prerequisites?: Prerequisite[]
}

export type Research = {
  id: string
  name: string
  cost: { rp: number; time: number }
  level?: number
  effect?: string
  prerequisites?: Prerequisite[]
}

export type OwnedBuilding = {
  id: string
  name: string
  // 'name' stores the structure id (e.g., 'army_barracks')
  builtAtTick: number
}

export type QueueItem = {
  id: string
  name: string // building or unit name
  type: 'Building' | 'Unit' | 'Research'
  remainingTime: number
  massReserved: number
  energyReserved: number
  meta?: Record<string, unknown>
}

export type PlayerState = {
  resources: ResourcePool
  income: ResourcePool
  ownedBuildings: OwnedBuilding[]
  completedResearch: string[]
  buildQueue: QueueItem[]
  unitQueueByFactory: Record<string, QueueItem[]>
  // counts of units by unit id (e.g., { worker: 50000 })
  unitCounts?: Record<string, number>
  tick: number
  meta?: Record<string, unknown>
}

export type AgentResult = { ok: boolean; reason?: string }
