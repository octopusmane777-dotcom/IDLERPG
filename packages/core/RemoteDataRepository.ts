import { GameDataRepository, GameSave } from './BaseTypes';

/**
 * RemoteDataRepository - optional adapter for syncing game saves to a remote server.
 *
 * This adapter implements the same `GameDataRepository` interface as `LocalDataRepository`,
 * allowing the engine to save/load via HTTP, WebSocket, or any remote backend without
 * changing engine code.
 *
 * Usage:
 *   const remoteRepo = new RemoteDataRepository({ endpoint: 'https://api.example.com/save' });
 *   const engine = new GameEngine({ repo: remoteRepo, ... });
 *
 * You may also combine local + remote by wrapping both in a composite repository.
 */
export interface RemoteRepositoryConfig {
  /** Base URL for the save/load API endpoint */
  endpoint: string;
  /** Optional auth token / session ID */
  authToken?: string;
  /** Optional custom fetch implementation (for React Native's built-in fetch, Node fetch, etc.) */
  fetchFn?: typeof fetch;
}

export class RemoteDataRepository implements GameDataRepository {
  private endpoint: string;
  private authToken?: string;
  private fetchFn: typeof fetch;

  constructor(config: RemoteRepositoryConfig) {
    this.endpoint = config.endpoint.replace(/\/+$/, ''); // strip trailing slash
    this.authToken = config.authToken;
    this.fetchFn = config.fetchFn || (typeof globalThis !== 'undefined' ? globalThis.fetch : fetch);
  }

  async saveGame(save: GameSave): Promise<void> {
    const url = `${this.endpoint}/${encodeURIComponent(save.userId)}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;

    const response = await this.fetchFn(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(save),
    });

    if (!response.ok) {
      throw new Error(`[RemoteDataRepository] saveGame failed: ${response.status} ${response.statusText}`);
    }

    console.log(`[RemoteDataRepository] Game saved for user: ${save.userId}`);
  }

  async loadGame(userId: string): Promise<GameSave | null> {
    const url = `${this.endpoint}/${encodeURIComponent(userId)}`;
    const headers: Record<string, string> = {};
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;

    const response = await this.fetchFn(url, { method: 'GET', headers });

    if (response.status === 404) {
      console.log(`[RemoteDataRepository] No save found for user: ${userId}`);
      return null;
    }

    if (!response.ok) {
      throw new Error(`[RemoteDataRepository] loadGame failed: ${response.status} ${response.statusText}`);
    }

    const save: GameSave = await response.json();
    console.log(`[RemoteDataRepository] Progress loaded for user: ${userId}`);
    return save;
  }
}