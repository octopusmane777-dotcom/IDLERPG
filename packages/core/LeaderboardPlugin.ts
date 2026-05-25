import { EnginePlugin, GameState } from './BaseTypes';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  stage: number;
  cores: number;
  defeated: number;
  updatedAt: string;
  isMe: boolean;
}

export interface LeaderboardPluginState {
  enabled: boolean;
  myRank: number | null;
  topPlayers: LeaderboardEntry[];
  lastSubmit: number;
  lastFetch: number;
  loading: boolean;
  error: string | null;
}

const SUBMIT_INTERVAL_MS = 5 * 60 * 1000;
const FETCH_INTERVAL_MS = 10 * 60 * 1000;

export class LeaderboardPlugin implements EnginePlugin {
  id = 'leaderboard';

  private supabaseUrl: string;
  private anonKey: string;

  constructor(supabaseUrl: string, anonKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.anonKey = anonKey;
  }

  onInit(engine: any) {
    (this as any)._engine = engine;
    const existing = engine.getPluginState(this.id) as LeaderboardPluginState | undefined;
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        enabled: false,
        myRank: null,
        topPlayers: [],
        lastSubmit: 0,
        lastFetch: 0,
        loading: false,
        error: null,
      } as LeaderboardPluginState);
    }
  }

  onTick(state: GameState, _delta: number): Partial<GameState> | void {
    const s: LeaderboardPluginState = state.pluginState[this.id];
    if (!s?.enabled) return;

    const now = Date.now();

    if (now - s.lastSubmit >= SUBMIT_INTERVAL_MS) {
      this.submitScore(state);
      return {
        pluginState: { [this.id]: { ...s, lastSubmit: now } },
      };
    }

    if (now - s.lastFetch >= FETCH_INTERVAL_MS) {
      this.fetchLeaderboard(state);
      return {
        pluginState: { [this.id]: { ...s, lastFetch: now } },
      };
    }
  }

  onAction(state: GameState, action: any): Partial<GameState> | void {
    const s: LeaderboardPluginState = state.pluginState[this.id];
    if (!s) return;

    if (action.type === 'TOGGLE_LEADERBOARD') {
      const enabling = !s.enabled;
      const next = {
        ...s,
        enabled: enabling,
        lastSubmit: enabling ? 0 : s.lastSubmit,
        lastFetch: enabling ? 0 : s.lastFetch,
      };
      if (enabling) {
        this.submitScore(state);
        this.fetchLeaderboard(state);
      }
      return { pluginState: { [this.id]: next } };
    }

    if (action.type === '_LEADERBOARD_RESULT') {
      return {
        pluginState: {
          [this.id]: {
            ...s,
            topPlayers: action.topPlayers ?? s.topPlayers,
            myRank: action.myRank ?? s.myRank,
            loading: false,
            error: action.error ?? null,
          },
        },
      };
    }
  }

  private getAuthToken(): string | null {
    try {
      const key = Object.keys(localStorage).find(k => k.endsWith('-auth-token'));
      if (!key) return null;
      const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
      return parsed?.access_token ?? null;
    } catch {
      return null;
    }
  }

  private async submitScore(state: GameState) {
    const token = this.getAuthToken();
    if (!token) return;
    const prestigePs = state.pluginState.prestige as any;
    const statsPs = state.pluginState.stats as any;
    try {
      await fetch(`${this.supabaseUrl}/functions/v1/submit-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage: state.level,
          prestige_cores: prestigePs?.cores ?? 0,
          monsters_defeated: statsPs?.totalKills ?? 0,
        }),
      });
    } catch {
      // silent — opt-in best-effort
    }
  }

  private async fetchLeaderboard(state: GameState) {
    const token = this.getAuthToken();
    if (!token) return;

    // Dispatch result back via a synthetic plugin action after fetch completes.
    // We capture the engine's dispatch indirectly by storing it on the class
    // during onInit — but since we don't have engine here, we use a stored ref.
    const engineRef = (this as any)._engine;
    if (!engineRef) return;

    engineRef.dispatch({
      type: 'PLUGIN_ACTION',
      payload: { pluginId: this.id, action: { type: '_LEADERBOARD_RESULT', loading: true } },
    });

    try {
      const res = await fetch(`${this.supabaseUrl}/functions/v1/submit-score`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const myEntry = (json.topPlayers ?? []).find((p: LeaderboardEntry) => p.isMe);
      engineRef.dispatch({
        type: 'PLUGIN_ACTION',
        payload: {
          pluginId: this.id,
          action: {
            type: '_LEADERBOARD_RESULT',
            topPlayers: json.topPlayers ?? [],
            myRank: myEntry?.rank ?? null,
          },
        },
      });
    } catch {
      engineRef.dispatch({
        type: 'PLUGIN_ACTION',
        payload: {
          pluginId: this.id,
          action: { type: '_LEADERBOARD_RESULT', error: 'Failed to fetch leaderboard' },
        },
      });
    }
  }

  getActionMetadata(_state: GameState): Record<string, any> | undefined {
    return undefined;
  }
}
