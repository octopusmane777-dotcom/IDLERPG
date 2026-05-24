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
  ],
  repo: repository,
  userId: 'player',
});

export default function App() {
  const [state, setState] = useState(engine.getState());
  const [combatEnabled, setCombatEnabled] = useState(engine.isPluginEnabled('adaptive'));
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

  const meta: any = engine.getUpgradeMetadata();
  const gold = state.resources.gold ?? 0;
  const gps = state.generationRates.gold ?? 0;

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

  const handleToggleCombat = () => {
    engine.togglePlugin('adaptive', !combatEnabled);
    setCombatEnabled(!combatEnabled);
  };

  const stageEmoji = (level: number) => {
    if (level >= 40) return '⚔️';
    if (level >= 30) return '🏛️';
    if (level >= 20) return '💰';
    if (level >= 10) return '🏢';
    return '🔌';
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

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>AI Overlord</h1>
      <div ref={msgRef} style={styles.message}>{message}</div>

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
               style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #8257e5', backgroundColor: s.canUpgrade ? '#8257e530' : '#1d1d22', color: s.canUpgrade ? '#8257e5' : '#444', fontWeight: 700, cursor: s.canUpgrade ? 'pointer' : 'not-allowed', fontSize: 12 }}
               onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: s.upgradeAction } } })}
               disabled={!s.canUpgrade}
             >
               {s.upgradeCost}
             </button>
           </div>
         ))}
       </div>

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

      <button
        style={{ ...styles.btn, backgroundColor: '#333' }}
        onClick={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'debug', action: { type: 'TOGGLE_DEBUG' } } })}
      >
        {meta.plugins['debug']?.debug?.visible ? 'Hide Dev Tools' : 'Dev Tools'}
      </button>

      {meta.plugins['debug']?.debug?.visible && (
        <div style={{ ...styles.card, border: '1px dashed #8257e5' }}>
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

      <div style={{ ...styles.card, border: '1px solid #7b2ff7' }}>
        <div style={styles.label}>⚙️ HARDWARE</div>
        <div style={{ ...styles.small, marginBottom: 8 }}>Equipped</div>
        {(['weapon','armor','ring'] as const).map(slot => {
          const gearId = meta.plugins['equipment']?.equipment?.equipped?.[slot];
          const gear = gearId ? (meta.plugins['equipment']?.equipment?.inventory ?? []).find((g: any) => g.id === gearId) : null;
          return (
            <div key={slot} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ color: '#888', fontSize: 10, fontWeight: 700, minWidth: 60 }}>{slot.toUpperCase()}</span>
              {gear ? (
                <>
                  <span style={{ color: gear.color || '#aaa', fontWeight: 700, fontSize: 13 }}>{gear.name}</span>
                  <span style={{ color: '#888', fontSize: 10 }}>{Object.entries(gear.bonuses || {}).map(([k,v]: any) => `+${v} ${k}`).join(' | ')}</span>
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
              <span style={{ color: '#888', fontSize: 9, marginLeft: 6 }}>{g.slot} | {Object.entries(g.bonuses || {}).map(([k,v]: any) => `+${v} ${k}`).join(' | ')}</span>
            </div>
            <button
              style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #8257e5', backgroundColor: '#8257e530', color: '#8257e5', fontSize: 10, cursor: 'pointer' }}
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

      <button style={styles.btn} onClick={() => engine.dispatch({ type: 'INCREMENT_RESOURCE', payload: { resource: 'gold', amount: 1 } })}>
        Self-Hack (+1 CPU)
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '20px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#04d361',
    marginBottom: 20,
  },
  message: {
    color: '#ffd86b',
    fontWeight: 600,
    marginBottom: 8,
    textAlign: 'center',
    transition: 'opacity 0.3s',
  },
  launcher: {
    backgroundColor: '#1d1d22',
    padding: '15px',
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
    border: '1px dashed #333',
    textAlign: 'center',
  },
  launcherTitle: {
    color: '#8f8f9d',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  toggleBtn: {
    padding: '10px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    color: '#fff',
    fontWeight: 'bold',
    width: '100%',
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
    backgroundColor: '#8257e5',
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
};