import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import Home from '../page'
import GameData from '../../lib/game/dataManager'
import * as agent from '../../lib/game/agent'

describe('Home page interactions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createDataTransfer = () => {
    const store: Record<string, string> = {}
    return {
      setData: (key: string, value: string) => {
        store[key] = value
      },
      getData: (key: string) => store[key],
      clearData: () => {
        Object.keys(store).forEach(k => delete store[k])
      },
      dropEffect: 'move' as DataTransfer['dropEffect'],
      effectAllowed: 'move' as DataTransfer['effectAllowed'],
      files: [] as any,
      items: [] as any,
      types: [] as any,
      setDragImage: () => {},
    } as unknown as DataTransfer
  }

  it('filters available items by tab selection', async () => {
    const mockUnits = [
      { id: 'worker', name: 'Worker', category: 'colonist', cost: [] },
      { id: 'scout_ship', name: 'Scout Ship', category: 'ship', cost: [] },
    ]

    vi.spyOn(GameData, 'getAllUnits').mockReturnValue(mockUnits as any)
    vi.spyOn(GameData, 'getUnitById').mockImplementation(id => mockUnits.find(u => u.id === id) as any || null)

    render(<Home />)

    const availableSection = screen.getByText(/Available to Build/i).closest('section')
    if (!availableSection) throw new Error('Available to Build section not found')

    fireEvent.click(within(availableSection).getAllByRole('button', { name: /^Ships$/i })[0])
    await screen.findByText('Scout Ship')
    expect(screen.queryByText('Worker')).not.toBeInTheDocument()

    fireEvent.click(within(availableSection).getAllByRole('button', { name: /^Colonists$/i })[0])
    await screen.findByText('Worker')
    expect(screen.queryByText('Scout Ship')).not.toBeInTheDocument()
  })

  it('queues an affordable structure and advances the viewed turn', async () => {
    render(<Home />)

    const availableSection = screen.getByText(/Available to Build/i).closest('section')
    if (!availableSection) throw new Error('Available to Build section not found')
    const farmCard = await within(availableSection).findByTestId('available-farm')
    fireEvent.click(farmCard)

    const firstEntry = await screen.findByTestId('queue-entry-0')
    expect(firstEntry.textContent || '').toContain('T1')
    expect(firstEntry.textContent || '').toContain('Farm')

    const numberInput = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(numberInput, { target: { value: '4' } })

    await waitFor(() => {
      const completedSection = screen.getByText(/Completed Structures/i).closest('aside')
      if (!completedSection) throw new Error('Completed Structures section not found')
      const farmEntry = within(completedSection).getByText(/Farm/i).parentElement
      expect(farmEntry?.textContent || '').toContain('×2')
    })
  })

  it('surfaced queue errors when enqueue fails', async () => {
    const enqueueSpy = vi.spyOn(agent, 'enqueueItem').mockReturnValue({ ok: false, reason: 'Insufficient resources' })

    render(<Home />)

    const availableSection = screen.getByText(/Available to Build/i).closest('section')
    if (!availableSection) throw new Error('Available to Build section not found')
    const farmCard = await within(availableSection).findByTestId('available-farm')
    fireEvent.click(farmCard)

    expect(enqueueSpy).toHaveBeenCalled()
    expect(await screen.findByText('Insufficient resources')).toBeInTheDocument()
  })

  it('highlights unaffordable structures and hides queue action', async () => {
    const originalStructures = GameData.getAllStructures()
    const outpost = originalStructures.find(s => s.id === 'outpost')!
    const metalMine = originalStructures.find(s => s.id === 'metal_mine')!

    const affordable = {
      id: 'cheap_lab',
      name: 'Cheap Lab',
      cost: [{ type: 'resource', id: 'energy', amount: 50 }],
      build_time_turns: 1,
    }

    const expensive = {
      id: 'mega_lab',
      name: 'Mega Lab',
      cost: [{ type: 'resource', id: 'energy', amount: 500000 }],
      build_time_turns: 1,
    }

    const structures = [outpost, metalMine, affordable as any, expensive as any]

    vi.spyOn(GameData, 'getAllStructures').mockReturnValue(structures as any)
    const byId = vi.spyOn(GameData, 'getStructureById').mockImplementation(id => {
      return structures.find(s => s.id === id) as any || null
    })

    render(<Home />)

    const affordableContainer = await screen.findByTestId('available-cheap_lab')
    const expensiveContainer = await screen.findByTestId('available-mega_lab')

    expect(affordableContainer.className).toContain('cursor-pointer')
    expect(expensiveContainer.className).toContain('cursor-pointer')
    expect(expensiveContainer.className).toContain('bg-pink-nebula-bg/40')

    fireEvent.click(expensiveContainer)
    expect(await screen.findByText('Insufficient resources')).toBeInTheDocument()
  })

  it('queues a wait item automatically when resources will accumulate later', async () => {
    const originalStructures = GameData.getAllStructures()
    const originalGetStructureById = GameData.getStructureById
    const delayed = {
      id: 'delayed_lab',
      name: 'Delayed Lab',
      build_time_turns: 2,
      cost: [
        { type: 'resource', id: 'metal', amount: 60000 },
        { type: 'resource', id: 'mineral', amount: 1000 },
      ],
    }

    vi.spyOn(GameData, 'getAllStructures').mockReturnValue([...originalStructures, delayed as any])
    vi.spyOn(GameData, 'getStructureById').mockImplementation(id => {
      if (id === 'delayed_lab') return delayed as any
      return originalStructures.find(s => s.id === id) as any || originalGetStructureById.call(GameData, id)
    })

    render(<Home />)

    const delayedRow = await screen.findByTestId('available-delayed_lab')
    fireEvent.click(delayedRow)

    const modal = await screen.findByTestId('wait-modal')
    expect(modal).toBeInTheDocument()
    fireEvent.click(within(modal).getByRole('button', { name: /^Add Wait$/i }))

    const waitRow = await screen.findByText(/Wait for/) // wait item should be queued
    expect(waitRow).toBeInTheDocument()
    const queueEntries = await screen.findAllByTestId(/queue-entry-/)
    expect(queueEntries.some(entry => entry.textContent?.includes('Delayed Lab'))).toBe(true)
  })

  it('allows removing queue items after selecting them', async () => {
    render(<Home />)

    const availableSection = screen.getByText(/Available to Build/i).closest('section')
    if (!availableSection) throw new Error('Available to Build section not found')

    const mineRow = await within(availableSection).findByTestId('available-metal_mine')
    fireEvent.click(mineRow)

    await screen.findByTestId('queue-entry-0')
    expect(screen.queryByTestId('queue-remove-0')).not.toBeInTheDocument()

    const queueRow = screen.getByTestId('queue-entry-0')
    fireEvent.click(queueRow)

    const removeButton = await screen.findByTestId('queue-remove-0')
    fireEvent.click(removeButton)

    await waitFor(() => {
      expect(screen.queryByTestId('queue-entry-0')).not.toBeInTheDocument()
    })
  })

  it('supports dragging queue items to reorder them', async () => {
    render(<Home />)

    const availableSection = screen.getByText(/Available to Build/i).closest('section')
    if (!availableSection) throw new Error('Available to Build section not found')

    const farmRow = await within(availableSection).findByTestId('available-farm')
    const mineRow = await within(availableSection).findByTestId('available-metal_mine')
    fireEvent.click(farmRow)
    fireEvent.click(mineRow)

    const firstBefore = await screen.findByTestId('queue-entry-0')
    expect(firstBefore.textContent || '').toMatch(/Farm/)
    const secondRow = await screen.findByTestId('queue-entry-1')

    const dragData = createDataTransfer()
    fireEvent.dragStart(firstBefore, { dataTransfer: dragData })
    fireEvent.dragOver(secondRow, { dataTransfer: dragData })
    fireEvent.drop(secondRow, { dataTransfer: dragData })
    fireEvent.dragEnd(firstBefore, { dataTransfer: dragData })

    await waitFor(() => {
      const firstAfter = screen.getByTestId('queue-entry-0')
      expect(firstAfter.textContent || '').toMatch(/Metal Mine/)
    })
  })

  it('filters build queue entries by tab selection', async () => {
    const originalUnits = GameData.getAllUnits()
    const originalUnitById = GameData.getUnitById
    const testShip = {
      id: 'test_ship',
      name: 'Test Ship',
      category: 'ship',
      build_time_turns: 2,
      cost: [],
      requirements: [],
    }

    vi.spyOn(GameData, 'getAllUnits').mockReturnValue([...originalUnits, testShip] as any)
    vi.spyOn(GameData, 'getUnitById').mockImplementation((id: string) => {
      if (id === 'test_ship') return testShip as any
      return originalUnitById.call(GameData, id)
    })

    render(<Home />)

    const availableSection = screen.getByText(/Available to Build/i).closest('section')
    if (!availableSection) throw new Error('Available to Build section not found')

    const mineRow = await within(availableSection).findByTestId('available-metal_mine')
    fireEvent.click(mineRow)

    const shipsTab = within(availableSection).getAllByRole('button', { name: /^Ships$/i })[0]
    fireEvent.click(shipsTab)
    const shipRow = await within(availableSection).findByTestId('available-test_ship')
    fireEvent.click(shipRow)

    const queuePanel = screen.getByTestId('build-queue-panel')

    await screen.findByTestId('queue-entry-0')
    expect(within(queuePanel).queryByText(/Test Ship/)).not.toBeInTheDocument()

    const queueShipsTab = screen.getByTestId('queue-tab-ships')
    fireEvent.click(queueShipsTab)
    await waitFor(() => {
      expect(within(queuePanel).getByText(/Test Ship/)).toBeInTheDocument()
    })

    const queueStructuresTab = screen.getByTestId('queue-tab-structures')
    fireEvent.click(queueStructuresTab)
    await waitFor(() => {
      expect(within(queuePanel).getByText(/Metal Mine/)).toBeInTheDocument()
      expect(within(queuePanel).queryByText(/Test Ship/)).not.toBeInTheDocument()
    })
  })

  it('does not allow queuing unique structures twice even on earlier turns', async () => {
    render(<Home />)

    const launchRow = await screen.findByTestId('available-launch_site')
    fireEvent.click(launchRow)

    await waitFor(() => {
      expect(screen.queryByTestId('available-launch_site')).toBeNull()
    })

    const slider = screen.getByRole('slider') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '0' } })

    await waitFor(() => {
      expect(screen.queryByTestId('available-launch_site')).toBeNull()
    })
  })
})
