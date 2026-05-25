import { EnginePlugin, GameState } from './BaseTypes';

export interface EnergyPluginState {
  energy: number;
  maxEnergy: number;
  cooldowns: Record<string, number>;
  spellLevels: Record<string, number>;
}

const SPELLS = [
  { id: 'SLASH',     name: 'Overclock',     baseCost: 5,  baseMultiplier: 2,  baseCooldown: 5,  color: '#00e5ff' },
  { id: 'FIREBALL',  name: 'RAM Surge',      baseCost: 10, baseMultiplier: 5,  baseCooldown: 10, color: '#00e676' },
  { id: 'LIGHTNING', name: 'GPU Render',     baseCost: 15, baseMultiplier: 12, baseCooldown: 15, color: '#ffd700' },
  { id: 'METEOR',    name: 'Kernel Panic',   baseCost: 20, baseMultiplier: 22, baseCooldown: 25, color: '#e63946' },
  { id: 'ULTIMATE',  name: 'Neural Cascade', baseCost: 30, baseMultiplier: 45, baseCooldown: 45, color: '#ff6b35' },
];


function spellUpgradeCost(spell: typeof SPELLS[0], level: number): number {
  return Math.round(spell.baseCost * 10 * Math.pow(1.5, level));
}

function spellMultiplier(spell: typeof SPELLS[0], level: number): number {
  return spell.baseMultiplier + level * 2;
}

function spellCooldown(spell: typeof SPELLS[0], level: number): number {
  return Math.max(1, spell.baseCooldown - level);
}

