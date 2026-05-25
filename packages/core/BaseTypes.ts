export interface GameState {
  resources: Record<string, number>;
  generationRates: Record<string, number>;
  level: number;
  lastTick: number;
  pluginState: Record<string, any>;
  enabledPlugins?: string[];
}

export type Action =
  | { type: 'INCREMENT_RESOURCE'; payload: { resource: string; amount: number } }
  | { type: 'LEVEL_UP'; payload?: { cost?: number } }
  | { type: 'UPGRADE_GENERATION'; payload: { resource: string; amount: number; cost: number } }
  | { type: 'TICK'; payload: { timestamp: number } }
  | { type: 'PLUGIN_ACTION'; payload: { pluginId: string; action: any } };

export interface GameSave {
  userId: string;
  state: GameState;
  updatedAt: number;
  saveVersion?: number;
}

export interface GameDataRepository {
  saveGame(save: GameSave): Promise<void>;
  loadGame(userId: string): Promise<GameSave | null>;
}

export interface EnginePlugin {
  id: string;
  onInit?(engine: any): void;
  onTick?(state: GameState, deltaSec: number): Partial<GameState> | void;
  onAction?(state: GameState, action: any): Partial<GameState> | void;
  onKill?(state: GameState, killCount: number): Partial<GameState> | void;
  getActionMetadata?(state: GameState): Record<string, any> | undefined;
}

export interface GameEngineConfig {
  tickRateMs?: number;
  plugins?: EnginePlugin[];
}

export class BaseGameEngine {
  protected offlineCapSec: number = 28800;
  protected state: GameState;
  private listeners: Array<(state: GameState) => void> = [];
  private tickInterval: any = null;
  private saveTimer: any = null;
  private saveDebounceMs: number = 30000;
  private tickRateMs: number;
  private plugins: Map<string, EnginePlugin> = new Map();
  private enabledPlugins: Set<string> = new Set();

  protected repo?: GameDataRepository;
  protected userId?: string;

  constructor(config?: GameEngineConfig & { repo?: GameDataRepository, userId?: string }) {
    this.tickRateMs = config?.tickRateMs || 1000;
    this.repo = config?.repo;
    this.userId = config?.userId;

    this.state = {
      resources: { gold: 0 },
      generationRates: { gold: 0 },
      level: 1,
      lastTick: Date.now(),
      pluginState: {},
      enabledPlugins: [],
    };

    if (config?.plugins) {
      config.plugins.forEach(plugin => {
        this.registerPlugin(plugin);
        this.enabledPlugins.add(plugin.id);
      });
      this.state.enabledPlugins = Array.from(this.enabledPlugins);
    }
  }

  protected async notify() {
    const currentState = this.getState();
    this.listeners.forEach(listener => listener(currentState));

    if (this.repo && this.userId) {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(async () => {
        try {
          await this.repo!.saveGame({
            userId: this.userId!,
            state: this.getState(),
            updatedAt: Date.now()
          });
        } catch (err) {
          console.error('[BaseGameEngine] auto-save failed', err);
        } finally {
          this.saveTimer = null;
        }
      }, this.saveDebounceMs);
    }
  }

  async flushSave(): Promise<void> {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (this.repo && this.userId) {
      try {
        await this.repo.saveGame({ userId: this.userId, state: this.getState(), updatedAt: Date.now() });
      } catch (err) {
        console.error('[BaseGameEngine] flush save failed', err);
      }
    }
  }

  togglePlugin(pluginId: string, enabled: boolean) {
    if (enabled) this.enabledPlugins.add(pluginId);
    else this.enabledPlugins.delete(pluginId);
    this.state.enabledPlugins = Array.from(this.enabledPlugins);
    this.notify();
  }

  isPluginEnabled(pluginId: string): boolean {
    return this.enabledPlugins.has(pluginId);
  }

  registerPlugin(plugin: EnginePlugin) {
    this.plugins.set(plugin.id, plugin);
    this.state.pluginState[plugin.id] = {};
  }

