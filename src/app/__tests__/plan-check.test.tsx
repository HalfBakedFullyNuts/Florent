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

    // The accepted problem stays visible: queue row, timeline marker and alert slot.
    const queue = screen.getByRole('list', { name: /Structures queue/i });
    const spyRow = within(queue).getAllByRole('listitem').find((row) => row.textContent?.includes('Spy Centre'))!;
    expect(spyRow).toHaveTextContent('Energy output negative');
    expect(screen.getByRole('button', { name: /^Problem at T21–T24: Energy output negative/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 plan problem, first at T21');
  });

  it('applies a valid change without asking', async () => {
    render(<Home />);
    await queueStructures(['Farm', 'Metal Mine']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('entire build list overview', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens from the button next to the alert slot and shows every lane by turn', async () => {
    render(<Home />);
    await queueStructures(['Farm', 'Solar Generator']);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /View entire build list/i }));
    });
    const table = screen.getByRole('table', { name: /Build list of Homeworld/i });
    expect(within(table).getByRole('row', { name: /^T1\b/ })).toHaveTextContent('Farm');
    expect(within(table).getByRole('row', { name: /^T5\b/ })).toHaveTextContent('Solar Generator');

    fireEvent.mouseEnter(within(table).getByRole('button', { name: 'T5' }));
    const card = screen.getAllByRole('tooltip').find((tip) => tip.textContent?.includes('Start of T5'));
    expect(card).toHaveTextContent('Scientists');
  });
});
