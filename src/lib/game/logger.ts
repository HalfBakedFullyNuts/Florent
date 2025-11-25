/**
 * Game logging system for debugging and analysis
 * Logs operations to CSV files in logs/ directory
 */

import type { PlanetState, LaneId, WorkItem } from '../sim/engine/types';

export interface LoggerConfig {
  enabled: boolean;
  sessionId: string;
  logDir: string;
}

export interface QueueOperation {
  timestamp: string;
  turn: number;
  operation: 'queue' | 'cancel' | 'reorder' | 'activate' | 'complete';
  laneId: LaneId;
  itemId: string;
  itemName: string;
  quantity?: number;
  details?: string;
}

export interface StateSnapshot {
  timestamp: string;
  turn: number;
  metal: number;
  mineral: number;
  food: number;
  energy: number;
  research_points: number;
  workersTotal: number;
  workersIdle: number;
  soldiers: number;
  scientists: number;
  buildingActive: string;
  buildingPending: number;
  shipActive: string;
  shipPending: number;
  colonistActive: string;
  colonistPending: number;
  researchActive: string;
  researchPending: number;
}

export interface TimelineEvent {
  timestamp: string;
  turn: number;
  event: 'mutation' | 'recompute' | 'stable_state' | 'advance';
  description: string;
  affectedTurns?: number;
}

class GameLogger {
  private config: LoggerConfig;
  private queueOps: QueueOperation[] = [];
  private stateSnapshots: StateSnapshot[] = [];
  private timelineEvents: TimelineEvent[] = [];
  private flushInterval: number = 50; // Flush every 50 operations
  private opCount: number = 0;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  /**
   * Enable or disable logging at runtime
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Log a queue operation
   */
  logQueueOperation(
    turn: number,
    operation: QueueOperation['operation'],
    laneId: LaneId,
    itemId: string,
    itemName: string,
    quantity?: number,
    details?: string
  ): void {
    if (!this.config.enabled) return;

    this.queueOps.push({
      timestamp: new Date().toISOString(),
      turn,
      operation,
      laneId,
      itemId,
      itemName,
      quantity,
      details,
    });

    this.incrementAndFlush();
  }

  /**
   * Log a state snapshot
   */
  logStateSnapshot(state: PlanetState): void {
    if (!this.config.enabled) return;

    this.stateSnapshots.push({
      timestamp: new Date().toISOString(),
      turn: state.currentTurn,
      metal: Math.round(state.stocks.metal),
      mineral: Math.round(state.stocks.mineral),
      food: Math.round(state.stocks.food),
      energy: Math.round(state.stocks.energy),
      research_points: Math.round(state.stocks.research_points),
      workersTotal: state.population.workersTotal,
      workersIdle: state.population.workersIdle,
      soldiers: state.population.soldiers,
      scientists: state.population.scientists,
      buildingActive: state.lanes.building.active?.itemId || '',
      buildingPending: state.lanes.building.pendingQueue.length,
      shipActive: state.lanes.ship.active?.itemId || '',
      shipPending: state.lanes.ship.pendingQueue.length,
      colonistActive: state.lanes.colonist.active?.itemId || '',
      colonistPending: state.lanes.colonist.pendingQueue.length,
      researchActive: state.lanes.research.active?.itemId || '',
      researchPending: state.lanes.research.pendingQueue.length,
    });

    this.incrementAndFlush();
  }

  /**
   * Log a timeline event
   */
  logTimelineEvent(
    turn: number,
    event: TimelineEvent['event'],
    description: string,
    affectedTurns?: number
  ): void {
    if (!this.config.enabled) return;

    this.timelineEvents.push({
      timestamp: new Date().toISOString(),
      turn,
      event,
      description,
      affectedTurns,
    });

    this.incrementAndFlush();
  }

  /**
   * Increment operation count and flush if needed
   */
  private incrementAndFlush(): void {
    this.opCount++;
    if (this.opCount >= this.flushInterval) {
      this.flush();
    }
  }

