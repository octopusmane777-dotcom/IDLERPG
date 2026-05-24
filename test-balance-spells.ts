/**
 * test-balance-spells.ts — Verifies spell upgrade progression curves.
 * Run: npx ts-node test-balance-spells.ts
 *
 * Simulates buying spell upgrades and prints cost/multiplier/cooldown curves
 * for each of the 5 spells across 10 upgrade levels.
 */

import { GameEngine } from './packages/core/GameEngine';
import { AdaptiveModule } from './packages/core/AdaptiveModule';
import { ProgressionPlugin } from './packages/core/ProgressionPlugin';
import { EnergyPlugin } from './packages/core/EnergyPlugin';
import { PrestigePlugin } from './packages/core/PrestigePlugin';
import { AchievementPlugin } from './packages/core/AchievementPlugin';

const SPELL_IDS = ['SLASH', 'FIREBALL', 'LIGHTNING', 'METEOR', 'ULTIMATE'];
const BASE_COSTS = [5, 10, 15, 20, 30];
const BASE_MULTS = [2, 5, 10, 20, 40];
const BASE_CDS   = [5, 10, 15, 25, 45];

function spellUpgradeCost(baseCost: number, level: number): number {
  return Math.round(baseCost * 10 * Math.pow(1.5, level));
}
function spellMultiplier(baseMult: number, level: number): number {
  return baseMult + level * 2;
}
function spellCooldown(baseCd: number, level: number): number {
  return Math.max(1, baseCd - level);
}

console.log('\n=== Spell Upgrade Progression Curves ===\n');

for (let i = 0; i < SPELL_IDS.length; i++) {
  const id = SPELL_IDS[i];
  const baseCost = BASE_COSTS[i];
  const baseMult = BASE_MULTS[i];
  const baseCd   = BASE_CDS[i];

  console.log(`\n--- ${id} (base cost: ${baseCost}, base mult: ${baseMult}, base CD: ${baseCd}s) ---`);
  console.log('Level | Upgrade Cost | Multiplier | Cooldown | DPS Factor');

  let totalCost = 0;
  for (let lvl = 0; lvl <= 10; lvl++) {
    const cost = lvl === 0 ? 0 : spellUpgradeCost(baseCost, lvl - 1);
    totalCost += cost;
    const mult = spellMultiplier(baseMult, lvl);
    const cd = spellCooldown(baseCd, lvl);
    const dpsFactor = (mult / cd).toFixed(2);
    const costStr = cost === 0 ? '     (base)' : String(cost).padStart(12);
    console.log(`  ${String(lvl).padStart(3)} | ${costStr} | ${String(mult).padStart(10)} | ${String(cd).padStart(7)}s | ${dpsFactor}`);
  }
  console.log(`  Total investment to Lv.10: ${totalCost}`);
}

// Simulate a short play session using the engine to verify spells work end-to-end
console.log('\n=== Engine Integration: Cast & Upgrade Spells ===\n');

const engine = new GameEngine({
  plugins: [
    new ProgressionPlugin(),
    new AdaptiveModule(),
    new PrestigePlugin(),
    new EnergyPlugin(),
    new AchievementPlugin(),
  ],
  userId: 'spell_test',
});

(engine as any).initializePlugins();

// Give plenty of gold
engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 10_000_000 } });

// Cast each spell once
for (const id of SPELL_IDS) {
  engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: id } } });
}

const esAfterCast = engine.getState().pluginState['energy'];
console.log('After casting all 5 spells:');
console.log(`  Energy: ${esAfterCast.energy.toFixed(1)} / ${esAfterCast.maxEnergy}`);
console.log(`  Active cooldowns: ${Object.keys(esAfterCast.cooldowns).join(', ')}`);

// Upgrade each spell to level 3
for (const id of SPELL_IDS) {
  for (let j = 0; j < 3; j++) {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: `UPGRADE_${id}` } } });
  }
}

const esAfterUpgrade = engine.getState().pluginState['energy'];
console.log('\nAfter upgrading all spells to Lv.3:');
for (const id of SPELL_IDS) {
  console.log(`  ${id}: level ${esAfterUpgrade.spellLevels[id]}`);
}

// Check metadata reflects upgrades
const meta: any = engine.getUpgradeMetadata();
console.log('\nSpell metadata at Lv.3:');
for (const s of meta.plugins['energy']?.energy?.spells ?? []) {
  console.log(`  ${s.name} (Lv.${s.level}): x${s.multiplier} dmg, ${s.cooldown}s CD, upgrade cost: ${s.upgradeCost}`);
}

const goldSpent = 10_000_000 - (engine.getState().resources.gold ?? 0);
console.log(`\nGold spent on 3 levels per spell: ${goldSpent.toFixed(0)}`);
console.log('\nSpell balance test complete.\n');
