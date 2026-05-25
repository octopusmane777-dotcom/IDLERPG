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
      const upgradeCost = Math.round(10 + initialTapDamage * 5);
      engine.setPluginState(this.id, {
        monsterHp: 10,
        monsterMaxHp: 10,
        monstersDefeated: 0,
        tapDamage: initialTapDamage,
        upgrade: { key: 'UPGRADE_TAP', cost: upgradeCost, nextValue: initialTapDamage + 1 },
      } as AdaptiveModuleState & { upgrade: any });
    }
  }

  /** Helper to read equipment bonuses from installed hardware */
  private getGearBonuses(state: GameState): { tapDamage: number; autoDps: number; goldPerKill: number } {
    const eq = state.pluginState?.equipment;
    if (!eq) return { tapDamage: 0, autoDps: 0, goldPerKill: 0 };
    const totals = { tapDamage: 0, autoDps: 0, goldPerKill: 0 };
    const slots: string[] = [...(eq.ramSlots || []), ...(eq.gpuSlots || [])];
    for (const itemId of slots) {
      if (!itemId) continue;
      const item = (eq.inventory || []).find((g: any) => g.id === itemId);
      if (!item?.bonuses) continue;
      if (item.bonuses.tapDamage)  totals.tapDamage  += item.bonuses.tapDamage;
      if (item.bonuses.autoDps)    totals.autoDps     += item.bonuses.autoDps;
      if (item.bonuses.goldPerKill) totals.goldPerKill += item.bonuses.goldPerKill;
    }
    return totals;
  }

  /** Read skill bonuses inline to avoid circular import */
  private getSkillBonuses(state: GameState): { tapDmgMult: number; autoDpsMult: number; autoDpsBonus: number; goldPerKillMult: number; critChance: number; surgeProtocol: boolean } {
    const st = state.pluginState?.skilltree;
    if (!st) return { tapDmgMult: 1, autoDpsMult: 1, autoDpsBonus: 0, goldPerKillMult: 1, critChance: 0, surgeProtocol: false };
    const u = new Set<string>(st.unlocked ?? []);
    const tapMult = 1
      + (u.has('s1') ? 0.15 : 0) + (u.has('s2') ? 0.20 : 0) + (u.has('s4') ? 0.25 : 0)
      + (u.has('p1') ? 0.05 : 0) + (u.has('p3') ? 0.10 : 0) + (u.has('a2') ? 0.05 : 0);
    const autoDpsMult = 1 + (u.has('p1') ? 0.30 : 0) + (u.has('a3') ? 0.05 : 0);
    const autoDpsBonus = u.has('p2') ? 2 : 0;
    const goldMult = 1
      + (u.has('s5') ? 0.20 : 0) + (u.has('a4') ? 0.10 : 0) + (u.has('p6') ? 0.05 : 0);
    return {
      tapDmgMult: tapMult,
      autoDpsMult,
      autoDpsBonus,
      goldPerKillMult: goldMult,
      critChance: u.has('s3') ? 0.10 : 0,
      surgeProtocol: u.has('s6'),
    };
  }

  onTick(state: GameState, deltaSec: number) {
    const adaptiveState: AdaptiveModuleState = state.pluginState[this.id];
    if (!adaptiveState) return;

    const gear = this.getGearBonuses(state);
    const skill = this.getSkillBonuses(state);
    const baseDps = (1 + gear.autoDps + skill.autoDpsBonus) * skill.autoDpsMult;
    // Surge protocol: tap damage also contributes to auto DPS
    const tapContrib = skill.surgeProtocol ? (adaptiveState.tapDamage || 1) * skill.tapDmgMult * 0.25 : 0;
    const dps = baseDps + tapContrib;

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
      goldGained = Math.round((10 + 8 * newLevel + goldPerKillBonus) * skill.goldPerKillMult);
      if (newLevel % 25 === 0) goldGained += 50 * newLevel;
      maxHp = Math.round(10 * Math.pow(1.12, newLevel));
      hp = maxHp;
    }

    const nextResources = { ...state.resources };
    if (goldGained > 0) nextResources.gold = (nextResources.gold || 0) + goldGained;

    const result: any = {
      resources: nextResources,
      pluginState: { [this.id]: { ...adaptiveState, monsterHp: hp, monsterMaxHp: maxHp, monstersDefeated: defeated } },
    };
    if (newLevel !== state.level) result.level = newLevel;
    return result;
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const adaptiveState: AdaptiveModuleState = state.pluginState[this.id];
    if (!adaptiveState) return undefined;

    const gear = this.getGearBonuses(state);
    const skill = this.getSkillBonuses(state);
    const tapDamage = adaptiveState.tapDamage || 1;

    // Expose the real effective tap damage (base × skill mult + gear) so UI can show it
    const effectiveTapDmg = Math.round((tapDamage + gear.tapDamage) * skill.tapDmgMult);
    const autoDps = Math.round((1 + gear.autoDps + skill.autoDpsBonus) * skill.autoDpsMult * 10) / 10;

    return {
      upgrade: {
        key: 'UPGRADE_TAP',
        cost: Math.round(10 + tapDamage * 5),
        nextValue: tapDamage + 1,
      },
      effectiveTapDmg,
      autoDps,
    };
  }

  onAction(state: GameState, action: any) {
    const adaptiveState: AdaptiveModuleState = state.pluginState[this.id];
    if (!adaptiveState) return;

    if (action.type === 'TAP_DAMAGE') {
      const gear = this.getGearBonuses(state);
      const skill = this.getSkillBonuses(state);
      const comboMult = state.pluginState.combo?.multiplier ?? 1;
      const baseTap = (adaptiveState.tapDamage || 1) + gear.tapDamage;
      let tapDmg = baseTap * skill.tapDmgMult * comboMult;

      // Crit roll
      if (skill.critChance > 0 && Math.random() < skill.critChance) {
        tapDmg *= 3;
      }

      const hp = Math.max(0, adaptiveState.monsterHp - tapDmg);
      let defeated = adaptiveState.monstersDefeated;
      let maxHp = adaptiveState.monsterMaxHp;
      let goldGained = 0;

      if (hp <= 0) {
        const newLevel = state.level + 1;
        defeated += 1;
        maxHp = Math.round(10 * Math.pow(1.12, newLevel));
        goldGained = Math.round((10 + 8 * newLevel + gear.goldPerKill) * skill.goldPerKillMult);
        if (newLevel % 25 === 0) goldGained += 50 * newLevel;
        return {
          level: newLevel,
          resources: { ...state.resources, gold: (state.resources.gold || 0) + goldGained },
          pluginState: { [this.id]: { ...adaptiveState, monsterHp: maxHp, monsterMaxHp: maxHp, monstersDefeated: defeated } },
        };
      }

      return {
        pluginState: { [this.id]: { ...adaptiveState, monsterHp: hp } },
      };
    }

    if (action.type === 'UPGRADE_TAP') {
      const cost = action.payload.cost;
      const gold = state.resources.gold || 0;

      if (gold >= cost) {
        const newTapDamage = (adaptiveState.tapDamage || 1) + 1;
        return {
          resources: { ...state.resources, gold: gold - cost },
          pluginState: {
            [this.id]: {
              ...adaptiveState,
              tapDamage: newTapDamage,
              upgrade: { key: 'UPGRADE_TAP', cost: Math.round(15 + newTapDamage * 8), nextValue: newTapDamage + 1 },
            },
          },
        };
      }
    }
  }
}
