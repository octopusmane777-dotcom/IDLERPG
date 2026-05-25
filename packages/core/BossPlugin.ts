import { EnginePlugin, GameState } from './BaseTypes';

export interface BossPluginState {
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  bossTimer: number;
  bossesDefeated: number;
  nextBossAt: number;       // kept for migration compat, no longer used for spawn logic
  bossHpPersisted: number;  // HP carried between failed attempts
  bossAttempts: number;     // how many times this boss has been attempted (resets at 3)
  lastStageRolled: number;  // last stage number where a boss roll was attempted
}

const BOSS_TIMER_SEC = 30;
const BOSS_HP_MULTIPLIER = 10;
const BOSS_SPAWN_CHANCE = 0.15; // 15% chance per stage completion
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
        nextBossAt: 0,
        bossHpPersisted: 0,
        bossAttempts: 0,
        lastStageRolled: 0,
      } as BossPluginState);
    }
  }

  onTick(state: GameState, deltaSec: number) {
    const bState: BossPluginState = state.pluginState[this.id];
    if (!bState) return;

    if (!bState.bossActive) {
      // Roll for boss spawn when a new stage of 10 fights completes (level divisible by 10)
      // and we haven't already rolled for this stage.
      const currentStage = Math.floor(state.level / 10);
      const lastRolled = bState.lastStageRolled ?? 0;
      if (currentStage > 0 && currentStage > lastRolled && state.level % 10 === 0) {
        const spawns = Math.random() < BOSS_SPAWN_CHANCE;
        if (spawns) {
          const adaptiveState = state.pluginState.adaptive;
          const baseMaxHp = adaptiveState?.monsterMaxHp ?? 10;
          const freshBoss = (bState.bossAttempts ?? 0) === 0 || (bState.bossHpPersisted ?? 0) <= 0;
          const bossMaxHp = freshBoss ? Math.round(baseMaxHp * BOSS_HP_MULTIPLIER) : bState.bossMaxHp;
          const bossHp = freshBoss ? bossMaxHp : (bState.bossHpPersisted ?? bossMaxHp);
          return {
            pluginState: {
              [this.id]: {
                ...bState,
                bossActive: true,
                bossHp,
                bossMaxHp,
                bossTimer: BOSS_TIMER_SEC,
                lastStageRolled: currentStage,
              },
            },
          };
        }
        // No spawn this stage — just record the roll
        return {
          pluginState: {
            [this.id]: { ...bState, lastStageRolled: currentStage },
          },
        };
      }
      return;
    }

    // Boss active — tick down timer
    const newTimer = Math.max(0, bState.bossTimer - deltaSec);
    if (newTimer <= 0) {
      // Boss retreats — persist remaining HP and increment attempt counter
      const attempts = (bState.bossAttempts ?? 0) + 1;
      const freshBoss = attempts >= 3;
      return {
        pluginState: {
          [this.id]: {
            ...bState,
            bossActive: false,
            bossTimer: 0,
            bossHpPersisted: freshBoss ? 0 : bState.bossHp,
            bossAttempts: freshBoss ? 0 : attempts,
          },
        },
      };
    }

    // Apply combined auto-DPS (adaptive + network nodes) to boss HP each tick
    const autoDps = _calcAutoDps(state);
    const hpAfterDps = Math.max(0, bState.bossHp - autoDps * deltaSec);

    if (hpAfterDps <= 0) {
      const goldReward = Math.round((10 + 8 * state.level) * BOSS_GOLD_MULTIPLIER);
      return {
        resources: { ...state.resources, gold: (state.resources.gold || 0) + goldReward },
        pluginState: {
          [this.id]: {
            ...bState,
            bossActive: false,
            bossHp: 0,
            bossTimer: 0,
            bossHpPersisted: 0,
            bossAttempts: 0,
            bossesDefeated: bState.bossesDefeated + 1,
          },
        },
      };
    }

    return {
      pluginState: {
        [this.id]: { ...bState, bossHp: hpAfterDps, bossTimer: newTimer },
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
        bossAttempts: bState.bossAttempts ?? 0,
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
      // Boss defeated — clear persistence for this boss
      const goldReward = Math.round((10 + 8 * state.level) * BOSS_GOLD_MULTIPLIER);
      return {
        resources: { ...state.resources, gold: (state.resources.gold || 0) + goldReward },
        pluginState: {
          [this.id]: {
            ...bState,
            bossActive: false,
            bossHp: 0,
            bossTimer: 0,
            bossHpPersisted: 0,
            bossAttempts: 0,
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

/** Compute total auto-DPS from AdaptiveModule + NetworkPlugin for boss tick damage. */
function _calcAutoDps(state: GameState): number {
  // Adaptive base auto DPS (mirrors AdaptiveModule.onTick logic)
  const adaptiveState = state.pluginState?.adaptive;
  const eq = state.pluginState?.equipment;
  let gearAutoDps = 0;
  let gearTapDmg = 0;
  if (eq) {
    const slots: string[] = [...(eq.ramSlots || []), ...(eq.gpuSlots || [])];
    for (const itemId of slots) {
      if (!itemId) continue;
      const item = (eq.inventory || []).find((g: any) => g.id === itemId);
      if (item?.bonuses?.autoDps)    gearAutoDps  += item.bonuses.autoDps;
      if (item?.bonuses?.tapDamage)  gearTapDmg   += item.bonuses.tapDamage;
    }
  }
  const st = state.pluginState?.skilltree;
  let autoDpsMult = 1;
  let autoDpsBonus = 0;
  let tapDmgMult = 1;
  let surgeProtocol = false;
  if (st) {
    const u = new Set<string>(st.unlocked ?? []);
    autoDpsMult  = 1 + (u.has('p1') ? 0.30 : 0) + (u.has('a3') ? 0.05 : 0);
    autoDpsBonus = u.has('p2') ? 2 : 0;
    tapDmgMult   = 1
      + (u.has('s1') ? 0.15 : 0) + (u.has('s2') ? 0.20 : 0) + (u.has('s4') ? 0.25 : 0)
      + (u.has('p1') ? 0.05 : 0) + (u.has('p3') ? 0.10 : 0) + (u.has('a2') ? 0.05 : 0);
    surgeProtocol = u.has('s6');
  }
  const tapContrib = surgeProtocol ? ((adaptiveState?.tapDamage || 1) + gearTapDmg) * tapDmgMult * 0.25 : 0;
  const adaptiveDps = (1 + gearAutoDps + autoDpsBonus) * autoDpsMult + tapContrib;

  // Network node DPS
  const nState = state.pluginState?.network;
  let networkDps = 0;
  if (nState?.nodes) {
    const NODE_RATES: Record<string, number> = {
      bot_farm: 1, scraper: 5, proxy_cluster: 20, ai_server: 100, quantum_core: 600,
    };
    for (const [id, count] of Object.entries(nState.nodes as Record<string, number>)) {
      networkDps += count * (NODE_RATES[id] ?? 0);
    }
  }

  return adaptiveDps + networkDps;
}
