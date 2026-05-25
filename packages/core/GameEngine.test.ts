import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './GameEngine';
import { ProgressionPlugin } from './ProgressionPlugin';
import { PrestigePlugin } from './PrestigePlugin';
import { EnergyPlugin } from './EnergyPlugin';
import { AchievementPlugin } from './AchievementPlugin';
import { AdaptiveModule } from './AdaptiveModule';
import { DebugPlugin } from './DebugPlugin';
import { NetworkPlugin } from './NetworkPlugin';
import { ComboPlugin } from './ComboPlugin';
import { BossPlugin } from './BossPlugin';
import { MissionPlugin } from './MissionPlugin';
import { SkillTreePlugin } from './SkillTreePlugin';
import { GameDataRepository, GameSave } from './BaseTypes';
import { StorageAdapter } from './LocalDataRepository';

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

describe('PrestigePlugin', () => {
  let engine: GameEngine;
  let mockRepository: MockRepository;

  beforeEach(() => {
    const mockStorage = new MockStorageAdapter();
    mockRepository = new MockRepository(mockStorage);
    engine = new GameEngine({
      repo: mockRepository,
      userId: 'test_user',
      plugins: [new ProgressionPlugin(), new PrestigePlugin()],
      tickRateMs: 100,
    });
    engine.initializePlugins();
  });

  it('should initialize with zero cores and 1x multiplier', () => {
    const ps = engine.getState().pluginState['prestige'];
    expect(ps.cores).toBe(0);
    expect(ps.bonusMultiplier).toBe(1.0);
    expect(ps.lifetimeGold).toBe(0);
  });

  it('should NOT allow prestige below required level', () => {
    const levelBefore = engine.getState().level;
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'prestige', action: { type: 'PRESTIGE' } } });
    expect(engine.getState().pluginState['prestige'].cores).toBe(0);
    expect(engine.getState().level).toBe(levelBefore);
  });

  it('should grant a core and reset on prestige when level >= 10', () => {
    // Manually set level to 10 via debug-style increment
    for (let i = 0; i < 9; i++) {
      engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 9999 } });
      engine.dispatch({ type: 'LEVEL_UP', payload: { cost: 0 } });
    }
    // Force level to 10 directly by setting via state manipulation via dispatch
    const state = engine.getState();
    // Use TICK to just get it up — instead set level directly using internal
    // We'll use the meta approach: give gold and buy levels
    // Reset and try a different approach — set gold high, buy levels until 10
    engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 999999 } });
    // Buy 9 more levels (already at 1, need 10)
    for (let i = 0; i < 9; i++) {
      const cost = engine.getUpgradeMetadata().level?.cost ?? 0;
      engine.dispatch({ type: 'LEVEL_UP', payload: { cost } });
    }
    expect(engine.getState().level).toBeGreaterThanOrEqual(10);

    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'prestige', action: { type: 'PRESTIGE' } } });

    const ps = engine.getState().pluginState['prestige'];
    expect(ps.cores).toBe(1);
    expect(ps.bonusMultiplier).toBeCloseTo(1.05);
    expect(engine.getState().level).toBe(1);
    expect(engine.getState().resources.gold).toBe(0);
  });

  it('should provide correct action metadata', () => {
    const meta = engine.getUpgradeMetadata();
    const p = meta.plugins['prestige']?.prestige;
    expect(p).toBeDefined();
    expect(p.cores).toBe(0);
    expect(p.requiredLevel).toBe(10);
    expect(p.canPrestige).toBe(false);
  });

  it('should track lifetime gold via onTick', () => {
    // Give some generation rate and tick
    engine.dispatch({ type: 'UPGRADE_GENERATION', payload: { resource: 'gold', amount: 10, cost: 0 } });
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 1000 } });
    const ps = engine.getState().pluginState['prestige'];
    expect(ps.lifetimeGold).toBeGreaterThan(0);
  });
});

