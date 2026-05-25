# AI Overlord — AI Developer Reference

> Compact guide for LLMs editing this monorepo. Covers architecture, file layout, conventions, and current state.

## Project Layout
```
packages/core/     — Engine, plugins, persistence (0 React deps)
packages/app/      — Expo mobile/web app (React Native)
packages/ui/       — Shared React Native components (ProgressBar, UpgradeCard, etc.)
packages/web/      — Vite + React web entry point (uses @idlerpg/core + @idlerpg/ui)
```

## Engine (`packages/core/BaseTypes.ts`)

**State shape:**
```ts
{ resources:{gold:0}, generationRates:{gold:0}, level:1, lastTick:Date.now(),
  pluginState:{}, enabledPlugins:[] }
```
- `generationRates.gold` is forced to 0 in constructor and on `loadSavedState` — no passive GPS income.

**Key methods:** `start()`, `stop()`, `dispatch(action)`, `subscribe(fn)`, `flushSave()`, `getUpgradeMetadata()`, `loadSavedState(s)`, `togglePlugin(id,bool)`, `setPluginState(id,data)`, `getPluginState(id)`.

**Lifecycle:** `registerPlugin → loadSavedState → initPlugins → processOfflineProgress → start tick loop`. Fresh starts skip offline progress.

## Plugins (all registered in `packages/core/index.ts` + `app/index.tsx`)

| ID | Class | Key State | Actions |
|----|-------|-----------|---------|
| `progression` | ProgressionPlugin | `{generation:{resource,cost,nextAmount}, level:{level,cost}}` | `UPGRADE_GENERATION`, `LEVEL_UP` |
| `adaptive` | AdaptiveModule | `{monsterHp,monsterMaxHp,monstersDefeated,tapDamage}` | `TAP_DAMAGE`, `UPGRADE_TAP` |
| `prestige` | PrestigePlugin | `{cores,lifetimeGold,bonusMultiplier}` | `PRESTIGE` (resets level→1, gold→0, generation→1) |
| `energy` | EnergyPlugin | `{energy,maxEnergy,cooldowns:{},spellLevels:{}}` | 5 spells: `SLASH/FIREBALL/LIGHTNING/METEOR/ULTIMATE` — upgradable (+2×/lvl, -1s CD/lvl), costs energy, has CD |
| `equipment` | EquipmentPlugin | `{equipped:{},inventory:[]}` | `EQUIP`, `UNEQUIP`, `SCRAP` — 3 slots, 4 rarities, drops via `onKill` hook |
| `achievements` | AchievementPlugin | `{unlocked:[],unlockedCount}` | Checks on tick, grants gold on unlock |
| `debug` | DebugPlugin | `{visible}` | `ADD_GOLD`, `SET_LEVEL`, `TOGGLE_DEBUG` |
| `onboarding` | OnboardingPlugin | `{step,completed}` | `NEXT_STEP`, `SKIP_TUTORIAL` (5-step tutorial) |
| `analytics` | AnalyticsPlugin | `{enabled,events}` | `TOGGLE_ANALYTICS` |
| `network` | NetworkPlugin | `{nodes:{}}` | `BUY_NODE` — 5 passive income generators, cost doubles per purchase |
| `combo` | ComboPlugin | `{count,lastTapTime,multiplier}` | Intercepts `TAP_DAMAGE` — builds x1.0–x3.0 multiplier on rapid taps, resets after 1.5s |
| `missions` | MissionPlugin | `{dayKey,active:[],sessionKills,...}` | `CLAIM_MISSION` — 3 daily missions rotating each 24h, tracks kills/taps/spells/gold spent/scraps |
| `boss` | BossPlugin | `{bossActive,bossHp,bossTimer,bossesDefeated}` | `BOSS_DAMAGE` — boss spawns every 10 stages, 30s timer, 3× gold reward on kill |
| `skilltree` | SkillTreePlugin | `{points,unlocked:[]}` | `UNLOCK_SKILL` — 3 branches × 5 nodes, points earned from prestige |
| `stats` | StatsPlugin | `{totalTaps,totalKills,totalGoldEarned,totalSecondsPlayed,totalBossesDefeated,totalMissionsClaimed,totalPrestiges}` | Intercepts `TAP_DAMAGE`, `PRESTIGE`, `CLAIM_MISSION` — lifetime counters |
| `events` | EventPlugin | `{seenEvents:[],activeEvent,activeBuffExpiry,pendingEvent,eventLog:[]}` | `ACTIVATE_EVENT`, `DISMISS_EVENT` — 10 stage-milestone events with time-limited buffs |
| `leaderboard` | LeaderboardPlugin | `{enabled,myRank,topPlayers:[],loading,error}` | `TOGGLE_LEADERBOARD` — opt-in anonymous Supabase leaderboard, submits every 5min when enabled |
| `return` | ReturnPlugin | `{lastSeenAt,pendingBonus}` | `DISMISS_BONUS` — detects 2h+ offline, surfaces welcome-back screen with network income summary |

