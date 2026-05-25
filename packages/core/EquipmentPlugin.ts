import { EnginePlugin, GameState } from './BaseTypes';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface HardwarePiece {
  id: string;
  type: 'ram' | 'gpu';
  name: string;
  rarity: Rarity;
  bonuses: Partial<HardwareBonuses>;
}

export interface HardwareBonuses {
  tapDamage: number;
  autoDps: number;
  spellMultiplier: number;
  goldPerKill: number;
  energyRegen: number;
}

interface MotherboardTier {
  tier: number;
  name: string;
  ramSlots: number;
  gpuSlots: number;
  upgradeCost: number;
}

export const MOTHERBOARD_TIERS: MotherboardTier[] = [
  { tier: 1, name: 'AXIOM-1 MicroATX', ramSlots: 2, gpuSlots: 1, upgradeCost: 0 },
  { tier: 2, name: 'NOVA-7 ATX',       ramSlots: 4, gpuSlots: 2, upgradeCost: 5000 },
  { tier: 3, name: 'APEX-X EATX',      ramSlots: 6, gpuSlots: 3, upgradeCost: 50000 },
  { tier: 4, name: 'TITAN-INF XL-ATX', ramSlots: 8, gpuSlots: 4, upgradeCost: 500000 },
];

export interface EquipmentPluginState {
  /** 1-indexed tier of the current motherboard */
  motherboardTier: number;
  /** IDs of installed RAM (null = empty slot) */
  ramSlots: (string | null)[];
  /** IDs of installed GPU (null = empty slot) */
  gpuSlots: (string | null)[];
  inventory: HardwarePiece[];
}

// ── Item databases ────────────────────────────────────────────────────────────

interface HardwareBase {
  id: string;
  type: HardwarePiece['type'];
  name: string;
  /** Proportion weights for each bonus — relative values, normalized per rarity */
  bonusWeights: Partial<Record<keyof HardwareBonuses, number>>;
}

const RAM_BASES: HardwareBase[] = [
  { id: 'RAM_01', type: 'ram', name: 'DDR5 Turbo',      bonusWeights: { autoDps: 3, energyRegen: 2 } },
  { id: 'RAM_02', type: 'ram', name: 'HyperCache X',    bonusWeights: { autoDps: 2, tapDamage: 1, goldPerKill: 1 } },
  { id: 'RAM_03', type: 'ram', name: 'OmniBuffer Pro',  bonusWeights: { spellMultiplier: 2, energyRegen: 2, autoDps: 1 } },
  { id: 'RAM_04', type: 'ram', name: 'XMP Overdrive',   bonusWeights: { tapDamage: 2, autoDps: 2, spellMultiplier: 1 } },
];

