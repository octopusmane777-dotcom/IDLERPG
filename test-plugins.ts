import { GameEngine } from './packages/core';
import { AdaptiveModule } from './packages/core/AdaptiveModule';

const engine = new GameEngine({
  tickRateMs: 500, // Process ticks faster for test
  plugins: [new AdaptiveModule()],
});

engine.subscribe((state) => {
  const combatState = state.pluginState.adaptive;
  console.log('[CORE TICK]', {
    gold: state.resources.gold.toFixed(2),
    level: state.level,
    monsterHp: combatState ? `${combatState.monsterHp.toFixed(1)}/${combatState.monsterMaxHp}` : 'N/A',
    defeated: combatState ? combatState.monstersDefeated : 0,
    dps: combatState ? combatState.playerDps : 0,
  });
});

console.log('--- Starting Engine with Adaptive Module ---');
engine.start();

// Let's wait a couple of seconds to defeat some monsters, then upgrade DPS
setTimeout(() => {
  console.log('\n--- Upgrading Player DPS (Cost: 15 Gold) ---');
  engine.dispatch({
    type: 'PLUGIN_ACTION',
    payload: {
      pluginId: 'adaptive',
      action: { type: 'UPGRADE_DPS', payload: { cost: 15 } },
    },
  });
}, 2600);

setTimeout(() => {
  console.log('\n--- Stopping Engine ---');
  engine.stop();
  process.exit(0);
}, 5000);
