import { GameEngine } from './packages/core';

const engine = new GameEngine();

// Subscribe to state changes
engine.subscribe((state) => {
  console.log('State updated:', state);
});

// Perform actions
console.log('Initial state:', engine.getState());

engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 10 } });
engine.dispatch({ type: 'LEVEL_UP' });

console.log('Final state:', engine.getState());
