import { EnginePlugin, GameState } from './BaseTypes';

export interface AnalyticsPluginState {
  /** Whether analytics logging is enabled (opt-in) */
  enabled: boolean;
  /** Array of logged events */
  events: Array<{ type: string; timestamp: number; data?: any }>;
  /** Session start time */
  sessionStart: number;
}

export class AnalyticsPlugin implements EnginePlugin {
  id = 'analytics';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        enabled: false, // opt-in by default — player must enable
        events: [],
        sessionStart: Date.now(),
      } as AnalyticsPluginState);
    }
  }

  /** Log an event (only if analytics is enabled) */
  logEvent(state: GameState, type: string, data?: any): Partial<GameState> | void {
    const aState: AnalyticsPluginState = state.pluginState[this.id];
    if (!aState || !aState.enabled) return;

    const event = { type, timestamp: Date.now(), data };
    return {
      pluginState: {
        ...state.pluginState,
        [this.id]: {
          ...aState,
          events: [...(aState.events || []), event].slice(-500), // keep last 500
        },
      },
    };
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const aState: AnalyticsPluginState = state.pluginState[this.id];
    if (!aState) return undefined;

    return {
      analytics: {
        enabled: aState.enabled,
        eventCount: (aState.events || []).length,
        sessionMinutes: Math.floor((Date.now() - (aState.sessionStart || Date.now())) / 60000),
      },
    };
  }

  onAction(state: GameState, action: any) {
    if (action.type === 'TOGGLE_ANALYTICS') {
      const aState: AnalyticsPluginState = state.pluginState[this.id];
      return {
        pluginState: {
          ...state.pluginState,
          [this.id]: {
            ...aState,
            enabled: !(aState?.enabled ?? false),
            sessionStart: aState?.sessionStart || Date.now(),
          },
        },
      };
    }

    if (action.type === 'RESET_ANALYTICS') {
      return {
        pluginState: {
          ...state.pluginState,
          [this.id]: {
            enabled: false,
            events: [],
            sessionStart: Date.now(),
          },
        },
      };
    }

    // Log various game events
    const result = this.logEvent(state, action.type, {
      level: state.level,
      gold: state.resources.gold,
    });
    return result ? result : undefined;
  }
}