  protected initPlugins() {
    this.plugins.forEach(plugin => {
      try { if (plugin.onInit) plugin.onInit(this); }
      catch (err) { console.error(`[BaseGameEngine] plugin ${plugin.id} onInit error`, err); }
    });
  }

  getPluginState<T = any>(pluginId: string): T {
    return this.state.pluginState[pluginId];
  }

  setPluginState(pluginId: string, newState: any) {
    this.state.pluginState[pluginId] = { ...this.state.pluginState[pluginId], ...newState };
    this.notify();
  }

  getState(): GameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  getUpgradeMetadata() {
    let generation: any = undefined;
    let level: any = undefined;
    const pluginsMeta: Record<string, any> = {};

    this.plugins.forEach(plugin => {
      if (plugin.getActionMetadata) {
        const meta = plugin.getActionMetadata(this.state);
        if (meta) {
          pluginsMeta[plugin.id] = { id: plugin.id, ...meta };
          if (meta.generation && meta.level) {
            generation = meta.generation;
            level = meta.level;
          }
        }
      }
    });

    if (generation && level) return { generation, level, plugins: pluginsMeta };

    const gps = this.state.generationRates.gold || 0;
    const lvl = this.state.level || 1;
    const generationCost = Math.round(10 * Math.pow(1.25, Math.max(0, gps - 1)) + lvl * 2);
    const levelUpCost = Math.round(40 * Math.pow(1.35, Math.max(1, lvl) - 1));

    return {
      generation: { resource: 'gold', nextAmount: 1, cost: generationCost },
      level: { level: lvl, cost: levelUpCost },
      plugins: pluginsMeta,
    };
  }

  start() {
    if (this.tickInterval) return;
    const elapsedSec = (Date.now() - this.state.lastTick) / 1000;
    const isFreshStart = elapsedSec < 1;
    if (!isFreshStart) {
      this.processOfflineProgress();
    } else {
      this.state.lastTick = Date.now();
    }
    this.tickInterval = setInterval(() => {
      this.dispatch({ type: 'TICK', payload: { timestamp: Date.now() } });
    }, this.tickRateMs);
  }

  stop() {
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    void this.flushSave();
  }

  dispatch(action: Action): void {
    switch (action.type) {
      case 'INCREMENT_RESOURCE': {
        const { resource, amount } = action.payload;
        this.state.resources[resource] = (this.state.resources[resource] || 0) + amount;
        break;
      }
      case 'LEVEL_UP': {
        let handled = false;
        for (const plugin of this.plugins.values()) {
          if (!this.isPluginEnabled(plugin.id) || !plugin.onAction) continue;
          const updates = plugin.onAction(this.state, action);
          if (updates) { this.applyStateUpdates(updates); handled = true; break; }
        }
        if (!handled) {
          const cost = action.payload?.cost ?? 0;
          const currentGold = this.state.resources.gold || 0;
          if (currentGold >= cost) {
            this.state.resources.gold = currentGold - cost;
            this.state.level += 1;
            this.state.generationRates.gold = (this.state.generationRates.gold || 0) + 2;
          }
        }
        break;
      }
      case 'UPGRADE_GENERATION': {
        let handled = false;
        for (const plugin of this.plugins.values()) {
          if (!this.isPluginEnabled(plugin.id) || !plugin.onAction) continue;
          const updates = plugin.onAction(this.state, action);
          if (updates) { this.applyStateUpdates(updates); handled = true; break; }
        }
        if (!handled) {
          const { resource, amount, cost } = action.payload;
          const currentGold = this.state.resources.gold || 0;
          if (currentGold >= cost) {
            this.state.resources.gold = currentGold - cost;
            this.state.generationRates[resource] = (this.state.generationRates[resource] || 0) + amount;
          }
        }
        break;
      }
      case 'TICK': {
        const { timestamp } = action.payload;
        const deltaSec = Math.max(0, (timestamp - this.state.lastTick) / 1000);

        Object.entries(this.state.generationRates).forEach(([resource, rate]) => {
          this.state.resources[resource] = (this.state.resources[resource] || 0) + (rate * deltaSec);
        });

        const oldLevel = this.state.level;
        this.plugins.forEach(plugin => {
          if (this.isPluginEnabled(plugin.id) && plugin.onTick) {
            const updates = plugin.onTick(this.state, deltaSec);
            if (updates) this.applyStateUpdates(updates);
          }
        });
        if (this.state.level > oldLevel) {
          const kills = this.state.level - oldLevel;
          this.plugins.forEach(plugin => {
            if (this.isPluginEnabled(plugin.id) && plugin.onKill) {
              for (let i = 0; i < kills; i++) {
                const updates = plugin.onKill!(this.state, 1);
                if (updates) this.applyStateUpdates(updates);
              }
            }
          });
        }

        this.state.lastTick = timestamp;
        break;
      }
      case 'PLUGIN_ACTION': {
        const { pluginId, action: pluginAction } = action.payload;
        const plugin = this.plugins.get(pluginId);
        if (plugin && plugin.onAction) {
          const oldLevel = this.state.level;
          const updates = plugin.onAction(this.state, pluginAction);
          if (updates) {
            this.applyStateUpdates(updates);
            if (this.state.level > oldLevel) {
              const kills = this.state.level - oldLevel;
              this.plugins.forEach(p => {
                if (this.isPluginEnabled(p.id) && p.onKill) {
                  for (let i = 0; i < kills; i++) {
                    const killUpdates = p.onKill!(this.state, 1);
                    if (killUpdates) this.applyStateUpdates(killUpdates);
                  }
                }
              });
            }
          }
        }
        break;
      }
    }
    this.notify();
  }

