import { EnginePlugin, GameState } from './BaseTypes';

export interface SkillNode {
  id: string;
  branch: 'HACK' | 'INFRA' | 'GHOST';
  name: string;
  description: string;
  requires: string | null; // parent node id
}

export interface SkillTreePluginState {
  points: number;
  unlocked: string[];
}

export const SKILL_TREE: SkillNode[] = [
  // HACK branch — tap damage and spell power
  { id: 'h1', branch: 'HACK',  name: 'Overclock I',      description: '+10% tap damage',             requires: null },
  { id: 'h2', branch: 'HACK',  name: 'Overclock II',     description: '+20% tap damage',             requires: 'h1' },
  { id: 'h3', branch: 'HACK',  name: 'Capacitor',        description: '+1 energy regen/s',           requires: 'h2' },
  { id: 'h4', branch: 'HACK',  name: 'Spell Amp I',      description: '+15% spell multiplier',       requires: 'h3' },
  { id: 'h5', branch: 'HACK',  name: 'Rapid Cooldown',   description: '-20% spell cooldowns',        requires: 'h4' },
  // INFRA branch — passive income and energy
  { id: 'i1', branch: 'INFRA', name: 'Net Boost I',      description: '+25% node output',            requires: null },
  { id: 'i2', branch: 'INFRA', name: 'Deep Buffer',      description: '+50 max energy',              requires: 'i1' },
  { id: 'i3', branch: 'INFRA', name: 'Auto Daemon',      description: '+1 auto DPS',                 requires: 'i2' },
  { id: 'i4', branch: 'INFRA', name: 'Net Boost II',     description: '+25% node output',            requires: 'i3' },
  { id: 'i5', branch: 'INFRA', name: 'Dark Fiber',       description: 'Offline cap: 16h',            requires: 'i4' },
  // GHOST branch — gold and gear
  { id: 'g1', branch: 'GHOST', name: 'Looter I',         description: '+15% gold per kill',          requires: null },
  { id: 'g2', branch: 'GHOST', name: 'Gear Magnet',      description: '+10% gear drop rate',         requires: 'g1' },
  { id: 'g3', branch: 'GHOST', name: 'Looter II',        description: '+20% gold per kill',          requires: 'g2' },
  { id: 'g4', branch: 'GHOST', name: 'Hoarder',          description: '+10 inventory slots',         requires: 'g3' },
  { id: 'g5', branch: 'GHOST', name: 'Scrapper',         description: '+50% scrap gold',             requires: 'g4' },
];

/** Read the skill tree bonuses from plugin state for use by other plugins */
export function getSkillBonuses(state: GameState): {
  tapDmgMult: number;
  energyRegenBonus: number;
  spellMultBonus: number;
  spellCooldownMult: number;
  nodeOutputMult: number;
  maxEnergyBonus: number;
  autoDpsBonus: number;
  offlineCapHours: number;
  goldPerKillMult: number;
  dropRateBonus: number;
  inventorySlotsBonus: number;
  scrapGoldMult: number;
} {
  const stState: SkillTreePluginState = state.pluginState?.skilltree;
  const unlocked = new Set<string>(stState?.unlocked ?? []);
  return {
    tapDmgMult:          1 + (unlocked.has('h1') ? 0.10 : 0) + (unlocked.has('h2') ? 0.20 : 0),
    energyRegenBonus:    unlocked.has('h3') ? 1 : 0,
    spellMultBonus:      unlocked.has('h4') ? 0.15 : 0,
    spellCooldownMult:   unlocked.has('h5') ? 0.8 : 1,
    nodeOutputMult:      1 + (unlocked.has('i1') ? 0.25 : 0) + (unlocked.has('i4') ? 0.25 : 0),
    maxEnergyBonus:      unlocked.has('i2') ? 50 : 0,
    autoDpsBonus:        unlocked.has('i3') ? 1 : 0,
    offlineCapHours:     unlocked.has('i5') ? 16 : 8,
    goldPerKillMult:     1 + (unlocked.has('g1') ? 0.15 : 0) + (unlocked.has('g3') ? 0.20 : 0),
    dropRateBonus:       unlocked.has('g2') ? 0.10 : 0,
    inventorySlotsBonus: unlocked.has('g4') ? 10 : 0,
    scrapGoldMult:       unlocked.has('g5') ? 1.5 : 1,
  };
}

export class SkillTreePlugin implements EnginePlugin {
  id = 'skilltree';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        points: 0,
        unlocked: [],
      } as SkillTreePluginState);
    }
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const stState: SkillTreePluginState = state.pluginState[this.id];
    if (!stState) return undefined;

    const unlocked = new Set<string>(stState.unlocked);
    const nodes = SKILL_TREE.map(n => {
      const isUnlocked = unlocked.has(n.id);
      const parentUnlocked = n.requires === null || unlocked.has(n.requires);
      return {
        ...n,
        unlocked: isUnlocked,
        available: !isUnlocked && parentUnlocked && stState.points > 0,
        locked: !isUnlocked && !parentUnlocked,
      };
    });

    return {
      skilltree: {
        points: stState.points,
        unlocked: stState.unlocked,
        nodes,
      },
    };
  }

  onAction(state: GameState, action: any) {
    const stState: SkillTreePluginState = state.pluginState[this.id];
    if (!stState) return;

    if (action.type !== 'UNLOCK_SKILL') return;

    const nodeId: string = action.nodeId;
    const node = SKILL_TREE.find(n => n.id === nodeId);
    if (!node) return;
    if (stState.points <= 0) return;

    const unlocked = new Set<string>(stState.unlocked);
    if (unlocked.has(nodeId)) return;
    if (node.requires && !unlocked.has(node.requires)) return;

    unlocked.add(nodeId);
    return {
      pluginState: {
        [this.id]: {
          points: stState.points - 1,
          unlocked: Array.from(unlocked),
        },
      },
    };
  }
}