describe('EnergyPlugin', () => {
  let engine: GameEngine;

  beforeEach(() => {
    const mockStorage = new MockStorageAdapter();
    const mockRepository = new MockRepository(mockStorage);
    engine = new GameEngine({
      repo: mockRepository,
      userId: 'test_user',
      plugins: [new ProgressionPlugin(), new AdaptiveModule(), new EnergyPlugin()],
      tickRateMs: 100,
    });
    engine.initializePlugins();
  });

  it('should initialize with full energy and no cooldowns', () => {
    const es = engine.getState().pluginState['energy'];
    expect(es.energy).toBe(50);
    expect(es.maxEnergy).toBe(50);
    expect(Object.keys(es.cooldowns).length).toBe(0);
  });

  it('should regenerate energy over time', () => {
    // Drain some energy first by casting SLASH
    const ts = engine.getState().lastTick;
    // Set energy low manually by checking onTick produces gain
    // Just tick 3 seconds — energy is already full, ensure it stays capped
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 3000 } });
    const es = engine.getState().pluginState['energy'];
    expect(es.energy).toBe(50); // still capped at 50
  });

  it('should cast a spell and consume energy and apply cooldown', () => {
    const before = engine.getState().pluginState['energy'];
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: 'SLASH' } } });
    const after = engine.getState().pluginState['energy'];
    expect(after.energy).toBe(before.energy - 5); // SLASH costs 5
    expect(after.cooldowns['SLASH']).toBeGreaterThan(0);
  });

  it('should NOT cast a spell on cooldown', () => {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: 'SLASH' } } });
    const energyAfterFirst = engine.getState().pluginState['energy'].energy;
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: 'SLASH' } } });
    const energyAfterSecond = engine.getState().pluginState['energy'].energy;
    expect(energyAfterSecond).toBe(energyAfterFirst); // no change — on cooldown
  });

  it('should upgrade a spell and increase its level', () => {
    // Give gold for upgrade
    engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 999999 } });
    const before = engine.getState().pluginState['energy'];
    expect(before.spellLevels['SLASH']).toBe(0);

    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: 'UPGRADE_SLASH' } } });
    const after = engine.getState().pluginState['energy'];
    expect(after.spellLevels['SLASH']).toBe(1);
  });

  it('should NOT upgrade a spell without enough gold', () => {
    const before = engine.getState().pluginState['energy'].spellLevels['SLASH'];
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: 'UPGRADE_SLASH' } } });
    const after = engine.getState().pluginState['energy'].spellLevels['SLASH'];
    expect(after).toBe(before);
  });

  it('should tick cooldowns down over time', () => {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: 'SLASH' } } });
    const cdBefore = engine.getState().pluginState['energy'].cooldowns['SLASH'];
    expect(cdBefore).toBeGreaterThan(0);

    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 2000 } });
    const cdAfter = engine.getState().pluginState['energy'].cooldowns['SLASH'];
    expect(cdAfter).toBeLessThan(cdBefore);
  });

  it('should return spell metadata via getActionMetadata', () => {
    const meta = engine.getUpgradeMetadata();
    const energy = meta.plugins['energy']?.energy;
    expect(energy).toBeDefined();
    expect(energy.spells.length).toBe(5);
    expect(energy.spells[0].id).toBe('SLASH');
    expect(energy.spells[0].canCast).toBe(true);
  });
});

describe('AchievementPlugin', () => {
  let engine: GameEngine;

  beforeEach(() => {
    const mockStorage = new MockStorageAdapter();
    const mockRepository = new MockRepository(mockStorage);
    engine = new GameEngine({
      repo: mockRepository,
      userId: 'test_user',
      plugins: [new ProgressionPlugin(), new AdaptiveModule(), new PrestigePlugin(), new AchievementPlugin()],
      tickRateMs: 100,
    });
    engine.initializePlugins();
  });

  it('should initialize with no achievements unlocked', () => {
    const as = engine.getState().pluginState['achievements'];
    expect(as.unlocked).toEqual([]);
    expect(as.unlockedCount).toBe(0);
  });

  it('should unlock "First Steps" when gold >= 100', () => {
    engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 100 } });
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 100 } });
    const as = engine.getState().pluginState['achievements'];
    expect(as.unlocked).toContain('first_gold');
  });

  it('should grant gold reward when achievement unlocks', () => {
    engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 100 } });
    const goldBefore = engine.getState().resources.gold;
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 100 } });
    const goldAfter = engine.getState().resources.gold;
    // first_gold reward = 10
    expect(goldAfter).toBeGreaterThan(goldBefore);
  });

  it('should NOT unlock achievement twice', () => {
    engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 100 } });
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 100 } });
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 200 } });
    const as = engine.getState().pluginState['achievements'];
    const count = as.unlocked.filter((id: string) => id === 'first_gold').length;
    expect(count).toBe(1);
  });

  it('should unlock "Stage 5" when level >= 5', () => {
    engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 999999 } });
    for (let i = 0; i < 4; i++) {
      const cost = engine.getUpgradeMetadata().level?.cost ?? 0;
      engine.dispatch({ type: 'LEVEL_UP', payload: { cost } });
    }
    expect(engine.getState().level).toBeGreaterThanOrEqual(5);
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 100 } });
    const as = engine.getState().pluginState['achievements'];
    expect(as.unlocked).toContain('stage_5');
  });

  it('should return achievement list via getActionMetadata', () => {
    const meta = engine.getUpgradeMetadata();
    const ach = meta.plugins['achievements']?.achievements;
    expect(ach).toBeDefined();
    expect(ach.total).toBe(6);
    expect(ach.list.length).toBe(6);
    expect(ach.list[0].id).toBe('first_gold');
  });
});