**Plugin template:**
```ts
export class X implements EnginePlugin {
  id = 'x';
  onInit(engine) { if(!engine.getPluginState(this.id)) engine.setPluginState(this.id,{...}); }
  onTick(state, deltaSec) { return { resources, pluginState:{ [this.id]:{...} }, level? }; }
  onKill(state, killCount) { return { pluginState:{ [this.id]:{...} } }; } // optional, called per kill
  getActionMetadata(state) { return { upgrade:{key,cost,nextValue} }; }
  onAction(state, action) { return { resources, pluginState:{ [this.id]:{...} }, level? }; }
}
```
> **Important:** `pluginState` returns must only include the plugin's own key — `{ [this.id]: {...} }`. Do NOT spread `...state.pluginState` — the engine merges safely at the key level.

## Persistence
- `LocalDataRepository` — `StorageAdapter` → `idlerpg_user_{id}` key
- `FirebaseDataRepository` — Firestore `saves/{userId}` doc, graceful degrade
- `CompositeRepository` — wraps array of repos, save-all/load-newest
- `PersistenceManager` — versioned saves with migration chain

## App UI (`packages/app/app/index.tsx`)
- **Top bar:** COMPUTE (left) → STAGE (center) → ⚙️ settings (right)
- **Monster area:** tappable `Pressable` → dispatches `TAP_DAMAGE`, shows health bar + `Tap: X | DPS: Y | Defeated: Z`
- **Damage numbers:** floating text overlay — tap/spell damage + gold earned floats up and fades
- **Stage themes:** enemy visual changes every 10 stages (Threat → Skull → Dragon → Demon → Titan)
- **Spell bar:** 5 circular 56px buttons (Slash/Fireball/Lightning/Meteor/Ultimate) — shows cost or CD countdown
- **Bottom drawer:** collapsible via `Animated.spring` height toggle. Contains tabs (Upgrades/Energy/Prestige/Feats/⚔️ Gear) + scrollable content
- **Spell upgrades:** each spell row shows level + upgrade cost button alongside cast button
- **Equipment tab:** shows equipped slots (weapon/armor/ring) + inventory list with equip/unequip/scrap
- **Haptics:** light impact on tap, heavy on spell cast, success notification on kill (via `expo-haptics`)
- **Settings modal:** Manual Save, Export, Import, Close
- **Dev tools:** toggle bottom-right, shows +1K/+100K/St.15/St.25/Reset buttons
- **Tutorial card:** shows between top bar and monster when onboarding active

## Web App (`packages/web/src/App.tsx`)
- Vite + React, same engine plugins, localStorage adapter
- Uses `@idlerpg/ui` for ProgressBar/UpgradeCard

## Key Architecture Rules
1. **Core engine files rarely change** — prefer new plugins
2. **Plugin IDs:** lowercase kebab (`"adaptive"`, `"energy"`)
3. **Safe re-init:** `onInit` must check `if(!existing || Object.keys(existing).length===0)` before setting defaults
4. **Upgrade metadata:** plugin → `getActionMetadata()` → engine collects → UI reads `meta.plugins[id]`
5. **OnAction return:** `Partial<GameState>` — engine's `applyStateUpdates` merges keys

## Current Gameplay
- **No passive gold/sec** — only from kills (tap + auto DPS)
- **Auto DPS:** fixed at 1/sec
- **Tap damage:** upgradable, starts at 1, costs `15 + tapDamage * 8`
- **Kill:** advances stage, grants `5 × newLevel` gold, spawns harder enemy (`10 × 1.2^level` HP)
- **Energy:** 50 cap, regens 1/3s, 5 spells with cooldowns (5/10/15/25/45s)
- **Spell upgrades:** each spell upgradable with compute; +2× multiplier and -1s CD per level
- **Equipment:** gear drops on kill (12-30% chance), 3 slots × 4 rarities × 4 items each; bonuses: +tap dmg, +energy regen, +spell mult, +gold/kill
- **Stage themes:** enemy name/emoji changes every 10 stages
- **Prestige:** at level 10+, resets progress, grants core (+5% compute/sec each)
- **Achievements:** 6 milestones, checked on tick, one-time gold rewards
- **Cloud sync:** optional Firebase anonymous auth + Firestore save/load
- **Haptics:** light tap, heavy spell, success kill feedback

## Running
```
cd packages/app && npx expo start    # Expo
cd packages/web && npx vite          # Web
npx vitest run                       # Unit tests
```

## `plan.md` Status
- **Phase 1:** Complete (core engine, persistence, plugin polish, UI, tests)
- **Phase 2:** Complete — Firebase, Prestige, Energy (spells), Achievements, Debug, UI library, web entry, Onboarding, Analytics
- **Phase 3:** Complete — spell upgrades, damage numbers, equipment/gear, stage themes, anonymous cloud auth, haptic feedback
- **Phase 4:** Complete — Engine bug fixes (pluginState corruption, offline chunking, onKill hook, equipment decoupling), NetworkPlugin, ComboPlugin, MissionPlugin, BossPlugin, SkillTreePlugin
- **Phase 5:** Complete — StatsPlugin (lifetime counters), EventPlugin (10 narrative stage-events with time-limited buffs), LeaderboardPlugin (opt-in Supabase leaderboard + Edge Function), ReturnPlugin (welcome-back screen after 2h+ offline), tab badge indicators on web board
