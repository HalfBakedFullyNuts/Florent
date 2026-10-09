import { describe, it, expect } from 'vitest';
import { getPlanDropIndex, getPlanShiftIndex, type PlanLaneOrder } from '../queueReorder';

// Planet lanes: the active item sits outside the pending index space used by reorderQueueItem.
const planet: PlanLaneOrder = { activeId: 'farm', pendingIds: ['metal', 'solar', 'lab'], activeInIndexSpace: false };
// Global research: reorderGlobalResearch indexes [active, ...pending] as one list.
const research: PlanLaneOrder = { activeId: 'pm', pendingIds: ['rc', 'ft'], activeInIndexSpace: true };

describe('getPlanDropIndex', () => {
  it('moves a pending item into the target pending slot (both directions)', () => {
    expect(getPlanDropIndex(planet, 'lab', 'metal')).toBe(0);
    expect(getPlanDropIndex(planet, 'metal', 'lab')).toBe(2);
  });

  it('moves the active item into the target slot, landing after it like a pending item would', () => {
    expect(getPlanDropIndex(planet, 'farm', 'metal')).toBe(1);
    expect(getPlanDropIndex(planet, 'farm', 'lab')).toBe(3);
  });

  it('rejects the planet active slot, self-drops and unknown ids', () => {
    expect(getPlanDropIndex(planet, 'metal', 'farm')).toBeNull();
    expect(getPlanDropIndex(planet, 'metal', 'metal')).toBeNull();
    expect(getPlanDropIndex(planet, 'ghost', 'metal')).toBeNull();
    expect(getPlanDropIndex(planet, 'metal', 'ghost')).toBeNull();
  });

  it('uses the combined [active, ...pending] index space for research', () => {
    expect(getPlanDropIndex(research, 'ft', 'pm')).toBe(0);
    expect(getPlanDropIndex(research, 'pm', 'ft')).toBe(2);
  });
});

describe('getPlanShiftIndex', () => {
  it('shifts pending items one slot later or earlier within bounds', () => {
    expect(getPlanShiftIndex(planet, 'metal', 'later')).toBe(1);
    expect(getPlanShiftIndex(planet, 'solar', 'earlier')).toBe(0);
    expect(getPlanShiftIndex(planet, 'lab', 'later')).toBeNull();
    expect(getPlanShiftIndex(planet, 'metal', 'earlier')).toBeNull();
  });

  it('lets the planet active item move later but never earlier', () => {
    expect(getPlanShiftIndex(planet, 'farm', 'later')).toBe(1);
    expect(getPlanShiftIndex(planet, 'farm', 'earlier')).toBeNull();
    expect(getPlanShiftIndex({ ...planet, pendingIds: [] }, 'farm', 'later')).toBeNull();
  });

  it('shifts within the combined research list', () => {
    expect(getPlanShiftIndex(research, 'pm', 'later')).toBe(1);
    expect(getPlanShiftIndex(research, 'rc', 'earlier')).toBe(0);
    expect(getPlanShiftIndex(research, 'ft', 'later')).toBeNull();
  });
});
