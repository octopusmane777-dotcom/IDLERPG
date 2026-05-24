/**
 * test-balance.ts — Simulates hours of idle play and outputs progression curves.
 * Run: npx ts-node test-balance.ts
 * 
 * This script creates a GameEngine with all plugins, simulates ticks,
 * and prints resource/level progression over time.
 */

import { GameEngine } from './packages/core/GameEngine';
import { AdaptiveModule } from './packages/core/AdaptiveModule';
import { ProgressionPlugin } from './packages/core/ProgressionPlugin';
import { PrestigePlugin } from './packages/core/PrestigePlugin';
import { EnergyPlugin } from './packages/core/EnergyPlugin';
import { AchievementPlugin } from './packages/core/AchievementPlugin';
import { DebugPlugin } from './packages/core/DebugPlugin';
import { OnboardingPlugin } from './packages/core/OnboardingPlugin';
import { AnalyticsPlugin } from './packages/core/AnalyticsPlugin';

const engine = new GameEngine({
  plugins: [
    new ProgressionPlugin(),
    new AdaptiveModule(),
    new PrestigePlugin(),
    new EnergyPlugin(),
    new AchievementPlugin(),
    new DebugPlugin(),
    new OnboardingPlugin(),
    new AnalyticsPlugin(),
  ],
  userId: 'player',
});

(engine as any).initializePlugins();

const HOURS = 6;
const TICK_SEC = 10; // simulate in 10-second chunks
const TOTAL_TICKS = Math.floor((HOURS * 3600) / TICK_SEC);

console.log(`\n=== IDLERPG Balance Simulation: ${HOURS}h of idle play ===\n`);
console.log('Time      | Gold         | Level | GPS  | Cores | Achievements');

for (let i = 0; i <= TOTAL_TICKS; i++) {
  engine.dispatch({ type: 'TICK', payload: { timestamp: Date.now() + i * TICK_SEC * 1000 } });

  // Every 30 minutes, buy an upgrade if affordable (simulating active play)
  if (i % 180 === 0 && i > 0) {
    const state = engine.getState();
    // Try to level up
    const lvlCost = Math.round(40 * Math.pow(1.35, Math.max(1, state.level) - 1));
    if (state.resources.gold >= lvlCost) {
      engine.dispatch({ type: 'LEVEL_UP', payload: { cost: lvlCost } });
    }
    // Try to upgrade generation
    const gps = state.generationRates.gold || 0;
    const genCost = Math.round(10 * Math.pow(1.25, Math.max(0, gps - 1)) + state.level * 2);
    if (state.resources.gold >= genCost) {
      engine.dispatch({ type: 'UPGRADE_GENERATION', payload: { resource: 'gold', amount: 1, cost: genCost } });
    }
  }

  // Log every hour
  if (i % 360 === 0) {
    const s = engine.getState();
    const pState = s.pluginState.prestige || {};
    const aState = s.pluginState.achievements || {};
    const hours = (i * TICK_SEC / 3600).toFixed(1).padStart(5);
    const gold = (s.resources.gold || 0).toFixed(0).padStart(10);
    const level = String(s.level || 1).padStart(5);
    const gps = ((s.generationRates.gold || 0) * (pState.bonusMultiplier || 1)).toFixed(1).padStart(5);
    const cores = String(pState.cores || 0).padStart(5);
    const achs = String(aState.unlockedCount || 0).padStart(11);
    console.log(`${hours}h | ${gold} | ${level} | ${gps} | ${cores} | ${achs}`);
  }
}

const final = engine.getState();
const pState = final.pluginState.prestige || {};
console.log(`\n=== Final State ===`);
console.log(`Gold: ${(final.resources.gold || 0).toFixed(0)}`);
console.log(`Level: ${final.level}`);
console.log(`GPS (base): ${(final.generationRates.gold || 0).toFixed(1)}`);
console.log(`GPS (with prestige bonus): ${((final.generationRates.gold || 0) * (pState.bonusMultiplier || 1)).toFixed(1)}`);
console.log(`Cores: ${pState.cores || 0}`);
console.log(`Lifetime gold: ${(pState.lifetimeGold || 0).toFixed(0)}`);
console.log(`Achievements: ${(final.pluginState.achievements?.unlockedCount || 0)}`);
console.log(`Monsters defeated: ${final.pluginState.adaptive?.monstersDefeated || 0}`);
console.log(`\nSimulation complete.\n`);