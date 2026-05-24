import { GameDataRepository, GameSave } from './BaseTypes';

// A generic storage engine that works in node, browser (localStorage), and mobile (AsyncStorage wrapper)
export interface StorageAdapter {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

export class LocalDataRepository implements GameDataRepository {
  private storage: StorageAdapter;
  private savePrefix = 'idlerpg_user_';

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async saveGame(save: GameSave): Promise<void> {
    const key = `${this.savePrefix}${save.userId}`;
    const serialized = JSON.stringify(save);
    await this.storage.setItem(key, serialized);
    console.log(`[LocalDataRepository] Game progress saved for user: ${save.userId}`);
  }

  async loadGame(userId: string): Promise<GameSave | null> {
    const key = `${this.savePrefix}${userId}`;
    const data = await this.storage.getItem(key);
    if (!data) {
      console.log(`[LocalDataRepository] No save data found for user: ${userId}`);
      return null;
    }
    console.log(`[LocalDataRepository] Progress loaded for user: ${userId}`);
    return JSON.parse(data) as GameSave;
  }
}
