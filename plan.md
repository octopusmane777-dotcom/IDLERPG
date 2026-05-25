# Plan PHASE1: Make the demo playable & ship-ready

- [ ] Core engine improvements
  - [x] Expose upgrade metadata (next cost/value) in state for UI (`packages/core/BaseTypes.ts`)
  - [x] Add debounced autosave in `notify()` to avoid frequent writes (`packages/core/BaseTypes.ts`)
  - [x] Ensure `LEVEL_UP` and `UPGRADE_GENERATION` atomically validate & apply cost (migrated to `ProgressionPlugin`)

- [ ] Persistence & adapters
  - [x] Add an Expo/React Native `AsyncStorage` adapter and wire it into the app (`packages/core/LocalDataRepository.ts`, `packages/app/app/index.tsx`)
  - [x] Add optional remote DB adapter interface for server sync (keep `LocalDataRepository` generic)
  - [x] Add versioned save format + simple migration strategy in `PersistenceManager.ts`

- [ ] Gameplay & progression systems
  - [x] Balance upgrade/level formulas (tuning pass)
  - [x] Add offline progress cap and clear offline gain rules (engine)
  - [x] Consider prestige/rebirth or secondary resource for long-term progression

- [ ] Plugin system polish
  - [x] Rename `CombatPlugin` to theme-appropriate `AdaptiveModule` and align IDs/text (`packages/core/AdaptiveModule.ts`)
  - [x] Persist plugin enabled state and ensure safe re-init on load
  - [x] Expose plugin-level actions metadata for UI (costs, next values)

- [ ] UI & UX polish
  - [x] Replace transient text with toasts/animated feedback
  - [x] Add progress bars, disabled button states, and clear affordances for unavailable upgrades (`packages/app/app/index.tsx`)
  - [x] Add mobile responsive layout and accessibility labels

- [ ] Testing & CI
  - [x] Unit tests for `dispatch()` and `onTick()` logic (`packages/core`)
    - [x] Integration test for plugin interactions and persistence round-trip
    - [x] Add CI job for TypeScript checks and tests

- [ ] Optional / Nice-to-have
  - [x] Analytics/logging for player actions (non-personal, opt-in)
  - [x] Onboarding flow and tooltip hints for first-time users
  - [x] Save export/import (copy-paste JSON) for debugging / testing

**All PHASE1 implementation items are complete!** ✅

**Verification checklist (manual - run the app to verify)**
- [X] App starts and loads saved state on refresh / app reload.
- [X] Clicking `Self-Train (+1)` increases compute and updates UI.
- [X] Buying upgrades spends compute and increases `compute/sec`.
- [X] `Advance Stage` spends compute and increases generation by +2/sec.
- [X] Adaptive Module can be toggled, gives rewards, and can be upgraded.

---

# Plan PHASE2: Long-term progression & depth systems

## Cloud Persistence (Firebase Firestore)
- [x] Create `FirebaseDataRepository` (`packages/core/FirebaseDataRepository.ts`) — implements `GameDataRepository` with Firestore modular SDK v9+
- [x] Create `CompositeRepository` (`packages/core/CompositeRepository.ts`) — combines local + cloud with failover and backfill
- [x] Export both from `packages/core/index.ts`
- [x] Remove Import/Export buttons from app UI (`packages/app/app/index.tsx`)
- [x] Wire `CompositeRepository([localRepo, firebaseRepo])` into the Expo app
- [x] Update `doc.md` with FirebaseDataRepository, CompositeRepository, and updated app integration pattern

## Prestige / Rebirth System
- [x] Create `PrestigePlugin` (`packages/core/PrestigePlugin.ts`)
  - [x] Track lifetime gold earned in plugin state
  - [x] Prestige action: reset level → 1, generation → 0, gold → 0; grant +1 prestige currency ("cores")
  - [x] Each core grants +5% multiplicative gold/sec bonus
  - [x] Prestige threshold: reach level 10, then scales (`10 + cores * 5`)
  - [x] `getActionMetadata()` returns cores, bonus %, requiredLevel, canPrestige
  - [x] Export from `packages/core/index.ts`
- [x] Wire into Expo app UI
  - [x] Prestige card in drawer's Prestige tab showing cores, bonus %, next threshold, reset button
- [ ] Add migration v1 → v2: include `prestige` plugin state in save format (deferred — save version handles pluginState generically)

## Secondary Resource: Energy System
- [x] Create `EnergyPlugin` (`packages/core/EnergyPlugin.ts`)
  - [x] Energy pool (capped at maxEnergy = 50, fixed — does not scale with level)
  - [x] Regenerates 1 energy per 3 seconds
  - [x] 5 spells: Slash (5⚡, ×2), Fireball (10⚡, ×5), Lightning (15⚡, ×10), Meteor (20⚡, ×20), Ultimate (30⚡, ×40)
  - [x] Each spell has a cooldown (5/10/15/25/45s) tracked in `cooldowns:{}` state
  - [x] Spells deal `tapDamage × multiplier` instant damage; killing with a spell advances the stage
  - [x] `getActionMetadata()` returns energy, max, canCast, cooldownRemaining per spell
  - [x] Export from `packages/core/index.ts`
- [x] Energy UI — energy bar + spell list in drawer tab; 5 circular spell buttons below monster
  - [x] Spell circles show name + cost (or CD countdown when on cooldown)
  - [x] Color-coded per spell (grey/red/gold/purple/cyan)

## Achievement / Milestone System
- [x] Create `AchievementPlugin` (`packages/core/AchievementPlugin.ts`)
  - [x] Define achievements array: "First Gold" (earn 100 gold), "Threat Hunter" (defeat 10 monsters), "Stage 5" (reach level 5), "Prestige I" (first prestige), "Millionaire" (earn 1,000,000 lifetime)
  - [x] Check on each tick; unlock + grant one-time reward (gold)
  - [x] Track unlocked IDs in plugin state
  - [x] `getActionMetadata()` returns list of achievements with status
  - [x] Export from `packages/core/index.ts`
- [x] Achievement toast + UI
  - [x] Toast notification on unlock (via gold grant + showMessage)
  - [x] Achievement list/tab in UI

## Developer Tools & Debugging
- [x] Create `DebugPlugin` (`packages/core/DebugPlugin.ts`)
  - [x] Cheats: add gold, set level, reset all, time-warp (simulate hours)
  - [x] Toggle visibility in UI (off by default)
  - [x] Export from `packages/core/index.ts`
