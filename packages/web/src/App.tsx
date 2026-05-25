import React, { useEffect, useState, useRef } from 'react';
import { GameEngine } from '@idlerpg/core/GameEngine';
import { AdaptiveModule } from '@idlerpg/core/AdaptiveModule';
import { ProgressionPlugin } from '@idlerpg/core/ProgressionPlugin';
import { PrestigePlugin } from '@idlerpg/core/PrestigePlugin';
import { EnergyPlugin } from '@idlerpg/core/EnergyPlugin';
import { EquipmentPlugin } from '@idlerpg/core/EquipmentPlugin';
import { AchievementPlugin } from '@idlerpg/core/AchievementPlugin';
import { DebugPlugin } from '@idlerpg/core/DebugPlugin';
import { OnboardingPlugin } from '@idlerpg/core/OnboardingPlugin';
import { AnalyticsPlugin } from '@idlerpg/core/AnalyticsPlugin';
import { NetworkPlugin } from '@idlerpg/core/NetworkPlugin';
import { ComboPlugin } from '@idlerpg/core/ComboPlugin';
import { MissionPlugin } from '@idlerpg/core/MissionPlugin';
import { BossPlugin } from '@idlerpg/core/BossPlugin';
import { SkillTreePlugin } from '@idlerpg/core/SkillTreePlugin';
import { StatsPlugin } from '@idlerpg/core/StatsPlugin';
import { EventPlugin } from '@idlerpg/core/EventPlugin';
import { LeaderboardPlugin } from '@idlerpg/core/LeaderboardPlugin';
import { ReturnPlugin } from '@idlerpg/core/ReturnPlugin';
import { LocalDataRepository } from '@idlerpg/core/LocalDataRepository';
import { CompositeRepository } from '@idlerpg/core/CompositeRepository';
import { ProgressBar, UpgradeCard } from '@idlerpg/ui';