  /**
   * Flush all logs to files
   */
  async flush(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Write queue operations
      if (this.queueOps.length > 0) {
        await this.writeQueueOperations();
        this.queueOps = [];
      }

      // Write state snapshots
      if (this.stateSnapshots.length > 0) {
        await this.writeStateSnapshots();
        this.stateSnapshots = [];
      }

      // Write timeline events
      if (this.timelineEvents.length > 0) {
        await this.writeTimelineEvents();
        this.timelineEvents = [];
      }

      this.opCount = 0;
    } catch (error) {
      console.error('[Logger] Failed to flush logs:', error);
    }
  }

  /**
   * Write queue operations to CSV
   */
  private async writeQueueOperations(): Promise<void> {
    const csv = this.queueOpsToCSV(this.queueOps);
    await this.appendToFile('queue_operations.csv', csv);
  }

  /**
   * Write state snapshots to CSV
   */
  private async writeStateSnapshots(): Promise<void> {
    const csv = this.stateSnapshotsToCSV(this.stateSnapshots);
    await this.appendToFile('planet_states.csv', csv);
  }

  /**
   * Write timeline events to CSV
   */
  private async writeTimelineEvents(): Promise<void> {
    const csv = this.timelineEventsToCSV(this.timelineEvents);
    await this.appendToFile('timeline_events.csv', csv);
  }

  /**
   * Convert queue operations to CSV format
   */
  private queueOpsToCSV(ops: QueueOperation[]): string {
    return ops
      .map(
        (op) =>
          `${op.timestamp},${op.turn},${op.operation},${op.laneId},${op.itemId},${op.itemName},${op.quantity || ''},${op.details || ''}`
      )
      .join('\n');
  }

  /**
   * Convert state snapshots to CSV format
   */
  private stateSnapshotsToCSV(snapshots: StateSnapshot[]): string {
    return snapshots
      .map(
        (s) =>
          `${s.timestamp},${s.turn},${s.metal},${s.mineral},${s.food},${s.energy},${s.research_points},${s.workersTotal},${s.workersIdle},${s.soldiers},${s.scientists},${s.buildingActive},${s.buildingPending},${s.shipActive},${s.shipPending},${s.colonistActive},${s.colonistPending},${s.researchActive},${s.researchPending}`
      )
      .join('\n');
  }

  /**
   * Convert timeline events to CSV format
   */
  private timelineEventsToCSV(events: TimelineEvent[]): string {
    return events
      .map(
        (e) =>
          `${e.timestamp},${e.turn},${e.event},${e.description},${e.affectedTurns || ''}`
      )
      .join('\n');
  }

  /**
   * Append data to log file (browser only - uses localStorage)
   */
  private async appendToFile(filename: string, data: string): Promise<void> {
    // Browser environment - use localStorage
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const key = `${this.config.sessionId}_${filename}`;
        const existing = localStorage.getItem(key) || '';
        localStorage.setItem(key, existing + data + '\n');
      } catch (error) {
        // localStorage may be full or unavailable
        console.warn('[Logger] Failed to write to localStorage:', error);
      }
    }
    // Note: File system logging removed to avoid Next.js bundling issues
    // For server-side logging, implement a separate logger module
  }

  /**
   * Initialize CSV files with headers
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Queue operations header
      await this.appendToFile(
        'queue_operations.csv',
        'timestamp,turn,operation,laneId,itemId,itemName,quantity,details'
      );

      // State snapshots header
      await this.appendToFile(
        'planet_states.csv',
        'timestamp,turn,metal,mineral,food,energy,research_points,workersTotal,workersIdle,soldiers,scientists,buildingActive,buildingPending,shipActive,shipPending,colonistActive,colonistPending,researchActive,researchPending'
      );

      // Timeline events header
      await this.appendToFile(
        'timeline_events.csv',
        'timestamp,turn,event,description,affectedTurns'
      );
    } catch (error) {
      console.error('[Logger] Failed to initialize log files:', error);
    }
  }

  /**
   * Export logs from localStorage (browser only)
   */
  exportLogsFromBrowser(): { filename: string; content: string }[] {
    if (typeof window === 'undefined') return [];

    const logs: { filename: string; content: string }[] = [];
    const prefix = `${this.config.sessionId}_`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const filename = key.replace(prefix, '');
        const content = localStorage.getItem(key) || '';
        logs.push({ filename, content });
      }
    }

    return logs;
  }

  /**
   * Clear logs from localStorage (browser only)
   */
  clearLogsFromBrowser(): void {
    if (typeof window === 'undefined') return;

    const prefix = `${this.config.sessionId}_`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}

// Singleton instance
let loggerInstance: GameLogger | null = null;

/**
 * Initialize the global logger
 */
export function initLogger(enabled: boolean = false): GameLogger {
  const sessionId = `session_${Date.now()}`;
  const config: LoggerConfig = {
    enabled,
    sessionId,
    logDir: 'logs',
  };

  loggerInstance = new GameLogger(config);
  loggerInstance.initialize();
  return loggerInstance;
}

/**
 * Get the global logger instance
 */
export function getLogger(): GameLogger {
  if (!loggerInstance) {
    return initLogger(false);
  }
  return loggerInstance;
}

/**
 * Enable logging globally
 */
export function enableLogging(): void {
  getLogger().setEnabled(true);
}

/**
 * Disable logging globally
 */
export function disableLogging(): void {
  getLogger().setEnabled(false);
}
