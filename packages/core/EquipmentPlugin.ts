import { EnginePlugin, GameState } from './BaseTypes';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface GearPiece {
  id: string;
  slot: 'weapon' | 'armor' | 'ring';
  name: string;
  rarity: Rarity;
  bonuses: Partial<GearBonuses>;
}

export interface GearBonuses {
  tapDamage: number;
  energyRegen: number;
  spellMultiplier: number;
  goldPerKill: number;
}

export interface EquipmentPluginState {
  equipped: Record<string, string | null>; // slot -> gearId
  inventory: GearPiece[];
}

/** Base items — same item can drop at any rarity */
const GEAR_BASES: { id: string; slot: GearPiece['slot']; name: string; bonusTemplate: Partial<GearBonuses> }[] = [
  // Weapons
  { id: 'WEP_01', slot: 'weapon', name: 'RTX-9000 GPU',   bonusTemplate: { tapDamage: 3 } },
  { id: 'WEP_02', slot: 'weapon', name: 'Quantum Array',  bonusTemplate: { tapDamage: 2, spellMultiplier: 1 } },
  { id: 'WEP_03', slot: 'weapon', name: 'Neural Engine',  bonusTemplate: { tapDamage: 2, goldPerKill: 5 } },
  { id: 'WEP_04', slot: 'weapon', name: 'Photon Core',    bonusTemplate: { spellMultiplier: 2, goldPerKill: 3 } },
  // Armor
  { id: 'ARM_01', slot: 'armor',  name: 'Liquid Cooler v1', bonusTemplate: { energyRegen: 0.05 } },
  { id: 'ARM_02', slot: 'armor',  name: 'Cryo Cooler',     bonusTemplate: { energyRegen: 0.03, tapDamage: 1 } },
  { id: 'ARM_03', slot: 'armor',  name: 'Plasma Sink',     bonusTemplate: { energyRegen: 0.04, goldPerKill: 3 } },
  { id: 'ARM_04', slot: 'armor',  name: 'Quantum Fridge',  bonusTemplate: { tapDamage: 2, spellMultiplier: 1 } },
  // Rings
  { id: 'RNG_01', slot: 'ring',   name: 'Data Miner v1',   bonusTemplate: { goldPerKill: 5 } },
  { id: 'RNG_02', slot: 'ring',   name: 'Packet Harvester',bonusTemplate: { goldPerKill: 4, spellMultiplier: 1 } },
  { id: 'RNG_03', slot: 'ring',   name: 'Protocol Sniffer',bonusTemplate: { spellMultiplier: 2 } },
  { id: 'RNG_04', slot: 'ring',   name: 'Omni-Collector',  bonusTemplate: { goldPerKill: 3, energyRegen: 0.03 } },
];

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const RARITY_MULTIPLIER: Record<Rarity, number> = {
  common:    1,
  uncommon:  2,
  rare:      4,
  epic:      8,
  legendary: 16,
};

const RARITY_COLORS: Record<Rarity, string> = {
  common:    '#aaa',
  uncommon:  '#04d361',
  rare:      '#7b2ff7',
  epic:      '#ffd700',
  legendary: '#ff8c00',
};

const RARITY_WEIGHT: Record<Rarity, number> = {
  common:    50,
  uncommon:  28,
  rare:      14,
  epic:      6,
  legendary: 2,
};

const SCRAP_GOLD: Record<Rarity, number> = {
  common:    15,
  uncommon:  45,
  rare:      120,
  epic:      300,
  legendary: 800,
};

const STAGE_MIN: Record<Rarity, number> = {
  common:    1,
  uncommon:  5,
  rare:      15,
  epic:      30,
  legendary: 60,
};

function rollRarity(stageLevel: number): Rarity {
  const bias = Math.min(stageLevel / 80, 0.6);
  const roll = Math.random() * 100;
  const lW = RARITY_WEIGHT.legendary * (1 + bias);
  const eW = RARITY_WEIGHT.epic      * (1 + bias * 0.6);
  const rW = RARITY_WEIGHT.rare      * (1 + bias * 0.3);
  const uW = RARITY_WEIGHT.uncommon;
  const cW = RARITY_WEIGHT.common    * (1 - bias * 0.5);
  const total = lW + eW + rW + uW + cW;
  const scaled = (roll / 100) * total;

  let rarity: Rarity = 'common';
  let accum = lW;
  if (scaled < accum) rarity = 'legendary';
  accum += eW; if (scaled < accum && rarity === 'common') rarity = 'epic';
  accum += rW; if (scaled < accum && rarity === 'common') rarity = 'rare';
  accum += uW; if (scaled < accum && rarity === 'common') rarity = 'uncommon';

  // Stage gate: if the rolled rarity requires a higher stage, downgrade
  for (let i = RARITY_ORDER.indexOf(rarity); i >= 0; i--) {
    if (stageLevel >= STAGE_MIN[RARITY_ORDER[i]]) return RARITY_ORDER[i];
  }
  return 'common';
}