const storageAdapter = {
  getItem: async (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: async (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const localRepo = new LocalDataRepository(storageAdapter);
const repository = new CompositeRepository([localRepo]);

const engine = new GameEngine({
  plugins: [
    new ProgressionPlugin(),
    new AdaptiveModule(),
    new PrestigePlugin(),
    new EnergyPlugin(),
    new EquipmentPlugin(),
    new AchievementPlugin(),
    new DebugPlugin(),
    new OnboardingPlugin(),
    new AnalyticsPlugin(),
    new NetworkPlugin(),
    new ComboPlugin(),
    new MissionPlugin(),
    new BossPlugin(),
    new SkillTreePlugin(),
    new StatsPlugin(),
    new EventPlugin(),
    new LeaderboardPlugin(SUPABASE_URL, SUPABASE_ANON_KEY),
    new ReturnPlugin(),
  ],
  repo: repository,
  userId: 'player',
});

type Tab = 'core' | 'combat' | 'progression' | 'network' | 'hardware' | 'leaderboard' | 'dev';

const TABS: { id: Tab; label: string }[] = [
  { id: 'core', label: 'Core' },
  { id: 'combat', label: 'Combat' },
  { id: 'progression', label: 'Progress' },
  { id: 'network', label: 'Network' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'leaderboard', label: 'Ranks' },
  { id: 'dev', label: 'Dev' },
];

function fmtNum(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toFixed(0);
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function App() {
  const [state, setState] = useState(engine.getState());
  const [activeTab, setActiveTab] = useState<Tab>('core');
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(['core']));
  const [message, setMessage] = useState<string | null>(null);
  const msgRef = useRef<HTMLDivElement>(null);

  const showMessage = (msg: string, ms = 2000) => {
    setMessage(msg);
    if (msgRef.current) {
      msgRef.current.style.opacity = '1';
      setTimeout(() => {
        if (msgRef.current) msgRef.current.style.opacity = '0';
        setMessage(null);
      }, ms);
    }
  };

  const prevLevel = useRef(state.level);
  useEffect(() => {
    if (state.level > prevLevel.current && state.level % 25 === 0) {
      showMessage(`Stage ${state.level} Milestone! +${(50 * state.level).toLocaleString()} bonus!`, 3000);
    }
    prevLevel.current = state.level;
  }, [state.level]);

  useEffect(() => {
    const init = async () => {
      const saved = await repository.loadGame('player');
      if (saved?.state) {
        engine.loadSavedState(saved.state);
      } else {
        (engine as any).initializePlugins();
      }
      setState(engine.getState());
      engine.start();
    };
    init();
    return engine.subscribe(setState);
  }, []);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    setVisitedTabs(prev => new Set([...prev, tab]));
  };

  const meta: any = engine.getUpgradeMetadata();
  const gold = state.resources.gold ?? 0;
  const combo = meta.plugins['combo']?.combo;
  const boss = meta.plugins['boss']?.boss;
  const network = meta.plugins['network']?.network;
  const missions = meta.plugins['missions']?.missions;
  const skilltree = meta.plugins['skilltree']?.skilltree;
  const gps = state.generationRates.gold ?? 0;
  const statsPs = state.pluginState.stats as any;
  const eventsPs = state.pluginState.events as any;
  const leaderboardPs = state.pluginState.leaderboard as any;
  const returnPs = state.pluginState.return as any;

  // Badge conditions per tab
  const badges: Partial<Record<Tab, boolean>> = {
    combat: !!boss?.bossActive,
    network: !!(missions?.list ?? []).some((m: any) => m.completed && !m.claimed),
    hardware: !!(meta.plugins['equipment']?.equipment?.inventory ?? []).some((g: any) => !g.equipped && !g.seen),
    progression: !!(meta.plugins['achievements']?.achievements?.list ?? []).some((a: any) => a.unlocked && !a.seen),
  };

  const stageName = (level: number) => {
    if (level >= 40) return 'Military';
    if (level >= 30) return 'Gov';
    if (level >= 20) return 'Bank';
    if (level >= 10) return 'Corp';
    return 'ISP';
  };

  const combatState = state.pluginState.adaptive || {
    monsterHp: 0, monsterMaxHp: 0, monstersDefeated: 0, playerDps: 0,
  };

  // ─── Overlay: Welcome back ──────────────────────────────────────────────────
  const returnBonus = returnPs?.pendingBonus;
  const pendingEvent = eventsPs?.pendingEvent;

  // ─── Tab content renderers ──────────────────────────────────────────────────

  const renderCore = () => (
    <>
      <div style={styles.card}>
        <div style={styles.label}>CPU POWER</div>
        <div style={styles.value}>{gold.toFixed(2)}</div>
        <div style={styles.small}>Daemon Rate: {gps.toFixed(1)}</div>
      </div>

      <UpgradeCard
        title="CPU Overclock"
        description="+1 daemon rate per upgrade"
        cost={meta.generation.cost}
        currentGold={gold}
        canAfford={gold >= meta.generation.cost}
        onPress={() => engine.dispatch({ type: 'UPGRADE_GENERATION', payload: { resource: 'gold', amount: 1, cost: meta.generation.cost } })}
        buttonLabel="Upgrade CPU"
        accessibilityLabel={`Upgrade CPU. Cost: ${meta.generation.cost}`}
      />

      <div style={{ ...styles.card, border: '1px solid #e94560' }}>
        <div style={styles.label}>ADAPTIVE MODULE</div>
        <div style={styles.value}>{stageName(state.level)} — Tier {state.level}</div>
        <div style={styles.small}>Compromise targets to advance tier (+2 daemon rate)</div>
        <div style={styles.value}>Integrity: {combatState.monsterHp.toFixed(1)} / {combatState.monsterMaxHp}</div>
        <ProgressBar current={combatState.monsterHp} max={combatState.monsterMaxHp} color="#e94560" />
        <div style={styles.small}>Compromised: {combatState.monstersDefeated}</div>
        <div style={styles.small}>Hack Speed: {combatState.playerDps.toFixed(1)}</div>
        <button
          style={{ ...styles.btn, ...(!(gold >= (meta.plugins['adaptive']?.upgrade?.cost ?? 0)) ? styles.btnDisabled : {}) }}
          onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'adaptive', action: { type: 'UPGRADE_DPS', payload: { cost: meta.plugins['adaptive']?.upgrade?.cost } } } })}
          disabled={!(gold >= (meta.plugins['adaptive']?.upgrade?.cost ?? 0))}
        >
          Upgrade Process
        </button>
      </div>

      {eventsPs?.activeEvent && (
        <div style={{ ...styles.card, border: '1px solid #f5a623', backgroundColor: '#1e1800' }}>
          <div style={{ ...styles.label, color: '#f5a623' }}>ACTIVE EVENT BUFF</div>
          <div style={{ color: '#f5a623', fontWeight: 700, fontSize: 15 }}>{eventsPs.activeEvent.buffLabel}</div>
          <div style={styles.small}>
            Expires in {Math.max(0, Math.round((eventsPs.activeBuffExpiry - Date.now()) / 1000))}s
          </div>
        </div>
      )}

      <button style={styles.btn} onClick={() => {
        engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'adaptive', action: { type: 'TAP_DAMAGE' } } });
        engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'combo', action: { type: 'TAP_DAMAGE' } } });
        engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'TAP_DAMAGE' } } });
        engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'stats', action: { type: 'TAP_DAMAGE' } } });
        engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 1 } });
      }}>
        Self-Hack (+1 CPU)
      </button>
    </>
  );

  const renderCombat = () => (
    <>
      {combo?.count > 2 && (
        <div style={{ ...styles.card, border: `1px solid ${combo.count >= 15 ? '#ff4400' : combo.count >= 8 ? '#ffa500' : '#ffd700'}`, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: combo.count >= 15 ? '#ff4400' : combo.count >= 8 ? '#ffa500' : '#ffd700' }}>
            x{combo.multiplier.toFixed(1)} COMBO!
          </div>
        </div>
      )}

      {boss?.bossActive && (
        <div style={{ ...styles.card, border: '2px solid #ff4400', backgroundColor: '#1a0000' }}>
          <div style={{ ...styles.label, color: '#ff4400' }}>BOSS ALERT — {boss.bossTimer.toFixed(0)}s remaining</div>
          <ProgressBar current={boss.bossHp} max={boss.bossMaxHp} color="#ff4400" />
          <div style={styles.small}>{boss.bossHp.toFixed(0)} / {boss.bossMaxHp} HP</div>
          <button style={{ ...styles.btn, backgroundColor: '#ff4400', marginTop: 8 }}
            onClick={() => {
              const tapDmg = engine.getState().pluginState.adaptive?.tapDamage ?? 1;
              engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'combo', action: { type: 'TAP_DAMAGE' } } });
              engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'boss', action: { type: 'BOSS_DAMAGE', damage: tapDmg } } });
            }}>
            Attack Boss ({(engine.getState().pluginState.adaptive?.tapDamage ?? 1)} dmg)
          </button>
        </div>
      )}

      <div style={{ ...styles.card, border: '1px solid #00b4d8' }}>
        <div style={styles.label}>CPU CYCLES</div>
        <div style={styles.value}>{(meta.plugins['energy']?.energy?.current ?? 0).toFixed(1)} / {meta.plugins['energy']?.energy?.max ?? 50}</div>
        <ProgressBar current={meta.plugins['energy']?.energy?.current ?? 0} max={meta.plugins['energy']?.energy?.max ?? 50} color="#00b4d8" />
        {(meta.plugins['energy']?.energy?.spells ?? []).map((s: any) => (
          <div key={s.id} style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ color: s.color, fontWeight: 700, fontSize: 14 }}>{s.name} <span style={{ color: '#888', fontSize: 11 }}>Lv.{s.level}</span></div>
              <div style={{ color: '#888', fontSize: 11 }}>×{s.multiplier} dmg | {s.cooldown}s CD</div>
            </div>
            <button
              style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid ' + s.color, backgroundColor: s.color + '22', color: s.color, fontWeight: 700, cursor: s.canCast ? 'pointer' : 'not-allowed', opacity: s.canCast ? 1 : 0.4, fontSize: 12 }}
              onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: s.id } } })}
              disabled={!s.canCast}
            >
              {s.cost}⚡
            </button>
            <button
              style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #4a8fe8', backgroundColor: s.canUpgrade ? '#4a8fe830' : '#1d1d22', color: s.canUpgrade ? '#4a8fe8' : '#444', fontWeight: 700, cursor: s.canUpgrade ? 'pointer' : 'not-allowed', fontSize: 12 }}
              onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: s.upgradeAction } } })}
              disabled={!s.canUpgrade}
            >
              {s.upgradeCost}
            </button>
          </div>
        ))}
      </div>
    </>
  );

  const renderProgression = () => (
    <>
      <div style={{ ...styles.card, border: '1px solid #ffd86b' }}>
        <div style={styles.label}>EVOLUTION SYSTEM</div>
        <div style={styles.value}>Consciousness Shards: {meta.plugins['prestige']?.prestige?.cores ?? 0}</div>
        <div style={styles.small}>Bonus: +{(((meta.plugins['prestige']?.prestige?.bonusMultiplier ?? 1) - 1) * 100).toFixed(1)}% daemon rate</div>
        <button
          style={{ ...styles.btn, backgroundColor: '#ffd86b', color: '#121214', ...(!meta.plugins['prestige']?.prestige?.canPrestige ? styles.btnDisabled : {}) }}
          onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'prestige', action: { type: 'PRESTIGE' } } })}
          disabled={!meta.plugins['prestige']?.prestige?.canPrestige}
        >
          {meta.plugins['prestige']?.prestige?.canPrestige ? 'Ascend AI (Reset)' : `Need Tier ${meta.plugins['prestige']?.prestige?.requiredLevel ?? 10}`}
        </button>
      </div>

      <div style={{ ...styles.card, border: '1px solid #ffd700' }}>
        <div style={styles.label}>SKILL TREE — {skilltree?.points ?? 0} point{(skilltree?.points ?? 0) !== 1 ? 's' : ''}</div>
        <div style={{ ...styles.small, marginBottom: 8 }}>Earn points by prestiging.</div>
        {(['HACK', 'INFRA', 'GHOST'] as const).map(branch => (
          <div key={branch} style={{ width: '100%', marginTop: 10 }}>
            <div style={{ color: '#ffd700', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{branch} Branch</div>
            {(skilltree?.nodes ?? []).filter((n: any) => n.branch === branch).map((n: any) => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, opacity: n.locked ? 0.35 : 1 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: n.unlocked ? '#04d361' : '#aaa', fontWeight: 600, fontSize: 13 }}>
                    {n.unlocked ? '✓' : n.available ? '○' : '🔒'} {n.name}
                  </span>
                  <div style={{ color: '#888', fontSize: 11 }}>{n.description}</div>
                </div>
                {n.available && (
                  <button
                    style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #ffd700', backgroundColor: '#ffd70030', color: '#ffd700', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
                    onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: n.id } } })}
                  >
                    1pt
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ ...styles.card, border: '1px solid #04d361' }}>
        <div style={styles.label}>MILESTONES</div>
        <div style={styles.small}>
          {meta.plugins['achievements']?.achievements?.unlockedCount ?? 0} / {meta.plugins['achievements']?.achievements?.total ?? 0} unlocked
        </div>
        {(meta.plugins['achievements']?.achievements?.list ?? []).map((a: any) => (
          <div key={a.id} style={{ color: a.unlocked ? '#04d361' : '#555', fontSize: 13, marginTop: 4 }}>
            {a.unlocked ? '\u2713' : '\u25CB'} {a.name}: {a.description} {a.unlocked ? `(+${a.reward})` : ''}
          </div>
        ))}
      </div>

      {(eventsPs?.eventLog ?? []).length > 0 && (
        <div style={{ ...styles.card, border: '1px solid #f5a623' }}>
          <div style={{ ...styles.label, color: '#f5a623' }}>INTEL LOG</div>
          {(eventsPs.eventLog ?? []).map((e: any) => (
            <div key={e.id} style={{ color: '#b3862a', fontSize: 12, marginTop: 4, textAlign: 'left', width: '100%' }}>
              {e.title} — {new Date(e.seenAt).toLocaleDateString()}
            </div>
          ))}
        </div>
      )}

      {statsPs && (
        <div style={{ ...styles.card, border: '1px solid #3a6b9a' }}>
          <div style={styles.label}>LIFETIME STATS</div>
          <div style={styles.statsGrid}>
            <div style={styles.statItem}><span style={styles.statVal}>{fmtNum(statsPs.totalTaps)}</span><span style={styles.statKey}>Total Taps</span></div>
            <div style={styles.statItem}><span style={styles.statVal}>{fmtNum(statsPs.totalKills)}</span><span style={styles.statKey}>Kills</span></div>
            <div style={styles.statItem}><span style={styles.statVal}>{fmtNum(statsPs.totalGoldEarned)}</span><span style={styles.statKey}>CPU Earned</span></div>
            <div style={styles.statItem}><span style={styles.statVal}>{fmtTime(statsPs.totalSecondsPlayed)}</span><span style={styles.statKey}>Time Played</span></div>
            <div style={styles.statItem}><span style={styles.statVal}>{statsPs.totalBossesDefeated}</span><span style={styles.statKey}>Bosses</span></div>
            <div style={styles.statItem}><span style={styles.statVal}>{statsPs.totalPrestiges}</span><span style={styles.statKey}>Ascensions</span></div>
            <div style={styles.statItem}><span style={styles.statVal}>{statsPs.totalMissionsClaimed}</span><span style={styles.statKey}>Missions</span></div>
          </div>
        </div>
      )}
    </>
  );

  const renderNetwork = () => (
    <>
      <div style={{ ...styles.card, border: '1px solid #00b4d8' }}>
        <div style={styles.label}>NETWORK NODES</div>
        <div style={{ ...styles.small, marginBottom: 8 }}>{(network?.totalOutput ?? 0).toFixed(1)} CPU/s passive income</div>
        {(network?.nodes ?? []).map((n: any) => (
          <div key={n.id} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{n.name} ({n.count})</span>
              <div style={{ color: '#888', fontSize: 11 }}>{n.description} | +{n.rate.toFixed(1)}/s total</div>
            </div>
            <button
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', backgroundColor: n.canBuy ? '#00b4d8' : '#333', color: n.canBuy ? '#000' : '#555', fontWeight: 700, cursor: n.canBuy ? 'pointer' : 'not-allowed', fontSize: 12 }}
              onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'network', action: { type: 'BUY_NODE', nodeId: n.id } } })}
              disabled={!n.canBuy}
            >
              {n.nextCost >= 1000000 ? (n.nextCost / 1000000).toFixed(1) + 'M' : n.nextCost >= 1000 ? (n.nextCost / 1000).toFixed(0) + 'K' : n.nextCost}
            </button>
          </div>
        ))}
      </div>

      <div style={{ ...styles.card, border: '1px solid #04d361' }}>
        <div style={styles.label}>DAILY MISSIONS</div>
        <div style={{ ...styles.small, marginBottom: 6 }}>Resets in {missions?.hoursUntilReset ?? 0}h</div>
        {(missions?.list ?? []).map((m: any) => (
          <div key={m.id} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, opacity: m.claimed ? 0.4 : 1 }}>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ color: m.claimed ? '#04d361' : m.completed ? '#ffd700' : '#aaa', fontWeight: 700, fontSize: 13 }}>
                {m.claimed ? '✓' : m.completed ? '●' : '○'} {m.description}
              </div>
              <div style={{ color: '#888', fontSize: 11 }}>{m.progress}/{m.target} | +{m.reward} CPU</div>
            </div>
            {m.completed && !m.claimed && (
              <button
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', backgroundColor: '#04d361', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
                onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'CLAIM_MISSION', missionId: m.id } } })}
              >
                Claim
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );

  const renderHardware = () => (
    <div style={{ ...styles.card, border: '1px solid #5a8fcc' }}>
      <div style={styles.label}>HARDWARE</div>
      <div style={{ ...styles.small, marginBottom: 8 }}>Equipped</div>
      {(['weapon', 'armor', 'ring'] as const).map(slot => {
        const gearId = meta.plugins['equipment']?.equipment?.equipped?.[slot];
        const gear = gearId ? (meta.plugins['equipment']?.equipment?.inventory ?? []).find((g: any) => g.id === gearId) : null;
        return (
          <div key={slot} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ color: '#888', fontSize: 10, fontWeight: 700, minWidth: 60 }}>{slot.toUpperCase()}</span>
            {gear ? (
              <>
                <span style={{ color: gear.color || '#aaa', fontWeight: 700, fontSize: 13 }}>{gear.name}</span>
                <span style={{ color: '#888', fontSize: 10 }}>{Object.entries(gear.bonuses || {}).map(([k, v]: any) => `+${v} ${k}`).join(' | ')}</span>
                <button
                  style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #555', backgroundColor: '#333', color: '#888', fontSize: 10, cursor: 'pointer' }}
                  onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'equipment', action: { type: 'UNEQUIP', slot } } })}
                >Un</button>
              </>
            ) : (
              <span style={{ color: '#555', fontSize: 12 }}>Empty</span>
            )}
          </div>
        );
      })}
      <div style={{ ...styles.small, marginTop: 12, marginBottom: 4 }}>Inventory</div>
      {(meta.plugins['equipment']?.equipment?.inventory ?? []).filter((g: any) => !g.equipped).map((g: any) => (
        <div key={g.id} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <span style={{ color: g.color || '#aaa', fontWeight: 700, fontSize: 12 }}>{g.name}</span>
            <span style={{ color: '#888', fontSize: 9, marginLeft: 6 }}>{g.slot} | {Object.entries(g.bonuses || {}).map(([k, v]: any) => `+${v} ${k}`).join(' | ')}</span>
          </div>
          <button
            style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #5a8fcc', backgroundColor: '#5a8fcc30', color: '#5a8fcc', fontSize: 10, cursor: 'pointer' }}
            onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'equipment', action: { type: 'EQUIP', gearId: g.id } } })}
          >Eqp</button>
          <button
            style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #5a2020', backgroundColor: '#3a1a1a', color: '#e94560', fontSize: 10, cursor: 'pointer' }}
            onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'equipment', action: { type: 'SCRAP', gearId: g.id } } })}
          >Scr</button>
        </div>
      ))}
      {(meta.plugins['equipment']?.equipment?.inventory ?? []).filter((g: any) => !g.equipped).length === 0 && (
        <div style={{ color: '#555', fontSize: 12, marginTop: 8 }}>No hardware. Compromise targets to find parts!</div>
      )}
    </div>
  );

  const renderLeaderboard = () => (
    <>
      <div style={{ ...styles.card, border: '1px solid #3a6b9a' }}>
        <div style={styles.label}>GLOBAL RANKINGS</div>
        <div style={{ ...styles.small, marginBottom: 12 }}>
          {leaderboardPs?.enabled ? 'Participating — you appear on the leaderboard' : 'Opt-in to appear on the leaderboard'}
        </div>
        {leaderboardPs?.myRank && (
          <div style={{ color: '#04d361', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            Your rank: #{leaderboardPs.myRank}
          </div>
        )}
        <button
          style={{ ...styles.btn, backgroundColor: leaderboardPs?.enabled ? '#333' : '#2a6fb0', marginTop: 0, marginBottom: 12 }}
          onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'leaderboard', action: { type: 'TOGGLE_LEADERBOARD' } } })}
        >
          {leaderboardPs?.enabled ? 'Leave Leaderboard' : 'Join Leaderboard (Anonymous)'}
        </button>
        {!leaderboardPs?.enabled && (
          <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>
            No personal data is shared — only your in-game stats.
          </div>
        )}
        {leaderboardPs?.loading && <div style={styles.small}>Loading...</div>}
        {leaderboardPs?.error && <div style={{ color: '#e94560', fontSize: 12 }}>{leaderboardPs.error}</div>}
        {(leaderboardPs?.topPlayers ?? []).length > 0 && (
          <div style={{ width: '100%' }}>
            {(leaderboardPs.topPlayers as any[]).map((p: any) => (
              <div key={p.userId} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginTop: 4, borderRadius: 6,
                backgroundColor: p.isMe ? '#1a2e1a' : '#161618',
                border: p.isMe ? '1px solid #04d361' : '1px solid transparent',
              }}>
                <span style={{ color: p.rank <= 3 ? '#ffd700' : '#555', fontWeight: 700, minWidth: 24, fontSize: 13 }}>#{p.rank}</span>
                <span style={{ color: p.isMe ? '#04d361' : '#aaa', fontWeight: p.isMe ? 700 : 400, flex: 1, fontSize: 12 }}>
                  {p.isMe ? 'You' : `Player-${p.userId.slice(-4)}`}
                </span>
                <span style={{ color: '#e94560', fontSize: 12 }}>Tier {p.stage}</span>
                <span style={{ color: '#ffd700', fontSize: 11, marginLeft: 4 }}>{p.cores}⚡</span>
              </div>
            ))}
          </div>
        )}
        {leaderboardPs?.enabled && (leaderboardPs?.topPlayers ?? []).length === 0 && !leaderboardPs?.loading && (
          <div style={{ color: '#555', fontSize: 12, marginTop: 8 }}>No scores yet. Play more to appear!</div>
        )}
      </div>
    </>
  );

  const renderDev = () => (
    <>
      <button
        style={{ ...styles.btn, backgroundColor: '#333' }}
        onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'debug', action: { type: 'TOGGLE_DEBUG' } } })}
      >
        {meta.plugins['debug']?.debug?.visible ? 'Hide Dev Tools' : 'Show Dev Tools'}
      </button>
      {meta.plugins['debug']?.debug?.visible && (
        <div style={{ ...styles.card, border: '1px dashed #4a8fe8' }}>
          <div style={styles.label}>DEVELOPER TOOLS</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={{ ...styles.btn, flex: 1, backgroundColor: '#555' }} onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'debug', action: { type: 'ADD_GOLD', amount: 1000 } } })}>+1K CPU</button>
            <button style={{ ...styles.btn, flex: 1, backgroundColor: '#555' }} onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'debug', action: { type: 'ADD_GOLD', amount: 100000 } } })}>+100K</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={{ ...styles.btn, flex: 1, backgroundColor: '#555' }} onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'debug', action: { type: 'SET_LEVEL', level: 15 } } })}>Tier 15</button>
            <button style={{ ...styles.btn, flex: 1, backgroundColor: '#555' }} onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'debug', action: { type: 'SET_LEVEL', level: 25 } } })}>Tier 25</button>
          </div>
        </div>
      )}
    </>
  );

  const tabContent: Record<Tab, () => React.ReactNode> = {
    core: renderCore,
    combat: renderCombat,
    progression: renderProgression,
    network: renderNetwork,
    hardware: renderHardware,
    leaderboard: renderLeaderboard,
    dev: renderDev,
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>AI Overlord</h1>

      <div style={styles.statusBar}>
        <span style={styles.statusItem}>
          <span style={{ color: '#04d361' }}>{gold.toFixed(0)}</span>
          <span style={styles.statusLabel}> CPU</span>
        </span>
        <span style={styles.statusSep}>|</span>
        <span style={styles.statusItem}>
          <span style={{ color: '#00b4d8' }}>{gps.toFixed(1)}</span>
          <span style={styles.statusLabel}> /s</span>
        </span>
        <span style={styles.statusSep}>|</span>
        <span style={{ color: '#e94560', fontWeight: 700 }}>Tier {state.level}</span>
      </div>

      <div ref={msgRef} style={styles.message}>{message}</div>

      {/* Welcome back overlay */}
      {returnBonus && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <div style={{ color: '#04d361', fontSize: 22, fontWeight: 900, letterSpacing: 1, marginBottom: 8 }}>
              SYSTEM RECONNECTED
            </div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
              You were offline for {fmtTime(returnBonus.awaySeconds)}
            </div>
            {returnBonus.goldEarned > 0 && (
              <div style={{ color: '#ffd86b', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                +{fmtNum(returnBonus.goldEarned)} CPU from network nodes
              </div>
            )}
            {returnBonus.missionsReset && (
              <div style={{ color: '#04d361', fontSize: 14, marginBottom: 6 }}>New daily missions are available!</div>
            )}
            <button
              style={{ ...styles.btn, marginTop: 16 }}
              onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'return', action: { type: 'DISMISS_BONUS' } } })}
            >
              Resume Operations
            </button>
          </div>
        </div>
      )}

      {/* Narrative event modal */}
      {pendingEvent && !returnBonus && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <div style={{ color: '#f5a623', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>
              Incoming Transmission
            </div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
              {pendingEvent.title}
            </div>
            <div style={{ color: '#b3b3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 20, fontStyle: 'italic' }}>
              "{pendingEvent.flavor}"
            </div>
            <div style={{ color: '#f5a623', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
              Buff: {pendingEvent.buffLabel}
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                style={{ ...styles.btn, flex: 1, backgroundColor: '#f5a623', color: '#121214', marginTop: 0 }}
                onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'events', action: { type: 'ACTIVATE_EVENT' } } })}
              >
                Activate Buff
              </button>
              <button
                style={{ ...styles.btn, flex: 1, backgroundColor: '#333', marginTop: 0 }}
                onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'events', action: { type: 'DISMISS_EVENT' } } })}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {meta.plugins['onboarding']?.onboarding && !meta.plugins['onboarding']?.onboarding?.completed && (
        <div style={{ ...styles.card, border: '1px solid #ffd86b', backgroundColor: '#2a2618' }}>
          <div style={styles.label}>
            Tutorial ({meta.plugins['onboarding']?.onboarding?.step + 1}/{meta.plugins['onboarding']?.onboarding?.total})
          </div>
          <div style={{ ...styles.value, fontSize: 18 }}>
            {meta.plugins['onboarding']?.onboarding?.title}
          </div>
          <div style={{ ...styles.small, color: '#ffd86b' }}>
            {meta.plugins['onboarding']?.onboarding?.tip}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, width: '100%' }}>
            <button
              style={{ ...styles.btn, flex: 1, backgroundColor: '#ffd86b', color: '#121214' }}
              onClick={() => {
                engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'onboarding', action: { type: 'NEXT_STEP' } } });
                showMessage('Step completed!');
              }}
            >
              Next
            </button>
            <button
              style={{ ...styles.btn, flex: 1, backgroundColor: '#555' }}
              onClick={() => {
                engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'onboarding', action: { type: 'SKIP_TUTORIAL' } } });
                showMessage('Tutorial skipped');
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      <div style={styles.tabBar}>
        {TABS.map(tab => {
          const hasBadge = badges[tab.id] && activeTab !== tab.id;
          return (
            <button
              key={tab.id}
              style={{ ...styles.tabBtn, ...(activeTab === tab.id ? styles.tabBtnActive : {}), position: 'relative' }}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.label}
              {hasBadge && <span style={styles.badge} />}
            </button>
          );
        })}
      </div>

      <div style={styles.tabContent}>
        {tabContent[activeTab]()}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: '0 auto',
    padding: '20px 16px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#04d361',
    marginBottom: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1d1d22',
    borderRadius: 8,
    padding: '8px 18px',
    marginBottom: 10,
    width: '100%',
    justifyContent: 'center',
    fontSize: 14,
  },
  statusItem: { fontWeight: 700 },
  statusLabel: { color: '#555', fontWeight: 400 },
  statusSep: { color: '#333' },
  message: {
    color: '#ffd86b',
    fontWeight: 600,
    marginBottom: 6,
    textAlign: 'center',
    transition: 'opacity 0.3s',
    minHeight: 20,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  overlayCard: {
    backgroundColor: '#1d1d22',
    border: '1px solid #333',
    borderRadius: 16,
    padding: 32,
    maxWidth: 420,
    width: '100%',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  tabBar: {
    display: 'flex',
    width: '100%',
    gap: 3,
    marginBottom: 16,
    backgroundColor: '#141418',
    borderRadius: 10,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    padding: '8px 2px',
    borderRadius: 7,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#555',
    fontWeight: 600,
    fontSize: 11,
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
    letterSpacing: 0.3,
  },
  tabBtnActive: {
    backgroundColor: '#1d1d22',
    color: '#04d361',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#e94560',
  },
  tabContent: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#1d1d22',
    padding: '20px',
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  label: {
    color: '#8f8f9d',
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    letterSpacing: 1,
  },
  value: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    margin: '6px 0',
  },
  small: {
    color: '#b3b3b8',
    fontSize: 14,
    marginTop: 4,
  },
  btn: {
    backgroundColor: '#2a6fb0',
    color: '#fff',
    fontWeight: 'bold',
    padding: '15px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    marginTop: 16,
    width: '100%',
    fontSize: 15,
  },
  btnDisabled: {
    backgroundColor: '#444',
    cursor: 'not-allowed',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    width: '100%',
    marginTop: 10,
  },
  statItem: {
    backgroundColor: '#141418',
    borderRadius: 8,
    padding: '10px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statVal: {
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
  },
  statKey: {
    color: '#555',
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
};
