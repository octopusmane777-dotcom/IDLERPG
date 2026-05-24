import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './GameEngine';
import { ProgressionPlugin } from './ProgressionPlugin';
import { PrestigePlugin } from './PrestigePlugin';
import { EnergyPlugin } from './EnergyPlugin';
import { AchievementPlugin } from './AchievementPlugin';
import { DebugPlugin } from './DebugPlugin';
import { StorageAdapter, GameDataRepository, GameSave } from './BaseTypes';

// Mock StorageAdapter for testing
class MockStorageAdapter implements StorageAdapter {
  private store: { [key: string]: string } = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
}

// Mock Repository for testing
class MockRepository implements GameDataRepository {
  private storage: MockStorageAdapter;
  constructor(storage: MockStorageAdapter) {
    this.storage = storage;
  }

  async saveGame(save: GameSave): Promise<void> {
    this.storage.setItem(save.userId, JSON.stringify(save));
  }

  async loadGame(userId: string): Promise<GameSave | null> {
    const data = this.storage.getItem(userId);
    return data ? JSON.parse(data) : null;
  }
}

describe('GameEngine Core Logic', () => {
  let engine: GameEngine;
  let mockStorage: MockStorageAdapter;
  let mockRepository: MockRepository;

  beforeEach(() => {
    mockStorage = new MockStorageAdapter();
    mockRepository = new MockRepository(mockStorage);
    engine = new GameEngine({
      repo: mockRepository,
      userId: 'test_user',
      plugins: [new ProgressionPlugin()],
      tickRateMs: 100, // Faster tick for testing
    });
  });

  describe('dispatch()', () => {
    it('should increment resources manually', () => {
      engine.dispatch({
        type: 'INCREMENT_RESOURCE',
        payload: { resource: 'gold', amount: 10 }
      });
      expect(engine.getState().resources.gold).toBe(10);
    });

    it('should handle level up with cost validation', () => {
      // Set initial gold
      engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 100 } });
      const initialLevel = engine.getState().level;
      const cost = engine.getUpgradeMetadata().level.cost;

      engine.dispatch({ type: 'LEVEL_UP', payload: { cost } });

      expect(engine.getState().level).toBe(initialLevel + 1);
      expect(engine.getState().resources.gold).toBe(100 - cost);
    });

    it('should NOT level up if gold is insufficient', () => {
      const initialLevel = engine.getState().level;
      engine.dispatch({ type: 'LEVEL_UP', payload: { cost: 1000 } });

      expect(engine.getState().level).toBe(initialLevel);
    });

    it('should upgrade generation with cost validation', () => {
      engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 50 } });
      const initialGenerationRate = engine.getState().generationRates.gold;
      const cost = engine.getUpgradeMetadata().generation.cost;

      engine.dispatch({ type: 'UPGRADE_GENERATION', payload: { resource: 'gold', amount: 1, cost } });

      expect(engine.getState().generationRates.gold).toBe(initialGenerationRate + 1);
      expect(engine.getState().resources.gold).toBe(50 - cost);
    });
  });

  describe('onTick()', () => {
    it('should generate resources over time', () => {
      const initialGold = engine.getState().resources.gold;
      const rate = engine.getState().generationRates.gold;
      const initialLastTick = engine.getState().lastTick;

      // Manually trigger a tick for 1 second of elapsed time
      engine.dispatch({ type: 'TICK', payload: { timestamp: initialLastTick + 1000 } });

      const expectedGold = initialGold + rate * 1; // rate * deltaSec (1.0)
      expect(engine.getState().resources.gold).toBeCloseTo(expectedGold);
      expect(engine.getState().lastTick).toBe(initialLastTick + 1000);
    });
  });
});
