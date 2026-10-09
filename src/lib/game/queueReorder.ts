/**
 * Plan-order index math for queue reordering, independent of the viewed turn.
 * Reorder commands edit the plan at its start (planet start turn / global research root),
 * so drop and arrow targets must be expressed in that queue's index space.
 */
export interface PlanLaneOrder {
  activeId: string | null;
  pendingIds: string[];
  /** true when the reorder command indexes [active, ...pending] as one list (global research). */
  activeInIndexSpace: boolean;
}

export type ShiftDirection = 'later' | 'earlier';

/** Reads a lane's plan order from its queue at the plan start. */
export function planOrderFromLane(
  lane: { active: { id: string } | null; pendingQueue: Array<{ id: string }> },
  activeInIndexSpace: boolean
): PlanLaneOrder {
  return { activeId: lane.active?.id ?? null, pendingIds: lane.pendingQueue.map((item) => item.id), activeInIndexSpace };
}

function combinedIds(order: PlanLaneOrder): string[] {
  return order.activeId ? [order.activeId, ...order.pendingIds] : [...order.pendingIds];
}

function isInPlan(order: PlanLaneOrder, id: string): boolean {
  return id === order.activeId || order.pendingIds.includes(id);
}

/** Index to pass to the reorder command so `draggedId` takes `targetId`'s slot; null when the drop is invalid. */
export function getPlanDropIndex(order: PlanLaneOrder, draggedId: string, targetId: string): number | null {
  if (draggedId === targetId || !isInPlan(order, draggedId)) return null;
  const ids = order.activeInIndexSpace ? combinedIds(order) : order.pendingIds;
  const index = ids.indexOf(targetId);
  if (index < 0) return null;
  // A planet's active item is re-inserted rather than moved, so step past the target to land after it.
  const insertsFromOutside = !order.activeInIndexSpace && draggedId === order.activeId;
  return insertsFromOutside ? index + 1 : index;
}

/** Index that moves `entryId` one slot later or earlier in the plan; null at the edges. */
export function getPlanShiftIndex(order: PlanLaneOrder, entryId: string, direction: ShiftDirection): number | null {
  if (order.activeInIndexSpace) {
    const ids = combinedIds(order);
    const index = ids.indexOf(entryId);
    if (index < 0) return null;
    const next = direction === 'later' ? index + 1 : index - 1;
    return next >= 0 && next < ids.length ? next : null;
  }
  if (entryId === order.activeId) {
    // Re-inserting the active item at pending index 1 lets the first pending item start before it.
    return direction === 'later' && order.pendingIds.length > 0 ? 1 : null;
  }
  const index = order.pendingIds.indexOf(entryId);
  if (index < 0) return null;
  const next = direction === 'later' ? index + 1 : index - 1;
  return next >= 0 && next < order.pendingIds.length ? next : null;
}
