import { GameDataRepository, GameSave } from './BaseTypes';

/**
 * CompositeRepository - Combines local + cloud persistence with failover.
 *
 * Save: writes to all repositories (best-effort, failures are logged not thrown).
 * Load: tries repositories in order, returns the first successful result.
 *       If a later repository has a newer save, it upgrades the earlier ones.
 *
 * Usage:
 *   const localRepo = new LocalDataRepository(storageAdapter);
 *   const firebaseRepo = new FirebaseDataRepository({ firestore: db });
 *   const repo = new CompositeRepository([localRepo, firebaseRepo]);
 *   const engine = new GameEngine({ repo, ... });
 */

export class CompositeRepository implements GameDataRepository {
  private repos: GameDataRepository[];

  constructor(repos: GameDataRepository[]) {
    this.repos = repos;
  }

  async saveGame(save: GameSave): Promise<void> {
    // Fire-and-forget to all repos; primary (local) is first, cloud is best-effort
    const results = await Promise.allSettled(
      this.repos.map(repo => repo.saveGame(save))
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(
          `[CompositeRepository] saveGame failed for repo #${index}:`,
          result.reason
        );
      }
    });
  }

  async loadGame(userId: string): Promise<GameSave | null> {
    let bestSave: GameSave | null = null;
    let bestUpdatedAt = 0;

    for (const repo of this.repos) {
      try {
        const save = await repo.loadGame(userId);
        if (save && (!bestSave || (save.updatedAt > bestUpdatedAt))) {
          bestSave = save;
          bestUpdatedAt = save.updatedAt;
        }
      } catch (err) {
        console.warn('[CompositeRepository] loadGame failed for a repo:', err);
      }
    }

    // If we found a save and it came from a later repo, backfill earlier repos
    if (bestSave && bestUpdatedAt > 0) {
      for (const repo of this.repos) {
        try {
          // Non-blocking backfill
          repo.saveGame(bestSave).catch(() => {});
        } catch {
          // ignore backfill errors
        }
      }
    }

    return bestSave;
  }
}