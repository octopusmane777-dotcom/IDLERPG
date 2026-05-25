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

# Plan PHASE 4: Fun, retention & innovation

## Goal
Transform the game from a tech demo into something genuinely fun. Phase 4 focuses on three pillars:
1. **Retention loops** — reasons to come back every session
2. **Decision depth** — meaningful choices that reward strategy
3. **Innovation** — mechanics that set this game apart from standard idle clones

---

## 1. Skill Tree (`packages/core/SkillTreePlugin.ts`)
**The problem:** upgrades are linear. Players never make meaningful decisions.
**The fix:** a branching skill tree where each prestige unlocks 1 skill point to spend on permanent paths.

- [ ] Create `SkillTreePlugin`
  - [ ] Three branches: `HACK` (tap/spell power), `INFRA` (auto DPS, energy cap), `GHOST` (gold multiplier, equipment drop rate)
  - [ ] Each branch has 5 nodes; each node costs 1 skill point and has a prerequisite
  - [ ] Bonuses applied multiplicatively in `AdaptiveModule` and `EnergyPlugin` via shared state read
  - [ ] Action: `UNLOCK_SKILL` — validates point budget and prerequisites
  - [ ] `getActionMetadata()` returns tree structure, unlocked nodes, available points
- [ ] Skill tree UI in Expo app
  - [ ] New tab "Skill Tree" in bottom drawer
  - [ ] Visual tree with nodes (locked/available/unlocked) and branch lines
  - [ ] Each node shows name, description, cost, and bonus value
- [ ] Export from `packages/core/index.ts` and wire into both apps

---

## 2. Daily Mission System (`packages/core/MissionPlugin.ts`)
**The problem:** no reason to return daily. Sessions have no narrative purpose.
**The fix:** 3 rotating daily missions that refresh every 24 hours and grant meaningful rewards.

- [ ] Create `MissionPlugin`
  - [ ] Pool of 12+ mission templates: "Deal 1000 tap damage", "Kill 50 enemies", "Cast 10 spells", "Reach stage X", "Spend Y compute on upgrades", "Prestige once", etc.
  - [ ] Each day: deterministically pick 3 missions using `Math.floor(Date.now() / 86400000)` as seed
  - [ ] Track per-mission progress in plugin state; check completion on `onTick` and `onAction`
  - [ ] Rewards: compute shards (new sub-currency), skill points, or large gold lump sums
  - [ ] `getActionMetadata()` returns missions array with id, description, progress, target, reward, completed
  - [ ] Action: `CLAIM_MISSION` — marks claimed, grants reward; prevents double-claim
- [ ] Mission UI
  - [ ] New tab "Missions" in bottom drawer (or mini-card above monster area)
  - [ ] 3 mission rows with progress bars and claim buttons
  - [ ] Countdown timer to next reset
- [ ] Export from `packages/core/index.ts` and wire into both apps

---

## 3. Boss Rush Mode (`packages/core/BossPlugin.ts`)
**The problem:** combat is passive and never tense. Players tap without stakes.
**The fix:** optional high-stakes boss fights that appear every 10 stages with a 30-second timer. Kill it for massive rewards; fail and lose nothing.

- [ ] Create `BossPlugin`
  - [ ] Every 10 stage kills triggers a boss spawn (tracked in plugin state)
  - [ ] Boss has 10× normal HP and a 30-second window to kill it (`bossTimer` countdown in `onTick`)
  - [ ] Boss rewards: `3× gold` + guaranteed rare equipment drop + +1 skill point
  - [ ] If timer expires, boss retreats silently — no penalty
  - [ ] State: `{ bossActive, bossHp, bossMaxHp, bossTimer, bossesDefeated }`
  - [ ] Integrates with `AdaptiveModule`: `TAP_DAMAGE` and spell actions route through `BossPlugin` when boss is active
  - [ ] `getActionMetadata()` returns boss state for UI
- [ ] Boss UI in monster area
  - [ ] Boss indicator replaces normal enemy (different emoji + "BOSS" label + red HP bar)
  - [ ] Countdown timer displayed prominently
  - [ ] Screen flash / haptic on boss spawn
- [ ] Export from `packages/core/index.ts` and wire into both apps

---

## 4. Idle Income Overhaul — "Network Nodes" (`packages/core/NetworkPlugin.ts`)
**The problem:** passive income (`generationRates`) is locked to 0; the only income source is killing. This makes offline progress nearly zero and early-game sessions feel empty.
**The fix:** purchasable "Network Nodes" (think: generators in Cookie Clicker) that produce compute passively. Separate from the `generationRates` system — they live entirely in plugin state.

