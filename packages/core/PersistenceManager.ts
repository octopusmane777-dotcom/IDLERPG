import { GameState, GameSave } from './BaseTypes';

export interface StorageProvider {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

export interface PersistenceManagerConfig {
  storage: StorageProvider;
  saveKey?: string;
}

const CURRENT_SAVE_VERSION = 1;

/** Migration functions keyed by the version they upgrade FROM */
const MIGRATIONS: Record<number, (data: any) => any> = {
  // Version 0 (unversioned) -> Version 1: wrap raw state into GameSave format
  0: (raw: any) => ({
    userId: 'player',
    state: raw as GameState,
    updatedAt: Date.now(),
    saveVersion: 1,
  }),
};

export class PersistenceManager {
  private storage: StorageProvider;
  private saveKey: string;

  constructor(config: PersistenceManagerConfig) {
    this.storage = config.storage;
    this.saveKey = config.saveKey || 'idlerpg_save_data';
  }

  async save(save: GameSave): Promise<void> {
    try {
      const payload = {
        saveVersion: CURRENT_SAVE_VERSION,
        state: save.state,
        userId: save.userId,
        updatedAt: save.updatedAt,
      };
      const serialized = JSON.stringify(payload);
      await this.storage.setItem(this.saveKey, serialized);
    } catch (error) {
      console.error('[PersistenceManager] Failed to save state:', error);
    }
  }

  async load(): Promise<GameSave | null> {
    try {
      const data = await this.storage.getItem(this.saveKey);
      if (!data) return null;

      const parsed = JSON.parse(data);

      // Detect unversioned saves (raw GameState without wrapper)
      if (parsed.saveVersion === undefined) {
        // Run migration from version 0 (unversioned) through current
        return this.runMigrations(parsed, 0);
      }

      if (typeof parsed.saveVersion === 'number') {
        const version = parsed.saveVersion;
        if (version < CURRENT_SAVE_VERSION) {
          return this.runMigrations(parsed, version);
        }
        // Already current version
        return parsed as GameSave;
      }

      return null;
    } catch (error) {
      console.error('[PersistenceManager] Failed to load state:', error);
      return null;
    }
  }

  private runMigrations(data: any, fromVersion: number): GameSave {
    let migrated = data;
    let currentVersion = fromVersion;

    while (currentVersion < CURRENT_SAVE_VERSION) {
      const migrator = MIGRATIONS[currentVersion];
      if (migrator) {
        migrated = migrator(migrated);
        currentVersion++;
      } else {
        // No migrator for this version step — skip to next
        currentVersion++;
      }
    }

    // If the result is still unversioned/raw state, wrap it
    if (!migrated.saveVersion) {
      migrated = {
        userId: 'player',
        state: migrated,
        updatedAt: Date.now(),
        saveVersion: CURRENT_SAVE_VERSION,
      };
    }

    return migrated as GameSave;
  }
}