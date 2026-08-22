/**
 * Engine telemetry hook (engine-level).
 *
 * The engine stays framework- and orchestration-free: it reports queue events
 * through this injectable hook. The game layer registers an adapter backed by
 * the real logger; when nothing is registered, calls are no-ops.
 */

export interface EngineQueueEvent {
  turn: number;
  op: 'activate' | 'complete' | 'cancel' | 'queue' | string;
  laneId: string;
  itemId: string;
  itemName: string;
  quantity?: number;
  note?: string;
}

export interface EngineTelemetry {
  logQueueOperation(event: EngineQueueEvent): void;
}

const NULL_TELEMETRY: EngineTelemetry = {
  logQueueOperation: () => undefined,
};

let telemetry: EngineTelemetry | null = null;

export function setEngineTelemetry(t: EngineTelemetry | null): void {
  telemetry = t;
}

export function getEngineTelemetry(): EngineTelemetry {
  return telemetry ?? NULL_TELEMETRY;
}
