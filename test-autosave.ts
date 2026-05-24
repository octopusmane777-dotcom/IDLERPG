import { GameEngine, GameDataRepository, GameSave } from "@idlerpg/core";

// 1. Create a mock repository to test auto-save
class MockRepository implements GameDataRepository {
  private mockDb: Record<string, GameSave> = {};
  async saveGame(save: GameSave) {
    this.mockDb[save.userId] = save;
    console.log(
      `[TEST] Auto-saving to DB... Gold: ${save.state.resources.gold.toFixed(2)}`,
    );
  }
  async loadGame(userId: string) {
    return this.mockDb[userId] || null;
  }
}

// 2. Initialize Engine with auto-save
const repo = new MockRepository();
const engine = new GameEngine({
  repo: repo,
  userId: "test_user",
});

engine.subscribe((state) => {
  console.log("[TEST ENGINE STATE]", { gold: state.resources.gold.toFixed(2) });
});

console.log("--- Testing Auto-Save ---");
engine.start();

// Dispatch an action to trigger notify() -> auto-save
setTimeout(() => {
  console.log("\n--- Triggering Action to Save ---");
  engine.dispatch({
    type: "INCREMENT_RESOURCE",
    payload: { resource: "gold", amount: 5 },
  });
}, 500);

setTimeout(() => {
  console.log("\n--- Triggering another Action to Save ---");
  engine.dispatch({
    type: "INCREMENT_RESOURCE",
    payload: { resource: "gold", amount: 10 },
  });
}, 1000);

setTimeout(() => {
  engine.stop();
  process.exit(0);
}, 1500);
