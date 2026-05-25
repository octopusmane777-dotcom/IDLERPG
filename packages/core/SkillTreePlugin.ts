import { EnginePlugin, GameState } from './BaseTypes';

export type SkillBranch = 'STRIKER' | 'PHANTOM' | 'ARCANE';

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  name: string;
  description: string;
  requires: string | null;
}

export interface SkillTreePluginState {
  points: number;
  unlocked: string[];
  chosenPath: SkillBranch | null;
  /** stage levels at which a point was already granted */
  grantedAtStages: number[];
}

export const SKILL_TREE: SkillNode[] = [
  // STRIKER — tap-focused, touches idle + spell
  { id: 's1', branch: 'STRIKER', name: 'Precision Strike',  description: '+15% tap dmg, +5% spell mult',               requires: null },
  { id: 's2', branch: 'STRIKER', name: 'Double Tap',         description: '+20% tap dmg, +5% node output',              requires: 's1' },
  { id: 's3', branch: 'STRIKER', name: 'Critical Core',      description: '10% crit chance (×3 tap), +10% energy regen',requires: 's2' },
  { id: 's4', branch: 'STRIKER', name: 'Overclock Array',    description: '+25% tap dmg, -10% spell cooldowns',         requires: 's3' },
  { id: 's5', branch: 'STRIKER', name: 'Killswitch',         description: 'Boss tap ×2, +20% gold per kill',            requires: 's4' },
  { id: 's6', branch: 'STRIKER', name: 'Surge Protocol',     description: 'Tap damage also adds to auto DPS',           requires: 's5' },
  { id: 's7', branch: 'STRIKER', name: 'Overload',           description: 'Every 10th tap deals ×10 damage',            requires: 's6' },

  // PHANTOM — idle-focused, touches tap + spell
  { id: 'p1', branch: 'PHANTOM', name: 'Ghost Process',      description: '+30% auto DPS, +5% tap dmg',                 requires: null },
  { id: 'p2', branch: 'PHANTOM', name: 'Background Thread',  description: '+2 auto DPS, +5% spell mult',                requires: 'p1' },
  { id: 'p3', branch: 'PHANTOM', name: 'Sleep Mode',         description: 'Offline cap 16h, +10% tap dmg',              requires: 'p2' },
  { id: 'p4', branch: 'PHANTOM', name: 'Daemon Cluster',     description: 'Auto DPS ×1.5 after 10s idle, +1 energy/s',  requires: 'p3' },
  { id: 'p5', branch: 'PHANTOM', name: 'Persistent Threat',  description: 'Auto DPS scales with stage, +10% spell mult', requires: 'p4' },
  { id: 'p6', branch: 'PHANTOM', name: 'Dark Harvest',       description: 'Idle kills grant +5% bonus gold',            requires: 'p5' },
  { id: 'p7', branch: 'PHANTOM', name: 'Phantom Loop',       description: 'Auto-tick fires twice per second at full DPS',requires: 'p6' },

  // ARCANE — spell-focused, touches tap + idle
  { id: 'a1', branch: 'ARCANE',  name: 'Deep Capacitor',     description: '+60 max energy, +10% node output',            requires: null },
  { id: 'a2', branch: 'ARCANE',  name: 'Fast Compile',       description: '-25% spell cooldowns, +5% tap dmg',           requires: 'a1' },
  { id: 'a3', branch: 'ARCANE',  name: 'Amp Circuit',        description: '+25% spell mult, +5% auto DPS',               requires: 'a2' },
  { id: 'a4', branch: 'ARCANE',  name: 'Resonance',          description: 'Chained spells deal +50% dmg, +10% gold/kill',requires: 'a3' },
  { id: 'a5', branch: 'ARCANE',  name: 'Infinite Loop',      description: '5% chance spell resets its cooldown on cast', requires: 'a4' },
  { id: 'a6', branch: 'ARCANE',  name: 'Mana Overflow',      description: 'Excess energy on cast → bonus tap dmg',        requires: 'a5' },
  { id: 'a7', branch: 'ARCANE',  name: 'Arcane Echo',        description: 'Each spell cast adds 1 auto-tick hit',         requires: 'a6' },
];

/** Milestone stages where a skill point is granted */
const SKILL_POINT_STAGES = [50, 550, 1050, 1550, 2050, 2550, 3050, 3550, 4050, 4550, 5050];