function generateGearPiece(slot: GearPiece['slot'], stageLevel: number): GearPiece {
  const rarity = rollRarity(stageLevel);
  const pool = GEAR_BASES.filter(g => g.slot === slot);
  const template = pool[Math.floor(Math.random() * pool.length)];

  const stageScale = 1 + Math.floor(stageLevel / 10) * 0.25;
  const rarityMult = RARITY_MULTIPLIER[rarity];
  const bonuses: Partial<GearBonuses> = {};
  for (const key of Object.keys(template.bonusTemplate) as (keyof GearBonuses)[]) {
    const base = template.bonusTemplate[key];
    if (base !== undefined) {
      bonuses[key] = Math.round(base * stageScale * rarityMult);
    }
  }

  return {
    id: `${template.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    slot: template.slot,
    name: template.name,
    rarity,
    bonuses,
  };
}

export class EquipmentPlugin implements EnginePlugin {
  id = 'equipment';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        equipped: { weapon: null, armor: null, ring: null },
        inventory: [],
      } as EquipmentPluginState);
    }
  }

  onTick(_state: GameState, _deltaSec: number) {
    return {};
  }

  getEffectiveBonuses(state: GameState): GearBonuses {
    const eState: EquipmentPluginState = state.pluginState[this.id];
    if (!eState || !eState.equipped) return { tapDamage: 0, energyRegen: 0, spellMultiplier: 0, goldPerKill: 0 };

    const totals: GearBonuses = { tapDamage: 0, energyRegen: 0, spellMultiplier: 0, goldPerKill: 0 };
    for (const slot of ['weapon', 'armor', 'ring'] as const) {
      const gearId = eState.equipped[slot];
      if (!gearId) continue;
      const gear = eState.inventory.find(g => g.id === gearId);
      if (!gear) continue;
      for (const key of Object.keys(totals) as (keyof GearBonuses)[]) {
        const bonus = gear.bonuses[key];
        if (bonus) totals[key] = (totals[key] || 0) + bonus;
      }
    }
    return totals;
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const eState: EquipmentPluginState = state.pluginState[this.id];
    if (!eState) return undefined;

    const bonuses = this.getEffectiveBonuses(state);
    const equipped = eState.equipped || { weapon: null, armor: null, ring: null };
    const inventory = (eState.inventory || []).map(g => ({
      ...g,
      color: RARITY_COLORS[g.rarity] || '#aaa',
      equipped: equipped[g.slot] === g.id,
    }));

    return {
      equipment: {
        equipped,
        inventory,
        bonuses,
      },
    };
  }

  onAction(state: GameState, action: any) {
    const eState: EquipmentPluginState = state.pluginState[this.id];
    if (!eState) return;

    switch (action.type) {
      case 'EQUIP': {
        const gearId = action.gearId;
        const gear = (eState.inventory || []).find(g => g.id === gearId);
        if (!gear) return;
        const equipped = { ...(eState.equipped || { weapon: null, armor: null, ring: null }) };
        equipped[gear.slot] = gearId;
        return {
          pluginState: {
            ...state.pluginState,
            [this.id]: { ...eState, equipped },
          },
        };
      }

      case 'UNEQUIP': {
        const slot = action.slot;
        const equipped = { ...(eState.equipped || { weapon: null, armor: null, ring: null }) };
        if (equipped[slot]) equipped[slot] = null;
        return {
          pluginState: {
            ...state.pluginState,
            [this.id]: { ...eState, equipped },
          },
        };
      }

      case 'SCRAP': {
        const gearId = action.gearId;
        const inventory = (eState.inventory || []).filter(g => g.id !== gearId);
        const equipped = { ...(eState.equipped || { weapon: null, armor: null, ring: null }) };
        const scrapped = (eState.inventory || []).find(g => g.id === gearId);
        if (scrapped && equipped[scrapped.slot] === gearId) {
          equipped[scrapped.slot] = null;
        }
        const scrapGold = scrapped ? (SCRAP_GOLD[scrapped.rarity] || 10) : 0;
        return {
          resources: { ...state.resources, gold: (state.resources.gold || 0) + scrapGold },
          pluginState: {
            ...state.pluginState,
            [this.id]: { ...eState, equipped, inventory },
          },
        };
      }

      case 'GENERATE_DROP': {
        const stage = state.level;
        if (stage < 3) return;

        const dropChance = Math.max(0.03, 0.30 - (stage / 500) * 0.27);
        if (Math.random() > dropChance) return;

        const slots: GearPiece['slot'][] = ['weapon', 'armor', 'ring'];
        const slot = slots[Math.floor(Math.random() * slots.length)];
        const gear = generateGearPiece(slot, stage);
        const inventory = [...(eState.inventory || []), gear];

        const trimmed = inventory.slice(-30);

        return {
          pluginState: {
            ...state.pluginState,
            [this.id]: { ...eState, inventory: trimmed },
          },
        };
      }

      default:
        return;
    }
  }
}