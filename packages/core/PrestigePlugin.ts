import { EnginePlugin, GameState } from './BaseTypes';

export interface PrestigePluginState {
  /** Permanent prestige currency earned from resets */
  cores: number;
  /** Total gold earned across all runs (lifetime) */
  lifetimeGold: number;
  /** Multiplier applied to base gold/sec: 1 + cores * 0.05 */
  bonusMultiplier: number;
}

const BONUS_PER_CORE = 0.05; // +5% gold/sec per core

export class PrestigePlugin implements EnginePlugin {
  id = 'prestige';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        cores: 0,
        lifetimeGold: 0,
        bonusMultiplier: 1.0,
      } as PrestigePluginState);
    }
  }

  /** Get level threshold required to prestige (scales per core) */
  getRequiredLevel(state: GameState): number {
    const pState: PrestigePluginState = state.pluginState[this.id];
    const cores = pState?.cores ?? 0;
    return 10 + cores * 5; // 10, 15, 20, 25...
  }

  onTick(state: GameState, deltaSec: number) {
    const pState: PrestigePluginState = state.pluginState[this.id];
    if (!pState) return;

    const currentGps = state.generationRates.gold || 0;
    const multiplier = pState.bonusMultiplier || 1;

    // Track lifetime gold (total including bonus)
    const goldGained = currentGps * deltaSec * multiplier;
    const newLifetime = (pState.lifetimeGold || 0) + goldGained;

    // Add bonus gold on top of the base generation the engine already processed
    // Base generation runs at 1x rate; we add the (multiplier - 1) portion here
    const bonusGold = currentGps * deltaSec * (multiplier - 1);
    const nextResources = { ...state.resources };
    if (bonusGold > 0) {
      nextResources.gold = (nextResources.gold || 0) + bonusGold;
    }

    return {
      resources: nextResources,
      pluginState: {
        [this.id]: {
          ...pState,
          lifetimeGold: newLifetime,
        },
      },
    };
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const pState: PrestigePluginState = state.pluginState[this.id];
    if (!pState) return undefined;

    const requiredLevel = this.getRequiredLevel(state);
    const canPrestige = state.level >= requiredLevel;

    return {
      prestige: {
        cores: pState.cores,
        lifetimeGold: pState.lifetimeGold,
        bonusMultiplier: pState.bonusMultiplier,
        requiredLevel,
        canPrestige,
        nextBonus: 1 + (pState.cores + 1) * BONUS_PER_CORE,
      },
    };
  }

  onAction(state: GameState, action: any) {
    if (!action || action.type !== 'PRESTIGE') return;

    const pState: PrestigePluginState = state.pluginState[this.id];
    if (!pState) return;

    const requiredLevel = this.getRequiredLevel(state);
    if (state.level < requiredLevel) return;

    // Reset progression, grant core
    const newCores = pState.cores + 1;
    const newMultiplier = 1 + newCores * BONUS_PER_CORE;

    const resetPluginState: Record<string, any> = {
      [this.id]: { ...pState, cores: newCores, bonusMultiplier: newMultiplier },
    };
    // Grant a skill point on each prestige
    if (state.pluginState.skilltree) {
      const st = state.pluginState.skilltree;
      resetPluginState.skilltree = { ...st, points: (st.points || 0) + 1 };
    }
    if (state.pluginState.adaptive) {
      const tapDamage = state.pluginState.adaptive.tapDamage || 1;
      resetPluginState.adaptive = {
        monsterHp: 10,
        monsterMaxHp: 10,
        monstersDefeated: 0,
        tapDamage,
        upgrade: { key: 'UPGRADE_TAP', cost: Math.round(15 + tapDamage * 8), nextValue: tapDamage + 1 },
      };
    }
    if (state.pluginState.progression) {
      resetPluginState.progression = {
        generation: { resource: 'gold', nextAmount: 1, cost: Math.round(10 + 1 * 2) },
        level: { level: 1, cost: Math.round(40) },
      };
    }

    return {
      resources: { gold: 0 },
      generationRates: { gold: 1 },
      level: 1,
      pluginState: resetPluginState,
    };
  }
}