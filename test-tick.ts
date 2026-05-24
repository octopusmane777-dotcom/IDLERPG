import { GameEngine } from './packages/core';

const engine = new GameEngine();

engine.subscribe((state) => {
  console.log('[TICK UPDATE] State:', {
    gold: state.resources.gold.toFixed(2),
    gps: state.generationRates.gold,
  });
});

console.log('--- Starting Engine Loop ---');
engine.start();

// Simulating some manual clicks & upgrades over 3 seconds
setTimeout(() => {
  console.log('\n--- Manually clicking to mine +10 Gold ---');
  engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 10 } });
}, 1100);

setTimeout(() => {
  console.log('\n--- Upgrading Gold Generation (+2 gps, cost 10) ---');
  engine.dispatch({ type: 'UPGRADE_GENERATION', payload: { resource: 'gold', amount: 2, cost: 10 } });
}, 2200);

// Stop engine and exit test after 4 seconds
setTimeout(() => {
  console.log('\n--- Stopping Engine ---');
  engine.stop();
  process.exit(0);
}, 4100);
