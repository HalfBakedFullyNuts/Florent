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

  test('current export falls back to the full queue when nothing completes by the current turn', async () => {
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

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('[5] - Farm'));
    expect(screen.getByText(/full queue was copied/i)).toBeInTheDocument();
  });
});
