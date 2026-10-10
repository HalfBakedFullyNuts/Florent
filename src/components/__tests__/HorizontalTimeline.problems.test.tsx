import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HorizontalTimeline } from '../HorizontalTimeline';

describe('HorizontalTimeline problem markers', () => {
  it('shows one marker per problem that jumps to its first turn', () => {
    const onTurnChange = vi.fn();
    render(
      <HorizontalTimeline
        currentTurn={1}
        totalTurns={200}
        onTurnChange={onTurnChange}
        problemMarkers={[
          { turn: 21, endTurn: 24, label: 'Energy output negative' },
          { turn: 200, label: 'Space Dock never starts' },
        ]}
      />,
    );

    const marker = screen.getByRole('button', { name: 'Problem at T21–T24: Energy output negative' });
    fireEvent.click(marker);
    expect(onTurnChange).toHaveBeenCalledWith(21);
    expect(screen.getByRole('button', { name: 'Problem at T200: Space Dock never starts' })).toBeInTheDocument();
  });

  it('renders no markers without problems', () => {
    render(<HorizontalTimeline currentTurn={1} totalTurns={200} onTurnChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Problem at/ })).not.toBeInTheDocument();
  });
});
