import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BuildListSelector } from '../BuildListSelector';
import {
  deleteSave,
  deleteSharedLink,
  listSaves,
  listShared,
} from '../../lib/persistence/savesDb';

vi.mock('../../lib/persistence/savesDb', () => ({
  deleteSave: vi.fn(),
  deleteSharedLink: vi.fn(),
  listSaves: vi.fn(),
  listShared: vi.fn(),
}));

const ownList = {
  id: 'own-1',
  name: 'My Rush',
  createdAt: 1,
  updatedAt: 2,
  encoded: 'own-encoded',
  summary: {
    planetCount: 1,
    commandCount: 3,
    maxTurn: 0,
    planetNames: 'Homeworld',
  },
};

const sharedList = {
  id: 'shared-1',
  name: 'Neighbor Rush',
  author: 'Lin',
  openedAt: 3,
  encoded: 'shared-encoded',
  summary: {
    planetCount: 1,
    commandCount: 4,
    maxTurn: 0,
    planetNames: 'Homeworld',
    shareName: 'Neighbor Rush',
    shareAuthor: 'Lin',
  },
};

describe('BuildListSelector', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {},
    });
    vi.mocked(listSaves).mockResolvedValue([ownList]);
    vi.mocked(listShared).mockResolvedValue([sharedList]);
    vi.mocked(deleteSave).mockResolvedValue(undefined);
    vi.mocked(deleteSharedLink).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  test('distinguishes owned and shared cached lists', async () => {
    render(<BuildListSelector onRestore={vi.fn()} />);

    expect(await screen.findByText('My Rush')).toBeInTheDocument();
    expect(screen.getByText('Neighbor Rush by Lin')).toBeInTheDocument();
    expect(screen.getByText(/Shared links are cached on this device/i)).toBeInTheDocument();
  });

  test('loads the selected shared list', async () => {
    const onRestore = vi.fn();
    render(<BuildListSelector onRestore={onRestore} />);

    const select = await screen.findByLabelText(/select build list/i);
    fireEvent.change(select, { target: { value: 'shared:shared-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^load$/i }));

    expect(onRestore).toHaveBeenCalledWith('shared-encoded', 'Neighbor Rush by Lin');
  });

  test('deletes the selected owned list', async () => {
    render(<BuildListSelector onRestore={vi.fn()} />);

    const select = await screen.findByLabelText(/select build list/i);
    fireEvent.change(select, { target: { value: 'own:own-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(deleteSave).toHaveBeenCalledWith('own-1'));
    expect(deleteSharedLink).not.toHaveBeenCalled();
  });
});