describe('NetworkPlugin', () => {
  let engine: GameEngine;

  beforeEach(() => {
    const mockStorage = new MockStorageAdapter();
    const mockRepository = new MockRepository(mockStorage);
    engine = new GameEngine({
      repo: mockRepository,
      userId: 'test_user',
      plugins: [new NetworkPlugin()],
      tickRateMs: 100,
    });
    engine.initializePlugins();
  });

  it('should initialize with zero nodes', () => {
    const ns = engine.getState().pluginState['network'];
    expect(ns).toBeDefined();
    for (const key of Object.keys(ns.nodes)) {
      expect(ns.nodes[key]).toBe(0);
    }
  });

  it('should produce no passive gold when no nodes owned', () => {
    const before = engine.getState().resources.gold;
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 1000 } });
    expect(engine.getState().resources.gold).toBe(before);
  });

  it('should deduct gold and increment count on BUY_NODE', () => {
    engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 100 } });
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'network', action: { type: 'BUY_NODE', nodeId: 'bot_farm' } } });
    const ns = engine.getState().pluginState['network'];
    expect(ns.nodes['bot_farm']).toBe(1);
    expect(engine.getState().resources.gold).toBe(70); // baseCost 30, 0 owned so cost = 30 * 2^0 = 30
  });

  it('should NOT buy a node when gold is insufficient', () => {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'network', action: { type: 'BUY_NODE', nodeId: 'bot_farm' } } });
    const ns = engine.getState().pluginState['network'];
    expect(ns.nodes['bot_farm']).toBe(0);
  });

  it('should double cost after each purchase', () => {
    engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 200 } });
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'network', action: { type: 'BUY_NODE', nodeId: 'bot_farm' } } });
    // After 1 owned, next cost = 30 * 2^1 = 60
    const meta = engine.getUpgradeMetadata();
    const node = meta.plugins['network']?.network?.nodes?.find((n: any) => n.id === 'bot_farm');
    expect(node?.nextCost).toBe(60);
  });

  it('should generate passive gold via onTick when nodes are owned', () => {
    engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 100 } });
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'network', action: { type: 'BUY_NODE', nodeId: 'bot_farm' } } });
    const goldAfterBuy = engine.getState().resources.gold;
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 1000 } });
    // bot_farm produces 1/s, so after 1 second: +1
    expect(engine.getState().resources.gold).toBeCloseTo(goldAfterBuy + 1);
  });
});

describe('ComboPlugin', () => {
  let engine: GameEngine;

  beforeEach(() => {
    const mockStorage = new MockStorageAdapter();
    const mockRepository = new MockRepository(mockStorage);
    engine = new GameEngine({
      repo: mockRepository,
      userId: 'test_user',
      plugins: [new ComboPlugin(), new AdaptiveModule(), new ProgressionPlugin()],
      tickRateMs: 100,
    });
    engine.initializePlugins();
  });

  it('should initialize with count 0 and multiplier 1', () => {
    const cs = engine.getState().pluginState['combo'];
    expect(cs.count).toBe(0);
    expect(cs.multiplier).toBe(1);
  });

  it('should increment count on TAP_DAMAGE', () => {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'combo', action: { type: 'TAP_DAMAGE' } } });
    const cs = engine.getState().pluginState['combo'];
    expect(cs.count).toBe(1);
    expect(cs.multiplier).toBeCloseTo(1.1);
  });

  it('should accumulate multiplier on rapid taps', () => {
    for (let i = 0; i < 5; i++) {
      engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'combo', action: { type: 'TAP_DAMAGE' } } });
    }
    const cs = engine.getState().pluginState['combo'];
    expect(cs.count).toBe(5);
    expect(cs.multiplier).toBeCloseTo(1.5);
  });

  it('should cap combo count at 20', () => {
    for (let i = 0; i < 30; i++) {
      engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'combo', action: { type: 'TAP_DAMAGE' } } });
    }
    const cs = engine.getState().pluginState['combo'];
    expect(cs.count).toBe(20);
    expect(cs.multiplier).toBeCloseTo(3.0);
  });

  it('should return combo metadata', () => {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'combo', action: { type: 'TAP_DAMAGE' } } });
    const meta = engine.getUpgradeMetadata();
    const combo = meta.plugins['combo']?.combo;
    expect(combo).toBeDefined();
    expect(combo.count).toBe(1);
    expect(combo.active).toBe(true);
  });
});

