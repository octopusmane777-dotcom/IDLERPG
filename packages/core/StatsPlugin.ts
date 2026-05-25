import { EnginePlugin, GameState } from './BaseTypes';

export interface StatsPluginState {
  totalTaps: number;
  totalGoldEarned: number;
  totalKills: number;
  totalSecondsPlayed: number;
  totalBossesDefeated: number;
  totalMissionsClaimed: number;
  totalPrestiges: number;
}

export class StatsPlugin implements EnginePlugin {
  id = 'stats';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id) as StatsPluginState | undefined;
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        totalTaps: 0,
        totalGoldEarned: 0,
        totalKills: 0,
        totalSecondsPlayed: 0,
        totalBossesDefeated: 0,
        totalMissionsClaimed: 0,
        totalPrestiges: 0,
      } as StatsPluginState);
    }
  }

  onTick(state: GameState, delta: number): Partial<GameState> | void {
    const s: StatsPluginState = state.pluginState[this.id];
    if (!s) return;
    return {
      pluginState: {
        [this.id]: { ...s, totalSecondsPlayed: s.totalSecondsPlayed + delta },
      },
    };
  }

  onAction(state: GameState, action: any): Partial<GameState> | void {
    const s: StatsPluginState = state.pluginState[this.id];
    if (!s) return;
    const updates: Partial<StatsPluginState> = {};

    if (action.type === 'TAP_DAMAGE') {
      updates.totalTaps = s.totalTaps + 1;
    } else if (action.type === 'PRESTIGE') {
      updates.totalPrestiges = s.totalPrestiges + 1;
    } else if (action.type === 'CLAIM_MISSION') {
      updates.totalMissionsClaimed = s.totalMissionsClaimed + 1;
    }

    if (Object.keys(updates).length === 0) return;
    return { pluginState: { [this.id]: { ...s, ...updates } } };
  }

  onKill(state: GameState, _killCount: number): Partial<GameState> | void {
    const s: StatsPluginState = state.pluginState[this.id];
    if (!s) return;
    const bossPs = state.pluginState.boss as any;
    const bossDefeatedDelta = bossPs?.lastKillWasBoss ? 1 : 0;
    return {
      pluginState: {
        [this.id]: {
          ...s,
          totalKills: s.totalKills + 1,
          totalBossesDefeated: s.totalBossesDefeated + bossDefeatedDelta,
        },
      },
    };
  }

  getActionMetadata(_state: GameState): Record<string, any> | undefined {
    return undefined;
  }
}