export class EnergyPlugin implements EnginePlugin {
  id = 'energy';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        energy: 50,
        maxEnergy: 50,
        cooldowns: {},
        spellLevels: { SLASH: 0, FIREBALL: 0, LIGHTNING: 0, METEOR: 0, ULTIMATE: 0 },
      } as EnergyPluginState);
    } else {
      const s = existing as EnergyPluginState;
      // Migrate: ensure all new spell IDs exist
      const spellLevels = { ...(s.spellLevels || {}) };
      let migrated = false;
      for (const sp of SPELLS) {
        if (spellLevels[sp.id] === undefined) {
          spellLevels[sp.id] = 0;
          migrated = true;
        }
      }
      if (migrated) {
        engine.setPluginState(this.id, { ...s, spellLevels });
      }
    }
  }

  onTick(state: GameState, deltaSec: number) {
    const eState: EnergyPluginState = state.pluginState[this.id];
    if (!eState) return;

    // Read gear energy regen bonus from installed hardware
    const eq = state.pluginState?.equipment;
    let gearRegenBoost = 0;
    if (eq) {
      const slots: string[] = [...(eq.ramSlots || []), ...(eq.gpuSlots || [])];
      for (const itemId of slots) {
        if (!itemId) continue;
        const item = (eq.inventory || []).find((g: any) => g.id === itemId);
        if (item?.bonuses?.energyRegen) gearRegenBoost += item.bonuses.energyRegen;
      }
    }

    // Read skill bonuses
    const skillBonuses = _getSkillEnergyBonus(state);
    const maxEnergy = 50 + (state.pluginState?.skilltree ? skillBonuses.maxEnergyBonus : 0);
    const energyGain = deltaSec / 5 + gearRegenBoost * deltaSec + skillBonuses.regenBonus * deltaSec;
    const energy = Math.min(maxEnergy, (eState.energy || 0) + energyGain);

    const cooldowns: Record<string, number> = { ...(eState.cooldowns || {}) };
    for (const id of Object.keys(cooldowns)) {
      if (cooldowns[id] > 0) {
        cooldowns[id] = Math.max(0, cooldowns[id] - deltaSec);
        if (cooldowns[id] <= 0) delete cooldowns[id];
      }
    }

    return {
      pluginState: {
        [this.id]: { energy, maxEnergy, cooldowns, spellLevels: eState.spellLevels || {} },
      },
    };
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const eState: EnergyPluginState = state.pluginState[this.id];
    if (!eState) return undefined;

    const cooldowns = eState.cooldowns || {};
    const spellLevels = eState.spellLevels || {};
    const gold = state.resources.gold || 0;
    const skillBonuses = _getSkillEnergyBonus(state);

    const spells = SPELLS.map(s => {
      const lvl = spellLevels[s.id] || 0;
      const cost = s.baseCost;
      const mult = spellMultiplier(s, lvl);
      const baseCd = spellCooldown(s, lvl);
      const cd = Math.max(1, Math.round(baseCd * skillBonuses.cooldownMult * 10) / 10);
      const upgradeCost = spellUpgradeCost(s, lvl);
      return {
        id: s.id,
        name: s.name,
        cost,
        multiplier: mult,
        cooldown: cd,
        color: s.color,
        level: lvl,
        canCast: (eState.energy || 0) >= cost && !(cooldowns[s.id] > 0),
        cooldownRemaining: cooldowns[s.id] || 0,
        upgradeCost,
        canUpgrade: gold >= upgradeCost,
        upgradeAction: `UPGRADE_${s.id}`,
      };
    });

    return {
      energy: {
        current: eState.energy || 0,
        max: eState.maxEnergy || 50,
        spells,
      },
    };
  }

  onAction(state: GameState, action: any) {
    const eState: EnergyPluginState = state.pluginState[this.id];
    if (!eState) return;

    if (action.type && action.type.startsWith('UPGRADE_')) {
      const spellId = action.type.replace('UPGRADE_', '');
      const spell = SPELLS.find(s => s.id === spellId);
      if (!spell) return;

      const spellLevels = { ...(eState.spellLevels || {}) };
      const lvl = spellLevels[spellId] || 0;
      const cost = spellUpgradeCost(spell, lvl);
      const gold = state.resources.gold || 0;
      if (gold < cost) return;

      spellLevels[spellId] = lvl + 1;
      return {
        resources: { ...state.resources, gold: gold - cost },
        pluginState: {
          [this.id]: { ...eState, spellLevels },
        },
      };
    }

    const spell = SPELLS.find(s => s.id === action.type);
    if (!spell) return;

    const currentEnergy = eState.energy || 0;
    const cooldowns = eState.cooldowns || {};
    if (currentEnergy < spell.baseCost) return;
    if (cooldowns[spell.id] > 0) return;

    // Gear spell multiplier from installed hardware
    const eq = state.pluginState?.equipment;
    let gearSpellMult = 0;
    if (eq) {
      const slots: string[] = [...(eq.ramSlots || []), ...(eq.gpuSlots || [])];
      for (const itemId of slots) {
        if (!itemId) continue;
        const item = (eq.inventory || []).find((g: any) => g.id === itemId);
        if (item?.bonuses?.spellMultiplier) gearSpellMult += item.bonuses.spellMultiplier;
      }
    }

    const skillBonuses = _getSkillEnergyBonus(state);
    const adaptiveState = state.pluginState.adaptive;
    const tapDamage = adaptiveState?.tapDamage || 1;
    const spellLevels = eState.spellLevels || {};
    const lvl = spellLevels[spell.id] || 0;
    const baseDamage = (tapDamage + gearSpellMult) * spellMultiplier(spell, lvl);
    const damage = baseDamage * (1 + skillBonuses.spellMultBonus);

    // Neural Cascade: chains hits per installed hardware piece
    let finalDamage = damage;
    if (spell.id === 'NEURAL_CASCADE' && eq) {
      const installedCount = [...(eq.ramSlots || []), ...(eq.gpuSlots || [])].filter(Boolean).length;
      finalDamage = damage * Math.max(1, installedCount);
    }

    let hp = Math.max(0, (adaptiveState?.monsterHp || 10) - finalDamage);
    let defeated = adaptiveState?.monstersDefeated || 0;
    let maxHp = adaptiveState?.monsterMaxHp || 10;
    let goldGained = 0;

    const skillCdMult = skillBonuses.cooldownMult;
    const baseCd = spellCooldown(spell, lvl);
    const cd = Math.max(1, baseCd * skillCdMult);

    // Arcane Echo: add 1 auto-tick hit's worth of damage
    if (skillBonuses.arcaneEcho && adaptiveState) {
      const autoDps = 1 + (adaptiveState.tapDamage || 0);
      hp = Math.max(0, hp - autoDps);
    }

    const newCooldowns = { ...cooldowns, [spell.id]: cd };

    // Infinite Loop: 5% chance to reset cooldown
    if (skillBonuses.infiniteLoop && Math.random() < 0.05) {
      delete newCooldowns[spell.id];
    }

    if (hp <= 0) {
      const newLevel = state.level + 1;
      defeated += 1;
      const wasMiniBoss = (adaptiveState as any)?.isMiniBoss ?? false;
      const miniBossGoldMult = wasMiniBoss ? 3 : 1;
      const gear2 = state.pluginState?.equipment;
      let goldPerKillBonus = 0;
      if (gear2) {
        const slots2: string[] = [...(gear2.ramSlots || []), ...(gear2.gpuSlots || [])];
        for (const itemId of slots2) {
          if (!itemId) continue;
          const item2 = (gear2.inventory || []).find((g: any) => g.id === itemId);
          if (item2?.bonuses?.goldPerKill) goldPerKillBonus += item2.bonuses.goldPerKill;
        }
      }
      const newFightInStage = (newLevel % 10) === 0 ? 10 : newLevel % 10;
      const newIsMiniBoss = newFightInStage === 10;
      const baseMaxHp = Math.round(10 * Math.pow(1.12, newLevel));
      const newMaxHp = newIsMiniBoss ? Math.round(baseMaxHp * 3) : baseMaxHp;
      const baseGold = Math.round((10 + 8 * newLevel + goldPerKillBonus) * miniBossGoldMult);
      const finalGold = newLevel % 25 === 0 ? baseGold + 50 * newLevel : baseGold;
      return {
        level: newLevel,
        resources: { ...state.resources, gold: (state.resources.gold || 0) + finalGold },
        pluginState: {
          [this.id]: { energy: currentEnergy - spell.baseCost, maxEnergy: eState.maxEnergy || 50, cooldowns: newCooldowns, spellLevels },
          adaptive: {
            ...adaptiveState,
            monsterHp: newMaxHp,
            monsterMaxHp: newMaxHp,
            monstersDefeated: defeated,
            fightInStage: newFightInStage,
            isMiniBoss: newIsMiniBoss,
          },
        },
      };
    }

    return {
      pluginState: {
        [this.id]: { energy: currentEnergy - spell.baseCost, maxEnergy: eState.maxEnergy || 50, cooldowns: newCooldowns, spellLevels },
        adaptive: {
          ...adaptiveState,
          monsterHp: hp,
        },
      },
    };
  }
}

/** Read skill bonuses relevant to energy plugin without circular import */
function _getSkillEnergyBonus(state: GameState): {
  maxEnergyBonus: number;
  regenBonus: number;
  cooldownMult: number;
  spellMultBonus: number;
  arcaneEcho: boolean;
  infiniteLoop: boolean;
} {
  const st = state.pluginState?.skilltree;
  if (!st) return { maxEnergyBonus: 0, regenBonus: 0, cooldownMult: 1, spellMultBonus: 0, arcaneEcho: false, infiniteLoop: false };
  const u = new Set<string>(st.unlocked ?? []);
  return {
    maxEnergyBonus:  u.has('a1') ? 60 : 0,
    regenBonus:      (u.has('s3') ? 1 : 0) + (u.has('p4') ? 1 : 0),
    cooldownMult:    (u.has('s4') ? 0.90 : 1) * (u.has('a2') ? 0.75 : 1),
    spellMultBonus:  (u.has('s1') ? 0.05 : 0) + (u.has('p2') ? 0.05 : 0) + (u.has('p5') ? 0.10 : 0) + (u.has('a3') ? 0.25 : 0),
    arcaneEcho:      u.has('a7'),
    infiniteLoop:    u.has('a5'),
  };
}