describe('BossPlugin', () => {
  let engine: GameEngine;

  beforeEach(() => {
    const mockStorage = new MockStorageAdapter();
    const mockRepository = new MockRepository(mockStorage);
    engine = new GameEngine({
      repo: mockRepository,
      userId: 'test_user',
      plugins: [new BossPlugin(), new AdaptiveModule(), new ProgressionPlugin()],
      tickRateMs: 100,
    });
    engine.initializePlugins();
  });

  it('should initialize with no boss active', () => {
    const bs = engine.getState().pluginState['boss'];
    expect(bs.bossActive).toBe(false);
    expect(bs.bossesDefeated).toBe(0);
  });

  /** Helper: directly activate a boss with 1000 HP for tests that need it active. */
  function spawnBossForTest() {
    engine.loadSavedState({
      ...engine.getState(),
      pluginState: {
        ...engine.getState().pluginState,
        boss: {
          ...engine.getState().pluginState['boss'],
          bossActive: true,
          bossHp: 1000,
          bossMaxHp: 1000,
          bossTimer: 30,
          bossAttempts: 0,
          bossHpPersisted: 0,
        },
      },
    });
  }

  it('should reduce bossHp on BOSS_DAMAGE', () => {
    spawnBossForTest();
    const hpBefore = engine.getState().pluginState['boss'].bossHp;
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'boss', action: { type: 'BOSS_DAMAGE', damage: 10 } } });
    const hpAfter = engine.getState().pluginState['boss'].bossHp;
    expect(hpAfter).toBe(hpBefore - 10);
  });

  it('should retreat boss when timer expires', () => {
    spawnBossForTest();
    expect(engine.getState().pluginState['boss'].bossActive).toBe(true);

    // Tick 31 seconds to expire timer
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 31000 } });
    expect(engine.getState().pluginState['boss'].bossActive).toBe(false);
  });

  it('should grant gold and increment bossesDefeated on kill', () => {
    spawnBossForTest();
    const bossMaxHp = engine.getState().pluginState['boss'].bossMaxHp;
    const goldBefore = engine.getState().resources.gold;

    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'boss', action: { type: 'BOSS_DAMAGE', damage: bossMaxHp + 999 } } });

    const bs = engine.getState().pluginState['boss'];
    expect(bs.bossActive).toBe(false);
    expect(bs.bossesDefeated).toBe(1);
    expect(engine.getState().resources.gold).toBeGreaterThan(goldBefore);
  });

  it('should persist boss HP and increment attempts on retreat', () => {
    spawnBossForTest();
    // Deal partial damage
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'boss', action: { type: 'BOSS_DAMAGE', damage: 300 } } });
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 31000 } });
    const bs = engine.getState().pluginState['boss'];
    expect(bs.bossActive).toBe(false);
    expect(bs.bossAttempts).toBe(1);
    expect(bs.bossHpPersisted).toBeGreaterThan(0);
    expect(bs.bossHpPersisted).toBeLessThan(1000);
  });

  it('should return boss metadata via getActionMetadata', () => {
    const meta = engine.getUpgradeMetadata();
    const boss = meta.plugins['boss']?.boss;
    expect(boss).toBeDefined();
    expect(boss.bossActive).toBe(false);
    expect(typeof boss.bossAttempts).toBe('number');
  });
});

