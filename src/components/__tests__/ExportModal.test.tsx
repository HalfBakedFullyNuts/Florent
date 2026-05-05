import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ExportModal } from '../ExportModal';
import type { LaneView } from '../../lib/game/selectors';

const futureBuildingLane: LaneView = {
  laneId: 'building',
  entries: [
    {
      id: 'farm-1',
      itemId: 'farm',
      itemName: 'Farm',
      quantity: 1,
    status: 'pending',
    turnsRemaining: 4,
    eta: 5,
    completionTurn: 5,
    queuedTurn: 1,
    startTurn: 4,
    },
  ],
};

const futureShipLane: LaneView = {
  laneId: 'ship',
  entries: [
    {
      id: 'fighter-1',
      itemId: 'fighter',
      itemName: 'Fighter',
      quantity: 5,
    status: 'pending',
    turnsRemaining: 8,
    eta: 9,
    completionTurn: 9,
    queuedTurn: 1,
    startTurn: 7,
    },
  ],
};

const emptyLane = (laneId: LaneView['laneId']): LaneView => ({ laneId, entries: [] });

describe('ExportModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  test('current export falls back to the full queue when no queue actions are due by the current turn', async () => {
    const writeText = vi.mocked(window.navigator.clipboard.writeText);

    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        buildingLane={futureBuildingLane}
        shipLane={emptyLane('ship')}
        colonistLane={emptyLane('colonist')}
        researchLane={emptyLane('research')}
        currentTurn={1}
        exportMode="current"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /export as plain text/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('[4] - Farm'));
    expect(screen.getByText(/copied full queue/i)).toBeInTheDocument();
  });

  test('game JSON export copies build data without Florent save metadata', async () => {
    const writeText = vi.mocked(window.navigator.clipboard.writeText);

    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        buildingLane={futureBuildingLane}
        shipLane={futureShipLane}
        colonistLane={emptyLane('colonist')}
        researchLane={emptyLane('research')}
        currentTurn={1}
        exportMode="full"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /export game json/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const payload = JSON.parse(writeText.mock.calls[0][0] as string);

    expect(payload.format).toBe('florent-build-list');
    expect(payload.scope).toBe('full');
    expect(payload.items).toEqual([
      { turn: 4, lane: 'building', itemId: 'farm', name: 'Farm', quantity: 1 },
      { turn: 7, lane: 'ship', itemId: 'fighter', name: 'Fighter', quantity: 5 },
    ]);
    expect(writeText.mock.calls[0][0]).not.toContain('encoded');
    expect(screen.getByRole('button', { name: /download game json/i })).toBeInTheDocument();
  });

  test('empty game JSON export clears a stale download fallback', async () => {
    const writeText = vi.mocked(window.navigator.clipboard.writeText);
    const { rerender } = render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        buildingLane={futureBuildingLane}
        shipLane={emptyLane('ship')}
        colonistLane={emptyLane('colonist')}
        researchLane={emptyLane('research')}
        currentTurn={1}
        exportMode="full"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /export game json/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /download game json/i })).toBeInTheDocument();

    rerender(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        buildingLane={emptyLane('building')}
        shipLane={emptyLane('ship')}
        colonistLane={emptyLane('colonist')}
        researchLane={emptyLane('research')}
        currentTurn={1}
        exportMode="full"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /export game json/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /download game json/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/queue is empty/i)).toBeInTheDocument();
  });

  test('game JSON export can include all planets', async () => {
    const writeText = vi.mocked(window.navigator.clipboard.writeText);

    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        buildingLane={futureBuildingLane}
        shipLane={emptyLane('ship')}
        colonistLane={emptyLane('colonist')}
        researchLane={emptyLane('research')}
        currentTurn={1}
        exportMode="full"
        multiPlanetData={{
          planets: [
            {
              id: 'planet-1',
              name: 'Homeworld',
              startTurn: 1,
              lanes: [futureBuildingLane, emptyLane('ship'), emptyLane('colonist')],
            },
            {
              id: 'planet-2',
              name: 'Mars',
              startTurn: 24,
              lanes: [
                {
                  laneId: 'building',
                  entries: [
                    {
                      id: 'mars-farm',
                      itemId: 'farm',
                      itemName: 'Farm',
                      quantity: 1,
                      status: 'pending',
                      turnsRemaining: 4,
                      eta: 28,
                      queuedTurn: 24,
                      startTurn: 24,
                      completionTurn: 28,
                    },
                  ],
                },
                emptyLane('ship'),
                emptyLane('colonist'),
              ],
            },
          ],
          researchLane: emptyLane('research'),
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /all planets/i }));
    fireEvent.click(screen.getByRole('button', { name: /export game json/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const payload = JSON.parse(writeText.mock.calls[0][0] as string);

    expect(payload.version).toBe(2);
    expect(payload.planets.map((planet: { name: string }) => planet.name)).toEqual(['Homeworld', 'Mars']);
    expect(payload.planets[1].items).toEqual([
      { turn: 24, lane: 'building', itemId: 'farm', name: 'Farm', quantity: 1 },
    ]);
  });

  test('image export renders a wider table canvas instead of the old compact list image', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        write,
      },
    });
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 1,
    });

    const gradient = { addColorStop: vi.fn() };
    const context = {
      beginPath: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      createLinearGradient: vi.fn(() => gradient),
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      lineTo: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }));
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');

    class MockClipboardItem {
      constructor(public readonly items: Record<string, Blob>) {}
    }

    (globalThis as { ClipboardItem: typeof ClipboardItem }).ClipboardItem =
      MockClipboardItem as unknown as typeof ClipboardItem;

    const exportedCanvases: HTMLCanvasElement[] = [];
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = createElement(tagName, options);
      if (tagName === 'canvas') {
        exportedCanvases.push(element as HTMLCanvasElement);
      }
      return element;
    });

    render(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        buildingLane={futureBuildingLane}
        shipLane={futureShipLane}
        colonistLane={emptyLane('colonist')}
        researchLane={emptyLane('research')}
        currentTurn={1}
        exportMode="full"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /export as image/i }));

    await waitFor(() => expect(write).toHaveBeenCalled());
    expect(exportedCanvases).toHaveLength(1);
    const canvas = exportedCanvases[0];
    expect(canvas.width).toBeGreaterThan(500);
    expect(context.fillText).toHaveBeenCalledWith('QUEUE', expect.any(Number), expect.any(Number));
    expect(context.fillText).toHaveBeenCalledWith('STRUCTURE', expect.any(Number), expect.any(Number));
    expect(context.fillText).toHaveBeenCalledWith('SHIP', expect.any(Number), expect.any(Number));
  });
});
