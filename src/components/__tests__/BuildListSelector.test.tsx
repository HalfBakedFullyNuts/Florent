import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BuildListSelector } from '../BuildListSelector';
import {
  deleteHistoryEntry,
  deleteSave,
  deleteSharedLink,
  listHistory,
  listSaves,
  listShared,
} from '../../lib/persistence/savesDb';

vi.mock('../../lib/persistence/savesDb', () => ({
  deleteHistoryEntry: vi.fn(),
  deleteSave: vi.fn(),
  deleteSharedLink: vi.fn(),
  listHistory: vi.fn(),
  listSaves: vi.fn(),
  listShared: vi.fn(),
  SAVES_CHANGED_EVENT: 'florent:saves-changed',
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
  openedAt: new Date('2026-05-04T16:20:00Z').getTime(),
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

const olderSharedList = {
  id: 'shared-older',
  name: 'Old Neighbor Rush',
  author: 'Lin',
  openedAt: new Date('2026-05-03T16:20:00Z').getTime(),
  encoded: 'older-shared-encoded',
  summary: {
    planetCount: 1,
    commandCount: 4,
    maxTurn: 0,
    planetNames: 'Homeworld',
    shareName: 'Old Neighbor Rush',
    shareAuthor: 'Lin',
  },
};

const ownHistory = {
  id: 42,
  savedAt: 4,
  encoded: 'history-encoded',
  summary: {
    planetCount: 1,
    commandCount: 2,
    maxTurn: 0,
    planetNames: 'Homeworld',
  },
};

const sharedHistory = {
  id: 43,
  savedAt: 5,
  encoded: 'shared-history-encoded',
  summary: {
    planetCount: 1,
    commandCount: 2,
    maxTurn: 0,
    planetNames: 'Homeworld',
    shareName: 'Neighbor Rush',
    shareAuthor: 'Lin',
  },
};

describe('BuildListSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {},
    });
    vi.mocked(listSaves).mockResolvedValue([ownList]);
    vi.mocked(listShared).mockResolvedValue([sharedList]);
    vi.mocked(listHistory).mockResolvedValue([]);
    vi.mocked(deleteSave).mockResolvedValue(undefined);
    vi.mocked(deleteSharedLink).mockResolvedValue(undefined);
    vi.mocked(deleteHistoryEntry).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  test('distinguishes owned and shared cached lists', async () => {
    render(<BuildListSelector onRestore={vi.fn()} />);

    expect(await screen.findByText('My Rush')).toBeInTheDocument();
    expect(screen.getByText(/Neighbor Rush by Lin - opened/i)).toBeInTheDocument();
    expect(screen.getByText(/Shared links are cached on this device/i)).toBeInTheDocument();
  });

  test('loads the selected shared list', async () => {
    const onRestore = vi.fn();
    render(<BuildListSelector onRestore={onRestore} />);

    const select = await screen.findByLabelText(/select build list/i);
    fireEvent.change(select, { target: { value: 'shared:shared-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^load$/i }));

    expect(onRestore).toHaveBeenCalledWith('shared-encoded', expect.stringMatching(/^Neighbor Rush by Lin - opened /));
  });

  test('keeps the dropdown enabled while refreshing existing lists on focus', async () => {
    let resolveRefresh: ((records: typeof sharedList[]) => void) | undefined;
    vi.mocked(listShared)
      .mockResolvedValueOnce([sharedList])
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveRefresh = resolve;
      }));

    render(<BuildListSelector onRestore={vi.fn()} />);

    const select = await screen.findByLabelText(/select build list/i);
    fireEvent.focus(select);

    expect(select).not.toBeDisabled();

    await act(async () => {
      resolveRefresh?.([sharedList]);
    });
  });

  test('shows recent non-shared auto-saves as your lists', async () => {
    vi.mocked(listSaves).mockResolvedValue([]);
    vi.mocked(listHistory).mockResolvedValue([sharedHistory, ownHistory]);

    render(<BuildListSelector onRestore={vi.fn()} />);

    expect(await screen.findByText(/Recent local build - Homeworld/i)).toBeInTheDocument();
    expect(screen.queryByText(/shared-history/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Neighbor Rush by Lin - opened/i)).toBeInTheDocument();
  });

  test('orders cached shared lists by newest opened time', async () => {
    vi.mocked(listShared).mockResolvedValue([olderSharedList, sharedList]);

    render(<BuildListSelector onRestore={vi.fn()} />);

    const select = await screen.findByLabelText(/select build list/i);
    const labels = Array.from(select.querySelectorAll('option')).map((option) => option.textContent ?? '');

    expect(labels.findIndex((label) => label.startsWith('Neighbor Rush by Lin - opened'))).toBeLessThan(
      labels.findIndex((label) => label.startsWith('Old Neighbor Rush by Lin - opened'))
    );
  });

  test('refreshes when saves change elsewhere', async () => {
    vi.mocked(listSaves).mockResolvedValueOnce([]).mockResolvedValue([ownList]);
    render(<BuildListSelector onRestore={vi.fn()} />);

    expect(await screen.findByText(/Neighbor Rush by Lin - opened/i)).toBeInTheDocument();
    expect(screen.queryByText('My Rush')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('florent:saves-changed'));
    });

    expect(await screen.findByText('My Rush')).toBeInTheDocument();
  });

  test('deletes the selected owned list', async () => {
    render(<BuildListSelector onRestore={vi.fn()} />);

    const select = await screen.findByLabelText(/select build list/i);
    fireEvent.change(select, { target: { value: 'own:own-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(deleteSave).toHaveBeenCalledWith('own-1'));
    expect(deleteSharedLink).not.toHaveBeenCalled();
  });

  test('deletes the selected recent local build', async () => {
    vi.mocked(listSaves).mockResolvedValue([]);
    vi.mocked(listHistory).mockResolvedValue([ownHistory]);
    render(<BuildListSelector onRestore={vi.fn()} />);

    const select = await screen.findByLabelText(/select build list/i);
    fireEvent.change(select, { target: { value: 'history:42' } });
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(deleteHistoryEntry).toHaveBeenCalledWith(42));
    expect(deleteSave).not.toHaveBeenCalled();
  });
});
