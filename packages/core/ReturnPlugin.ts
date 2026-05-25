import { EnginePlugin, GameState } from './BaseTypes';

export interface ReturnBonus {
  awaySeconds: number;
  goldEarned: number;
  missionsReset: boolean;
}

export interface ReturnPluginState {
  lastSeenAt: number;
  pendingBonus: ReturnBonus | null;
}

const THRESHOLD_SECONDS = 2 * 60 * 60;

export class ReturnPlugin implements EnginePlugin {
  id = 'return';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id) as ReturnPluginState | undefined;
    const now = Date.now();

    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        lastSeenAt: now,
        pendingBonus: null,
      } as ReturnPluginState);
      return;
    }

    const awaySeconds = (now - existing.lastSeenAt) / 1000;
    if (awaySeconds >= THRESHOLD_SECONDS) {
      const networkPs = engine.getPluginState('network') as any;
      const totalRate = networkPs?.totalOutput ?? 0;
      const cappedAway = Math.min(awaySeconds, 8 * 3600);
      const goldEarned = Math.floor(totalRate * cappedAway);

      const missionsPs = engine.getPluginState('missions') as any;
      const currentDay = Math.floor(now / 86400000);
      const savedDay = missionsPs?.dayKey ?? currentDay;
      const missionsReset = currentDay > savedDay;

      engine.setPluginState(this.id, {
        lastSeenAt: now,
        pendingBonus: { awaySeconds: Math.floor(cappedAway), goldEarned, missionsReset },
      } as ReturnPluginState);
    } else {
      engine.setPluginState(this.id, { ...existing, lastSeenAt: now });
    }
  }

  onTick(state: GameState, _delta: number): Partial<GameState> | void {
    const s: ReturnPluginState = state.pluginState[this.id];
    if (!s) return;
    const now = Date.now();
    if (Math.floor(now / 30000) !== Math.floor(s.lastSeenAt / 30000)) {
      return { pluginState: { [this.id]: { ...s, lastSeenAt: now } } };
    }
  }

  onAction(state: GameState, action: any): Partial<GameState> | void {
    const s: ReturnPluginState = state.pluginState[this.id];
    if (!s) return;
    if (action.type === 'DISMISS_BONUS') {
      return { pluginState: { [this.id]: { ...s, pendingBonus: null } } };
    }
  }

  getActionMetadata(_state: GameState): Record<string, any> | undefined {
    return undefined;
  }
}
