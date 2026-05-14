import gameData from './game_data.json'

export type ResourceId = 'metal' | 'mineral' | 'food' | 'energy' | 'ground_space' | 'orbital_space' | 'research_points'

export type Cost =
  | { type: 'resource'; id: ResourceId; amount: number }
  | { type: 'unit'; id: string; amount: number; is_consumed?: boolean }

export type Production = {
  type: string
  base_amount: number
  is_abundance_scaled?: boolean
}

export type Consumption =
  | { type: 'resource'; id: ResourceId; amount?: number; amount_per_100_pop?: number }
  | { type: 'housing'; category: 'worker' | 'soldier'; amount: number }

export type Effect = Record<string, unknown>

export type Requirement = { type: 'structure' | 'research_flag'; id: string }

export type Structure = {
  id: string
  name: string
  tier?: number
  is_advanced?: boolean
  build_time_turns?: number
  cost?: Cost[]
  build_requirements?: Record<string, unknown>
  requirements?: Requirement[]
  operations?: { production?: Production[]; consumption?: Consumption[]; effects?: Effect[] }
  max_per_planet?: number | null
}

export type Unit = {
  id: string
  name: string
  category?: string
  subcategory?: string
  build_time_turns?: number
  cost?: Cost[]
  consumption?: Consumption[]
  requirements?: Requirement[]
}

class GameDataService {
  private data: { meta: any; resources: { id: string; name: string }[]; units: Unit[]; structures: Structure[] }

  constructor() {
    // Cast the imported JSON into the expected typed shape and validate at runtime.
    const typed = gameData as unknown as { meta: any; resources: { id: string; name: string }[]; units: Unit[]; structures: Structure[] }
    // Run lightweight validation to catch common authoring mistakes early.
    this.validateRawData(typed)
    this.data = typed
  }

  // Lightweight runtime validations. These intentionally avoid external deps
  // and only check shapes and required fields to provide clear diagnostics.
  private fail(msg: string): never {
    throw new Error('[GameDataValidation] ' + msg)
  }

  private isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
  }

  private validateRawData(raw: any) {
    if (!this.isObject(raw)) this.fail('game_data.json must be an object')
    if (!Array.isArray(raw.resources)) this.fail('game_data.json.resources must be an array')
    if (!Array.isArray(raw.units)) this.fail('game_data.json.units must be an array')
    if (!Array.isArray(raw.structures)) this.fail('game_data.json.structures must be an array')

    raw.resources.forEach((r: any, i: number) => {
      if (!this.isObject(r)) this.fail(`resources[${i}] must be an object`)
      if (typeof r.id !== 'string' || r.id.length === 0) this.fail(`resources[${i}].id must be a non-empty string`)
      if (typeof r.name !== 'string') this.fail(`resources[${i}].name must be a string`)
    })

    raw.units.forEach((u: any, i: number) => this.validateUnit(u, i))
    raw.structures.forEach((s: any, i: number) => this.validateStructure(s, i))
  }

  private validateUnit(u: any, i: number) {
    if (!this.isObject(u)) this.fail(`units[${i}] must be an object`)
    if (typeof u.id !== 'string' || u.id.length === 0) this.fail(`units[${i}].id must be a non-empty string`)
    if (typeof u.name !== 'string') this.fail(`units[${i}].name must be a string`)
    if (u.cost !== undefined) {
      if (!Array.isArray(u.cost)) this.fail(`units[${i}].cost must be an array if present`)
      u.cost.forEach((c: any, j: number) => this.validateCost(c, `units[${i}].cost[${j}]`))
    }
    if (u.requirements !== undefined) {
      if (!Array.isArray(u.requirements)) this.fail(`units[${i}].requirements must be an array if present`)
      u.requirements.forEach((r: any, j: number) => this.validateRequirement(r, `units[${i}].requirements[${j}]`))
    }
  }

  private validateStructure(s: any, i: number) {
    if (!this.isObject(s)) this.fail(`structures[${i}] must be an object`)
    if (typeof s.id !== 'string' || s.id.length === 0) this.fail(`structures[${i}].id must be a non-empty string`)
    if (typeof s.name !== 'string') this.fail(`structures[${i}].name must be a string`)
    if (s.cost !== undefined) {
      if (!Array.isArray(s.cost)) this.fail(`structures[${i}].cost must be an array if present`)
      s.cost.forEach((c: any, j: number) => this.validateCost(c, `structures[${i}].cost[${j}]`))
    }
    if (s.requirements !== undefined) {
      if (!Array.isArray(s.requirements)) this.fail(`structures[${i}].requirements must be an array if present`)
      s.requirements.forEach((r: any, j: number) => this.validateRequirement(r, `structures[${i}].requirements[${j}]`))
    }
    if (s.operations !== undefined) {
      if (!this.isObject(s.operations)) this.fail(`structures[${i}].operations must be an object if present`)
      const ops = s.operations
      if (ops.production !== undefined) {
        if (!Array.isArray(ops.production)) this.fail(`structures[${i}].operations.production must be an array if present`)
        ops.production.forEach((p: any, j: number) => this.validateProduction(p, `structures[${i}].operations.production[${j}]`))
      }
      if (ops.consumption !== undefined) {
        if (!Array.isArray(ops.consumption)) this.fail(`structures[${i}].operations.consumption must be an array if present`)
      }
    }
  }

  private validateCost(c: any, label = 'cost') {
    if (!this.isObject(c)) this.fail(`${label} must be an object`)
    if (c.type === 'resource') {
      if (typeof c.id !== 'string') this.fail(`${label}.id must be a string when type==='resource'`)
      if (typeof c.amount !== 'number') this.fail(`${label}.amount must be a number when type==='resource'`)
    } else if (c.type === 'unit') {
      if (typeof c.id !== 'string') this.fail(`${label}.id must be a string when type==='unit'`)
      if (typeof c.amount !== 'number') this.fail(`${label}.amount must be a number when type==='unit'`)
      if (c.is_consumed !== undefined && typeof c.is_consumed !== 'boolean') this.fail(`${label}.is_consumed must be boolean if present`)
    } else {
      this.fail(`${label}.type must be either 'resource' or 'unit'`)
    }
  }

  private validateProduction(p: any, label = 'production') {
    if (!this.isObject(p)) this.fail(`${label} must be an object`)
    if (typeof p.type !== 'string') this.fail(`${label}.type must be a string`)
    if (typeof p.base_amount !== 'number') this.fail(`${label}.base_amount must be a number`)
  }

  private validateRequirement(r: any, label = 'requirement') {
    if (!this.isObject(r)) this.fail(`${label} must be an object`)
    if (r.type !== 'structure' && r.type !== 'research_flag') this.fail(`${label}.type must be 'structure' or 'research_flag'`)
    if (typeof r.id !== 'string') this.fail(`${label}.id must be a string`)
  }

  getAllUnits(): Unit[] {
    return this.data.units
  }

  getAllStructures(): Structure[] {
    return this.data.structures
  }

  getUnitById(id: string): Unit | null {
    return this.data.units.find(u => u.id === id) || null
  }

  getStructureById(id: string): Structure | null {
    return this.data.structures.find(s => s.id === id) || null
  }

  getResourceById(id: string) {
    return this.data.resources.find(r => r.id === id) || null
  }

  getMeta() {
    return this.data.meta
  }
}

const instance = new GameDataService()
export default instance
