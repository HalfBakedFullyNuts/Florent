import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import Home from '../page';

// Spy Centre (-100 energy) ahead of the Solar Generator (+100) drives net energy negative (T21–T24).
async function queueStructures(names: string[]) {
  for (const name of names) {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Queue ${name}` }));
    });
  }
}

function queueOrder(): string[] {
  const queue = screen.getByRole('list', { name: /Structures queue/i });
  return within(queue).getAllByRole('listitem').map((row) => row.textContent ?? '')
    .map((text) => ['Spy Centre', 'Solar Generator', 'Farm'].find((name) => text.includes(name)) ?? '')
    .filter(Boolean);
}

async function moveSpyCentreEarlier() {
  const queue = screen.getByRole('list', { name: /Structures queue/i });
  const spyRow = within(queue).getAllByRole('listitem').find((row) => row.textContent?.includes('Spy Centre'))!;
  await act(async () => {
    fireEvent.click(within(spyRow).getByRole('button', { name: 'Move down' }));
  });
}

describe('plan check on queue changes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('asks before keeping a reorder that drives energy negative, and Cancel restores the queue', async () => {
    render(<Home />);
    await queueStructures(['Farm', 'Solar Generator', 'Spy Centre']);
    expect(queueOrder()).toEqual(['Spy Centre', 'Solar Generator', 'Farm']); // newest first

    await moveSpyCentreEarlier();

    const dialog = screen.getByRole('dialog', { name: /This reorder causes problems/i });
    expect(dialog).toHaveTextContent('Energy output negative');
    expect(dialog).toHaveTextContent('T21–T24');

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel change' }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(queueOrder()).toEqual(['Spy Centre', 'Solar Generator', 'Farm']);
  });

  it('keeps the reorder when the player accepts it', async () => {
    render(<Home />);
    await queueStructures(['Farm', 'Solar Generator', 'Spy Centre']);
    await moveSpyCentreEarlier();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Do it anyway' }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(queueOrder()).toEqual(['Solar Generator', 'Spy Centre', 'Farm']);
  });

  it('applies a valid change without asking', async () => {
    render(<Home />);
    await queueStructures(['Farm', 'Metal Mine']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
