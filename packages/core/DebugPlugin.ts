import { EnginePlugin, GameState } from './BaseTypes';

export interface DebugPluginState {
  /** Whether the debug panel is visible */
  visible: boolean;
}

export class DebugPlugin implements EnginePlugin {
  id = 'debug';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, { visible: false } as DebugPluginState);
    }
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const dState: DebugPluginState = state.pluginState[this.id];
    return {
      debug: { visible: dState?.visible ?? false },
    };
  }

  onAction(state: GameState, action: any) {
    if (!action || action.type === 'TOGGLE_DEBUG') {
      const dState: DebugPluginState = state.pluginState[this.id];
      return {
        pluginState: {
          [this.id]: { visible: !(dState?.visible ?? false) },
        },
      };
    }

    if (action.type === 'ADD_GOLD') {
      return {
        resources: { ...state.resources, gold: (state.resources.gold || 0) + (action.amount ?? 1000) },
      };
    }

    if (action.type === 'SET_LEVEL') {
      const newLevel = action.level ?? 10;
      const newGps = 1 + (newLevel - 1) * 2;
      // Reset progression costs for new level
      const generationCost = Math.round(10 * Math.pow(1.25, Math.max(0, newGps - 1)) + newLevel * 2);
      const levelUpCost = Math.round(40 * Math.pow(1.35, Math.max(1, newLevel) - 1));
      return {
        level: newLevel,
        generationRates: { gold: newGps },
        pluginState: {
          progression: {
            generation: { resource: 'gold', nextAmount: 1, cost: generationCost },
            level: { level: newLevel, cost: levelUpCost },
          },
        },
      };
    }

    if (action.type === 'TIME_WARP') {
      return {
        pluginState: {
          _timeWarpSec: (action.seconds ?? 3600),
        },
      };
    }
  }
}