/** Read the skill tree bonuses from plugin state for use by other plugins */
export function getSkillBonuses(state: GameState): {
  tapDmgMult: number;
  energyRegenBonus: number;
  spellMultBonus: number;
  spellCooldownMult: number;
  nodeOutputMult: number;
  maxEnergyBonus: number;
  autoDpsBonus: number;
  autoDpsMult: number;
  offlineCapHours: number;
  goldPerKillMult: number;
  dropRateBonus: number;
  scrapGoldMult: number;
  critChance: number;
  daemonClusterActive: boolean;
  resonanceBonus: number;
  phantomLoopDouble: boolean;
  surgeProtocolActive: boolean;
} {
  const stState: SkillTreePluginState = state.pluginState?.skilltree;
  const unlocked = new Set<string>(stState?.unlocked ?? []);

  // STRIKER bonuses
  const tapMult = 1
    + (unlocked.has('s1') ? 0.15 : 0)
    + (unlocked.has('s2') ? 0.20 : 0)
    + (unlocked.has('s4') ? 0.25 : 0)
    + (unlocked.has('p1') ? 0.05 : 0)
    + (unlocked.has('p3') ? 0.10 : 0)
    + (unlocked.has('a2') ? 0.05 : 0);

  const spellMult = 0
    + (unlocked.has('s1') ? 0.05 : 0)
    + (unlocked.has('p2') ? 0.05 : 0)
    + (unlocked.has('p5') ? 0.10 : 0)
    + (unlocked.has('a3') ? 0.25 : 0)
    + (unlocked.has('a4') ? 0 : 0); // resonance is situational

  const spellCoolMult = 1
    * (unlocked.has('s4') ? 0.90 : 1)
    * (unlocked.has('a2') ? 0.75 : 1);

  const nodeOut = 1
    + (unlocked.has('s2') ? 0.05 : 0)
    + (unlocked.has('a1') ? 0.10 : 0);

  const maxEnergy = 0 + (unlocked.has('a1') ? 60 : 0);

  const autoDpsBonus = 0
    + (unlocked.has('p2') ? 2 : 0)
    + (unlocked.has('a3') ? 0 : 0); // a3 adds 5% mult below

  const autoDpsMult = 1
    + (unlocked.has('p1') ? 0.30 : 0)
    + (unlocked.has('a3') ? 0.05 : 0);

  const energyRegen = 0 + (unlocked.has('s3') ? 1 : 0) + (unlocked.has('p4') ? 1 : 0);

  const goldMult = 1
    + (unlocked.has('s5') ? 0.20 : 0)
    + (unlocked.has('a4') ? 0.10 : 0)
    + (unlocked.has('p6') ? 0.05 : 0);

  return {
    tapDmgMult:         tapMult,
    energyRegenBonus:   energyRegen,
    spellMultBonus:     spellMult,
    spellCooldownMult:  spellCoolMult,
    nodeOutputMult:     nodeOut,
    maxEnergyBonus:     maxEnergy,
    autoDpsBonus,
    autoDpsMult,
    offlineCapHours:    unlocked.has('p3') ? 16 : 8,
    goldPerKillMult:    goldMult,
    dropRateBonus:      0,
    scrapGoldMult:      1,
    critChance:         unlocked.has('s3') ? 0.10 : 0,
    daemonClusterActive: unlocked.has('p4'),
    resonanceBonus:     unlocked.has('a4') ? 0.50 : 0,
    phantomLoopDouble:  unlocked.has('p7'),
    surgeProtocolActive: unlocked.has('s6'),
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
        chosenPath: null,
        grantedAtStages: [],
      } as SkillTreePluginState);
    } else {
      // Migrate older state that lacks new fields
      const s = existing as SkillTreePluginState;
      const patch: Partial<SkillTreePluginState> = {};
      if (s.chosenPath === undefined) patch.chosenPath = null;
      if (!s.grantedAtStages) patch.grantedAtStages = [];
      if (Object.keys(patch).length > 0) {
        engine.setPluginState(this.id, { ...s, ...patch });
      }
    }
  }

  onTick(state: GameState, _deltaSec: number) {
    const stState: SkillTreePluginState = state.pluginState[this.id];
    if (!stState) return;

    const currentStage = state.level;
    const granted = stState.grantedAtStages ?? [];

    // Check if current stage qualifies for a skill point
    const milestone = SKILL_POINT_STAGES.find(s => currentStage >= s && !granted.includes(s));
    if (!milestone) return;

    return {
      pluginState: {
        [this.id]: {
          ...stState,
          points: stState.points + 1,
          grantedAtStages: [...granted, milestone],
        },
      },
    };
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const stState: SkillTreePluginState = state.pluginState[this.id];
    if (!stState) return undefined;

    const unlocked = new Set<string>(stState.unlocked);
    const chosenPath = stState.chosenPath ?? null;

    const nodes = SKILL_TREE.map(n => {
      const isUnlocked = unlocked.has(n.id);
      const parentUnlocked = n.requires === null || unlocked.has(n.requires);
      const branchLocked = chosenPath !== null && n.branch !== chosenPath;
      return {
        ...n,
        unlocked: isUnlocked,
        available: !isUnlocked && parentUnlocked && stState.points > 0 && !branchLocked,
        locked: !isUnlocked && (!parentUnlocked || branchLocked),
        branchLocked,
      };
    });

    return {
      skilltree: {
        points: stState.points,
        unlocked: stState.unlocked,
        chosenPath,
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

    // Enforce one-path lock
    const chosenPath = stState.chosenPath ?? null;
    if (chosenPath !== null && node.branch !== chosenPath) return;

    unlocked.add(nodeId);
    const newChosenPath = chosenPath ?? node.branch;

    return {
      pluginState: {
        [this.id]: {
          ...stState,
          points: stState.points - 1,
          unlocked: Array.from(unlocked),
          chosenPath: newChosenPath,
        },
      },
    };
  }
}
