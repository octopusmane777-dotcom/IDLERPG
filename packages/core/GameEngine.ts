import { BaseGameEngine, GameState } from './BaseTypes';

export class GameEngine extends BaseGameEngine {
  /** Public wrapper for protected initPlugins — called on first run when no saved state exists */
  initializePlugins() {
    (this as any).initPlugins();
  }

  loadSavedState(savedState: GameState) {
    // Access protected property 'state' via cast
    const state = (this as any).state;
    state.resources = { ...savedState.resources };
    state.generationRates = { ...savedState.generationRates };
    state.generationRates.gold = 0; // zero out legacy GPS from old saves
    state.level = savedState.level;
    state.lastTick = savedState.lastTick;
    state.pluginState = { ...savedState.pluginState };
    state.enabledPlugins = savedState.enabledPlugins || [];

    // Ensure all registered plugins are enabled (toggles removed from UI)
    const enabledSet = new Set(state.enabledPlugins);
    (this as any).plugins.forEach((_: any, id: string) => enabledSet.add(id));
    (this as any).enabledPlugins = enabledSet;
    state.enabledPlugins = Array.from(enabledSet);

    // Initialize plugins FIRST so they see the restored pluginState
    (this as any).initPlugins();
    // THEN process offline progress so plugin onTick runs with initialized state
    (this as any).processOfflineProgress();
  }
}