  protected applyStateUpdates(updates: Partial<GameState>) {
    if (updates.resources) this.state.resources = { ...this.state.resources, ...updates.resources };
    if (updates.generationRates) this.state.generationRates = { ...this.state.generationRates, ...updates.generationRates };
    if (updates.level !== undefined) this.state.level = updates.level;
    if (updates.pluginState) this.state.pluginState = { ...this.state.pluginState, ...updates.pluginState };
  }

  protected processOfflineProgress() {
    const now = Date.now();
    const elapsedSec = (now - this.state.lastTick) / 1000;
    if (elapsedSec <= 0) return;

    const cappedSec = Math.min(elapsedSec, this.offlineCapSec);
    if (cappedSec <= 0) return;

    const CHUNK_SEC = 1;
    let totalBaseGold = 0;
    let simTime = 0;

    // Apply base generation linearly (no need to chunk — it's linear math)
    Object.entries(this.state.generationRates).forEach(([resource, rate]) => {
      const gain = rate * cappedSec;
      this.state.resources[resource] = (this.state.resources[resource] || 0) + gain;
      if (resource === 'gold') totalBaseGold += gain;
    });

    // Chunk plugin ticks into 1-second slices so time-dependent logic (kill counts,
    // cooldowns, combo resets) behaves correctly over large offline durations
    while (simTime < cappedSec) {
      const delta = Math.min(CHUNK_SEC, cappedSec - simTime);
      const oldLevel = this.state.level;
      this.plugins.forEach(plugin => {
        if (this.isPluginEnabled(plugin.id) && plugin.onTick) {
          const updates = plugin.onTick(this.state, delta);
          if (updates) this.applyStateUpdates(updates);
        }
      });
      if (this.state.level > oldLevel) {
        const kills = this.state.level - oldLevel;
        this.plugins.forEach(plugin => {
          if (this.isPluginEnabled(plugin.id) && plugin.onKill) {
            for (let i = 0; i < kills; i++) {
              const updates = plugin.onKill!(this.state, 1);
              if (updates) this.applyStateUpdates(updates);
            }
          }
        });
      }
      simTime += delta;
    }

    this.state.lastTick = now;
    this.notify();

    if (cappedSec > 60) {
      console.log(`[Offline] Away ${(elapsedSec / 60).toFixed(0)}min, capped at ${(cappedSec / 60).toFixed(0)}min, earned ${totalBaseGold.toFixed(1)} gold base`);
    }
  }

  subscribe(listener: (state: GameState) => void) {
    this.listeners.push(listener);
    listener(this.getState());
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }
}