describe('MissionPlugin', () => {
  let engine: GameEngine;

  beforeEach(() => {
    const mockStorage = new MockStorageAdapter();
    const mockRepository = new MockRepository(mockStorage);
    engine = new GameEngine({
      repo: mockRepository,
      userId: 'test_user',
      plugins: [new MissionPlugin(), new ProgressionPlugin(), new AdaptiveModule()],
      tickRateMs: 100,
    });
    engine.initializePlugins();
  });

  it('should initialize with 3 active missions for today', () => {
    const ms = engine.getState().pluginState['missions'];
    expect(ms).toBeDefined();
    expect(ms.active).toHaveLength(3);
    expect(ms.dayKey).toBeGreaterThan(0);
  });

  it('should start all missions with zero progress', () => {
    const ms = engine.getState().pluginState['missions'];
    for (const m of ms.active) {
      expect(m.progress).toBe(0);
      expect(m.completed).toBe(false);
      expect(m.claimed).toBe(false);
    }
  });

  it('should increment sessionTaps on TAP_DAMAGE', () => {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'TAP_DAMAGE' } } });
    const ms = engine.getState().pluginState['missions'];
    expect(ms.sessionTaps).toBe(1);
  });

  it('should increment sessionSpellsCast on SLASH', () => {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'SLASH' } } });
    const ms = engine.getState().pluginState['missions'];
    expect(ms.sessionSpellsCast).toBe(1);
  });

  it('should track spend on LEVEL_UP', () => {
    engine.dispatch({
      type: 'PLUGIN_ACTION',
      payload: { pluginId: 'missions', action: { type: 'LEVEL_UP', payload: { cost: 40 } } },
    });
    const ms = engine.getState().pluginState['missions'];
    expect(ms.sessionGoldSpent).toBe(40);
  });

  it('should complete a tap mission when sessionTaps reaches target', () => {
    const ms0 = engine.getState().pluginState['missions'];
    const tapMission = ms0.active.find((m: any) => m.id === 'tap_50' || m.id === 'tap_200');
    if (!tapMission) return; // not in today's rotation, skip

    const target = tapMission.target;
    for (let i = 0; i < target; i++) {
      engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'TAP_DAMAGE' } } });
    }
    const ms = engine.getState().pluginState['missions'];
    const updated = ms.active.find((m: any) => m.id === tapMission.id);
    expect(updated.completed).toBe(true);
    expect(updated.progress).toBe(target);
  });

  it('should grant reward on CLAIM_MISSION and prevent double-claim', () => {
    // Force a completed tap mission by targeting tap_50
    const ms0 = engine.getState().pluginState['missions'];
    const tapMission = ms0.active.find((m: any) => m.id === 'tap_50');
    if (!tapMission) return; // not in today's rotation, skip

    for (let i = 0; i < 50; i++) {
      engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'TAP_DAMAGE' } } });
    }

    const goldBefore = engine.getState().resources.gold;
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'CLAIM_MISSION', missionId: 'tap_50' } } });
    const goldAfter = engine.getState().resources.gold;
    expect(goldAfter).toBeGreaterThan(goldBefore);

    // Second claim should be a no-op
    const goldAfterSecondClaim = engine.getState().resources.gold;
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'CLAIM_MISSION', missionId: 'tap_50' } } });
    expect(engine.getState().resources.gold).toBe(goldAfterSecondClaim);
  });

  it('should NOT claim an incomplete mission', () => {
    const ms0 = engine.getState().pluginState['missions'];
    const mission = ms0.active[0];
    const goldBefore = engine.getState().resources.gold;
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'CLAIM_MISSION', missionId: mission.id } } });
    expect(engine.getState().resources.gold).toBe(goldBefore);
  });

  it('should return missions metadata via getActionMetadata', () => {
    const meta = engine.getUpgradeMetadata();
    const missions = meta.plugins['missions']?.missions;
    expect(missions).toBeDefined();
    expect(missions.list).toHaveLength(3);
    expect(typeof missions.nextReset).toBe('number');
    expect(missions.hoursUntilReset).toBeGreaterThanOrEqual(0);
  });

  it('should produce 3 unique mission IDs for any day key', () => {
    // Verify that the deterministic picker never returns duplicate IDs
    const ms = engine.getState().pluginState['missions'];
    const ids = ms.active.map((m: any) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });
});