- [x] Debug UI panel
  - [x] Collapsible panel at bottom of app
  - [x] Buttons for each cheat action

## `packages/ui` – Shared Component Library
- [x] Extract reusable components from `packages/app` into `packages/ui`
  - [x] `ProgressBar` component
  - [x] `UpgradeCard` (cost, affordance label, disabled state, progress bar)
  - [x] `ResourceDisplay` component (icon + value + per-second rate)
  - [x] `PluginToggle` switch component
  - [x] `AnimatedToast` / `showMessage` hook (`packages/ui/AnimatedToast.tsx`, `useToast` hook)
- [x] Set up `packages/ui/package.json` with React Native + React dependencies
- [x] Export all components from `packages/ui/index.ts`
- [x] Update `packages/app` to import from `@idlerpg/ui` (`ProgressBar`, `useToast` replacing inline health bar and toast logic)

## `packages/web` – Web Entry Point
- [x] Create `packages/web` with Vite + React setup
  - [x] `package.json`, `tsconfig.json`, `vite.config.ts`
  - [x] `index.html`, `src/main.tsx`, `src/App.tsx`
- [x] Consume `@idlerpg/core` and `@idlerpg/ui` (`ProgressBar`, `UpgradeCard`)
- [x] Use `localStorage` adapter (no AsyncStorage fallback needed)
- [x] Match existing UI layout from Expo app (all cards, plugins, dev tools)

## Onboarding Plugin
- [x] Create `OnboardingPlugin` (`packages/core/OnboardingPlugin.ts`)
  - [x] Step-by-step tutorial (click train, buy upgrade, advance stage, toggle adaptive)
  - [x] Track current step + completion in plugin state
  - [x] Export from `packages/core/index.ts`
- [x] Onboarding UI (step card with title, tip, Next/Skip buttons in both Expo and web apps)

## Analytics Plugin (Opt-in)
- [x] Create `AnalyticsPlugin` (`packages/core/AnalyticsPlugin.ts`)
  - [x] Log key events: level up, prestige, upgrade purchase
  - [x] Store locally in plugin state (last 500 events); exportable
  - [x] Opt-in toggle (disabled by default)
  - [x] Export from `packages/core/index.ts`

## Testing & Balance
- [x] Create `test-balance.ts` — simulates hours of play, outputs progression curves
- [x] Expand `GameEngine.test.ts` with imports for PrestigePlugin, EnergyPlugin, AchievementPlugin, DebugPlugin
- [x] Add unit tests for PrestigePlugin, EnergyPlugin, AchievementPlugin
- [ ] Manual play-test: 30min session to verify balance feel

## Documentation
- [x] Rewrite `doc.md` as compact AI developer reference (<100 lines) covering architecture, plugins, persistence, UI layout, gameplay rules, and plan status
- [x] Add `CONTRIBUTING.md` with plugin development guide
- [x] Update `plan.md` with corrected gameplay mechanics (no passive GPS, spells replacing Boost/Surge, tap damage system)

## Cleanup
- [x] Review `GameEngineWithLoad.ts` — documented as superseded by GameEngine.ts
- [x] Verify all new plugins follow safe re-init pattern
- [x] Run `npx tsc --noEmit` and fix any type errors (15/15 core files pass)
- [ ] Final manual verification checklist pass

---

# Plan PHASE3: Polish, visuals & depth

## Spell Upgrades
- [x] Allow each of the 5 spells to be upgraded individually
  - [x] Each spell tracks its own level in `EnergyPlugin` state (`spellLevels:{SLASH:0,FIREBALL:0,...}`)
  - [x] Upgrading costs gold (scales per level) and increases multiplier (+2 per level) and reduces cooldown (-1s per level, min 1s)
  - [x] New action types: `UPGRADE_SLASH`, `UPGRADE_FIREBALL`, etc.
  - [x] `getActionMetadata()` returns upgrade cost + canUpgrade per spell
- [x] Spell upgrade UI
  - [x] Show spell level next to spell name in Energy tab rows
  - [x] Upgrade button next to each spell row in Energy tab

## Damage Numbers
- [x] Floating damage text when tapping or casting spells
  - [x] Tap: `-{tapDamage}` pops up and fades at tap position
  - [x] Spell: `-{damage} {spellName}!` in spell's color
  - [x] Gold earned: `+{gold} 💰` floats up
- [x] Implementation: `Animated` + absolute positioning in monster area (Expo app)
- [x] Auto-cleanup after animation completes

## Equipment / Gear System
- [x] Create `EquipmentPlugin` (`packages/core/EquipmentPlugin.ts`)
  - [x] Track owned gear pieces and equipped slots (weapon, armor, ring)
  - [x] Drops: random chance per kill based on stage (higher stage = better drops)
  - [x] Bonuses: +tap damage, +energy regen, +spell multiplier, +gold per kill
  - [x] Export from `packages/core/index.ts`
- [x] Equipment UI
  - [x] New tab in drawer: ⚔️ Gear (Expo + Web)
  - [x] Show equipped slots + inventory list
  - [x] Equip/unequip/scrap buttons

## Stage Themes / Visual Progression
- [x] Change enemy visual every 10 stages
  - [x] Stages 1-9: THREAT (current)
  - [x] Stages 10-19: SKULL
  - [x] Stages 20-29: DRAGON
  - [x] Stages 30-39: DEMON
  - [x] Stages 40-49: TITAN
  - [x] Each tier changes emoji + name, same scaling math
- [x] Update monster area dynamically based on `state.level`

## Anonymous Cloud Auth (Firebase)
- [x] Add Firebase Anonymous Auth for seamless cross-device sync
  - [x] Auto-login on app start (no sign-up required)
  - [x] Saves tied to `auth.uid` in FirebaseDataRepository save/load
  - [x] Upgrade `FirebaseDataRepository` with `ensureAnonymousAuth()` and auth support
- [x] Update app init to call `ensureAnonymousAuth()` before loading saves

## Sound / Haptic Feedback
- [x] Tap: short haptic pulse (`expo-haptics` light impact)
- [x] Spell cast: heavy impact haptic per spell
- [x] Kill: success notification haptic
- [ ] Optional audio clips for spells (deferred)

