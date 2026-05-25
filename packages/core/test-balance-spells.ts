/**
 * Spell balance simulation: outputs each spell's DPS contribution at levels 0–5
 * and estimates time-to-unlock from a cold start.
 * Run with: npx tsx packages/core/test-balance-spells.ts
 */

const SPELLS = [
  { id: 'SLASH',     name: 'Overclock',     baseCost: 5,  baseMultiplier: 2,  baseCooldown: 5  },
  { id: 'FIREBALL',  name: 'RAM Surge',      baseCost: 10, baseMultiplier: 5,  baseCooldown: 10 },
  { id: 'LIGHTNING', name: 'GPU Render',     baseCost: 15, baseMultiplier: 12, baseCooldown: 15 },
  { id: 'METEOR',    name: 'Kernel Panic',   baseCost: 20, baseMultiplier: 22, baseCooldown: 25 },
  { id: 'ULTIMATE',  name: 'Neural Cascade', baseCost: 30, baseMultiplier: 45, baseCooldown: 45 },
];

function spellUpgradeCost(spell: typeof SPELLS[0], level: number): number {
  return Math.round(spell.baseCost * 10 * Math.pow(1.5, level));
}

function spellMultiplier(spell: typeof SPELLS[0], level: number): number {
  return spell.baseMultiplier + level * 2;
}

function spellCooldown(spell: typeof SPELLS[0], level: number): number {
  return Math.max(1, spell.baseCooldown - level);
}

// DPS = damage per cast / cooldown (assuming base tap damage of 10 at level 1)
function spellDps(spell: typeof SPELLS[0], level: number, tapDamage = 10): number {
  const dmg = tapDamage * spellMultiplier(spell, level);
  const cd = spellCooldown(spell, level);
  return dmg / cd;
}

const BASE_TAP = 10;
const UPGRADE_LEVELS = [0, 1, 2, 3, 4, 5];

console.log('=== SPELL DPS AT BASE TAP DAMAGE', BASE_TAP, '===\n');
const header = ['Spell', ...UPGRADE_LEVELS.map(l => `Lv${l} DPS`), ...UPGRADE_LEVELS.slice(1).map(l => `Cost→Lv${l}`)];
console.log(header.map((h, i) => (i === 0 ? h.padEnd(18) : h.padStart(12))).join(''));
console.log('-'.repeat(18 + 12 * (header.length - 1)));

for (const spell of SPELLS) {
  const dpsCols = UPGRADE_LEVELS.map(l => spellDps(spell, l).toFixed(1));
  const costCols = UPGRADE_LEVELS.slice(1).map(l => spellUpgradeCost(spell, l - 1).toLocaleString());
  const row = [spell.name, ...dpsCols, ...costCols];
  console.log(row.map((v, i) => (i === 0 ? v.padEnd(18) : v.padStart(12))).join(''));
}

// ---- Affordability check: time to unlock each spell at level 0 ----
// Assume the player earns gold at ~50/s by the time spells matter (stage 5+)
const ASSUMED_GOLD_PER_SEC = 50;

console.log('\n=== UPGRADE AFFORDABILITY (assuming', ASSUMED_GOLD_PER_SEC, 'gold/s) ===\n');
console.log(['Spell', 'Level', 'Cost', 'Seconds to afford', 'Minutes'].map((h, i) => (i === 0 ? h.padEnd(18) : h.padStart(18))).join(''));
console.log('-'.repeat(18 + 18 * 4));

const issues: string[] = [];
for (const spell of SPELLS) {
  for (const level of UPGRADE_LEVELS.slice(0, 5)) {
    const cost = spellUpgradeCost(spell, level);
    const seconds = cost / ASSUMED_GOLD_PER_SEC;
    const minutes = seconds / 60;
    const row = [spell.name, `Lv${level}→Lv${level + 1}`, cost.toLocaleString(), seconds.toFixed(0), minutes.toFixed(1)];
    console.log(row.map((v, i) => (i === 0 ? v.padEnd(18) : v.padStart(18))).join(''));

    // Flag if first spell (Slash/Overclock) upgrade costs more than 5 min
    if (spell.id === 'SLASH' && level === 0 && minutes > 5) {
      issues.push(`SLASH upgrade to Lv1 takes ${minutes.toFixed(1)} min — may feel too slow for new players`);
    }
    // Flag if ultimate upgrade costs so much it's basically unreachable in session
    if (spell.id === 'ULTIMATE' && level === 4 && minutes > 60) {
      issues.push(`ULTIMATE upgrade to Lv5 takes ${minutes.toFixed(1)} min — requires multiple prestiges (ok)`);
    }
  }
}

// ---- Cooldown progression ----
console.log('\n=== COOLDOWN PROGRESSION ===\n');
console.log(['Spell', ...UPGRADE_LEVELS.map(l => `Lv${l} CD`)].map((h, i) => (i === 0 ? h.padEnd(18) : h.padStart(10))).join(''));
console.log('-'.repeat(18 + 10 * UPGRADE_LEVELS.length));
for (const spell of SPELLS) {
  const row = [spell.name, ...UPGRADE_LEVELS.map(l => spellCooldown(spell, l) + 's')];
  console.log(row.map((v, i) => (i === 0 ? v.padEnd(18) : v.padStart(10))).join(''));
}

console.log('\n=== ISSUES ===');
if (issues.length === 0) {
  console.log('None — spell progression looks balanced!');
} else {
  issues.forEach(i => console.log('  ⚠', i));
}
