import { EnginePlugin, GameState } from './BaseTypes';

export interface ComboPluginState {
  count: number;
  lastTapTime: number;
  multiplier: number;
}

const COMBO_WINDOW_MS = 1500;
const MAX_COMBO = 20;

export class ComboPlugin implements EnginePlugin {
  id = 'combo';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        count: 0,
        lastTapTime: 0,
        multiplier: 1,
      } as ComboPluginState);
    }
  }

  onTick(state: GameState, _deltaSec: number) {
    const cState: ComboPluginState = state.pluginState[this.id];
    if (!cState || cState.count === 0) return;

    const now = Date.now();
    if (now - cState.lastTapTime > COMBO_WINDOW_MS) {
      return {
        pluginState: {
          [this.id]: { count: 0, lastTapTime: cState.lastTapTime, multiplier: 1 },
        },
      };
    }
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const cState: ComboPluginState = state.pluginState[this.id];
    if (!cState) return undefined;

    return {
      combo: {
        count: cState.count,
        multiplier: cState.multiplier,
        active: cState.count > 0,
      },
    };
  }

  onAction(state: GameState, action: any) {
    if (action.type !== 'TAP_DAMAGE') return;

    const cState: ComboPluginState = state.pluginState[this.id];
    if (!cState) return;

    const now = Date.now();
    const withinWindow = now - cState.lastTapTime <= COMBO_WINDOW_MS;
    const newCount = withinWindow ? Math.min(cState.count + 1, MAX_COMBO) : 1;
    const multiplier = 1 + newCount * 0.1;

    return {
      pluginState: {
        [this.id]: { count: newCount, lastTapTime: now, multiplier },
      },
    };
  }
}