const GPU_BASES: HardwareBase[] = [
  { id: 'GPU_01', type: 'gpu', name: 'RTX-9000 Ultra',  bonusWeights: { tapDamage: 3, spellMultiplier: 2 } },
  { id: 'GPU_02', type: 'gpu', name: 'Quantum Array',   bonusWeights: { tapDamage: 2, spellMultiplier: 2, autoDps: 1 } },
  { id: 'GPU_03', type: 'gpu', name: 'Neural Engine',   bonusWeights: { tapDamage: 2, goldPerKill: 2, autoDps: 1 } },
  { id: 'GPU_04', type: 'gpu', name: 'Photon Core',     bonusWeights: { spellMultiplier: 3, goldPerKill: 2, energyRegen: 1 } },
];

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const RARITY_MULTIPLIER: Record<Rarity, number> = {
  common:    1,
  uncommon:  2,
  rare:      4,
  epic:      8,
  legendary: 16,
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common:    '#aaa',
  uncommon:  '#04d361',
  rare:      '#3a9eff',
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

const BASE_VALUES: Record<keyof HardwareBonuses, number> = {
  tapDamage:       2,
  autoDps:         1,
  spellMultiplier: 1,
  goldPerKill:     4,
  energyRegen:     0.03,
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

  for (let i = RARITY_ORDER.indexOf(rarity); i >= 0; i--) {
    if (stageLevel >= STAGE_MIN[RARITY_ORDER[i]]) return RARITY_ORDER[i];
  }
  return 'common';
}

function generateHardware(type: 'ram' | 'gpu', stageLevel: number): HardwarePiece {
  const rarity = rollRarity(stageLevel);
  const pool = type === 'ram' ? RAM_BASES : GPU_BASES;
  const template = pool[Math.floor(Math.random() * pool.length)];

  const stageScale = 1 + Math.floor(stageLevel / 10) * 0.25;
  const rarityMult = RARITY_MULTIPLIER[rarity];
  const bonuses: Partial<HardwareBonuses> = {};

  for (const key of Object.keys(template.bonusWeights) as (keyof HardwareBonuses)[]) {
    const weight = template.bonusWeights[key] ?? 0;
    const base = BASE_VALUES[key] * weight;
    bonuses[key] = Math.round(base * stageScale * rarityMult * 10) / 10;
  }

  return {
    id: `${template.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    name: template.name,
    rarity,
    bonuses,
  };
}

function buildEmptySlots(count: number): (string | null)[] {
  return Array(count).fill(null);
}

export class EquipmentPlugin implements EnginePlugin {
  id = 'equipment';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        motherboardTier: 1,
        ramSlots: buildEmptySlots(MOTHERBOARD_TIERS[0].ramSlots),
        gpuSlots: buildEmptySlots(MOTHERBOARD_TIERS[0].gpuSlots),
        inventory: [],
      } as EquipmentPluginState);
    } else {
      // Migrate old weapon/armor/ring state to new format
      const s = existing as any;
      if (s.equipped !== undefined && s.motherboardTier === undefined) {
        engine.setPluginState(this.id, {
          motherboardTier: 1,
          ramSlots: buildEmptySlots(MOTHERBOARD_TIERS[0].ramSlots),
          gpuSlots: buildEmptySlots(MOTHERBOARD_TIERS[0].gpuSlots),
          inventory: [],
        } as EquipmentPluginState);
      }
    }
  }

  onTick(_state: GameState, _deltaSec: number) {
    return {};
  }

  /** Returns sum of all bonuses from installed hardware */
  getEffectiveBonuses(state: GameState): HardwareBonuses {
    const eState: EquipmentPluginState = state.pluginState[this.id];
    if (!eState) return { tapDamage: 0, autoDps: 0, spellMultiplier: 0, goldPerKill: 0, energyRegen: 0 };

    const totals: HardwareBonuses = { tapDamage: 0, autoDps: 0, spellMultiplier: 0, goldPerKill: 0, energyRegen: 0 };
    const installedIds = [...(eState.ramSlots || []), ...(eState.gpuSlots || [])].filter(Boolean);

    for (const itemId of installedIds) {
      const item = (eState.inventory || []).find(g => g.id === itemId);
      if (!item) continue;
      for (const key of Object.keys(totals) as (keyof HardwareBonuses)[]) {
        const bonus = item.bonuses[key];
        if (bonus) totals[key] = (totals[key] || 0) + bonus;
      }
    }
    return totals;
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const eState: EquipmentPluginState = state.pluginState[this.id];
    if (!eState) return undefined;

    const tier = eState.motherboardTier ?? 1;
    const tierDef = MOTHERBOARD_TIERS[tier - 1] ?? MOTHERBOARD_TIERS[0];
    const nextTierDef = MOTHERBOARD_TIERS[tier] ?? null;
    const bonuses = this.getEffectiveBonuses(state);
    const gold = state.resources.gold || 0;

    const inventory = (eState.inventory || []).map(g => ({
      ...g,
      color: RARITY_COLORS[g.rarity] || '#aaa',
      installedIn: _findInstalledSlot(eState, g.id),
    }));

    return {
      equipment: {
        motherboardTier: tier,
        motherboardName: tierDef.name,
        ramSlots: eState.ramSlots || [],
        gpuSlots: eState.gpuSlots || [],
        ramSlotCount: tierDef.ramSlots,
        gpuSlotCount: tierDef.gpuSlots,
        canUpgradeMotherboard: nextTierDef !== null && gold >= nextTierDef.upgradeCost,
        nextMotherboardCost: nextTierDef?.upgradeCost ?? null,
        nextMotherboardName: nextTierDef?.name ?? null,
        maxTier: tier >= MOTHERBOARD_TIERS.length,
        inventory,
        bonuses,
      },
    };
  }

  onAction(state: GameState, action: any) {
    const eState: EquipmentPluginState = state.pluginState[this.id];
    if (!eState) return;

    switch (action.type) {
      case 'INSTALL_RAM': {
        const { itemId, slotIndex } = action;
        const item = (eState.inventory || []).find(g => g.id === itemId);
        if (!item || item.type !== 'ram') return;
        const tier = eState.motherboardTier ?? 1;
        const tierDef = MOTHERBOARD_TIERS[tier - 1];
        if (slotIndex >= tierDef.ramSlots) return;

        const ramSlots = [...(eState.ramSlots || [])];
        ramSlots[slotIndex] = itemId;
        return {
          pluginState: { [this.id]: { ...eState, ramSlots } },
        };
      }

      case 'INSTALL_GPU': {
        const { itemId, slotIndex } = action;
        const item = (eState.inventory || []).find(g => g.id === itemId);
        if (!item || item.type !== 'gpu') return;
        const tier = eState.motherboardTier ?? 1;
        const tierDef = MOTHERBOARD_TIERS[tier - 1];
        if (slotIndex >= tierDef.gpuSlots) return;

        const gpuSlots = [...(eState.gpuSlots || [])];
        gpuSlots[slotIndex] = itemId;
        return {
          pluginState: { [this.id]: { ...eState, gpuSlots } },
        };
      }

      case 'UNINSTALL': {
        const { itemId } = action;
        const ramSlots = (eState.ramSlots || []).map(id => (id === itemId ? null : id));
        const gpuSlots = (eState.gpuSlots || []).map(id => (id === itemId ? null : id));
        return {
          pluginState: { [this.id]: { ...eState, ramSlots, gpuSlots } },
        };
      }

      case 'SCRAP': {
        const { itemId } = action;
        const scrapped = (eState.inventory || []).find(g => g.id === itemId);
        if (!scrapped) return;
        const scrapGold = SCRAP_GOLD[scrapped.rarity] || 10;
        const inventory = (eState.inventory || []).filter(g => g.id !== itemId);
        const ramSlots = (eState.ramSlots || []).map(id => (id === itemId ? null : id));
        const gpuSlots = (eState.gpuSlots || []).map(id => (id === itemId ? null : id));
        return {
          resources: { ...state.resources, gold: (state.resources.gold || 0) + scrapGold },
          pluginState: { [this.id]: { ...eState, inventory, ramSlots, gpuSlots } },
        };
      }

      case 'UPGRADE_MOTHERBOARD': {
        const tier = eState.motherboardTier ?? 1;
        if (tier >= MOTHERBOARD_TIERS.length) return;
        const nextTierDef = MOTHERBOARD_TIERS[tier];
        const gold = state.resources.gold || 0;
        if (gold < nextTierDef.upgradeCost) return;

        const newTier = tier + 1;
        const tierDef = MOTHERBOARD_TIERS[newTier - 1];
        // Expand slot arrays (preserve existing, pad with null)
        const ramSlots = _expandSlots(eState.ramSlots || [], tierDef.ramSlots);
        const gpuSlots = _expandSlots(eState.gpuSlots || [], tierDef.gpuSlots);

        return {
          resources: { ...state.resources, gold: gold - nextTierDef.upgradeCost },
          pluginState: {
            [this.id]: { ...eState, motherboardTier: newTier, ramSlots, gpuSlots },
          },
        };
      }

      default:
        return;
    }
  }

  onKill(state: GameState, _killCount: number) {
    const eState: EquipmentPluginState = state.pluginState[this.id];
    if (!eState) return;

    const stage = state.level;
    if (stage < 3) return;

    const dropChance = Math.max(0.03, 0.30 - (stage / 500) * 0.27);
    if (Math.random() > dropChance) return;

    const type: 'ram' | 'gpu' = Math.random() < 0.5 ? 'ram' : 'gpu';
    const item = generateHardware(type, stage);
    const inventory = [...(eState.inventory || []), item].slice(-40);

    return {
      pluginState: {
        [this.id]: { ...eState, inventory },
      },
    };
  }
}

function _findInstalledSlot(eState: EquipmentPluginState, itemId: string): { type: 'ram' | 'gpu'; index: number } | null {
  const ramIdx = (eState.ramSlots || []).indexOf(itemId);
  if (ramIdx !== -1) return { type: 'ram', index: ramIdx };
  const gpuIdx = (eState.gpuSlots || []).indexOf(itemId);
  if (gpuIdx !== -1) return { type: 'gpu', index: gpuIdx };
  return null;
}

function _expandSlots(current: (string | null)[], newSize: number): (string | null)[] {
  const result = [...current];
  while (result.length < newSize) result.push(null);
  return result;
}