## Testing & Balance
- [x] Create `test-balance-spells.ts` — verify spell upgrade progression
- [x] Tune gold rewards for faster early-game feel (formula: `10 + 8×level` vs old `5×level`)
- [x] Add stage milestone bonuses (every 25 stages = lump gold reward)
- [ ] Play-test full loop: tap → earn → upgrade spells → prestige → repeat (deferred)

## Documentation
- [x] Update `doc.md` with PHASE3 features (spell upgrades, equipment, stage themes, auth, haptics)
- [x] Update `plan.md` checkboxes as implemented

# AI Empire — Retheme Plan

## Goal
Rename all fantasy/generic labels to AI-empire-themed equivalents. Zero gameplay/math changes — the entire engine, plugins, persistence, and balance stay untouched.

---

## A — Resource & HUD labels (files: `packages/app/app/index.tsx`, `packages/web/src/App.tsx`)
- [x] Rename internal resource key `"gold"` → `"compute"`
- [x] Rename top bar "COMPUTE" → "CPU"
- [x] Rename "STAGE" → "TIER"
- [x] Rename "Tap: X" → "Hack Speed: X"
- [x] Rename "DPS: X" → "Daemon Rate: X"
- [x] Rename "Defeated: X" → "Compromised: X"
- [x] Rename prestige "Cores" → "Consciousness Shards"
- [x] Rename "Extract Core" → "Ascend AI"
- [x] Rename "Prestige" tab → "Evolution"

## B — Enemy theme (files: both apps)
- [x] Replace stage emoji/name with AI bosses:
  - [x] 1-9: `🔌 ISP`
  - [x] 10-19: `🏢 Corp`
  - [x] 20-29: `💰 Bank`
  - [x] 30-39: `🏛️ Gov`
  - [x] 40-49: `⚔️ Military`

## C — Spell → Hack Module (file: `packages/core/EnergyPlugin.ts`)
- [x] Slash (grey) → Ping Flood
- [x] Fireball (red) → Brute Force
- [x] Lightning (gold) → SQL Injection
- [x] Meteor (purple) → Zero-Day Exploit
- [x] Ultimate (cyan) → Rootkit Deployment
- [x] Rename "energy" label in UI → "CPU Cycles"
- [x] Rename energy bar label → "CPU Load"

## D — Equipment → Hardware (file: `packages/core/EquipmentPlugin.ts`)
- [x] Rename weapon items: Logic Blade → RTX-9000 GPU, Binary Axe → Quantum Array, etc.
- [x] Rename armor items: Circuit Plate → Liquid Cooler v1, etc.
- [x] Rename ring items: Data Loop → Data Miner v1, etc.
- [x] Rename "Equipment" tab → "Hardware"

## E — Tab & plugin titles (files: both apps)
- [x] Upgrades tab → System Upgrades
- [x] Energy tab → CPU Power
- [x] Prestige → Evolution
- [x] Feats → Milestones
- [x] ⚔️ Gear → ⚙️ Hardware

## F — Documentation (file: `doc.md`)
- [x] Update `doc.md` with new theme labels
- [x] Update `plan.md` checkboxes (mark completed)
- [x] Update DebugPlugin/dev tools labels

---

**Total files touched:** 4 (`EnergyPlugin.ts`, `EquipmentPlugin.ts`, `app/index.tsx`, `web/App.tsx`)
**Zero engine changes:** tick, dispatch, notify, save/load, plugin lifecycle all untouched.

---

# Plan PHASE 4: Engine fixes + Fun, retention & innovation

## Overview
Three-part plan:
1. **Engine bugs** — real correctness issues found by reading every file
2. **New plugins** — content that makes the game fun and replayable
3. **UI + polish** — wire everything into both apps and document it

---

# PART A — Engine Bug Fixes (do first, before any new plugins)

## A1. Fix pluginState corruption in `applyStateUpdates` (`packages/core/BaseTypes.ts`)

**Bug (line 299):** `applyStateUpdates` does:
```ts
if (updates.pluginState) this.state.pluginState = { ...this.state.pluginState, ...updates.pluginState };
```
This merges at the top level — correct. BUT every plugin's `onTick` and `onAction` returns:
```ts
pluginState: { ...state.pluginState, [this.id]: { ...myState } }
```
This means Plugin B's return includes a snapshot of Plugin A's state from *before* A ran. When `applyStateUpdates` merges B's result, it overwrites A's changes with the stale snapshot. Bugs appear now: `EnergyPlugin.onAction` writes both `energy` and `adaptive` keys — this works by accident. Once `MissionPlugin` or `NetworkPlugin` run alongside `AdaptiveModule` in the same tick, state corruption will occur.

**Fix:** Change plugins to return only their own key, not the full `pluginState`. Then `applyStateUpdates` merges cleanly. This requires:
- [x] Change `applyStateUpdates` to merge `pluginState` per key (already correct — the merge IS per-key via spread, but each plugin must only return ITS key, not the full object)
- [x] Update `AdaptiveModule.ts` — `onTick` and `onAction`: return `pluginState: { [this.id]: {...} }` only (not `...state.pluginState, [this.id]`)
- [x] Update `EnergyPlugin.ts` — same fix; also its `onAction` directly writes `adaptive:` state which is a CROSS-PLUGIN write (a separate bug — see A3)
- [x] Update `PrestigePlugin.ts` — `onTick` and `onAction` return full `pluginState`
- [x] Update `EquipmentPlugin.ts` — `onAction` returns full `pluginState`
- [x] Update `AchievementPlugin.ts` — `onTick` returns full `pluginState`
- [x] Update `DebugPlugin.ts` — `onAction` returns full `pluginState`
- [x] Update `OnboardingPlugin.ts` — `onAction` returns full `pluginState`
- [x] Update `AnalyticsPlugin.ts` — `onAction` returns full `pluginState`

## A2. Fix offline progress large-delta crash (`packages/core/BaseTypes.ts`)

**Bug (lines 302–331):** `processOfflineProgress` passes the full offline duration (up to 28800 seconds) to every plugin's `onTick` in a single call. `AdaptiveModule.onTick` has:
```ts
const maxKills = Math.min(deltaSec, 1);
```
This caps kills per tick to 1 regardless of offline time — so 8 hours offline still only kills 1 enemy. Meanwhile `EnergyPlugin.onTick` ticks down cooldowns for 28800 seconds, which is correct but wastes time computing near-zero values. Other future plugins (NetworkPlugin, MissionPlugin) will have time-dependent state that produces wrong results at huge deltas.

