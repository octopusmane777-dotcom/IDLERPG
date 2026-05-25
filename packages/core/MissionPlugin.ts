import { EnginePlugin, GameState } from './BaseTypes';

export interface MissionProgress {
  id: string;
  description: string;
  target: number;
  progress: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

export interface MissionPluginState {
  dayKey: number;
  active: MissionProgress[];
  sessionKills: number;
  sessionTaps: number;
  sessionGoldSpent: number;
  sessionSpellsCast: number;
  sessionScraps: number;
  prevLevel: number;
}

interface MissionTemplate {
  id: string;
  description: string;
  target: number;
  reward: number;
  trackKey: keyof Omit<MissionPluginState, 'dayKey' | 'active' | 'prevLevel'>;
}

const MISSION_POOL: MissionTemplate[] = [
  { id: 'kill_25',       description: 'Defeat 25 targets',        target: 25,   reward: 500,  trackKey: 'sessionKills' },
  { id: 'kill_100',      description: 'Defeat 100 targets',       target: 100,  reward: 2500, trackKey: 'sessionKills' },
  { id: 'tap_50',        description: 'Deal 50 tap attacks',       target: 50,   reward: 300,  trackKey: 'sessionTaps' },
  { id: 'spend_1000',    description: 'Spend 1,000 CPU on upgrades', target: 1000, reward: 800, trackKey: 'sessionGoldSpent' },
  { id: 'cast_10',       description: 'Cast 10 hack modules',      target: 10,   reward: 600,  trackKey: 'sessionSpellsCast' },
  { id: 'scrap_3',       description: 'Scrap 3 hardware pieces',   target: 3,    reward: 700,  trackKey: 'sessionScraps' },
  { id: 'kill_50',       description: 'Defeat 50 targets',         target: 50,   reward: 1200, trackKey: 'sessionKills' },
  { id: 'tap_200',       description: 'Deal 200 tap attacks',      target: 200,  reward: 900,  trackKey: 'sessionTaps' },
  { id: 'spend_5000',    description: 'Spend 5,000 CPU on upgrades', target: 5000, reward: 2000, trackKey: 'sessionGoldSpent' },
  { id: 'cast_30',       description: 'Cast 30 hack modules',      target: 30,   reward: 1500, trackKey: 'sessionSpellsCast' },
];

function pickMissions(dayKey: number): MissionTemplate[] {
  // Deterministic selection using day key as seed
  const a = ((dayKey * 1664525 + 1013904223) & 0xffffffff) >>> 0;
  const b = ((a * 1664525 + 1013904223) & 0xffffffff) >>> 0;
  const c = ((b * 1664525 + 1013904223) & 0xffffffff) >>> 0;
  const idx0 = a % MISSION_POOL.length;
  let idx1 = b % MISSION_POOL.length;
  if (idx1 === idx0) idx1 = (idx1 + 1) % MISSION_POOL.length;
  let idx2 = c % MISSION_POOL.length;
  if (idx2 === idx0 || idx2 === idx1) idx2 = (idx2 + 2) % MISSION_POOL.length;
  return [MISSION_POOL[idx0], MISSION_POOL[idx1], MISSION_POOL[idx2]];
}

function todayKey(): number {
  return Math.floor(Date.now() / 86400000);
}

function buildActive(templates: MissionTemplate[]): MissionProgress[] {
  return templates.map(t => ({
    id: t.id,
    description: t.description,
    target: t.target,
    progress: 0,
    reward: t.reward,
    completed: false,
    claimed: false,
  }));
}

export class MissionPlugin implements EnginePlugin {
  id = 'missions';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    const day = todayKey();
    if (!existing || Object.keys(existing).length === 0 || existing.dayKey !== day) {
      const templates = pickMissions(day);
      engine.setPluginState(this.id, {
        dayKey: day,
        active: buildActive(templates),
        sessionKills: 0,
        sessionTaps: 0,
        sessionGoldSpent: 0,
        sessionSpellsCast: 0,
        sessionScraps: 0,
        prevLevel: engine.getState().level,
      } as MissionPluginState);
    }
  }

