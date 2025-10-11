import type { Building, Unit, Research } from './types'

export const SAMPLE_BUILDINGS: Building[] = [
  {
    id: 'b1',
    name: 'T1 Mass Extractor',
    type: 'Extractor',
    cost: { mass: 100, energy: 0, time: 30 },
    prerequisites: [],
    function: 'Mass production',
  },
  {
    id: 'b2',
    name: 'Army Barracks',
    type: 'Factory',
    cost: { mass: 200, energy: 0, time: 60 },
    prerequisites: [],
    function: 'Produce infantry',
    productionList: ['Soldier'],
  },
]

export const SAMPLE_UNITS: Unit[] = [
  {
    id: 'u1',
    name: 'Soldier',
    type: 'Infantry',
    cost: { mass: 12, energy: 0, time: 4 },
    prerequisites: [{ type: 'Building', name: 'Army Barracks' }],
  },
]

export const SAMPLE_RESEARCH: Research[] = [
  { id: 'r1', name: 'Basic Tactics', cost: { rp: 100, time: 120 }, level: 1 },
]
