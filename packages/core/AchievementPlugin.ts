import { EnginePlugin, GameState } from './BaseTypes';

interface Achievement {
  id: string;
  name: string;
  description: string;
  check: (state: GameState) => boolean;
  reward: number; // gold reward on unlock
}

export interface AchievementPluginState {
  unlocked: string[]; // array of unlocked achievement IDs
  unlockedCount: number;
  tracks: Record<string, number>; // progress tracking (e.g., gold earned, monsters killed)
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_gold', name: 'First Steps', description: 'Earn 100 compute', check: (s) => (s.resources.gold || 0) >= 100, reward: 10 },
  { id: 'threat_hunter', name: 'Threat Hunter', description: 'Defeat 10 threats', check: (s) => {
    const a = s.pluginState.adaptive;
    return (a?.monstersDefeated ?? 0) >= 10;
  }, reward: 50 },
  { id: 'stage_5', name: 'Stage 5', description: 'Reach Stage 5', check: (s) => s.level >= 5, reward: 100 },
  { id: 'stage_15', name: 'Stage 15', description: 'Reach Stage 15', check: (s) => s.level >= 15, reward: 500 },
  { id: 'prestige_1', name: 'Prestige I', description: 'Prestige for the first time', check: (s) => {
    const p = s.pluginState.prestige;
    return (p?.cores ?? 0) >= 1;
  }, reward: 200 },
  { id: 'rich', name: 'Compute Baron', description: 'Hold 10,000 compute', check: (s) => (s.resources.gold || 0) >= 10000, reward: 1000 },
];

export class AchievementPlugin implements EnginePlugin {
  id = 'achievements';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        unlocked: [],
        unlockedCount: 0,
        tracks: {},
      } as AchievementPluginState);
    }
  }

  onTick(state: GameState, _deltaSec: number) {
    const aState: AchievementPluginState = state.pluginState[this.id];
    if (!aState) return;

    const unlocked = new Set(aState.unlocked || []);
    let goldBonus = 0;

    for (const a of ACHIEVEMENTS) {
      if (!unlocked.has(a.id) && a.check(state)) {
        unlocked.add(a.id);
        goldBonus += a.reward;
      }
    }

    if (goldBonus > 0) {
      const nextResources = { ...state.resources, gold: (state.resources.gold || 0) + goldBonus };
      return {
        resources: nextResources,
        pluginState: {
          [this.id]: {
            unlocked: Array.from(unlocked),
            unlockedCount: unlocked.size,
            tracks: aState.tracks || {},
          },
        },
      };
    }
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const aState: AchievementPluginState = state.pluginState[this.id];
    if (!aState) return undefined;

    const unlocked = new Set(aState.unlocked || []);
    const list = ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: unlocked.has(a.id),
    }));

    return {
      achievements: {
        unlockedCount: aState.unlockedCount || 0,
        total: ACHIEVEMENTS.length,
        list,
      },
    };
  }
}