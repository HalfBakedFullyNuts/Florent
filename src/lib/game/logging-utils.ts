/**
 * Browser utilities for logging management
 * Exposes logging controls to the browser console for debugging
 */

import { getLogger, enableLogging, disableLogging, initLogger } from './logger';

/**
 * Enable game logging and expose controls to window for console access
 */
export function setupLogging() {
  // Initialize logger (disabled by default)
  initLogger(false);

  // Expose logging controls to window for console access
  if (typeof window !== 'undefined') {
    (window as any).gameLogger = {
      enable: () => {
        enableLogging();
        console.log('[Logger] Logging enabled. Operations will be logged to browser localStorage.');
        console.log('[Logger] Use gameLogger.export() to download logs or gameLogger.clear() to remove them.');
      },
      disable: () => {
        disableLogging();
        console.log('[Logger] Logging disabled.');
      },
      flush: async () => {
        await getLogger().flush();
        console.log('[Logger] Logs flushed to storage.');
      },
      export: () => {
        const logs = getLogger().exportLogsFromBrowser();
        logs.forEach(({ filename, content }) => {
          const blob = new Blob([content], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
        });
        console.log(`[Logger] Exported ${logs.length} log files.`);
      },
      clear: () => {
        getLogger().clearLogsFromBrowser();
        console.log('[Logger] Logs cleared from localStorage.');
      },
      status: () => {
        const logger = getLogger();
        console.log('[Logger] Status:', {
          enabled: logger.isEnabled(),
          logs: logger.exportLogsFromBrowser().length,
        });
      },
      help: () => {
        console.log(`
Game Logger Commands:
---------------------
gameLogger.enable()   - Enable logging (logs to browser localStorage)
gameLogger.disable()  - Disable logging
gameLogger.flush()    - Force flush logs to storage
gameLogger.export()   - Download all logs as CSV files
gameLogger.clear()    - Clear all logs from localStorage
gameLogger.status()   - Show logging status
gameLogger.help()     - Show this help message

Logged Data:
-----------
1. queue_operations.csv - All queue operations (queue, cancel, reorder, activate, complete)
2. planet_states.csv    - State snapshots (resources, population, lane status)
3. timeline_events.csv  - Timeline events (mutations, recompute, stable state, advance)

Usage Example:
-------------
> gameLogger.enable()
> // Play the game, queue items, advance turns
> gameLogger.export()    // Download logs
> gameLogger.clear()     // Clean up localStorage
        `);
      },
    };

    console.log('[Logger] Game logging utilities loaded. Type "gameLogger.help()" for usage.');
  }
}

/**
 * Example: Enable logging for the next N turns
 */
export function logNextTurns(turns: number) {
  enableLogging();
  console.log(`[Logger] Logging enabled for next ${turns} turns`);

  setTimeout(() => {
    disableLogging();
    console.log('[Logger] Logging disabled after turn limit reached');
    console.log('[Logger] Use gameLogger.export() to download logs');
  }, turns * 1000); // Approximate timing
}

/**
 * Example: Log a specific game session
 */
export function startGameSession(sessionName: string) {
  enableLogging();
  console.log(`[Logger] Session "${sessionName}" started - logging enabled`);

  return {
    end: async () => {
      await getLogger().flush();
      disableLogging();
      console.log(`[Logger] Session "${sessionName}" ended`);
      console.log('[Logger] Use gameLogger.export() to download session logs');
    },
  };
}
