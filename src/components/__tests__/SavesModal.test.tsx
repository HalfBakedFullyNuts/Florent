import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SavesModal } from '../SavesModal';
import {
  deleteSave,
  deleteSharedLink,
  listHistory,
  listSaves,
  listShared,
  renameSave,
  saveSave,
} from '../../lib/persistence/savesDb';
import { buildSaveSummary } from '../../lib/persistence/saveSummary';
import { decodeGameState, encodeGameState, getShareMetadataFromSnapshot } from '../../lib/game/urlState';
import type { PlanetConfig } from '../../lib/game/gameState';

vi.mock('../../lib/persistence/savesDb', () => ({
  deleteSave: vi.fn(),
  deleteSharedLink: vi.fn(),
  listHistory: vi.fn(),
  listSaves: vi.fn(),
  listShared: vi.fn(),
  renameSave: vi.fn(),
  saveSave: vi.fn(),
}));

const homeworldConfig: PlanetConfig = {
  name: 'Homeworld',
  startTurn: 1,
  abundance: {
    metal: 1,
    mineral: 1,
    food: 1,
    energy: 1,
    research_points: 1,
  },
  space: {
    groundCap: 60,
    orbitalCap: 40,
  },
};

const ownedEncoded = encodeGameState([homeworldConfig], [['q', 0, 11, 1]]);
const sharedEncoded = encodeGameState(
  [homeworldConfig],
  [['q', 0, 11, 1]],
  { name: 'Neighbor Rush', author: 'Lin', sharedAt: '2026-05-04T16:20:00.000Z' },
);

const ownedSave = {
  id: 'own-1',
  name: 'My Rush',
  createdAt: 1,
  updatedAt: 2,
  encoded: ownedEncoded,
  summary: buildSaveSummary(ownedEncoded),
};

const sharedList = {
  id: 'shared-1',
  name: 'Neighbor Rush',
  author: 'Lin',
  openedAt: new Date('2026-05-04T16:20:00Z').getTime(),
  encoded: sharedEncoded,
  summary: buildSaveSummary(sharedEncoded),
};

describe('SavesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSaves).mockResolvedValue([ownedSave]);
    vi.mocked(listShared).mockResolvedValue([sharedList]);
    vi.mocked(listHistory).mockResolvedValue([]);
    vi.mocked(saveSave).mockResolvedValue(undefined);
    vi.mocked(deleteSave).mockResolvedValue(undefined);
    vi.mocked(deleteSharedLink).mockResolvedValue(undefined);
    vi.mocked(renameSave).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  test('loads a named save as an owned list', async () => {
    const { onRestore } = renderModal();

    fireEvent.click(await screen.findByRole('button', { name: /load mine/i }));

    expect(onRestore).toHaveBeenCalledWith(ownedEncoded, 'My Rush', { shared: false });
  });

  test('opens a cached shared list as shared', async () => {
    const { onRestore } = renderModal();

    fireEvent.click(await screen.findByRole('button', { name: /shared/i }));
    fireEvent.click(await screen.findByRole('button', { name: /open shared/i }));

    expect(onRestore).toHaveBeenCalledWith(sharedEncoded, 'Neighbor Rush', { shared: true });
  });

  test('saving a shared list as mine strips shared metadata from summary and payload', async () => {
    renderModal();

    fireEvent.click(await screen.findByRole('button', { name: /shared/i }));
    fireEvent.click(await screen.findByRole('button', { name: /save as mine/i }));

    await waitFor(() => expect(saveSave).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(saveSave).mock.calls[0]?.[0];
    expect(saved.summary.shareName).toBeUndefined();
    expect(saved.summary.shareAuthor).toBeUndefined();
    const decoded = decodeGameState(saved.encoded);
    expect(decoded ? getShareMetadataFromSnapshot(decoded) : null).toBeNull();
  });

  test('pasted shared links restore with shared intent', async () => {
    const { onRestore } = renderModal();

    fireEvent.click(await screen.findByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText(/paste save or shared link/i), {
      target: { value: `https://example.test/#state=${sharedEncoded}` },
    });
    fireEvent.click(screen.getByRole('button', { name: /load now/i }));

    expect(onRestore).toHaveBeenCalledWith(sharedEncoded, 'Neighbor Rush', { shared: true });
  });

  test('saving an imported shared link as mine strips shared metadata', async () => {
    renderModal();

    fireEvent.click(await screen.findByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText(/paste save or shared link/i), {
      target: { value: `https://example.test/#state=${sharedEncoded}` },
    });
    fireEvent.click(screen.getByRole('button', { name: /save as mine/i }));

    await waitFor(() => expect(saveSave).toHaveBeenCalledTimes(1));
    const saved = vi.mocked(saveSave).mock.calls[0]?.[0];
    expect(saved.summary.shareName).toBeUndefined();
    expect(saved.summary.shareAuthor).toBeUndefined();
    const decoded = decodeGameState(saved.encoded);
    expect(decoded ? getShareMetadataFromSnapshot(decoded) : null).toBeNull();
  });
});

function renderModal() {
  const onRestore = vi.fn();
  const onClose = vi.fn();

  render(
    <SavesModal
      isOpen
      onClose={onClose}
      getCurrentSnapshot={() => ({ encoded: sharedEncoded, summary: buildSaveSummary(sharedEncoded) })}
      onRestore={onRestore}
    />,
  );

  return { onRestore, onClose };
}
