import { EnginePlugin, GameState } from './BaseTypes';

export interface BossPluginState {
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  bossTimer: number; // seconds remaining before boss retreats
  bossesDefeated: number;
  nextBossAt: number; // stage level that triggers the next boss
}

const BOSS_TIMER_SEC = 30;
const BOSS_HP_MULTIPLIER = 10;
const BOSS_INTERVAL = 10; // every 10 stage kills
const BOSS_GOLD_MULTIPLIER = 3;

export class BossPlugin implements EnginePlugin {
  id = 'boss';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        bossActive: false,
        bossHp: 0,
        bossMaxHp: 0,
        bossTimer: 0,
        bossesDefeated: 0,
        nextBossAt: BOSS_INTERVAL,
      } as BossPluginState);
    }
  }

  onTick(state: GameState, deltaSec: number) {
    const bState: BossPluginState = state.pluginState[this.id];
    if (!bState) return;

    if (!bState.bossActive) {
      // Check if it's time to spawn a boss
      if (state.level >= bState.nextBossAt) {
        const adaptiveState = state.pluginState.adaptive;
        const baseMaxHp = adaptiveState?.monsterMaxHp ?? 10;
        const bossMaxHp = Math.round(baseMaxHp * BOSS_HP_MULTIPLIER);
        return {
          pluginState: {
            [this.id]: {
              ...bState,
              bossActive: true,
              bossHp: bossMaxHp,
              bossMaxHp,
              bossTimer: BOSS_TIMER_SEC,
              nextBossAt: bState.nextBossAt + BOSS_INTERVAL,
            },
          },
        };
      }
      return;
    }

    // Boss active — tick down timer
    const newTimer = Math.max(0, bState.bossTimer - deltaSec);
    if (newTimer <= 0) {
      // Boss retreats
      return {
        pluginState: {
          [this.id]: { ...bState, bossActive: false, bossHp: 0, bossTimer: 0 },
        },
      };
    }

    return {
      pluginState: {
        [this.id]: { ...bState, bossTimer: newTimer },
      },
    };
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const bState: BossPluginState = state.pluginState[this.id];
    if (!bState) return undefined;

    return {
      boss: {
        bossActive: bState.bossActive,
        bossHp: bState.bossHp,
        bossMaxHp: bState.bossMaxHp,
        bossTimer: bState.bossTimer,
        bossesDefeated: bState.bossesDefeated,
        nextBossAt: bState.nextBossAt,
      },
    };
  }

  /** Apply damage to the active boss. Called from the app UI layer via PLUGIN_ACTION. */
  onAction(state: GameState, action: any) {
    const bState: BossPluginState = state.pluginState[this.id];
    if (!bState || !bState.bossActive) return;

    if (action.type !== 'BOSS_DAMAGE') return;

    const damage: number = action.damage ?? 0;
    const newHp = Math.max(0, bState.bossHp - damage);

    if (newHp <= 0) {
      // Boss defeated
      const goldReward = Math.round((10 + 8 * state.level) * BOSS_GOLD_MULTIPLIER);
      return {
        resources: { ...state.resources, gold: (state.resources.gold || 0) + goldReward },
        pluginState: {
          [this.id]: {
            ...bState,
            bossActive: false,
            bossHp: 0,
            bossTimer: 0,
            bossesDefeated: bState.bossesDefeated + 1,
          },
        },
      };
    }

    return {
      pluginState: {
        [this.id]: { ...bState, bossHp: newHp },
      },
    };
  }
}
