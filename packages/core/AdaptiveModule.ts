import { EnginePlugin, GameState } from './BaseTypes';

export interface AdaptiveModuleState {
  monsterHp: number;
  monsterMaxHp: number;
  monstersDefeated: number;
  tapDamage: number;
  fightInStage: number;  // 1-10 within each stage (10 = mini-boss)
  isMiniBoss: boolean;
}

export class AdaptiveModule implements EnginePlugin {
  id = 'adaptive';
  private engine: any = null;

  onInit(engine: any) {
    this.engine = engine;
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      const initialTapDamage = 1;
      const upgradeCost = Math.round(10 + initialTapDamage * 5);
      engine.setPluginState(this.id, {
        monsterHp: 10,
        monsterMaxHp: 10,
        monstersDefeated: 0,
        tapDamage: initialTapDamage,
        fightInStage: 1,
        isMiniBoss: false,
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

  /** Compute next monster HP and mini-boss flag given the incoming level. */
  private nextMonster(newLevel: number): { maxHp: number; isMiniBoss: boolean } {
    const fightInStage = (newLevel % 10) === 0 ? 10 : newLevel % 10;
    const isMiniBoss = fightInStage === 10;
    const base = Math.round(10 * Math.pow(1.12, newLevel));
    return { maxHp: isMiniBoss ? Math.round(base * 3) : base, isMiniBoss };
  }

  /** Read skill bonuses inline to avoid circular import */
  private getSkillBonuses(state: GameState): { tapDmgMult: number; autoDpsMult: number; autoDpsBonus: number; goldPerKillMult: number; critChance: number; surgeProtocol: boolean; strikerOverkill: boolean; phantomOverkill: boolean } {
    const st = state.pluginState?.skilltree;
    if (!st) return { tapDmgMult: 1, autoDpsMult: 1, autoDpsBonus: 0, goldPerKillMult: 1, critChance: 0, surgeProtocol: false, strikerOverkill: false, phantomOverkill: false };
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
      strikerOverkill: u.has('s_overkill'),
      phantomOverkill: u.has('p_overkill'),
    };
  }

  onTick(state: GameState, deltaSec: number) {
    const adaptiveState: AdaptiveModuleState = state.pluginState[this.id];
    if (!adaptiveState) return;

    // When a boss is active, auto-DPS is routed to the boss by BossPlugin instead.
    if (state.pluginState.boss?.bossActive) return;

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

    let isMiniBoss = adaptiveState.isMiniBoss ?? false;
    let fightInStage = adaptiveState.fightInStage ?? 1;

    if (hp <= 0 && maxKills > 0) {
      const prevHp = adaptiveState.monsterHp; // hp before this tick
      defeated += 1;
      newLevel = state.level + 1;
      const miniBossGoldMult = isMiniBoss ? 3 : 1;
      goldGained = Math.round((10 + 8 * newLevel + goldPerKillBonus) * skill.goldPerKillMult * miniBossGoldMult);
      if (newLevel % 25 === 0) goldGained += 50 * newLevel;
      const next = this.nextMonster(newLevel);
      maxHp = next.maxHp;
      isMiniBoss = next.isMiniBoss;
      fightInStage = (newLevel % 10) === 0 ? 10 : newLevel % 10;
      hp = maxHp;

      // Phantom overkill: excess auto-DPS bleeds into next monster
      if (skill.phantomOverkill) {
        const overflow = dps * deltaSec - prevHp;
        if (overflow > 0) hp = Math.max(1, maxHp - overflow);
      }
    }

    const nextResources = { ...state.resources };
    if (goldGained > 0) nextResources.gold = (nextResources.gold || 0) + goldGained;

    const result: any = {
      resources: nextResources,
      pluginState: {
        [this.id]: {
          ...adaptiveState,
          monsterHp: hp,
          monsterMaxHp: maxHp,
          monstersDefeated: defeated,
          fightInStage,
          isMiniBoss,
        },
      },
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
      fightInStage: (adaptiveState as any).fightInStage ?? 1,
      isMiniBoss: (adaptiveState as any).isMiniBoss ?? false,
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

      const currentHp = adaptiveState.monsterHp;
      const hp = Math.max(0, currentHp - tapDmg);
      let defeated = adaptiveState.monstersDefeated;
      let maxHp = adaptiveState.monsterMaxHp;
      let goldGained = 0;
      let newLevel = state.level;

      if (hp <= 0) {
        newLevel = state.level + 1;
        defeated += 1;
        const wasMiniBoss = (adaptiveState as any).isMiniBoss ?? false;
        const miniBossGoldMult = wasMiniBoss ? 3 : 1;
        goldGained = Math.round((10 + 8 * newLevel + gear.goldPerKill) * skill.goldPerKillMult * miniBossGoldMult);
        if (newLevel % 25 === 0) goldGained += 50 * newLevel;

        // Dispatch kill event to missions plugin
        if (this.engine) {
          this.engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'RECORD_KILL', count: 1 } } });
        }

        const next = this.nextMonster(newLevel);
        const fightInStage = (newLevel % 10) === 0 ? 10 : newLevel % 10;
        let nextHp = next.maxHp;

        // Striker overkill: excess damage carries over as a free partial hit on the next monster
        if (skill.strikerOverkill) {
          const overflow = tapDmg - currentHp;
          if (overflow > 0) nextHp = Math.max(1, next.maxHp - overflow);
        }

        return {
          level: newLevel,
          resources: { ...state.resources, gold: (state.resources.gold || 0) + goldGained },
          pluginState: {
            [this.id]: {
              ...adaptiveState,
              monsterHp: nextHp,
              monsterMaxHp: next.maxHp,
              monstersDefeated: defeated,
              fightInStage,
              isMiniBoss: next.isMiniBoss,
            },
          },
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
              upgrade: { key: 'UPGRADE_TAP', cost: Math.round(10 + newTapDamage * 5), nextValue: newTapDamage + 1 },
            },
          },
        };
      }
    }
  }
}
