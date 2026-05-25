# Contributing to IDLERPG

This guide covers how to add new plugins, extend persistence, and contribute to the IDLERPG monorepo.

## Quick Start

```bash
npm install    # link workspace packages
cd packages/app && npx expo start   # run the Expo app
cd packages/web && npx vite         # run the web app (needs npm install in web/)
```

## Adding a New Plugin

1. **Create** `packages/core/YourPlugin.ts`
2. **Implement** the `EnginePlugin` interface:

```typescript
import { EnginePlugin, GameState } from './BaseTypes';

export class YourPlugin implements EnginePlugin {
  id = 'your-plugin';  // lowercase, kebab-style

  onInit(engine: any) {
    // Safe re-init: only set defaults if no persisted state exists
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, { /* defaults */ });
    }
  }

  onTick(state: GameState, deltaSec: number) {
    // Called each tick and during offline progress
    // Return Partial<GameState> to mutate state
  }

  onAction(state: GameState, action: any) {
    // Handle PLUGIN_ACTION dispatches targeting this plugin
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    // Return metadata for the UI (costs, next values, etc.)
  }
}
```

3. **Export** from `packages/core/index.ts`:
```typescript
export * from './YourPlugin';
```

4. **Register** in both apps:
   - `packages/app/app/index.tsx` — add to the `plugins` array
   - `packages/web/src/App.tsx` — add to the `plugins` array

5. **Document** in `doc.md` under Built-in Plugins table

## Persistence Adapters

Implement `GameDataRepository` to add a new storage backend:

```typescript
import { GameDataRepository, GameSave } from './BaseTypes';

export class MyAdapter implements GameDataRepository {
  async saveGame(save: GameSave): Promise<void> { /* ... */ }
  async loadGame(userId: string): Promise<GameSave | null> { /* ... */ }
}
```

Then wrap with `CompositeRepository` for offline-first:

```typescript
const repo = new CompositeRepository([localRepo, new MyAdapter()]);
```

## Architecture Rules

- **Core engine files** (`BaseTypes.ts`, `GameEngine.ts`) should rarely change. Default to new plugins.
- **Plugin IDs**: lowercase, kebab-style (`"adaptive"`, `"energy"`)
- **Plugin state**: stored under `state.pluginState[plugin.id]` — only the plugin writes to its own subspace
- **Upgrade metadata**: return via `getActionMetadata()` → engine collects in `getUpgradeMetadata()` → UI reads from `meta.plugins[pluginId]`
- **Safe re-init**: always guard `onInit` to avoid overwriting persisted state

## Testing

```bash
npx vitest run    # Run the unit test suite
```

## Code Style

- TypeScript strict mode enabled
- Prefer explicit return types on public methods
- Use `any` for `engine` parameter in plugin hooks (avoids circular deps)
- JSX in `.tsx` files only