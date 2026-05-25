import { EnginePlugin, GameState } from './BaseTypes';

export class ProgressionPlugin implements EnginePlugin {
  id = 'progression';

  onInit(engine: any) {
    // Only set initial state when no persisted state exists (first run)
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      const state: GameState = engine.getState();
      const gps = state.generationRates.gold || 0;
      const level = state.level || 1;

      const generationCost = Math.round(10 * Math.pow(1.25, Math.max(0, gps - 1)) + level * 2);
      const levelUpCost = Math.round(40 * Math.pow(1.35, Math.max(1, level) - 1));

      engine.setPluginState(this.id, {
        generation: { resource: 'gold', nextAmount: 1, cost: generationCost },
        level: { level, cost: levelUpCost },
      });
    }
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const existing = state.pluginState[this.id];
    if (!existing) return undefined;
    // Return the metadata as stored by onInit/onAction
    return {
      generation: existing.generation,
      level: existing.level,
    };
  }

  onAction(state: GameState, action: any) {
    if (!action || !action.type) return;

    if (action.type === 'UPGRADE_GENERATION') {
      const { resource, amount, cost } = action.payload;
      const currentGold = state.resources.gold || 0;
      if (currentGold >= cost) {
        const nextResources = { ...state.resources, gold: currentGold - cost };
        const nextGeneration: Record<string, number> = { ...state.generationRates, [resource]: (state.generationRates[resource] || 0) + amount };

        // Recompute metadata
        const gps = nextGeneration['gold'] || 0;
        const level = state.level || 1;
        const generationCost = Math.round(10 * Math.pow(1.25, Math.max(0, gps - 1)) + level * 2);

        return {
          resources: nextResources,
          generationRates: nextGeneration,
          pluginState: { progression: { generation: { resource, nextAmount: amount, cost: generationCost }, level: { level, cost: Math.round(40 * Math.pow(1.35, Math.max(1, level) - 1)) } } }
        };
      }
    }

    if (action.type === 'LEVEL_UP') {
      const cost = action.payload?.cost ?? 0;
      const currentGold = state.resources.gold || 0;
      if (currentGold >= cost) {
        const nextResources = { ...state.resources, gold: currentGold - cost };
        const nextLevel = state.level + 1;
        const nextGeneration: Record<string, number> = { ...state.generationRates, gold: (state.generationRates.gold || 0) + 2 };

        // Recompute metadata
        const gps = nextGeneration['gold'] || 0;
        const generationCost = Math.round(10 * Math.pow(1.25, Math.max(0, gps - 1)) + nextLevel * 2);
        const levelUpCost = Math.round(40 * Math.pow(1.35, Math.max(1, nextLevel) - 1));

        return {
          resources: nextResources,
          level: nextLevel,
          generationRates: nextGeneration,
          pluginState: { progression: { generation: { resource: 'gold', nextAmount: 1, cost: generationCost }, level: { level: nextLevel, cost: levelUpCost } } }
        };
      }
    }
  }
}
