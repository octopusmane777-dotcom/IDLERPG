import { EnginePlugin, GameState } from './BaseTypes';

export interface AdaptiveModuleState {
  monsterHp: number;
  monsterMaxHp: number;
  monstersDefeated: number;
  tapDamage: number;
}

export class AdaptiveModule implements EnginePlugin {
  id = 'adaptive';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      const initialTapDamage = 1;
      const upgradeCost = Math.round(15 + initialTapDamage * 8);
      engine.setPluginState(this.id, {
        monsterHp: 10,
        monsterMaxHp: 10,
        monstersDefeated: 0,
        tapDamage: initialTapDamage,
        upgrade: { key: 'UPGRADE_TAP', cost: upgradeCost, nextValue: initialTapDamage + 1 },
      } as AdaptiveModuleState & { upgrade: any });
    }
  }

  /** Helper to read equipment bonuses from plugin state */
  private getGearBonuses(state: GameState): { tapDamage: number; energyRegen: number; spellMultiplier: number; goldPerKill: number } {
    const eq = state.pluginState?.equipment;
    if (!eq || !eq.equipped) return { tapDamage: 0, energyRegen: 0, spellMultiplier: 0, goldPerKill: 0 };
    const gearBonuses = { tapDamage: 0, energyRegen: 0, spellMultiplier: 0, goldPerKill: 0 };
    for (const slot of ['weapon', 'armor', 'ring'] as const) {
      const gearId = eq.equipped[slot];
      if (!gearId) continue;
      const gear = (eq.inventory || []).find((g: any) => g.id === gearId);
      if (!gear || !gear.bonuses) continue;
      for (const key of Object.keys(gearBonuses) as (keyof typeof gearBonuses)[]) {
        if (gear.bonuses[key]) gearBonuses[key] = (gearBonuses[key] || 0) + gear.bonuses[key];
      }
    }
    return gearBonuses;
  }

  onTick(state: GameState, deltaSec: number) {
    const adaptiveState: AdaptiveModuleState = state.pluginState[this.id];
    if (!adaptiveState) return;

    const gear = this.getGearBonuses(state);
    const dps = 1 + gear.tapDamage; // gear adds to auto dps
    const goldPerKillBonus = gear.goldPerKill;
    const maxKills = Math.min(deltaSec, 1);
    let hp = adaptiveState.monsterHp - (dps * deltaSec);
    let defeated = adaptiveState.monstersDefeated;
    let maxHp = adaptiveState.monsterMaxHp;
    let goldGained = 0;
    let newLevel = state.level;

    if (hp <= 0 && maxKills > 0) {
      defeated += 1;
      newLevel = state.level + 1;
      goldGained = 10 + 8 * newLevel + goldPerKillBonus;
      // Every 25 stages grant a lump bonus equal to 50 * stage
      if (newLevel % 25 === 0) {
        goldGained += 50 * newLevel;
      }
      maxHp = Math.round(10 * Math.pow(1.2, newLevel));
      hp = maxHp;
    }

    const nextPluginState = {
      ...state.pluginState,
      [this.id]: { ...adaptiveState, monsterHp: hp, monsterMaxHp: maxHp, monstersDefeated: defeated },
    };

    const nextResources = { ...state.resources };
    if (goldGained > 0) nextResources.gold = (nextResources.gold || 0) + goldGained;

    const result: any = { resources: nextResources, pluginState: nextPluginState };
    if (newLevel !== state.level) result.level = newLevel;
    return result;
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const adaptiveState: AdaptiveModuleState = state.pluginState[this.id];
    if (!adaptiveState) return undefined;
    const tapDamage = adaptiveState.tapDamage || 1;
    return {
      upgrade: {
        key: 'UPGRADE_TAP',
        cost: Math.round(15 + tapDamage * 8),
        nextValue: tapDamage + 1,
      }
    };
  }

  onAction(state: GameState, action: any) {
    const adaptiveState: AdaptiveModuleState = state.pluginState[this.id];
    if (!adaptiveState) return;

    if (action.type === 'TAP_DAMAGE') {
      const gear = this.getGearBonuses(state);
      const tapDmg = (adaptiveState.tapDamage || 1) + gear.tapDamage;
      const hp = Math.max(0, adaptiveState.monsterHp - tapDmg);
      let defeated = adaptiveState.monstersDefeated;
      let maxHp = adaptiveState.monsterMaxHp;
      let goldGained = 0;

      if (hp <= 0) {
        const newLevel = state.level + 1;
        defeated += 1;
        maxHp = Math.round(10 * Math.pow(1.2, newLevel));
        goldGained = 10 + 8 * newLevel + gear.goldPerKill;
        if (newLevel % 25 === 0) goldGained += 50 * newLevel;
        return {
          level: newLevel,
          resources: { ...state.resources, gold: (state.resources.gold || 0) + goldGained },
          pluginState: { ...state.pluginState, [this.id]: { ...adaptiveState, monsterHp: maxHp, monsterMaxHp: maxHp, monstersDefeated: defeated } },
        };
      }

      return {
        pluginState: { ...state.pluginState, [this.id]: { ...adaptiveState, monsterHp: hp } },
      };
    }

    if (action.type === 'UPGRADE_TAP') {
      const cost = action.payload.cost;
      const gold = state.resources.gold || 0;

      if (gold >= cost) {
        const newTapDamage = (adaptiveState.tapDamage || 1) + 1;
        const nextResources = { ...state.resources, gold: gold - cost };
        const nextPluginState = {
          ...state.pluginState,
          [this.id]: {
            ...adaptiveState,
            tapDamage: newTapDamage,
            upgrade: { key: 'UPGRADE_TAP', cost: Math.round(15 + newTapDamage * 8), nextValue: newTapDamage + 1 }
          }
        };

        return {
          resources: nextResources,
          pluginState: nextPluginState,
        };
      }
    }
  }
}