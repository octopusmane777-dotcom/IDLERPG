/**
 * Balance simulation: 2-hour play session tick-by-tick.
 * Run with: npx tsx packages/core/test-balance.ts
 *
 * Simulates a player who:
 *   - Taps once per second
 *   - Buys the cheapest upgrade they can afford each tick
 *   - Never uses spells or prestige
 *
 * Outputs a snapshot table every 10 minutes and flags balance issues.
 */

import { GameEngine } from './GameEngine';
import { ProgressionPlugin } from './ProgressionPlugin';
import { AdaptiveModule } from './AdaptiveModule';
import { NetworkPlugin } from './NetworkPlugin';
import { ComboPlugin } from './ComboPlugin';
import { LocalDataRepository } from './LocalDataRepository';

// ---- mock storage so we don't need AsyncStorage ----
class MemStorage {
  private store: Record<string, string> = {};
  getItem(k: string) { return this.store[k] ?? null; }
  setItem(k: string, v: string) { this.store[k] = v; }
}

const storage = new MemStorage();
const repo = new LocalDataRepository(storage as any, 'balance_sim');

const engine = new GameEngine({
  repo,
  userId: 'balance_sim',
  plugins: [
    new ProgressionPlugin(),
    new AdaptiveModule(),
    new NetworkPlugin(),
    new ComboPlugin(),
  ],
  tickRateMs: 1000,
});

engine.initializePlugins();

const SIMULATION_SECONDS = 2 * 60 * 60; // 2 hours
const SNAPSHOT_INTERVAL = 10 * 60;       // every 10 min
const TAP_INTERVAL = 1;                  // tap once per second

let lastSnapshotAt = 0;
let lastTapAt = 0;
let prevLevel = engine.getState().level;
let levelStallStart = -1;
const issues: string[] = [];

console.log('=== BALANCE SIMULATION: 2-HOUR SESSION ===\n');
console.log(
  ['Time', 'Level', 'Gold', 'Gen/s', 'NetDPS', 'TapDmg', 'Kills']
    .map(h => h.padStart(10)).join(' ')
);
console.log('-'.repeat(80));

for (let t = 0; t < SIMULATION_SECONDS; t++) {
  const ts = engine.getState().lastTick + 1000;

  // Tap every TAP_INTERVAL seconds
  if (t - lastTapAt >= TAP_INTERVAL) {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'adaptive', action: { type: 'TAP_DAMAGE' } } });
    lastTapAt = t;
  }

  // Tick the engine
  engine.dispatch({ type: 'TICK', payload: { timestamp: ts } });

  const state = engine.getState();
  const gold = state.resources.gold || 0;
  const meta = engine.getUpgradeMetadata();

  // Auto-buy cheapest available upgrade
  const tapCost = meta.plugins?.adaptive?.tap?.upgradeCost ?? Infinity;
  const genCost = meta.generation?.cost ?? Infinity;
  const levelCost = meta.level?.cost ?? Infinity;
  const botCost = meta.plugins?.network?.network?.nodes?.find((n: any) => n.id === 'bot_farm')?.nextCost ?? Infinity;

  if (gold >= genCost && genCost < tapCost && genCost < levelCost) {
    engine.dispatch({ type: 'UPGRADE_GENERATION', payload: { resource: 'gold', amount: 1, cost: genCost } });
  } else if (gold >= botCost && botCost < tapCost && botCost < levelCost) {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'network', action: { type: 'BUY_NODE', nodeId: 'bot_farm' } } });
  } else if (gold >= tapCost) {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'adaptive', action: { type: 'UPGRADE_TAP' } } });
  }

  // Stall detection: no level change for 20 minutes
  if (state.level === prevLevel) {
    if (levelStallStart < 0) levelStallStart = t;
    else if (t - levelStallStart >= 20 * 60) {
      issues.push(`STALL at t=${Math.floor(t / 60)}m: level stuck at ${state.level} for 20+ minutes`);
      levelStallStart = t; // reset so we don't spam
    }
  } else {
    levelStallStart = -1;
    prevLevel = state.level;
  }

  // Snapshot every 10 min
  if (t - lastSnapshotAt >= SNAPSHOT_INTERVAL || t === SIMULATION_SECONDS - 1) {
    const nState = state.pluginState?.network;
    let netDps = 0;
    if (nState) {
      const { NETWORK_NODES } = require('./NetworkPlugin');
      for (const n of NETWORK_NODES) netDps += (nState.nodes[n.id] || 0) * n.baseRate;
    }
    const tapDmg = state.pluginState?.adaptive?.tapDamage ?? 1;
    const kills = state.pluginState?.adaptive?.monstersDefeated ?? 0;
    const genRate = state.generationRates.gold || 0;
    const timeStr = `${Math.floor(t / 60)}m`;

    console.log(
      [timeStr, state.level, Math.round(gold), genRate.toFixed(1), netDps.toFixed(0), tapDmg, kills]
        .map(v => String(v).padStart(10)).join(' ')
    );
    lastSnapshotAt = t;
  }
}

console.log('\n=== ISSUES ===');
if (issues.length === 0) {
  console.log('None — progression looks healthy!');
} else {
  issues.forEach(i => console.log('  ⚠', i));
}