  onTick(state: GameState, _deltaSec: number) {
    const mState: MissionPluginState = state.pluginState[this.id];
    if (!mState) return;

    const day = todayKey();
    if (mState.dayKey !== day) {
      // New day — rotate missions, reset session counters
      const templates = pickMissions(day);
      return {
        pluginState: {
          [this.id]: {
            dayKey: day,
            active: buildActive(templates),
            sessionKills: 0,
            sessionTaps: 0,
            sessionGoldSpent: 0,
            sessionSpellsCast: 0,
            sessionScraps: 0,
            prevLevel: state.level,
          },
        },
      };
    }

    // Track kills via level delta
    const kills = Math.max(0, state.level - (mState.prevLevel || state.level));
    if (kills === 0) return;

    const sessionKills = (mState.sessionKills || 0) + kills;
    const active = mState.active.map(m => {
      if (m.claimed) return m;
      const template = MISSION_POOL.find(t => t.id === m.id);
      if (!template || template.trackKey !== 'sessionKills') return m;
      const progress = Math.min(m.target, sessionKills);
      return { ...m, progress, completed: progress >= m.target };
    });

    return {
      pluginState: {
        [this.id]: { ...mState, sessionKills, active, prevLevel: state.level },
      },
    };
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const mState: MissionPluginState = state.pluginState[this.id];
    if (!mState) return undefined;

    const nextReset = (mState.dayKey + 1) * 86400000;
    return {
      missions: {
        list: mState.active,
        nextReset,
        hoursUntilReset: Math.max(0, Math.floor((nextReset - Date.now()) / 3600000)),
      },
    };
  }

  onAction(state: GameState, action: any) {
    const mState: MissionPluginState = state.pluginState[this.id];
    if (!mState) return;

    if (action.type === 'CLAIM_MISSION') {
      const missionId: string = action.missionId;
      const mission = mState.active.find(m => m.id === missionId);
      if (!mission || !mission.completed || mission.claimed) return;

      const active = mState.active.map(m =>
        m.id === missionId ? { ...m, claimed: true } : m
      );
      return {
        resources: { ...state.resources, gold: (state.resources.gold || 0) + mission.reward },
        pluginState: {
          [this.id]: { ...mState, active },
        },
      };
    }

    // Track session stats from other actions
    let updated: Partial<MissionPluginState> | null = null;

    if (action.type === 'TAP_DAMAGE') {
      updated = { sessionTaps: (mState.sessionTaps || 0) + 1 };
    } else if (
      action.type === 'UPGRADE_GENERATION' ||
      action.type === 'LEVEL_UP' ||
      action.type === 'UPGRADE_TAP' ||
      (action.type && action.type.startsWith('UPGRADE_'))
    ) {
      const cost = action.payload?.cost ?? action.cost ?? 0;
      updated = { sessionGoldSpent: (mState.sessionGoldSpent || 0) + cost };
    } else if (['SLASH', 'FIREBALL', 'LIGHTNING', 'METEOR', 'ULTIMATE'].includes(action.type)) {
      updated = { sessionSpellsCast: (mState.sessionSpellsCast || 0) + 1 };
    } else if (action.type === 'SCRAP') {
      updated = { sessionScraps: (mState.sessionScraps || 0) + 1 };
    }

    if (!updated) return;

    // Update mission progress for affected track key
    const newMState = { ...mState, ...updated };
    const active = newMState.active.map(m => {
      if (m.claimed || m.completed) return m;
      const template = MISSION_POOL.find(t => t.id === m.id);
      if (!template) return m;
      const trackVal = (newMState as any)[template.trackKey] || 0;
      const progress = Math.min(m.target, trackVal);
      return { ...m, progress, completed: progress >= m.target };
    });

    return {
      pluginState: {
        [this.id]: { ...newMState, active },
      },
    };
  }
}
