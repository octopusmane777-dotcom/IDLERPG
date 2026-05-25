import { EnginePlugin, GameState } from './BaseTypes';

export interface EnergyPluginState {
  energy: number;
  maxEnergy: number;
  cooldowns: Record<string, number>; // remaining seconds per spell ID
  spellLevels: Record<string, number>; // upgrade level per spell ID
}

const SPELLS = [
  { id: 'SLASH', name: 'Ping Flood', baseCost: 5, baseMultiplier: 2, baseCooldown: 5, color: '#888' },
  { id: 'FIREBALL', name: 'Brute Force', baseCost: 10, baseMultiplier: 5, baseCooldown: 10, color: '#e94560' },
  { id: 'LIGHTNING', name: 'SQL Injection', baseCost: 15, baseMultiplier: 10, baseCooldown: 15, color: '#ffd700' },
  { id: 'METEOR', name: 'Zero-Day Exploit', baseCost: 20, baseMultiplier: 20, baseCooldown: 25, color: '#7b2ff7' },
  { id: 'ULTIMATE', name: 'Rootkit Deployment', baseCost: 30, baseMultiplier: 40, baseCooldown: 45, color: '#00d4ff' },
];

/** Upgrade cost for a spell at its current level */
function spellUpgradeCost(spell: typeof SPELLS[0], level: number): number {
  return Math.round(spell.baseCost * 10 * Math.pow(1.5, level));
}

/** Current multiplier for a spell given its level */
function spellMultiplier(spell: typeof SPELLS[0], level: number): number {
  return spell.baseMultiplier + level * 2;
}

/** Current cooldown for a spell given its level (min 1s) */
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
      // Ensure spellLevels exists (migration from older state)
      const s = existing as EnergyPluginState;
      if (!s.spellLevels) {
        engine.setPluginState(this.id, {
          ...s,
          spellLevels: { SLASH: 0, FIREBALL: 0, LIGHTNING: 0, METEOR: 0, ULTIMATE: 0 },
        });
      }
    }
  }

  onTick(state: GameState, deltaSec: number) {
    const eState: EnergyPluginState = state.pluginState[this.id];
    if (!eState) return;

    // Read gear energy regen bonus
    const eq = state.pluginState?.equipment;
    let gearRegenBoost = 0;
    if (eq?.equipped) {
      const inv = eq.inventory || [];
      for (const slot of ['weapon', 'armor', 'ring'] as const) {
        const gearId = eq.equipped[slot];
        if (!gearId) continue;
        const gear = inv.find((g: any) => g.id === gearId);
        if (gear?.bonuses?.energyRegen) gearRegenBoost += gear.bonuses.energyRegen;
      }
    }

    const newMax = 50;
    const energyGain = deltaSec / 3 + gearRegenBoost * deltaSec;
    const energy = Math.min(newMax, (eState.energy || 0) + energyGain);

    // Tick down cooldowns
    const cooldowns: Record<string, number> = { ...(eState.cooldowns || {}) };
    for (const id of Object.keys(cooldowns)) {
      if (cooldowns[id] > 0) {
        cooldowns[id] = Math.max(0, cooldowns[id] - deltaSec);
        if (cooldowns[id] <= 0) delete cooldowns[id];
      }
    }

    return {
      pluginState: {
        ...state.pluginState,
        [this.id]: { energy, maxEnergy: newMax, cooldowns, spellLevels: eState.spellLevels || {} },
      },
    };
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const eState: EnergyPluginState = state.pluginState[this.id];
    if (!eState) return undefined;

    const cooldowns = eState.cooldowns || {};
    const spellLevels = eState.spellLevels || {};
    const gold = state.resources.gold || 0;

    const spells = SPELLS.map(s => {
      const lvl = spellLevels[s.id] || 0;
      const cost = s.baseCost;
      const mult = spellMultiplier(s, lvl);
      const cd = spellCooldown(s, lvl);
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

    // Handle spell upgrades
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
          ...state.pluginState,
          [this.id]: { ...eState, spellLevels },
        },
      };
    }

    // Handle spell casts
    const spell = SPELLS.find(s => s.id === action.type);
    if (!spell) return;

    const currentEnergy = eState.energy || 0;
    const cooldowns = eState.cooldowns || {};
    if (currentEnergy < spell.baseCost) return;
    if (cooldowns[spell.id] > 0) return; // on cooldown

    // Read gear spell multiplier bonus
    const eq = state.pluginState?.equipment;
    let gearSpellMult = 0;
    if (eq?.equipped) {
      const inv = eq.inventory || [];
      for (const slot of ['weapon', 'armor', 'ring'] as const) {
        const gearId = eq.equipped[slot];
        if (!gearId) continue;
        const gear = inv.find((g: any) => g.id === gearId);
        if (gear?.bonuses?.spellMultiplier) gearSpellMult += gear.bonuses.spellMultiplier;
      }
    }

    const adaptiveState = state.pluginState.adaptive;
    const tapDamage = adaptiveState?.tapDamage || 1;
    const spellLevels = eState.spellLevels || {};
    const lvl = spellLevels[spell.id] || 0;
    const damage = (tapDamage + gearSpellMult) * spellMultiplier(spell, lvl);

    let hp = Math.max(0, (adaptiveState?.monsterHp || 10) - damage);
    let defeated = adaptiveState?.monstersDefeated || 0;
    let maxHp = adaptiveState?.monsterMaxHp || 10;
    let goldGained = 0;

    const newCooldowns = { ...cooldowns, [spell.id]: spellCooldown(spell, lvl) };

    if (hp <= 0) {
      const newLevel = state.level + 1;
      defeated += 1;
      maxHp = Math.round(10 * Math.pow(1.2, newLevel));
      goldGained = 10 + 8 * newLevel;
      if (newLevel % 25 === 0) goldGained += 50 * newLevel;
      const nextResources = { ...state.resources, gold: (state.resources.gold || 0) + goldGained };
      return {
        level: newLevel,
        resources: nextResources,
        pluginState: {
          ...state.pluginState,
          [this.id]: { energy: currentEnergy - spell.baseCost, maxEnergy: 50, cooldowns: newCooldowns, spellLevels },
          adaptive: { ...adaptiveState, monsterHp: maxHp, monsterMaxHp: maxHp, monstersDefeated: defeated, tapDamage },
        },
      };
    }

    return {
      pluginState: {
        ...state.pluginState,
        [this.id]: { energy: currentEnergy - spell.baseCost, maxEnergy: 50, cooldowns: newCooldowns, spellLevels },
        adaptive: { ...adaptiveState, monsterHp: hp, tapDamage },
      },
    };
  }
}