- [ ] Create `NetworkPlugin`
  - [ ] 5 node types: Bot Farm (cheap, slow), Scraper Array, Proxy Cluster, AI Server, Quantum Core (expensive, fast)
  - [ ] Each type has a base rate and a count; total output = Σ(count × rate) per second
  - [ ] Prices double every purchase (classic idle formula)
  - [ ] Output applied in `onTick` as compute added to resources
  - [ ] Action: `BUY_NODE` — validates gold, deducts cost, increments count
  - [ ] `getActionMetadata()` returns node array with name, count, cost, rate, totalOutput
- [ ] Network UI
  - [ ] Replace "System Upgrades" tab content with combined: existing upgrades (tap/level) + node purchase list below
  - [ ] Each node row: name, owned count, rate/sec, next cost, buy button
- [ ] Export from `packages/core/index.ts` and wire into both apps
- [ ] Update `doc.md` passive income section

---

## 5. Combo / Chain System (UI-side, no new plugin needed)
**The problem:** tapping feels mechanical. There's no skill expression.
**The fix:** a combo multiplier that builds up with rapid taps and decays when idle. Pure UI/state logic.

- [ ] Track `comboCount` and `comboMultiplier` in `AdaptiveModule` state
  - [ ] Each `TAP_DAMAGE` within 1.5 seconds increments `comboCount` (cap: 20)
  - [ ] `comboMultiplier = 1 + comboCount * 0.1` applied to tap damage
  - [ ] `comboCount` resets to 0 if 1.5s passes without a tap (tracked via `lastTapTime` in plugin state)
  - [ ] Update `onAction` and `onTick` in `AdaptiveModule`
- [ ] Combo UI
  - [ ] Combo counter above monster ("×1.5 COMBO!" when active)
  - [ ] Color shifts from white → yellow → orange → red at milestone counts
  - [ ] Burst animation pulse on the monster area at max combo

---

## 6. Leaderboard / Soft Social (`packages/core/LeaderboardPlugin.ts` + Edge Function)
**The problem:** no social proof or external motivation.
**The fix:** anonymous opt-in leaderboard — top players by stage, prestige cores, and monsters defeated. Stored in Supabase.

- [ ] Create `leaderboard` Supabase table
  - [ ] Columns: `user_id`, `stage`, `prestige_cores`, `monsters_defeated`, `updated_at`
  - [ ] RLS: each user can only write their own row; anyone can read top 50
- [ ] Deploy Supabase Edge Function `submit-score` that upserts a player's score
- [ ] Create `LeaderboardPlugin`
  - [ ] Opt-in (disabled by default); submits score to edge function every 5 minutes when enabled
  - [ ] Fetches top-10 leaderboard on enable and every 10 minutes
  - [ ] Stores `{ enabled, myRank, topPlayers: [{rank,stage,cores,defeated}] }` in plugin state
  - [ ] Action: `TOGGLE_LEADERBOARD`
- [ ] Leaderboard UI tab in both apps
  - [ ] Ranked list (top 10 anonymous entries)
  - [ ] Player's own rank highlighted
  - [ ] Opt-in toggle with privacy notice
- [ ] Export and wire into both apps

---

## 7. Narrative Events System (`packages/core/EventPlugin.ts`)
**The innovation:** scripted "world events" that fire at milestone stages — flavor text + temporary buffs. No other idle RPG in this genre does this at the plugin level.

- [ ] Create `EventPlugin`
  - [ ] Table of 10 events tied to stage milestones (stage 5, 10, 25, 50, 75, 100, 150, 200, 300, 500)
  - [ ] Each event: title, flavor text (lore), buff type (`DOUBLE_GOLD / DOUBLE_TAP / FREE_SPELLS`), duration (60–300s)
  - [ ] Active buff is applied multiplicatively in `onTick`
  - [ ] State: `{ seenEvents: [], activeEvent: null, activeBuffExpiry: 0 }`
  - [ ] Fires on `onTick` when `state.level` matches a threshold and hasn't been seen
  - [ ] `getActionMetadata()` returns active event + remaining buff time
- [ ] Event UI
  - [ ] Full-screen modal pop-up with event title + flavor text + buff announcement
  - [ ] Persists in a log accessible via "Intel Log" mini-tab
- [ ] Export and wire into both apps

---

## 8. Accessibility & Retention Polish
- [ ] Add "Return bonus" — if offline > 2 hours, show a "welcome back" screen with offline gains summary
- [ ] Add session play time tracker in `AdaptiveModule` or standalone — show total play time in stats
- [ ] Add "New!" badge on tabs that have unread content (new gear dropped, mission available, etc.)
- [ ] Add settings option to disable haptics independently of sound
- [ ] Add a minimal "Stats" tab showing lifetime stats: total taps, total gold earned, total kills, time played

---

## Engine / Infra Changes Required
- [ ] `BaseTypes.ts`: add `comboCount`, `lastTapTime` to `AdaptiveModuleState` (minor state extension)
- [ ] `BaseTypes.ts`: add `missionProgress` partial tracking hook in dispatch (or handle fully in plugin)
- [ ] `GameEngine.ts`: no changes needed — plugins are self-contained

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