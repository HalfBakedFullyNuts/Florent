import { describe, expect, test } from 'vitest';
import { formatReplayDropNotice } from '../replayNotice';
import type { ReplayDrop } from '../urlState';

const names = { research_lab: 'Research Lab', farm: 'Farm', metal_mine: 'Metal Mine' };
const planets = ['Homeworld', 'Mars'];

function drop(itemId: string, planetIndex = 0, quantity = 1): ReplayDrop {
  return { planetIndex, itemId, quantity, reason: 'REQ_MISSING' };
}

describe('formatReplayDropNotice', () => {
  test('returns null when nothing was dropped', () => {
    expect(formatReplayDropNotice([], planets, names)).toBeNull();
  });

  test('names the skipped step and its planet', () => {
    expect(formatReplayDropNotice([drop('research_lab')], planets, names)).toBe(
      "1 step of this plan couldn't be applied under the current game rules and was skipped: Research Lab ×1 (Homeworld).",
    );
  });

  test('groups repeats per planet and sums quantities', () => {
    const notice = formatReplayDropNotice(
      [drop('farm', 0, 2), drop('farm', 0, 3), drop('farm', 1, 1)],
      planets,
      names,
    );
    expect(notice).toBe(
      "3 steps of this plan couldn't be applied under the current game rules and were skipped: Farm ×5 (Homeworld), Farm ×1 (Mars).",
    );
  });

  test('falls back to ids/indexes for unknown names and caps a long list', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => drop(id, 5));
    const notice = formatReplayDropNotice(many, planets, names) ?? '';

    expect(notice).toContain('a ×1 (Planet 6)');
    expect(notice).toContain('e ×1 (Planet 6)');
    expect(notice).not.toContain('f ×1');
    expect(notice).toMatch(/and 2 more\.$/);
  });
});