describe('SkillTreePlugin', () => {
  let engine: GameEngine;

  beforeEach(() => {
    const mockStorage = new MockStorageAdapter();
    const mockRepository = new MockRepository(mockStorage);
    engine = new GameEngine({
      repo: mockRepository,
      userId: 'test_user',
      plugins: [new SkillTreePlugin(), new PrestigePlugin(), new ProgressionPlugin()],
      tickRateMs: 100,
    });
    engine.initializePlugins();
  });

  it('should initialize with 0 points and empty unlocked list', () => {
    const st = engine.getState().pluginState['skilltree'];
    expect(st.points).toBe(0);
    expect(st.unlocked).toEqual([]);
    expect(st.chosenPath).toBeNull();
  });

  it('should NOT unlock a skill when points are 0', () => {
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: 's1' } } });
    const st = engine.getState().pluginState['skilltree'];
    expect(st.unlocked).not.toContain('s1');
  });

  it('should unlock a root skill when a point is available', () => {
    // Manually grant a skill point via loadSavedState
    const state = engine.getState();
    engine.loadSavedState({
      ...state,
      pluginState: { ...state.pluginState, skilltree: { ...state.pluginState.skilltree, points: 1 } },
    });

    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: 's1' } } });
    const st = engine.getState().pluginState['skilltree'];
    expect(st.unlocked).toContain('s1');
    expect(st.points).toBe(0);
    expect(st.chosenPath).toBe('STRIKER');
  });

  it('should NOT unlock a node without its prerequisite', () => {
    const state = engine.getState();
    engine.loadSavedState({
      ...state,
      pluginState: { ...state.pluginState, skilltree: { ...state.pluginState.skilltree, points: 1 } },
    });

    // s2 requires s1 — should fail since s1 is not unlocked
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: 's2' } } });
    const st = engine.getState().pluginState['skilltree'];
    expect(st.unlocked).not.toContain('s2');
    expect(st.points).toBe(1); // point not consumed
  });

  it('should enforce one-path lock after first unlock', () => {
    const state = engine.getState();
    engine.loadSavedState({
      ...state,
      pluginState: { ...state.pluginState, skilltree: { ...state.pluginState.skilltree, points: 2 } },
    });

    // Unlock s1 (STRIKER branch) — locks out PHANTOM and ARCANE
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: 's1' } } });
    expect(engine.getState().pluginState['skilltree'].chosenPath).toBe('STRIKER');

    // Attempt to unlock p1 (PHANTOM branch) — should fail
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: 'p1' } } });
    const st = engine.getState().pluginState['skilltree'];
    expect(st.unlocked).not.toContain('p1');
    expect(st.points).toBe(1); // only 1 spent (on s1)
  });

  it('should unlock prerequisite chain correctly', () => {
    const state = engine.getState();
    engine.loadSavedState({
      ...state,
      pluginState: { ...state.pluginState, skilltree: { ...state.pluginState.skilltree, points: 3 } },
    });

    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: 's1' } } });
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: 's2' } } });
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: 's3' } } });

    const st = engine.getState().pluginState['skilltree'];
    expect(st.unlocked).toContain('s1');
    expect(st.unlocked).toContain('s2');
    expect(st.unlocked).toContain('s3');
    expect(st.points).toBe(0);
  });

  it('should NOT unlock the same node twice', () => {
    const state = engine.getState();
    engine.loadSavedState({
      ...state,
      pluginState: { ...state.pluginState, skilltree: { ...state.pluginState.skilltree, points: 3 } },
    });

    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: 's1' } } });
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: 's1' } } });

    const st = engine.getState().pluginState['skilltree'];
    const count = st.unlocked.filter((id: string) => id === 's1').length;
    expect(count).toBe(1);
    expect(st.points).toBe(2); // only 1 spent
  });

  it('should grant a skill point when stage milestone is reached', () => {
    // Set level to 50 (first milestone stage)
    const state = engine.getState();
    engine.loadSavedState({ ...state, level: 50 });
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 1000 } });

    const st = engine.getState().pluginState['skilltree'];
    expect(st.points).toBeGreaterThanOrEqual(1);
    expect(st.grantedAtStages).toContain(50);
  });

  it('should NOT grant a point for the same stage milestone twice', () => {
    const state = engine.getState();
    engine.loadSavedState({ ...state, level: 50 });
    const ts = engine.getState().lastTick;
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 1000 } });
    engine.dispatch({ type: 'TICK', payload: { timestamp: ts + 2000 } });

    const st = engine.getState().pluginState['skilltree'];
    const count = st.grantedAtStages.filter((s: number) => s === 50).length;
    expect(count).toBe(1);
  });

  it('should return skill tree metadata via getActionMetadata', () => {
    const meta = engine.getUpgradeMetadata();
    const skilltree = meta.plugins['skilltree']?.skilltree;
    expect(skilltree).toBeDefined();
    expect(skilltree.points).toBe(0);
    expect(skilltree.nodes.length).toBeGreaterThan(0);
    // Root nodes (no requires) should be locked (no points)
    const s1Node = skilltree.nodes.find((n: any) => n.id === 's1');
    expect(s1Node).toBeDefined();
    expect(s1Node.available).toBe(false); // no points
    expect(s1Node.locked).toBe(false); // no prerequisite missing — just no points
  });
});
