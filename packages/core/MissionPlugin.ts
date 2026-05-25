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
  matter: number;
}

interface MissionTemplate {
  id: string;
  description: string;
  target: number;
  reward: number;
  trackKey: keyof Omit<MissionPluginState, 'dayKey' | 'active' | 'prevLevel' | 'matter'>;
}

const MISSION_POOL: MissionTemplate[] = [
  { id: 'kill_25',    description: 'Defeat 25 targets',           target: 25,   reward: 3,  trackKey: 'sessionKills' },
  { id: 'kill_100',   description: 'Defeat 100 targets',          target: 100,  reward: 8,  trackKey: 'sessionKills' },
  { id: 'tap_50',     description: 'Deal 50 tap attacks',          target: 50,   reward: 2,  trackKey: 'sessionTaps' },
  { id: 'spend_1000', description: 'Spend 1,000 CPU on upgrades',  target: 1000, reward: 4,  trackKey: 'sessionGoldSpent' },
  { id: 'cast_10',    description: 'Cast 10 hack modules',         target: 10,   reward: 3,  trackKey: 'sessionSpellsCast' },
  { id: 'scrap_3',    description: 'Scrap 3 hardware pieces',      target: 3,    reward: 4,  trackKey: 'sessionScraps' },
  { id: 'kill_50',    description: 'Defeat 50 targets',            target: 50,   reward: 5,  trackKey: 'sessionKills' },
  { id: 'tap_200',    description: 'Deal 200 tap attacks',         target: 200,  reward: 6,  trackKey: 'sessionTaps' },
  { id: 'spend_5000', description: 'Spend 5,000 CPU on upgrades',  target: 5000, reward: 10, trackKey: 'sessionGoldSpent' },
  { id: 'cast_30',    description: 'Cast 30 hack modules',         target: 30,   reward: 8,  trackKey: 'sessionSpellsCast' },
];

function pickMissions(dayKey: number): MissionTemplate[] {
  const a = ((dayKey * 1664525 + 1013904223) & 0xffffffff) >>> 0;
  const b = ((a  * 1664525 + 1013904223) & 0xffffffff) >>> 0;
  const c = ((b  * 1664525 + 1013904223) & 0xffffffff) >>> 0;
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

const SPELL_ACTIONS = new Set(['SLASH', 'FIREBALL', 'LIGHTNING', 'METEOR', 'ULTIMATE']);

export class MissionPlugin implements EnginePlugin {
  id = 'missions';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    const day = todayKey();
    if (!existing || Object.keys(existing).length === 0) {
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
        matter: 0,
      } as MissionPluginState);
    } else {
      // Migrate older state that lacks matter
      if (existing.matter === undefined) {
        engine.setPluginState(this.id, { ...existing, matter: 0 });
      }
      // Rotate missions if day changed since last save
      if (existing.dayKey !== day) {
        const templates = pickMissions(day);
        engine.setPluginState(this.id, {
          ...existing,
          dayKey: day,
          active: buildActive(templates),
          sessionKills: 0,
          sessionTaps: 0,
          sessionGoldSpent: 0,
          sessionSpellsCast: 0,
          sessionScraps: 0,
          prevLevel: engine.getState().level,
          matter: existing.matter ?? 0,
        });
      }
    }
  }

  onTick(state: GameState, _deltaSec: number) {
    const mState: MissionPluginState = state.pluginState[this.id];
    if (!mState) return;

    const day = todayKey();
    if (mState.dayKey !== day) {
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
            matter: mState.matter ?? 0,
          },
        },
      };
    }
    return;
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
        matter: mState.matter ?? 0,
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
      const newMatter = (mState.matter ?? 0) + mission.reward;
      return {
        pluginState: {
          [this.id]: { ...mState, active, matter: newMatter },
        },
      };
    }

    // RECORD_KILL is dispatched directly by AdaptiveModule to guarantee accuracy
    if (action.type === 'RECORD_KILL') {
      const kills = (action.count as number) ?? 1;
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
      if (cost > 0) updated = { sessionGoldSpent: (mState.sessionGoldSpent || 0) + cost };
    } else if (SPELL_ACTIONS.has(action.type)) {
      updated = { sessionSpellsCast: (mState.sessionSpellsCast || 0) + 1 };
    } else if (action.type === 'SCRAP') {
      updated = { sessionScraps: (mState.sessionScraps || 0) + 1 };
    }

    if (!updated) return;

    const newMState = { ...mState, ...updated };
    const active = newMState.active.map(m => {
      if (m.claimed || m.completed) return m;
      const template = MISSION_POOL.find(t => t.id === m.id);
      if (!template || template.trackKey === 'sessionKills') return m; // kills tracked via RECORD_KILL
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