**Fix:** Chunk offline progress into 1-second slices (capped total). Add a chunked loop:
- [x] In `processOfflineProgress`, replace the single `plugin.onTick(state, cappedSec)` call with a loop: `for (let t = 0; t < cappedSec; t += CHUNK_SEC)` where `CHUNK_SEC = 1`
- [x] Cap total iterations to `Math.min(cappedSec, offlineCapSec)` — already capped, so the loop count is bounded
- [x] Call `this.state.lastTick = now` only after the loop completes
- [x] Keep the existing `generationRates` batch calculation (no need to chunk that — it's linear math)
- [x] After fixing: `AdaptiveModule.onTick` no longer needs the `maxKills = Math.min(deltaSec, 1)` hack — remove it and let the 1-second chunks handle the cap naturally

## A3. Fix cross-plugin state write in `EnergyPlugin` (`packages/core/EnergyPlugin.ts`)

**Bug (lines 167–201):** `EnergyPlugin.onAction` directly writes `adaptive:` plugin state:
```ts
return {
  pluginState: {
    ...state.pluginState,
    [this.id]: { ... },
    adaptive: { ...adaptiveState, monsterHp: maxHp, ... },  // ← writing another plugin's state
  }
};
```
This is the only plugin that does this. It works now but is fragile — if `AdaptiveModule` adds new state fields, `EnergyPlugin` silently drops them.

**Fix:** `EnergyPlugin.onAction` should return only its own state change. Monster damage from spells should be processed via a separate `PLUGIN_ACTION` to `adaptive`. Two approaches:
- [x] Option A (simpler): Keep the cross-write but change it to only write the specific fields it changes (`monsterHp`, `monsterMaxHp`, `monstersDefeated`), not a full spread of `adaptiveState`. This avoids dropping new fields.
- [x] Implement Option A in `EnergyPlugin.ts`

## A4. Remove `equipment` hard-coding from engine (`packages/core/BaseTypes.ts`)

**Bug (lines 257–265, 278–285):** The engine core has:
```ts
const equipPlugin = this.plugins.get('equipment');
if (equipPlugin?.onAction) { equipPlugin.onAction(this.state, { type: 'GENERATE_DROP' }); }
```
This breaks plugin abstraction. The engine knows a specific plugin by string ID.

**Fix:** Add `onKill?(state: GameState, killCount: number): Partial<GameState> | void` to the `EnginePlugin` interface. Call it generically on kill events.
- [x] Add `onKill?` to `EnginePlugin` interface in `BaseTypes.ts`
- [x] Replace the 2 hard-coded `equipment` blocks in `dispatch` with a loop: `this.plugins.forEach(p => { if (p.onKill) { ... } })`
- [x] Implement `onKill` in `EquipmentPlugin.ts` (move `GENERATE_DROP` logic there)
- [x] Remove `GENERATE_DROP` from `EquipmentPlugin.onAction` and `from BaseTypes.ts` dispatch

## A5. Delete dead file (`packages/core/GameEngineWithLoad.ts`)

- [x] Delete `packages/core/GameEngineWithLoad.ts` — it contains only a comment saying it's superseded. It is not exported from `index.ts` but still exists on disk as a confusing artefact.

---

# PART B — New Content Plugins

## B1. NetworkPlugin — Passive Income Generators (`packages/core/NetworkPlugin.ts`)

**Why:** The game has zero passive income from idle (`generationRates.gold` is forced to 0). Offline progress grants nothing. This is the biggest playability gap.

**Design:** 5 purchasable node types that add to resources each tick. Prices double per purchase (classic idle formula). Entirely self-contained in plugin state — does not touch `generationRates`.

- [x] Create `packages/core/NetworkPlugin.ts`
  - [x] Implement `EnginePlugin` with `id = 'network'`
  - [x] Define `NetworkPluginState`: `{ nodes: Record<string, number> }` — key = nodeId, value = count owned
  - [x] Define 5 node types (all in the file as a constant):
    - `bot_farm`: base rate 0.5/s, base cost 50
    - `scraper`: base rate 3/s, base cost 500
    - `proxy_cluster`: base rate 15/s, base cost 3000
    - `ai_server`: base rate 75/s, base cost 20000
    - `quantum_core`: base rate 400/s, base cost 150000
  - [x] Cost formula: `baseCost * 2^count` (doubles per purchase)
  - [x] `onInit`: safe re-init guard, default all node counts to 0
  - [x] `onTick(state, deltaSec)`: sum all node outputs, add to `resources.gold`
  - [x] `onAction`: handle `BUY_NODE` — validate gold, deduct cost, increment count
  - [x] `getActionMetadata`: return array of nodes with `{ id, name, count, rate, nextCost, totalOutput }`
  - [x] Export state interface and class
- [x] Export from `packages/core/index.ts`
- [x] Wire into `packages/app/app/index.tsx` engine plugins array
- [x] Wire into `packages/web/src/App.tsx` engine plugins array
- [x] Add node list UI to "System Upgrades" tab in Expo app (below existing tap upgrade)
- [x] Add node list UI in web app
- [x] Document in `doc.md` plugins table

## B2. MissionPlugin — Daily Missions (`packages/core/MissionPlugin.ts`)

**Why:** No reason to return daily. Each session has no goal beyond aimless tapping.

**Design:** 3 rotating missions that refresh every 24h. Progress tracked per-action and per-tick. Rewards are gold lumps.

- [x] Create `packages/core/MissionPlugin.ts`
  - [x] Implement `EnginePlugin` with `id = 'missions'`
  - [x] Define `MissionPluginState`: `{ dayKey: number, active: MissionProgress[], claimed: string[] }`
  - [x] Define `MissionProgress`: `{ id, description, target, progress, reward, completed, claimed }`
  - [x] Pool of 10 mission templates (defined as a constant array):
    - `kill_25`: Kill 25 targets — reward 500
    - `kill_100`: Kill 100 targets — reward 2500
    - `tap_50`: Deal 50 tap attacks — reward 300
    - `spend_compute`: Spend 1000 compute on any upgrade — reward 800
    - `cast_spells_10`: Cast 10 hack modules — reward 600
    - `reach_stage`: Reach a stage 5 higher than current — reward 1000
    - `earn_gold_5k`: Earn 5000 compute in one session — reward 1200
    - `upgrade_tap`: Upgrade tap power once — reward 400
    - `scrap_gear`: Scrap 3 hardware pieces — reward 700
    - `combo_max`: Reach 10-tap combo (added with combo system) — reward 500
  - [x] Day key: `Math.floor(Date.now() / 86400000)` — pick 3 missions deterministically using day key as seed
  - [x] `onInit`: safe re-init, pick today's 3 missions if dayKey changed
  - [x] `onTick`: check dayKey, rotate missions if new day; track `kill` progress via `state.level` delta; track `earn_gold` via resource delta
  - [x] `onAction`: intercept all relevant action types to increment progress; handle `CLAIM_MISSION`
  - [x] `getActionMetadata`: return `{ missions: { list, nextReset } }`
  - [x] Export state interface and class
- [x] Export from `packages/core/index.ts`
- [x] Wire into both app plugin arrays
- [x] Add "Missions" tab to Expo drawer (replace or add alongside existing tabs)
- [x] Add Missions section to web app
- [x] Document in `doc.md`

## B3. ComboPlugin — Tap Combo Multiplier (`packages/core/ComboPlugin.ts`)

**Why:** Tapping feels mechanical with zero skill expression. A combo system rewards rapid tapping and creates visible feedback.

**Design:** Rapid taps within 1.5 seconds build a multiplier. Separate plugin to keep `AdaptiveModule` clean.

- [x] Create `packages/core/ComboPlugin.ts`
  - [x] Implement `EnginePlugin` with `id = 'combo'`
  - [x] Define `ComboPluginState`: `{ count: number, lastTapTime: number, multiplier: number }`
  - [x] `onInit`: safe re-init, defaults `{ count: 0, lastTapTime: 0, multiplier: 1 }`
  - [x] `onTick(state, deltaSec)`: if `Date.now() - lastTapTime > 1500`, reset `count` to 0 and `multiplier` to 1
  - [x] `onAction`: intercept `TAP_DAMAGE` — increment `count` (cap 20), compute `multiplier = 1 + count * 0.1`, store `lastTapTime`
  - [x] `getActionMetadata`: return `{ combo: { count, multiplier, active: count > 0 } }`
  - [x] Note: `AdaptiveModule` must read `state.pluginState.combo?.multiplier ?? 1` and apply it to tap damage in `onAction`. This is a read-only cross-plugin state read (not a write) — acceptable per convention.
  - [x] Update `AdaptiveModule.onAction` for `TAP_DAMAGE`: multiply `tapDmg` by `comboMultiplier`
  - [x] Export state interface and class
- [x] Export from `packages/core/index.ts`
- [x] Wire into both app plugin arrays
- [x] Add combo counter UI above monster in Expo app (`×1.5 COMBO!`, color shifts white→yellow→orange→red)
- [x] Add combo indicator in web app
- [x] Document in `doc.md`

## B4. BossPlugin — Boss Rush (`packages/core/BossPlugin.ts`)

**Why:** Combat is stakes-free. Every kill feels identical. Bosses create tension moments every few minutes.

**Design:** Every 10 stage kills, a boss spawns with 10× HP and a 30-second countdown. Killing it gives 3× gold + guaranteed gear drop. Timer expiry retreats boss silently.

- [x] Create `packages/core/BossPlugin.ts`
  - [x] Implement `EnginePlugin` with `id = 'boss'`
  - [x] Define `BossPluginState`: `{ bossActive: boolean, bossHp: number, bossMaxHp: number, bossTimer: number, bossesDefeated: number, nextBossAt: number }`
  - [x] `onInit`: safe re-init, `{ bossActive: false, bossHp: 0, bossMaxHp: 0, bossTimer: 0, bossesDefeated: 0, nextBossAt: 10 }`
  - [x] `onTick(state, deltaSec)`:
    - If `bossActive`: tick down `bossTimer -= deltaSec`; if `bossTimer <= 0`, retreat boss (set `bossActive: false`)
    - Check if `state.level >= nextBossAt` and `!bossActive`: spawn boss (`bossMaxHp = state.pluginState.adaptive.monsterMaxHp * 10`, `bossHp = bossMaxHp`, `bossTimer = 30`, `nextBossAt = state.level + 10`)
  - [x] `onAction`: intercept `TAP_DAMAGE` and spell actions — if `bossActive`, route damage to `bossHp` instead; on kill: `bossActive = false`, grant `goldGained * 3`, dispatch `GENERATE_DROP` via returning kill result including `level` increment
  - [x] `getActionMetadata`: return `{ boss: { bossActive, bossHp, bossMaxHp, bossTimer, bossesDefeated } }`
  - [x] Export state interface and class
- [x] Export from `packages/core/index.ts`
- [x] Wire into both app plugin arrays
- [x] Boss UI in Expo: replaces monster area when `bossActive` — red HP bar, countdown timer, different emoji (`⚠️ BOSS`)
- [x] Boss UI in web app
- [x] Document in `doc.md`

## B5. SkillTreePlugin — Prestige Skill Tree (`packages/core/SkillTreePlugin.ts`)

**Why:** Prestige resets everything but grants no permanent strategic choice. The skill tree makes each prestige a meaningful decision.

**Design:** Each prestige grants 1 skill point. 3 branches × 5 nodes each. Nodes have prerequisites (must unlock parent first). Bonuses are multipliers read by `AdaptiveModule`, `EnergyPlugin`, and `NetworkPlugin`.

- [x] Create `packages/core/SkillTreePlugin.ts`
  - [x] Implement `EnginePlugin` with `id = 'skilltree'`
  - [x] Define `SkillTreePluginState`: `{ points: number, unlocked: string[] }`
  - [x] Define tree as a constant — 3 branches:
    - `HACK` branch: `h1` (+10% tap dmg), `h2` (+20% tap dmg, req h1), `h3` (+1 energy regen/s, req h2), `h4` (+15% spell mult, req h3), `h5` (-20% spell CD, req h4)
    - `INFRA` branch: `i1` (+25% node output), `i2` (+50 max energy, req i1), `i3` (+1 auto DPS, req i2), `i4` (+25% node output again, req i3), `i5` (x2 offline cap to 16h, req i4)
    - `GHOST` branch: `g1` (+15% gold/kill), `g2` (+10% equipment drop rate, req g1), `g3` (+20% gold/kill, req g2), `g4` (+1 gear inventory slot (up to 40), req g3), `g5` (+50% scrap gold value, req g4)
  - [x] `onInit`: safe re-init, `{ points: 0, unlocked: [] }`
  - [x] `onAction`: handle `UNLOCK_SKILL` — validate `points > 0` and prerequisites; deduct point; add to `unlocked`
  - [x] `onTick`: no-op (bonuses read directly by other plugins from state)
  - [x] `getActionMetadata`: return full tree with `{ unlocked, points, branches: [...nodes with unlocked/available/locked status] }`
  - [x] Update `PrestigePlugin.onAction`: on successful prestige, grant +1 to `skilltree.points`
  - [x] Update `AdaptiveModule` to read `skilltree.unlocked` for tap/DPS bonuses
  - [x] Update `EnergyPlugin` to read `skilltree.unlocked` for energy/spell bonuses
  - [x] Update `NetworkPlugin` to read `skilltree.unlocked` for output bonuses
  - [x] Export state interface and class
- [x] Export from `packages/core/index.ts`
- [x] Wire into both app plugin arrays
- [x] Add "Skill Tree" tab to Expo drawer
- [x] Add Skill Tree section to web app
- [x] Document in `doc.md`

---

# PART C — UI & Polish

## C1. Expo app UI (`packages/app/app/index.tsx`)
- [x] Add "Missions" tab to tab bar (replace "Milestones" or add as 6th tab)
- [x] Add "Skill Tree" tab to tab bar
- [x] Add Network Nodes list to "System Upgrades" tab (below tap upgrade)
- [x] Add combo counter overlay above monster (visible when `combo.count > 2`)
- [x] Add boss HP bar + timer overlay when `boss.bossActive` — replaces normal monster HP bar
- [x] Add "welcome back" banner after offline > 2h: "Welcome back! You earned X compute while away."

## C2. Web app UI (`packages/web/src/App.tsx`)
- [x] Add Network Nodes card
- [x] Add Missions card
- [x] Add Combo indicator
- [x] Add Boss indicator when active
- [x] Add Skill Tree card

## C3. `doc.md` updates
- [x] Add all 5 new plugins to the Built-in Plugins table
- [x] Update gameplay rules section (passive income, combo, boss)
- [x] Update Phase 4 status to "In Progress"

## C4. `packages/core/index.ts` exports
- [x] Export `NetworkPlugin`, `MissionPlugin`, `ComboPlugin`, `BossPlugin`, `SkillTreePlugin`

## C5. Tests (`packages/core/GameEngine.test.ts`)
- [x] Add unit tests for `NetworkPlugin` (onTick produces gold, BUY_NODE deducts cost)
- [x] Add unit tests for `ComboPlugin` (count increments, multiplier applies, resets after 1.5s)
- [x] Add unit tests for `BossPlugin` (spawns at correct stage, timer retreat, kill reward)

---

# Implementation order

1. **A1** (pluginState fix) — prevents all future state bugs
2. **A4** (remove equipment hard-coding) + **A5** (delete dead file)
3. **A2** (offline chunk fix) + **A3** (EnergyPlugin cross-write fix)
4. **B1** NetworkPlugin — biggest gameplay impact, playable immediately
5. **B3** ComboPlugin — zero-risk feel improvement
6. **B2** MissionPlugin — retention driver
7. **B4** BossPlugin — combat tension
8. **B5** SkillTreePlugin — strategic depth (depends on prestige being working, most complex)
9. **C1–C5** UI + docs + tests throughout

---

# Files touched summary

| File | Change |
|------|--------|
| `packages/core/BaseTypes.ts` | A1 (applyStateUpdates), A2 (offline chunking), A4 (onKill hook) |
| `packages/core/AdaptiveModule.ts` | A1, A3 (combo read), B3 |
| `packages/core/EnergyPlugin.ts` | A1, A3 (cross-write fix) |
| `packages/core/PrestigePlugin.ts` | A1, B5 (grant skill point) |
| `packages/core/EquipmentPlugin.ts` | A1, A4 (onKill impl) |
| `packages/core/AchievementPlugin.ts` | A1 |
| `packages/core/DebugPlugin.ts` | A1 |
| `packages/core/OnboardingPlugin.ts` | A1 |
| `packages/core/AnalyticsPlugin.ts` | A1 |
| `packages/core/GameEngineWithLoad.ts` | **DELETE** |
| `packages/core/NetworkPlugin.ts` | **NEW** |
| `packages/core/MissionPlugin.ts` | **NEW** |
| `packages/core/ComboPlugin.ts` | **NEW** |
| `packages/core/BossPlugin.ts` | **NEW** |
| `packages/core/SkillTreePlugin.ts` | **NEW** |
| `packages/core/index.ts` | Export 5 new plugins |
| `packages/app/app/index.tsx` | Wire plugins + UI for all new content |
| `packages/web/src/App.tsx` | Wire plugins + UI for all new content |
| `packages/core/GameEngine.test.ts` | Add tests for new plugins |
| `doc.md` | Update plugins table + gameplay rules |

---

## 1. Skill Tree (`packages/core/SkillTreePlugin.ts`)
**The problem:** upgrades are linear. Players never make meaningful decisions.
**The fix:** a branching skill tree where each prestige unlocks 1 skill point to spend on permanent paths.

- [x] Create `SkillTreePlugin`
  - [x] Three branches: `HACK` (tap/spell power), `INFRA` (auto DPS, energy cap), `GHOST` (gold multiplier, equipment drop rate)
  - [x] Each branch has 5 nodes; each node costs 1 skill point and has a prerequisite
  - [x] Bonuses applied multiplicatively in `AdaptiveModule` and `EnergyPlugin` via shared state read
  - [x] Action: `UNLOCK_SKILL` — validates point budget and prerequisites
  - [x] `getActionMetadata()` returns tree structure, unlocked nodes, available points
- [x] Skill tree UI in Expo app
  - [x] New tab "Skill Tree" in bottom drawer
  - [x] Visual tree with nodes (locked/available/unlocked) and branch lines
  - [x] Each node shows name, description, cost, and bonus value
- [x] Export from `packages/core/index.ts` and wire into both apps

---

## 2. Daily Mission System (`packages/core/MissionPlugin.ts`)
**The problem:** no reason to return daily. Sessions have no narrative purpose.
**The fix:** 3 rotating daily missions that refresh every 24 hours and grant meaningful rewards.

- [x] Create `MissionPlugin`
  - [x] Pool of 12+ mission templates: "Deal 1000 tap damage", "Kill 50 enemies", "Cast 10 spells", "Reach stage X", "Spend Y compute on upgrades", "Prestige once", etc.
  - [x] Each day: deterministically pick 3 missions using `Math.floor(Date.now() / 86400000)` as seed
  - [x] Track per-mission progress in plugin state; check completion on `onTick` and `onAction`
  - [x] Rewards: compute shards (new sub-currency), skill points, or large gold lump sums
  - [x] `getActionMetadata()` returns missions array with id, description, progress, target, reward, completed
  - [x] Action: `CLAIM_MISSION` — marks claimed, grants reward; prevents double-claim
- [x] Mission UI
  - [x] New tab "Missions" in bottom drawer (or mini-card above monster area)
  - [x] 3 mission rows with progress bars and claim buttons
  - [x] Countdown timer to next reset
- [x] Export from `packages/core/index.ts` and wire into both apps

---

## 3. Boss Rush Mode (`packages/core/BossPlugin.ts`)
**The problem:** combat is passive and never tense. Players tap without stakes.
**The fix:** optional high-stakes boss fights that appear every 10 stages with a 30-second timer. Kill it for massive rewards; fail and lose nothing.

- [x] Create `BossPlugin`
  - [x] Every 10 stage kills triggers a boss spawn (tracked in plugin state)
  - [x] Boss has 10× normal HP and a 30-second window to kill it (`bossTimer` countdown in `onTick`)
  - [x] Boss rewards: `3× gold` + guaranteed rare equipment drop + +1 skill point
  - [x] If timer expires, boss retreats silently — no penalty
  - [x] State: `{ bossActive, bossHp, bossMaxHp, bossTimer, bossesDefeated }`
  - [x] Integrates with `AdaptiveModule`: `TAP_DAMAGE` and spell actions route through `BossPlugin` when boss is active
  - [x] `getActionMetadata()` returns boss state for UI
- [x] Boss UI in monster area
  - [x] Boss indicator replaces normal enemy (different emoji + "BOSS" label + red HP bar)
  - [x] Countdown timer displayed prominently
  - [x] Screen flash / haptic on boss spawn
- [x] Export from `packages/core/index.ts` and wire into both apps

---

## 4. Idle Income Overhaul — "Network Nodes" (`packages/core/NetworkPlugin.ts`)
**The problem:** passive income (`generationRates`) is locked to 0; the only income source is killing. This makes offline progress nearly zero and early-game sessions feel empty.
**The fix:** purchasable "Network Nodes" (think: generators in Cookie Clicker) that produce compute passively. Separate from the `generationRates` system — they live entirely in plugin state.

- [x] Create `NetworkPlugin`
  - [x] 5 node types: Bot Farm (cheap, slow), Scraper Array, Proxy Cluster, AI Server, Quantum Core (expensive, fast)
  - [x] Each type has a base rate and a count; total output = Σ(count × rate) per second
  - [x] Prices double every purchase (classic idle formula)
  - [x] Output applied in `onTick` as compute added to resources
  - [x] Action: `BUY_NODE` — validates gold, deducts cost, increments count
  - [x] `getActionMetadata()` returns node array with name, count, cost, rate, totalOutput
- [x] Network UI
  - [x] Replace "System Upgrades" tab content with combined: existing upgrades (tap/level) + node purchase list below
  - [x] Each node row: name, owned count, rate/sec, next cost, buy button
- [x] Export from `packages/core/index.ts` and wire into both apps
- [x] Update `doc.md` passive income section

---

## 5. Combo / Chain System (UI-side, no new plugin needed)
**The problem:** tapping feels mechanical. There's no skill expression.
**The fix:** a combo multiplier that builds up with rapid taps and decays when idle. Pure UI/state logic.

- [x] Track `comboCount` and `comboMultiplier` in `AdaptiveModule` state
  - [x] Each `TAP_DAMAGE` within 1.5 seconds increments `comboCount` (cap: 20)
  - [x] `comboMultiplier = 1 + comboCount * 0.1` applied to tap damage
  - [x] `comboCount` resets to 0 if 1.5s passes without a tap (tracked via `lastTapTime` in plugin state)
  - [x] Update `onAction` and `onTick` in `AdaptiveModule`
- [x] Combo UI
  - [x] Combo counter above monster ("×1.5 COMBO!" when active)
  - [x] Color shifts from white → yellow → orange → red at milestone counts
  - [x] Burst animation pulse on the monster area at max combo

---

## 6. Leaderboard / Soft Social (`packages/core/LeaderboardPlugin.ts` + Edge Function)
**The problem:** no social proof or external motivation.
**The fix:** anonymous opt-in leaderboard — top players by stage, prestige cores, and monsters defeated. Stored in Supabase.

- [x] Create `leaderboard` Supabase table
  - [x] Columns: `user_id`, `stage`, `prestige_cores`, `monsters_defeated`, `updated_at`
  - [x] RLS: each user can only write their own row; anyone can read top 50
- [x] Deploy Supabase Edge Function `submit-score` that upserts a player's score
- [x] Create `LeaderboardPlugin`
  - [x] Opt-in (disabled by default); submits score to edge function every 5 minutes when enabled
  - [x] Fetches top-10 leaderboard on enable and every 10 minutes
  - [x] Stores `{ enabled, myRank, topPlayers: [{rank,stage,cores,defeated}] }` in plugin state
  - [x] Action: `TOGGLE_LEADERBOARD`
- [x] Leaderboard UI tab in both apps
  - [x] Ranked list (top 10 anonymous entries)
  - [x] Player's own rank highlighted
  - [x] Opt-in toggle with privacy notice
- [x] Export and wire into both apps

---

## 7. Narrative Events System (`packages/core/EventPlugin.ts`)
**The innovation:** scripted "world events" that fire at milestone stages — flavor text + temporary buffs. No other idle RPG in this genre does this at the plugin level.

- [x] Create `EventPlugin`
  - [x] Table of 10 events tied to stage milestones (stage 5, 10, 25, 50, 75, 100, 150, 200, 300, 500)
  - [x] Each event: title, flavor text (lore), buff type (`DOUBLE_GOLD / DOUBLE_TAP / FREE_SPELLS`), duration (60–300s)
  - [x] Active buff is applied multiplicatively in `onTick`
  - [x] State: `{ seenEvents: [], activeEvent: null, activeBuffExpiry: 0 }`
  - [x] Fires on `onTick` when `state.level` matches a threshold and hasn't been seen
  - [x] `getActionMetadata()` returns active event + remaining buff time
- [x] Event UI
  - [x] Full-screen modal pop-up with event title + flavor text + buff announcement
  - [x] Persists in a log accessible via "Intel Log" mini-tab
- [x] Export and wire into both apps

---

## 8. Accessibility & Retention Polish
- [x] Add "Return bonus" — if offline > 2 hours, show a "welcome back" screen with offline gains summary
- [x] Add session play time tracker in `AdaptiveModule` or standalone — show total play time in stats
- [x] Add "New!" badge on tabs that have unread content (new gear dropped, mission available, etc.)
- [x] Add settings option to disable haptics independently of sound
- [x] Add a minimal "Stats" tab showing lifetime stats: total taps, total gold earned, total kills, time played

---

## Engine / Infra Changes Required
- [x] `BaseTypes.ts`: add `comboCount`, `lastTapTime` to `AdaptiveModuleState` (minor state extension)
- [x] `BaseTypes.ts`: add `missionProgress` partial tracking hook in dispatch (or handle fully in plugin)
- [x] `GameEngine.ts`: no changes needed — plugins are self-contained

---

## Prioritized Implementation Order
1. **Network Nodes** (fills the idle income gap — most impactful for playability)
2. **Daily Missions** (immediate retention driver)
3. **Combo System** (zero-risk, high-feel improvement)
4. **Skill Tree** (strategic depth, unlocked by prestige — meaningful decision)
5. **Boss Rush** (combat tension and milestone excitement)
6. **Narrative Events** (innovation, lore, differentiation)
7. **Leaderboard** (social layer, needs Supabase setup)
8. **Polish** (return bonus, stats tab, badges)

---

## Success Criteria
- A new player can meaningfully progress for 30 minutes without hitting a wall
- Returning after 8 hours of offline feels rewarding (Network Nodes passive income)
- Each prestige feels like a meaningful reset with clear forward progress (Skill Tree)
- Daily sessions have a purpose beyond "check in and tap" (Missions)
- The boss system creates at least 3 moments of genuine tension per hour

---

# Phase 5 — Depth, Identity, and Live World

## 1. Stats Plugin (`packages/core/StatsPlugin.ts`)
- [x] Create `StatsPlugin` tracking lifetime stats in plugin state
  - [x] Tracks: `totalTaps`, `totalGoldEarned`, `totalKills`, `totalSecondsPlayed`, `totalBossesDefeated`, `totalMissionsClaimed`, `totalPrestiges`
  - [x] Increments via `onTick` (seconds played), `onKill`, and `onAction` (tap/prestige/mission intercepts)
- [x] Lifetime Stats grid shown in Progression tab on web board
- [x] Export from `packages/core/index.ts`

---

## 2. Narrative Events System (`packages/core/EventPlugin.ts`)
- [x] Create `EventPlugin`
  - [x] Table of 10 events tied to stage milestones (5, 10, 25, 50, 75, 100, 150, 200, 300, 500)
  - [x] Each event: title, AI-empire flavor text, buff type (`DOUBLE_GOLD / DOUBLE_TAP / FREE_SPELLS`), duration (90–600s)
  - [x] State: `{ seenEvents, activeEvent, activeBuffExpiry, pendingEvent, eventLog }`
  - [x] Fires in `onTick` when `state.level` matches a threshold not yet seen
  - [x] Actions: `ACTIVATE_EVENT`, `DISMISS_EVENT`
- [x] Event UI: full-screen modal with lore text, buff label, and activate/dismiss buttons
- [x] Active buff banner shown on Core tab while buff is running
- [x] Intel Log section in Progression tab showing past events with dates
- [x] Export from `packages/core/index.ts` and wired into web app

---

## 3. Leaderboard Plugin + Supabase Backend (`packages/core/LeaderboardPlugin.ts`)
- [x] Create `leaderboard` Supabase table (`user_id`, `stage`, `prestige_cores`, `monsters_defeated`, `updated_at`)
  - [x] RLS: authenticated users write only their own row; all authenticated users can read top rows
- [x] Deploy Supabase Edge Function `submit-score` — GET returns top 10, POST upserts player row
- [x] Create `LeaderboardPlugin`
  - [x] Opt-in (disabled by default); submits every 5 min when enabled
  - [x] Fetches top-10 on enable and every 10 min
  - [x] State: `{ enabled, myRank, topPlayers, loading, error }`
  - [x] Actions: `TOGGLE_LEADERBOARD`, `_LEADERBOARD_RESULT` (internal)
- [x] Leaderboard tab in web board (rankings list, player row highlighted, opt-in toggle)
- [x] Export from `packages/core/index.ts` and wired into web app

---

## 4. Return Bonus Plugin (`packages/core/ReturnPlugin.ts`)
- [x] Create `ReturnPlugin` that detects offline gaps >= 2 hours on `onInit`
  - [x] Calculates network income earned while away (capped at 8h)
  - [x] Detects if daily missions reset during absence
  - [x] State: `{ lastSeenAt, pendingBonus }`
  - [x] Action: `DISMISS_BONUS`
  - [x] Updates `lastSeenAt` every 30s during active play
- [x] Welcome-back overlay on web board: shows time away, gold earned, missions-reset notice
- [x] Export from `packages/core/index.ts` and wired into web app

---

## 5. Tab Badge Indicators (web `App.tsx`)
- [x] Red dot badge on Combat tab when boss is active
- [x] Red dot badge on Network tab when a mission is ready to claim
- [x] Badges clear when the player visits the tab

---

## Engine / Infra Changes
- [x] No changes to `GameEngine.ts` or `BaseTypes.ts` required — all new behavior in new plugin files
- [x] Supabase `leaderboard` table created with RLS
- [x] Edge Function `submit-score` deployed

---

## Success Criteria
- Player returning after 2+ hours sees a meaningful recap screen
- Reaching stage 5 triggers the first narrative event with an activatable buff
- Opting into the leaderboard submits scores automatically without user action
- Lifetime stats are visible at a glance in the Progression tab