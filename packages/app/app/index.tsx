import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, Pressable, Animated, ScrollView,
  Dimensions, Modal, Alert, StatusBar, Platform,
} from 'react-native';
import { useToast } from '@idlerpg/ui';
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
import { LocalDataRepository } from '@idlerpg/core/LocalDataRepository';
import { FirebaseDataRepository } from '@idlerpg/core/FirebaseDataRepository';
import { CompositeRepository } from '@idlerpg/core/CompositeRepository';

const { width: SCREEN_W } = Dimensions.get('window');

// ── theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:        '#060912',
  surface:   '#0d1120',
  surface2:  '#111827',
  border:    '#1e2d4a',
  borderGlow:'#1a3a6a',
  gold:      '#f5c518',
  goldDark:  '#8a6e0a',
  cyan:      '#00e5ff',
  cyanDark:  '#007a8a',
  red:       '#e63946',
  redDark:   '#7a1a22',
  green:     '#00e676',
  greenDark: '#006633',
  orange:    '#ff6b35',
  white:     '#f0f4ff',
  dim:       '#5a6a8a',
  dimmer:    '#2a3550',
} as const;

const FONT_MONO = Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });

// ── storage / engine ─────────────────────────────────────────────────────────
const storageAdapter = {
  getItem: async (key: string) => {
    try {
      const mod = await import('@react-native-async-storage/async-storage').then(m => (m && (m as any).default) || m).catch(() => null);
      if (mod && mod.getItem) return await mod.getItem(key);
    } catch {}
    try { if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(key); } catch {}
    return null;
  },
  setItem: async (key: string, value: string) => {
    try {
      const mod = await import('@react-native-async-storage/async-storage').then(m => (m && (m as any).default) || m).catch(() => null);
      if (mod && mod.setItem) { await mod.setItem(key, value); return; }
    } catch {}
    try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(key, value); } catch {}
  },
};

const localRepo = new LocalDataRepository(storageAdapter);
const firebaseRepo = new FirebaseDataRepository({ firestore: null });
const repository = new CompositeRepository([localRepo, firebaseRepo]);

const engine = new GameEngine({
  plugins: [
    new ProgressionPlugin(), new AdaptiveModule(), new PrestigePlugin(),
    new EnergyPlugin(), new EquipmentPlugin(), new AchievementPlugin(),
    new DebugPlugin(), new OnboardingPlugin(), new AnalyticsPlugin(),
    new NetworkPlugin(), new ComboPlugin(), new MissionPlugin(),
    new BossPlugin(), new SkillTreePlugin(),
  ],
  repo: repository,
  userId: 'player',
});

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function stageInfo(level: number): { name: string; icon: string; threat: string } {
  if (level >= 50) return { name: 'QUANTUM NEXUS', icon: '⬡', threat: 'OMEGA' };
  if (level >= 40) return { name: 'MILITARY GRID', icon: '◈', threat: 'CRITICAL' };
  if (level >= 30) return { name: 'GOV MAINFRAME', icon: '◆', threat: 'HIGH' };
  if (level >= 20) return { name: 'BANK VAULT', icon: '◇', threat: 'ELEVATED' };
  if (level >= 10) return { name: 'CORP SERVER', icon: '○', threat: 'MEDIUM' };
  return { name: 'ISP NODE', icon: '·', threat: 'LOW' };
}

function threatColor(threat: string): string {
  if (threat === 'OMEGA') return '#ff00ff';
  if (threat === 'CRITICAL') return C.red;
  if (threat === 'HIGH') return C.orange;
  if (threat === 'ELEVATED') return C.gold;
  if (threat === 'MEDIUM') return C.cyan;
  return C.green;
}

interface DamageNum {
  id: number; x: number; y: number;
  text: string; color: string; anim: Animated.Value;
}
let dmgId = 0;

// ── subcomponents ─────────────────────────────────────────────────────────────

function HexBar({ current, max, color, height = 8 }: { current: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return (
    <View style={{ height, backgroundColor: C.surface2, borderRadius: 2, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

function StatChip({ label, value, color = C.cyan }: { label: string; value: string; color?: string }) {
  return (
    <View style={sx.chip}>
      <Text style={[sx.chipLabel, { color: C.dim }]}>{label}</Text>
      <Text style={[sx.chipValue, { color }]}>{value}</Text>
    </View>
  );
}

type TabId = 'combat' | 'network' | 'energy' | 'board' | 'missions' | 'prestige' | 'skilltree';
const TABS: { id: TabId; label: string }[] = [
  { id: 'combat',    label: 'HACK' },
  { id: 'network',   label: 'NET' },
  { id: 'energy',    label: 'POWER' },
  { id: 'board',     label: 'BOARD' },
  { id: 'missions',  label: 'OPS' },
  { id: 'prestige',  label: 'ASCEND' },
  { id: 'skilltree', label: 'TREE' },
];

// ── main component ────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(engine.getState());
  const { showMessage, ToastComponent } = useToast();
  const [dmgNums, setDmgNums] = useState<DamageNum[]>([]);
  const [tab, setTab] = useState<TabId>('combat');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tapScale = useRef(new Animated.Value(1)).current;
  const attackGlow = useRef(new Animated.Value(0)).current;
  const prevState = useRef(state);
  // Prestige pulse animation
  const prestigePulse = useRef(new Animated.Value(1)).current;

  const spawnDmg = (text: string, color: string) => {
    const anim = new Animated.Value(1);
    const id = ++dmgId;
    const x = (Math.random() - 0.5) * 120;
    const y = -30 - Math.random() * 50;
    setDmgNums(prev => [...prev.slice(-9), { id, x, y, text, color, anim }]);
    Animated.timing(anim, { toValue: 0, duration: 1100, useNativeDriver: true }).start(() => {
      setDmgNums(prev => prev.filter(d => d.id !== id));
    });
  };

  useEffect(() => {
    const init = async () => {
      const saved = await repository.loadGame('player');
      if (saved?.state) engine.loadSavedState(saved.state);
      else engine.initializePlugins();
      setState(engine.getState());
      engine.start();
    };
    init();
    return engine.subscribe(setState);
  }, []);

  useEffect(() => {
    const prev = prevState.current;
    if (state.level > prev.level) {
      const goldDiff = (state.resources.gold ?? 0) - (prev.resources.gold ?? 0);
      if (goldDiff > 0) spawnDmg(`+${fmt(goldDiff)}`, C.gold);
      if (state.level % 10 === 0) showMessage(`STAGE ${state.level} — NEW TIER UNLOCKED`, 2500);
    }
    prevState.current = state;
  }, [state]);

  // Pulse prestige button when available
  useEffect(() => {
    const meta = engine.getUpgradeMetadata();
    const p = meta.plugins['prestige']?.prestige;
    if (p?.canPrestige) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(prestigePulse, { toValue: 1.04, duration: 800, useNativeDriver: true }),
          Animated.timing(prestigePulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      prestigePulse.stopAnimation();
      prestigePulse.setValue(1);
    }
  }, [state.level]);

  const triggerHaptic = async (type: string) => {
    try {
      const h = await import('expo-haptics').then(m => m).catch(() => null);
      if (!h) return;
      if (type === 'tap') h.impactAsync?.(h.ImpactFeedbackStyle?.Light);
      else if (type === 'spell') h.impactAsync?.(h.ImpactFeedbackStyle?.Heavy);
      else if (type === 'kill') h.notificationAsync?.(h.NotificationFeedbackType?.Success);
    } catch {}
  };

  const handleTap = () => {
    triggerHaptic('tap');
    const s = engine.getState();
    const adaptState = s.pluginState.adaptive;
    const eq = s.pluginState?.equipment;

    // Compute real effective damage (mirrors AdaptiveModule logic)
    const baseTap = adaptState?.tapDamage ?? 1;
    let gearTap = 0;
    if (eq) {
      const slots: string[] = [...(eq.ramSlots || []), ...(eq.gpuSlots || [])];
      for (const itemId of slots) {
        if (!itemId) continue;
        const item = (eq.inventory || []).find((g: any) => g.id === itemId);
        if (item?.bonuses?.tapDamage) gearTap += item.bonuses.tapDamage;
      }
    }
    const st = s.pluginState?.skilltree;
    let tapDmgMult = 1;
    if (st) {
      const u = new Set<string>(st.unlocked ?? []);
      tapDmgMult = 1
        + (u.has('s1') ? 0.15 : 0) + (u.has('s2') ? 0.20 : 0) + (u.has('s4') ? 0.25 : 0)
        + (u.has('p1') ? 0.05 : 0) + (u.has('p3') ? 0.10 : 0) + (u.has('a2') ? 0.05 : 0);
    }
    const comboMult = s.pluginState.combo?.multiplier ?? 1;
    const realDamage = Math.round((baseTap + gearTap) * tapDmgMult * comboMult);
    spawnDmg(`-${fmt(realDamage)}`, C.red);

    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'combo', action: { type: 'TAP_DAMAGE' } } });
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'TAP_DAMAGE' } } });
    const bossState = engine.getState().pluginState.boss;
    if (bossState?.bossActive) {
      engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'boss', action: { type: 'BOSS_DAMAGE', damage: realDamage } } });
    } else {
      engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'adaptive', action: { type: 'TAP_DAMAGE' } } });
    }
    Animated.sequence([
      Animated.parallel([
        Animated.timing(tapScale, { toValue: 0.88, duration: 60, useNativeDriver: true }),
        Animated.timing(attackGlow, { toValue: 1, duration: 60, useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.spring(tapScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
        Animated.timing(attackGlow, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]),
    ]).start();
  };

  const meta = engine.getUpgradeMetadata();
  const gold = state.resources?.gold ?? 0;
  const a = state.pluginState.adaptive;
  const monsterHp = a?.monsterHp ?? 0;
  const monsterMaxHp = a?.monsterMaxHp ?? 0;
  const monstersDefeated = a?.monstersDefeated ?? 0;
  const tapDamage = a?.tapDamage ?? 1;
  const effectiveTapDmg = meta.plugins['adaptive']?.effectiveTapDmg ?? tapDamage;
  const autoDps = meta.plugins['adaptive']?.autoDps ?? 1;
  const fightInStage = meta.plugins['adaptive']?.fightInStage ?? 1;
  const isMiniBoss = meta.plugins['adaptive']?.isMiniBoss ?? false;
  const combo = meta.plugins['combo']?.combo;
  const boss = meta.plugins['boss']?.boss;
  const network = meta.plugins['network']?.network;
  const missions = meta.plugins['missions']?.missions;
  const skilltree = meta.plugins['skilltree']?.skilltree;
  const prestige = meta.plugins['prestige']?.prestige;
  const energy = meta.plugins['energy']?.energy;
  const equipment = meta.plugins['equipment']?.equipment;
  const achievements = meta.plugins['achievements']?.achievements;
  const canUpgradeTap = gold >= (meta.plugins['adaptive']?.upgrade?.cost ?? 0);
  const { name: stageName, icon: stageIcon, threat } = stageInfo(state.level);
  const threatCol = threatColor(threat);
  const glowColor = attackGlow.interpolate({ inputRange: [0, 1], outputRange: [C.surface2, C.redDark] });

  const onboarding = meta.plugins['onboarding']?.onboarding;

  return (
    <View style={sx.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── HUD top bar ── */}
      <View style={sx.hud}>
        <View style={sx.hudLeft}>
          <Text style={sx.hudLabel}>COMPUTE</Text>
          <Text style={sx.hudGold}>{fmt(gold)}</Text>
          {(network?.totalOutput ?? 0) > 0 && (
            <Text style={sx.hudPassive}>+{(network.totalOutput).toFixed(1)} DPS</Text>
          )}
        </View>
        <View style={sx.hudCenter}>
          <Text style={[sx.threatBadge, { color: threatCol, borderColor: threatCol }]}>{threat}</Text>
          <Text style={sx.stageLabel}>{stageName}</Text>
        </View>
        <View style={sx.hudRight}>
          <Text style={sx.hudLabel}>STAGE</Text>
          <Text style={sx.hudStage}>{state.level}</Text>
          <Pressable onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel="Settings">
            <Text style={sx.settingsIcon}>⚙</Text>
          </Pressable>
        </View>
      </View>

      {/* ── tutorial banner ── */}
      {onboarding && !onboarding.completed && (
        <View style={sx.tutorialBanner}>
          <View style={{ flex: 1 }}>
            <Text style={sx.tutStep}>TUTORIAL {onboarding.step + 1}/{onboarding.total}</Text>
            <Text style={sx.tutTitle}>{onboarding.title}</Text>
            <Text style={sx.tutTip}>{onboarding.tip}</Text>
          </View>
          <View style={{ gap: 6 }}>
            <Pressable style={sx.tutNext} onPress={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'onboarding', action: { type: 'NEXT_STEP' } } })}>
              <Text style={sx.tutNextText}>NEXT</Text>
            </Pressable>
            <Pressable onPress={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'onboarding', action: { type: 'SKIP_TUTORIAL' } } })}>
              <Text style={sx.tutSkip}>skip</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── combo indicator ── */}
      {(combo?.count ?? 0) > 2 && (
        <View style={sx.comboRow} pointerEvents="none">
          <Text style={[sx.comboText, {
            color: combo.count >= 15 ? '#ff4488' : combo.count >= 8 ? C.orange : C.gold,
          }]}>
            {combo.count}× COMBO  ×{combo.multiplier.toFixed(1)}
          </Text>
        </View>
      )}

      {/* ── boss HP bar ── */}
      {boss?.bossActive && (
        <View style={sx.bossCard}>
          <View style={sx.bossHeader}>
            <Text style={sx.bossTitle}>BOSS ENCOUNTER</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[sx.bossTimer, boss.bossTimer < 10 && { color: C.red }]}>
                {boss.bossTimer.toFixed(0)}s
              </Text>
              <Text style={sx.bossAttempt}>
                {boss.bossAttempts < 2
                  ? `Attempt ${boss.bossAttempts + 1}/3`
                  : 'FINAL ATTEMPT'}
              </Text>
            </View>
          </View>
          <HexBar current={boss.bossHp} max={boss.bossMaxHp} color={C.red} height={12} />
          <Text style={sx.bossHpText}>{fmt(boss.bossHp)} / {fmt(boss.bossMaxHp)}</Text>
        </View>
      )}

      {/* ── damage numbers overlay ── */}
      <View style={sx.dmgOverlay} pointerEvents="none">
        {dmgNums.map(d => (
          <Animated.Text key={d.id} style={[sx.dmgNum, {
            color: d.color,
            opacity: d.anim,
            transform: [
              { translateX: d.x },
              { translateY: d.anim.interpolate({ inputRange: [0, 1], outputRange: [d.y - 60, d.y] }) },
            ],
          }]}>
            {d.text}
          </Animated.Text>
        ))}
      </View>

      {/* ── combat arena ── */}
      <Animated.View style={[sx.arena, { backgroundColor: glowColor }]}>
        <View style={sx.targetHeader}>
          <Text style={[sx.targetIcon, { color: boss?.bossActive ? C.red : isMiniBoss ? C.orange : threatCol }]}>
            {boss?.bossActive ? '◈' : isMiniBoss ? '◆' : stageIcon}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[sx.targetName, { color: boss?.bossActive ? C.red : isMiniBoss ? C.orange : C.white }]}>
              {boss?.bossActive ? '[ BOSS ] ELITE TARGET' : isMiniBoss ? '[ MINI-BOSS ] STAGE GUARDIAN' : stageName}
            </Text>
            <Text style={sx.targetLv}>
              {boss?.bossActive
                ? `LV.${state.level}  ·  ${monstersDefeated} DEFEATED`
                : `Fight ${fightInStage}/10  ·  LV.${state.level}  ·  ${monstersDefeated} DEFEATED`}
            </Text>
          </View>
        </View>

        {!boss?.bossActive && (
          <View style={{ marginTop: 8 }}>
            <HexBar current={monsterHp} max={monsterMaxHp} color={C.red} height={10} />
            <View style={sx.hpRow}>
              <Text style={sx.hpText}>{fmt(monsterHp)}</Text>
              <Text style={sx.hpText}>{fmt(monsterMaxHp)}</Text>
            </View>
          </View>
        )}

        <View style={sx.statsRow}>
          <StatChip label="TAP DMG" value={String(effectiveTapDmg)} color={C.cyan} />
          <StatChip label="AUTO DPS" value={String(autoDps)} color={C.green} />
          <StatChip label="DEFEATED" value={fmt(monstersDefeated)} color={C.gold} />
        </View>

        <Pressable onPress={handleTap} style={sx.attackWrap}
          accessibilityRole="button" accessibilityLabel="Attack target">
          <Animated.View style={[sx.attackBtn, { transform: [{ scale: tapScale }] }]}>
            <View style={sx.attackBtnInner}>
              <Text style={sx.attackLabel}>ATTACK</Text>
              <Text style={sx.attackDmg}>-{effectiveTapDmg}</Text>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>

      {/* ── spell bar ── */}
      <View style={sx.spellBar}>
        {(energy?.spells ?? []).map((s: any) => (
          <Pressable key={s.id}
            style={[sx.spellBtn, !s.canCast && sx.spellBtnOff, s.cooldownRemaining > 0 && sx.spellBtnCD]}
            onPress={() => {
              if (!s.canCast) return;
              triggerHaptic('spell');
              spawnDmg(`${s.name}!`, s.color ?? C.cyan);
              engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: s.id } } });
              showMessage(`${s.name} activated!`);
            }}
            disabled={!s.canCast}
            accessibilityRole="button"
            accessibilityLabel={s.name}
            accessibilityState={{ disabled: !s.canCast }}
          >
            <Text style={[sx.spellName, { color: s.canCast ? (s.color ?? C.cyan) : C.dim }]}>{s.name}</Text>
            {s.cooldownRemaining > 0
              ? <Text style={sx.spellSub}>{s.cooldownRemaining.toFixed(0)}s</Text>
              : <Text style={[sx.spellSub, { color: s.canCast ? '#7be' : C.dim }]}>{s.cost}⚡</Text>
            }
          </Pressable>
        ))}
      </View>

      {/* ── tab drawer ── */}
      <View style={sx.drawer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sx.tabScroll} contentContainerStyle={sx.tabRow}>
          {TABS.map(t => (
            <Pressable key={t.id} style={[sx.tabBtn, tab === t.id && sx.tabBtnActive]} onPress={() => setTab(t.id)}>
              <Text style={[sx.tabText, tab === t.id && sx.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>

          {/* COMBAT TAB */}
          {tab === 'combat' && (
            <View style={sx.tabContent}>
              <SectionHeader title="TAP UPGRADE" />
              <UpgradeRow
                name="Tap Power"
                sub={`Level ${Math.max(0, tapDamage - 1)} · +1 base damage per tap`}
                cost={meta.plugins['adaptive']?.upgrade?.cost ?? 0}
                canBuy={canUpgradeTap}
                onBuy={() => {
                  engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'adaptive', action: { type: 'UPGRADE_TAP', payload: { cost: meta.plugins['adaptive']?.upgrade?.cost } } } });
                  showMessage('Tap Damage increased!');
                }}
              />
              <SectionHeader title="ACHIEVEMENTS" sub={`${achievements?.unlockedCount ?? 0} / ${achievements?.total ?? 6} unlocked`} />
              {(achievements?.list ?? []).map((ac: any) => (
                <View key={ac.id} style={[sx.listRow, ac.unlocked && sx.listRowGreen]}>
                  <Text style={[sx.listDot, { color: ac.unlocked ? C.green : C.dimmer }]}>{ac.unlocked ? '◆' : '◇'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[sx.listName, ac.unlocked && { color: C.green }]}>{ac.name}</Text>
                    <Text style={sx.listSub}>{ac.description}{ac.unlocked ? `  +${ac.reward} CPU` : ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* NETWORK TAB */}
          {tab === 'network' && (
            <View style={sx.tabContent}>
              <SectionHeader title="PASSIVE NODES" sub={`${(network?.totalOutput ?? 0).toFixed(2)} DPS total output`} />
              {(network?.nodes ?? []).map((n: any) => (
                <UpgradeRow key={n.id}
                  name={`${n.name}  [${n.count}]`}
                  sub={`${n.description} · ${n.rate.toFixed(2)} DPS active`}
                  cost={n.nextCost}
                  canBuy={n.canBuy}
                  onBuy={() => {
                    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'network', action: { type: 'BUY_NODE', nodeId: n.id } } });
                    showMessage(`${n.name} +1`);
                  }}
                />
              ))}
            </View>
          )}

          {/* ENERGY TAB */}
          {tab === 'energy' && (
            <View style={sx.tabContent}>
              <View style={sx.energyHeader}>
                <Text style={sx.energyLabel}>ENERGY</Text>
                <Text style={sx.energyVal}>{(energy?.current ?? 0).toFixed(0)} / {energy?.max ?? 50}</Text>
              </View>
              <HexBar current={energy?.current ?? 0} max={energy?.max ?? 50} color={C.cyan} height={10} />
              <SectionHeader title="MODULES" />
              {(energy?.spells ?? []).map((s: any) => (
                <View key={s.id} style={[sx.spellCard, !s.canCast && { opacity: 0.55 }]}>
                  <View style={[sx.spellCardAccent, { backgroundColor: s.color ?? C.cyan }]} />
                  <View style={{ flex: 1 }}>
                    <View style={sx.spellCardHeader}>
                      <Text style={[sx.spellCardName, { color: s.color ?? C.cyan }]}>{s.name}</Text>
                      <Text style={sx.spellCardLv}>LV.{s.level}</Text>
                    </View>
                    <Text style={sx.spellCardStat}>×{s.multiplier} dmg · {s.cooldown}s cooldown · {s.cost}⚡</Text>
                    <View style={sx.spellCardBtns}>
                      <Pressable style={[sx.spellCastBtn, { borderColor: s.color ?? C.cyan }, !s.canCast && sx.btnOff]}
                        disabled={!s.canCast}
                        onPress={() => {
                          if (!s.canCast) return;
                          triggerHaptic('spell');
                          engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: s.id } } });
                          spawnDmg(`${s.name}!`, s.color ?? C.cyan);
                          showMessage(`${s.name}!`);
                        }}
                        accessibilityRole="button" accessibilityLabel={`Cast ${s.name}`} accessibilityState={{ disabled: !s.canCast }}
                      >
                        <Text style={[sx.spellCastText, { color: s.canCast ? (s.color ?? C.cyan) : C.dim }]}>
                          {s.cooldownRemaining > 0 ? `${s.cooldownRemaining.toFixed(0)}s` : 'CAST'}
                        </Text>
                      </Pressable>
                      <Pressable style={[sx.spellUpBtn, !s.canUpgrade && sx.btnOff]}
                        disabled={!s.canUpgrade}
                        onPress={() => {
                          if (!s.canUpgrade) return;
                          engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'energy', action: { type: s.upgradeAction } } });
                          showMessage(`${s.name} LV.${s.level + 1}!`);
                        }}
                        accessibilityRole="button" accessibilityLabel={`Upgrade ${s.name}`} accessibilityState={{ disabled: !s.canUpgrade }}
                      >
                        <Text style={[sx.spellUpText, !s.canUpgrade && { color: C.dim }]}>
                          UPGRADE  {fmt(s.upgradeCost)}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* BOARD TAB */}
          {tab === 'board' && (
            <View style={sx.tabContent}>
              {/* Motherboard header */}
              <View style={sx.mbCard}>
                <View style={sx.mbTierBadge}>
                  <Text style={sx.mbTierText}>TIER {equipment?.motherboardTier ?? 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sx.mbName}>{equipment?.motherboardName ?? 'AXIOM-1 MicroATX'}</Text>
                  <Text style={sx.mbSlotInfo}>
                    {equipment?.ramSlotCount ?? 2} RAM · {equipment?.gpuSlotCount ?? 1} GPU
                  </Text>
                </View>
                {!equipment?.maxTier && (
                  <Pressable
                    style={[sx.mbUpgradeBtn, !(equipment?.canUpgradeMotherboard) && sx.btnOff]}
                    disabled={!equipment?.canUpgradeMotherboard}
                    onPress={() => {
                      engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'equipment', action: { type: 'UPGRADE_MOTHERBOARD' } } });
                      showMessage(`Motherboard upgraded!`);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Upgrade motherboard"
                    accessibilityState={{ disabled: !equipment?.canUpgradeMotherboard }}
                  >
                    <Text style={[sx.mbUpgradeBtnText, !equipment?.canUpgradeMotherboard && { color: C.dim }]}>
                      {equipment?.canUpgradeMotherboard ? `UPGRADE  ${fmt(equipment?.nextMotherboardCost ?? 0)}` : `${fmt(equipment?.nextMotherboardCost ?? 0)} NEEDED`}
                    </Text>
                  </Pressable>
                )}
                {equipment?.maxTier && <Text style={[sx.mbUpgradeBtnText, { color: C.gold }]}>MAX TIER</Text>}
              </View>

              {/* RAM Slots */}
              <SectionHeader title="RAM SLOTS" sub={`${(equipment?.ramSlots ?? []).filter(Boolean).length} / ${equipment?.ramSlotCount ?? 2} installed`} />
              <View style={sx.slotGrid}>
                {Array.from({ length: equipment?.ramSlotCount ?? 2 }).map((_, i) => {
                  const itemId = (equipment?.ramSlots ?? [])[i] ?? null;
                  const item = itemId ? (equipment?.inventory ?? []).find((g: any) => g.id === itemId) : null;
                  return (
                    <SlotCard
                      key={`ram-${i}`}
                      slotLabel={`RAM ${i + 1}`}
                      item={item}
                      onUninstall={itemId ? () => {
                        engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'equipment', action: { type: 'UNINSTALL', itemId } } });
                      } : undefined}
                    />
                  );
                })}
              </View>

              {/* GPU Slots */}
              <SectionHeader title="GPU SLOTS" sub={`${(equipment?.gpuSlots ?? []).filter(Boolean).length} / ${equipment?.gpuSlotCount ?? 1} installed`} />
              <View style={sx.slotGrid}>
                {Array.from({ length: equipment?.gpuSlotCount ?? 1 }).map((_, i) => {
                  const itemId = (equipment?.gpuSlots ?? [])[i] ?? null;
                  const item = itemId ? (equipment?.inventory ?? []).find((g: any) => g.id === itemId) : null;
                  return (
                    <SlotCard
                      key={`gpu-${i}`}
                      slotLabel={`GPU ${i + 1}`}
                      item={item}
                      onUninstall={itemId ? () => {
                        engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'equipment', action: { type: 'UNINSTALL', itemId } } });
                      } : undefined}
                    />
                  );
                })}
              </View>

              {/* Inventory */}
              <SectionHeader title="INVENTORY" sub={`${(equipment?.inventory ?? []).filter((g: any) => !g.installedIn).length} components`} />
              {(equipment?.inventory ?? []).filter((g: any) => !g.installedIn).map((g: any) => (
                <View key={g.id} style={sx.gearItem}>
                  <View style={[sx.gearItemAccent, { backgroundColor: g.color ?? C.dim }]} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, paddingBottom: 0 }}>
                      <Text style={[sx.gearName, { color: g.color ?? C.gold }]}>{g.name}</Text>
                      <Text style={[sx.rarityTag, { borderColor: g.color ?? C.dim, color: g.color ?? C.dim }]}>{g.rarity.toUpperCase()}</Text>
                      <Text style={sx.typeTag}>{g.type.toUpperCase()}</Text>
                    </View>
                    <Text style={[sx.gearStats, { paddingHorizontal: 10, paddingBottom: 8 }]}>
                      {Object.entries(g.bonuses ?? {}).map(([k, v]: any) => `+${v} ${k}`).join('  ')}
                    </Text>
                  </View>
                  {/* Install buttons for available slots */}
                  <View style={{ flexDirection: 'column', gap: 4, padding: 8 }}>
                    {g.type === 'ram' && Array.from({ length: equipment?.ramSlotCount ?? 2 }).map((_, i) => {
                      const slotFilled = (equipment?.ramSlots ?? [])[i];
                      if (slotFilled) return null;
                      return (
                        <Pressable key={i} style={sx.installBtn}
                          onPress={() => {
                            engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'equipment', action: { type: 'INSTALL_RAM', itemId: g.id, slotIndex: i } } });
                            showMessage(`${g.name} installed in RAM ${i + 1}`);
                          }}
                          accessibilityRole="button" accessibilityLabel={`Install in RAM slot ${i + 1}`}
                        >
                          <Text style={sx.installBtnText}>RAM {i + 1}</Text>
                        </Pressable>
                      );
                    })}
                    {g.type === 'gpu' && Array.from({ length: equipment?.gpuSlotCount ?? 1 }).map((_, i) => {
                      const slotFilled = (equipment?.gpuSlots ?? [])[i];
                      if (slotFilled) return null;
                      return (
                        <Pressable key={i} style={[sx.installBtn, { borderColor: C.gold }]}
                          onPress={() => {
                            engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'equipment', action: { type: 'INSTALL_GPU', itemId: g.id, slotIndex: i } } });
                            showMessage(`${g.name} installed in GPU ${i + 1}`);
                          }}
                          accessibilityRole="button" accessibilityLabel={`Install in GPU slot ${i + 1}`}
                        >
                          <Text style={[sx.installBtnText, { color: C.gold }]}>GPU {i + 1}</Text>
                        </Pressable>
                      );
                    })}
                    <Pressable style={sx.gearScrap}
                      onPress={() => {
                        engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'equipment', action: { type: 'SCRAP', itemId: g.id } } });
                        showMessage(`Scrapped for gold`);
                      }}
                      accessibilityRole="button" accessibilityLabel={`Scrap ${g.name}`}
                    >
                      <Text style={sx.gearScrapText}>SCRAP</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              {(equipment?.inventory ?? []).filter((g: any) => !g.installedIn).length === 0 && (
                <Text style={sx.emptyMsg}>No hardware in inventory. Keep defeating targets.</Text>
              )}
            </View>
          )}

          {/* MISSIONS TAB */}
          {tab === 'missions' && (
            <View style={sx.tabContent}>
              <SectionHeader title="DAILY OPS" sub={`Resets in ${missions?.hoursUntilReset ?? 0}h`} />
              {(missions?.list ?? []).map((m: any) => (
                <View key={m.id} style={[sx.missionCard, m.claimed && { opacity: 0.35 }]}>
                  <View style={[sx.missionAccent, {
                    backgroundColor: m.claimed ? C.dim : m.completed ? C.green : C.cyanDark,
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[sx.missionName, m.completed && { color: C.green }]}>{m.description}</Text>
                    <View style={sx.missionProgress}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <HexBar current={m.progress} max={m.target} color={m.completed ? C.green : C.cyan} height={4} />
                      </View>
                      <Text style={sx.missionPct}>{Math.min(100, (m.progress / m.target * 100)).toFixed(0)}%</Text>
                    </View>
                    <Text style={sx.missionReward}>REWARD: {fmt(m.reward)} CPU</Text>
                  </View>
                  {m.completed && !m.claimed && (
                    <Pressable style={sx.claimBtn}
                      onPress={() => {
                        engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'CLAIM_MISSION', missionId: m.id } } });
                        showMessage(`+${m.reward} CPU claimed!`);
                      }}
                      accessibilityRole="button" accessibilityLabel={`Claim ${m.reward} CPU`}
                    >
                      <Text style={sx.claimText}>CLAIM</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* PRESTIGE / ASCEND TAB */}
          {tab === 'prestige' && (
            <View style={sx.tabContent}>
              {/* Shard display */}
              <View style={sx.ascendShardBox}>
                <View style={sx.ascendShardRing}>
                  <Text style={sx.ascendShardNum}>{prestige?.cores ?? 0}</Text>
                  <Text style={sx.ascendShardLabel}>SHARDS</Text>
                </View>
                <View style={{ marginTop: 10 }}>
                  <Text style={sx.ascendBonusLine}>
                    Permanent bonus: <Text style={{ color: C.gold }}>+{(((prestige?.bonusMultiplier ?? 1) - 1) * 100).toFixed(1)}%</Text>
                  </Text>
                  {(prestige?.cores ?? 0) > 0 && (
                    <Text style={sx.ascendHistoryLine}>
                      {prestige?.cores} ascension{(prestige?.cores ?? 0) !== 1 ? 's' : ''} completed
                    </Text>
                  )}
                </View>
              </View>

              {/* Next bonus meter */}
              <View style={sx.ascendBonusMeter}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={sx.ascendMeterLabel}>NEXT SHARD BONUS</Text>
                  <Text style={[sx.ascendMeterLabel, { color: C.gold }]}>+{(((prestige?.nextBonus ?? 1) - 1) * 100).toFixed(1)}%</Text>
                </View>
                <HexBar current={(prestige?.cores ?? 0) % 5} max={5} color={C.gold} height={6} />
              </View>

              {/* Summary card */}
              <View style={sx.ascendSummaryCard}>
                <Text style={sx.ascendSummaryTitle}>ASCENSION SUMMARY</Text>
                <View style={sx.ascendSummaryRow}>
                  <Text style={sx.ascendSummaryKey}>Stage reset</Text>
                  <Text style={sx.ascendSummaryVal}>{state.level} → 1</Text>
                </View>
                <View style={sx.ascendSummaryRow}>
                  <Text style={sx.ascendSummaryKey}>Gold reset</Text>
                  <Text style={[sx.ascendSummaryVal, { color: C.red }]}>{fmt(gold)} → 0</Text>
                </View>
                <View style={sx.ascendSummaryRow}>
                  <Text style={sx.ascendSummaryKey}>Shards gained</Text>
                  <Text style={[sx.ascendSummaryVal, { color: C.cyan }]}>+1 shard</Text>
                </View>
                <View style={sx.ascendSummaryRow}>
                  <Text style={sx.ascendSummaryKey}>Skill point</Text>
                  <Text style={[sx.ascendSummaryVal, { color: C.green }]}>+1 point</Text>
                </View>
              </View>

              {/* Requirement */}
              <View style={sx.ascendReqRow}>
                <Text style={sx.ascendReqLabel}>REQUIREMENT</Text>
                <Text style={[sx.ascendReqVal, prestige?.canPrestige ? { color: C.green } : { color: C.dim }]}>
                  Stage {prestige?.requiredLevel ?? 10}  {prestige?.canPrestige ? '✓ MET' : `(${Math.max(0, (prestige?.requiredLevel ?? 10) - state.level)} to go)`}
                </Text>
              </View>

              {/* Ascend button */}
              <Animated.View style={{ transform: [{ scale: prestigePulse }] }}>
                <Pressable
                  style={[sx.ascendBtn, prestige?.canPrestige ? sx.ascendBtnActive : sx.ascendBtnLocked]}
                  disabled={!prestige?.canPrestige}
                  onPress={() => {
                    if (!prestige?.canPrestige) return;
                    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'prestige', action: { type: 'PRESTIGE' } } });
                    showMessage('ASCENSION COMPLETE — New cycle begins');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={prestige?.canPrestige ? 'Ascend' : `Need stage ${prestige?.requiredLevel}`}
                  accessibilityState={{ disabled: !prestige?.canPrestige }}
                >
                  <Text style={[sx.ascendBtnText, !prestige?.canPrestige && { color: C.dim }]}>
                    {prestige?.canPrestige ? 'ASCEND NOW' : `NEED STAGE ${prestige?.requiredLevel ?? 10}`}
                  </Text>
                </Pressable>
              </Animated.View>

              <Text style={sx.ascendFootnote}>
                Ascend Shards are kept between runs and stack permanently.
              </Text>
            </View>
          )}

          {/* SKILL TREE TAB */}
          {tab === 'skilltree' && (
            <View style={sx.tabContent}>
              <View style={sx.skillHeader}>
                <Text style={sx.skillPoints}>{skilltree?.points ?? 0}</Text>
                <Text style={sx.skillPointsLabel}>SKILL POINT{(skilltree?.points ?? 0) !== 1 ? 'S' : ''} AVAILABLE</Text>
              </View>
              <Text style={sx.skillNote}>
                Points earned at stage 50, then every 500 stages. First spend locks your path permanently.
              </Text>

              {/* Path lock warning */}
              {!(skilltree?.chosenPath) && (skilltree?.points ?? 0) > 0 && (
                <View style={sx.pathLockWarning}>
                  <Text style={sx.pathLockText}>WARNING: Choosing a path is permanent. Other paths will be disabled.</Text>
                </View>
              )}
              {skilltree?.chosenPath && (
                <View style={[sx.pathLockBadge, {
                  borderColor: skilltree.chosenPath === 'STRIKER' ? C.red : skilltree.chosenPath === 'PHANTOM' ? C.green : C.gold,
                }]}>
                  <Text style={[sx.pathLockBadgeText, {
                    color: skilltree.chosenPath === 'STRIKER' ? C.red : skilltree.chosenPath === 'PHANTOM' ? C.green : C.gold,
                  }]}>
                    PATH LOCKED: {skilltree.chosenPath}
                  </Text>
                </View>
              )}

              {(['STRIKER', 'PHANTOM', 'ARCANE'] as const).map(branch => {
                const branchColor = branch === 'STRIKER' ? C.red : branch === 'PHANTOM' ? C.green : C.gold;
                const chosenPath = skilltree?.chosenPath ?? null;
                const isLocked = chosenPath !== null && chosenPath !== branch;
                if (isLocked) return null; // collapse locked branches

                return (
                  <View key={branch} style={sx.skillBranch}>
                    <View style={[sx.skillBranchHeader, { borderLeftColor: branchColor }]}>
                      <Text style={[sx.skillBranchTitle, { color: branchColor }]}>{branch} BRANCH</Text>
                    </View>
                    {(skilltree?.nodes ?? []).filter((n: any) => n.branch === branch).map((n: any) => (
                      <View key={n.id} style={[sx.skillNode, n.unlocked && { borderColor: branchColor }, n.locked && { opacity: 0.3 }]}>
                        <Text style={[sx.skillDot, { color: n.unlocked ? branchColor : n.available ? C.dim : C.dimmer }]}>
                          {n.unlocked ? '◆' : n.available ? '◇' : '·'}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[sx.skillName, n.unlocked && { color: branchColor }]}>{n.name}</Text>
                          <Text style={sx.skillDesc}>{n.description}</Text>
                        </View>
                        {n.available && (
                          <Pressable style={[sx.skillUnlockBtn, { borderColor: branchColor }]}
                            onPress={() => {
                              engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'skilltree', action: { type: 'UNLOCK_SKILL', nodeId: n.id } } });
                              showMessage(`${n.name} unlocked!`);
                            }}
                            accessibilityRole="button" accessibilityLabel={`Unlock ${n.name}`}
                          >
                            <Text style={[sx.skillUnlockText, { color: branchColor }]}>1PT</Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })}

              {/* Show other paths collapsed */}
              {skilltree?.chosenPath && (
                <View style={sx.lockedPaths}>
                  {(['STRIKER', 'PHANTOM', 'ARCANE'] as const).filter(b => b !== skilltree.chosenPath).map(branch => {
                    const branchColor = branch === 'STRIKER' ? C.red : branch === 'PHANTOM' ? C.green : C.gold;
                    return (
                      <View key={branch} style={[sx.lockedPathRow, { borderColor: branchColor + '44' }]}>
                        <Text style={[sx.lockedPathText, { color: branchColor + '66' }]}>{branch} BRANCH — LOCKED</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

        </ScrollView>
      </View>

      {/* ── settings modal ── */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={sx.modalOverlay} onPress={() => setSettingsOpen(false)}>
          <Pressable style={sx.modalCard}>
            <Text style={sx.modalTitle}>SYSTEM</Text>
            {[
              { label: 'MANUAL SAVE', color: C.cyan, action: async () => { await engine.flushSave(); showMessage('Game saved!'); setSettingsOpen(false); } },
              { label: 'EXPORT SAVE', color: C.green, action: async () => { const json = JSON.stringify({ state: engine.getState(), exportedAt: Date.now() }); try { if ((navigator as any)?.clipboard?.writeText) { await (navigator as any).clipboard.writeText(json); showMessage('Copied to clipboard'); } } catch { Alert.alert('Export', json.slice(0, 500) + '...'); } setSettingsOpen(false); } },
              { label: 'IMPORT SAVE', color: C.orange, action: async () => { try { const t = await (navigator as any)?.clipboard?.readText(); if (t) { engine.loadSavedState(JSON.parse(t).state ?? JSON.parse(t)); setState(engine.getState()); showMessage('Save imported'); } } catch { showMessage('Import failed'); } setSettingsOpen(false); } },
            ].map(item => (
              <Pressable key={item.label} style={[sx.modalBtn, { borderColor: item.color }]} onPress={item.action}>
                <Text style={[sx.modalBtnText, { color: item.color }]}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable style={sx.modalClose} onPress={() => setSettingsOpen(false)}>
              <Text style={sx.modalCloseText}>CLOSE</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ToastComponent />

      {/* ── dev panel ── */}
      <Pressable style={sx.devToggle} onPress={() => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'debug', action: { type: 'TOGGLE_DEBUG' } } })}>
        <Text style={sx.devToggleText}>DEV</Text>
      </Pressable>
      {meta.plugins['debug']?.debug?.visible && (
        <View style={sx.devPanel}>
          {[
            { label: '+1K', action: () => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'debug', action: { type: 'ADD_GOLD', amount: 1000 } } }) },
            { label: '+100K', action: () => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'debug', action: { type: 'ADD_GOLD', amount: 100000 } } }) },
            { label: 'ST.50', action: () => engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'debug', action: { type: 'SET_LEVEL', level: 50 } } }) },
            { label: 'RESET', action: async () => { try { localStorage.removeItem('idlerpg_user_player'); } catch {} location.reload(); } },
          ].map(b => (
            <Pressable key={b.label} style={[sx.devBtn, b.label === 'RESET' && { borderColor: C.red }]} onPress={b.action}>
              <Text style={[sx.devBtnText, b.label === 'RESET' && { color: C.red }]}>{b.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ── small helper components ───────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={sx.sectionHeader}>
      <View style={sx.sectionLine} />
      <Text style={sx.sectionTitle}>{title}</Text>
      {sub && <Text style={sx.sectionSub}>{sub}</Text>}
    </View>
  );
}

function UpgradeRow({ name, sub, cost, canBuy, onBuy }: {
  name: string; sub: string; cost: number; canBuy: boolean; onBuy: () => void;
}) {
  return (
    <View style={sx.upgradeRow}>
      <View style={{ flex: 1 }}>
        <Text style={sx.upgradeName}>{name}</Text>
        <Text style={sx.upgradeSub}>{sub}</Text>
      </View>
      <Pressable style={[sx.buyBtn, !canBuy && sx.btnOff]} disabled={!canBuy} onPress={onBuy}
        accessibilityRole="button" accessibilityLabel={`Buy: ${name}`} accessibilityState={{ disabled: !canBuy }}>
        <Text style={[sx.buyBtnText, !canBuy && { color: C.dim }]}>{fmt(cost)}</Text>
      </Pressable>
    </View>
  );
}

function SlotCard({ slotLabel, item, onUninstall }: {
  slotLabel: string;
  item: any | null;
  onUninstall?: () => void;
}) {
  return (
    <View style={[sx.slotCard, item && { borderColor: item.color ?? C.dim }]}>
      <Text style={sx.slotLabel}>{slotLabel}</Text>
      {item ? (
        <>
          <Text style={[sx.slotItemName, { color: item.color ?? C.white }]} numberOfLines={1}>{item.name}</Text>
          <Text style={sx.slotItemStats} numberOfLines={2}>
            {Object.entries(item.bonuses ?? {}).map(([k, v]: any) => `+${v} ${k}`).join('\n')}
          </Text>
          <Pressable style={sx.slotRemoveBtn} onPress={onUninstall}
            accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
            <Text style={sx.slotRemoveText}>REMOVE</Text>
          </Pressable>
        </>
      ) : (
        <View style={sx.slotEmpty}>
          <Text style={sx.slotEmptyText}>EMPTY</Text>
        </View>
      )}
    </View>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────
const sx = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // HUD
  hud: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: C.surface, borderBottomWidth: 1, borderColor: C.border },
  hudLeft: { flex: 1 },
  hudCenter: { alignItems: 'center', flex: 1 },
  hudRight: { flex: 1, alignItems: 'flex-end' },
  hudLabel: { fontFamily: FONT_MONO, color: C.dim, fontSize: 9, letterSpacing: 2, marginBottom: 1 },
  hudGold: { fontFamily: FONT_MONO, color: C.gold, fontSize: 22, fontWeight: '900' },
  hudPassive: { fontFamily: FONT_MONO, color: C.goldDark, fontSize: 10 },
  hudStage: { fontFamily: FONT_MONO, color: C.white, fontSize: 22, fontWeight: '900' },
  threatBadge: { fontFamily: FONT_MONO, fontSize: 9, fontWeight: '700', letterSpacing: 2, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  stageLabel: { fontFamily: FONT_MONO, color: C.dim, fontSize: 9, marginTop: 3, letterSpacing: 1 },
  settingsIcon: { color: C.dim, fontSize: 18, marginTop: 2 },

  // Tutorial
  tutorialBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface2, borderBottomWidth: 1, borderColor: C.gold, padding: 12, gap: 12 },
  tutStep: { fontFamily: FONT_MONO, color: C.goldDark, fontSize: 9, letterSpacing: 1 },
  tutTitle: { color: C.gold, fontWeight: '700', fontSize: 13, marginTop: 2 },
  tutTip: { color: C.dim, fontSize: 11, marginTop: 3 },
  tutNext: { backgroundColor: C.gold, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 4 },
  tutNextText: { fontFamily: FONT_MONO, color: C.bg, fontWeight: '700', fontSize: 11 },
  tutSkip: { fontFamily: FONT_MONO, color: C.dim, fontSize: 10, textAlign: 'center' },

  // Combo
  comboRow: { position: 'absolute', top: 110, left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  comboText: { fontFamily: FONT_MONO, fontSize: 20, fontWeight: '900', letterSpacing: 3 },

  // Boss
  bossCard: { marginHorizontal: 12, marginTop: 6, backgroundColor: '#130000', borderRadius: 6, borderWidth: 1, borderColor: C.red, padding: 10 },
  bossHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bossTitle: { fontFamily: FONT_MONO, color: C.red, fontWeight: '700', fontSize: 12, letterSpacing: 2 },
  bossTimer: { fontFamily: FONT_MONO, color: C.orange, fontSize: 14, fontWeight: '900' },
  bossHpText: { fontFamily: FONT_MONO, color: C.redDark, fontSize: 10, textAlign: 'right', marginTop: 3 },
  bossAttempt: { fontFamily: FONT_MONO, color: C.orange, fontSize: 9, letterSpacing: 1, marginTop: 1 },

  // Damage numbers
  dmgOverlay: { position: 'absolute', top: '28%', left: '15%', right: '15%', bottom: '35%', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  dmgNum: { fontFamily: FONT_MONO, fontSize: 18, fontWeight: '900', position: 'absolute' },

  // Arena
  arena: { marginHorizontal: 12, marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: C.borderGlow, padding: 14, overflow: 'hidden' },
  targetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetIcon: { fontSize: 32, fontWeight: '900', width: 44, textAlign: 'center' },
  targetName: { fontFamily: FONT_MONO, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  targetLv: { fontFamily: FONT_MONO, color: C.dim, fontSize: 10, marginTop: 2, letterSpacing: 1 },
  hpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  hpText: { fontFamily: FONT_MONO, color: C.dim, fontSize: 9 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  attackWrap: { marginTop: 14, alignItems: 'center' },
  attackBtn: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.surface2, borderWidth: 2, borderColor: C.red,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.red, shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  attackBtnInner: { alignItems: 'center' },
  attackLabel: { fontFamily: FONT_MONO, color: C.red, fontSize: 14, fontWeight: '900', letterSpacing: 3 },
  attackDmg: { fontFamily: FONT_MONO, color: C.dim, fontSize: 11, marginTop: 2 },

  // Stat chip
  chip: { flex: 1, backgroundColor: C.surface2, borderRadius: 6, borderWidth: 1, borderColor: C.border, padding: 8, alignItems: 'center' },
  chipLabel: { fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 1, marginBottom: 2 },
  chipValue: { fontFamily: FONT_MONO, fontSize: 14, fontWeight: '900' },

  // Spell bar
  spellBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 12, marginTop: 10, marginBottom: 6 },
  spellBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: C.cyanDark, backgroundColor: C.surface2, alignItems: 'center', minWidth: 64 },
  spellBtnOff: { opacity: 0.35 },
  spellBtnCD: { borderStyle: 'dashed', opacity: 0.6 },
  spellName: { fontFamily: FONT_MONO, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  spellSub: { fontFamily: FONT_MONO, fontSize: 9, marginTop: 2, color: C.dim },

  // Drawer
  drawer: { flex: 1, backgroundColor: C.surface, borderTopWidth: 1, borderColor: C.border, overflow: 'hidden' },
  tabScroll: { maxHeight: 44, borderBottomWidth: 1, borderColor: C.border },
  tabRow: { flexDirection: 'row', paddingHorizontal: 4, alignItems: 'center', height: 44 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 2, borderColor: 'transparent' },
  tabBtnActive: { borderColor: C.cyan },
  tabText: { fontFamily: FONT_MONO, color: C.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  tabTextActive: { color: C.cyan },
  tabContent: { padding: 12, gap: 4 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 6, gap: 8 },
  sectionLine: { width: 3, height: 14, backgroundColor: C.cyan, borderRadius: 2 },
  sectionTitle: { fontFamily: FONT_MONO, color: C.cyan, fontSize: 10, fontWeight: '700', letterSpacing: 2, flex: 1 },
  sectionSub: { fontFamily: FONT_MONO, color: C.dim, fontSize: 9 },

  // Upgrade row
  upgradeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 12, gap: 10 },
  upgradeName: { fontFamily: FONT_MONO, color: C.white, fontSize: 12, fontWeight: '700' },
  upgradeSub: { color: C.dim, fontSize: 10, marginTop: 2 },
  buyBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.cyan, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, minWidth: 70, alignItems: 'center' },
  buyBtnText: { fontFamily: FONT_MONO, color: C.cyan, fontWeight: '700', fontSize: 12 },

  // Spell cards
  spellCard: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 6, overflow: 'hidden' },
  spellCardAccent: { width: 3 },
  spellCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3, padding: 12, paddingBottom: 0 },
  spellCardName: { fontFamily: FONT_MONO, fontSize: 13, fontWeight: '700', flex: 1 },
  spellCardLv: { fontFamily: FONT_MONO, color: C.dim, fontSize: 10 },
  spellCardStat: { color: C.dim, fontSize: 10, paddingHorizontal: 12 },
  spellCardBtns: { flexDirection: 'row', gap: 8, padding: 12, paddingTop: 8 },
  spellCastBtn: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, alignItems: 'center', minWidth: 70 },
  spellCastText: { fontFamily: FONT_MONO, fontSize: 11, fontWeight: '700' },
  spellUpBtn: { flex: 1, backgroundColor: 'rgba(0,229,255,0.06)', borderWidth: 1, borderColor: C.cyanDark, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  spellUpText: { fontFamily: FONT_MONO, color: C.cyan, fontSize: 10, fontWeight: '700' },
  energyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  energyLabel: { fontFamily: FONT_MONO, color: C.dim, fontSize: 9, letterSpacing: 2 },
  energyVal: { fontFamily: FONT_MONO, color: C.cyan, fontSize: 13, fontWeight: '700' },

  // BOARD tab — motherboard card
  mbCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.borderGlow, padding: 14, gap: 12, marginBottom: 4 },
  mbTierBadge: { backgroundColor: C.cyanDark, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  mbTierText: { fontFamily: FONT_MONO, color: C.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  mbName: { fontFamily: FONT_MONO, color: C.white, fontSize: 13, fontWeight: '700' },
  mbSlotInfo: { color: C.dim, fontSize: 10, marginTop: 2 },
  mbUpgradeBtn: { borderWidth: 1, borderColor: C.cyan, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  mbUpgradeBtnText: { fontFamily: FONT_MONO, color: C.cyan, fontSize: 10, fontWeight: '700' },

  // Slot grid
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  slotCard: { width: (SCREEN_W - 24 - 8 * 2) / 3, minWidth: 96, backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 10, alignItems: 'flex-start' },
  slotLabel: { fontFamily: FONT_MONO, color: C.dim, fontSize: 8, letterSpacing: 1, marginBottom: 4 },
  slotItemName: { fontFamily: FONT_MONO, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  slotItemStats: { color: C.dim, fontSize: 8, marginBottom: 6, lineHeight: 12 },
  slotRemoveBtn: { borderWidth: 1, borderColor: C.dimmer, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 },
  slotRemoveText: { fontFamily: FONT_MONO, color: C.dim, fontSize: 8 },
  slotEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, width: '100%', borderWidth: 1, borderColor: C.dimmer, borderStyle: 'dashed', borderRadius: 4 },
  slotEmptyText: { fontFamily: FONT_MONO, color: C.dimmer, fontSize: 9, letterSpacing: 1 },

  // Gear inventory (BOARD tab)
  gearItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 4, overflow: 'hidden' },
  gearItemAccent: { width: 3, alignSelf: 'stretch' },
  gearName: { fontFamily: FONT_MONO, fontSize: 12, fontWeight: '700' },
  gearStats: { color: C.dim, fontSize: 9, marginTop: 2 },
  rarityTag: { borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, fontSize: 7, fontFamily: FONT_MONO },
  typeTag: { fontFamily: FONT_MONO, color: C.dim, fontSize: 7, letterSpacing: 1 },
  installBtn: { borderWidth: 1, borderColor: C.cyan, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4 },
  installBtnText: { fontFamily: FONT_MONO, color: C.cyan, fontSize: 9, fontWeight: '700' },
  gearScrap: { borderWidth: 1, borderColor: C.redDark, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4 },
  gearScrapText: { fontFamily: FONT_MONO, color: C.red, fontSize: 9, fontWeight: '700' },
  emptyMsg: { fontFamily: FONT_MONO, color: C.dimmer, fontSize: 10, textAlign: 'center', paddingVertical: 16 },

  // Missions
  missionCard: { flexDirection: 'row', backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border, marginBottom: 6, overflow: 'hidden', padding: 12 },
  missionAccent: { width: 3, borderRadius: 2, marginRight: 10, alignSelf: 'stretch' },
  missionName: { color: C.white, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  missionProgress: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  missionPct: { fontFamily: FONT_MONO, color: C.dim, fontSize: 9, width: 32, textAlign: 'right' },
  missionReward: { fontFamily: FONT_MONO, color: C.goldDark, fontSize: 9, letterSpacing: 1 },
  claimBtn: { backgroundColor: C.green, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, alignSelf: 'center', marginLeft: 8 },
  claimText: { fontFamily: FONT_MONO, color: C.bg, fontSize: 10, fontWeight: '900' },

  // Ascend / Prestige (new design)
  ascendShardBox: { alignItems: 'center', paddingVertical: 24, backgroundColor: C.surface2, borderRadius: 12, borderWidth: 1, borderColor: C.borderGlow, marginBottom: 10 },
  ascendShardRing: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: C.cyan,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.cyan, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
  },
  ascendShardNum: { fontFamily: FONT_MONO, color: C.cyan, fontSize: 44, fontWeight: '900', lineHeight: 50 },
  ascendShardLabel: { fontFamily: FONT_MONO, color: C.cyanDark, fontSize: 9, letterSpacing: 3 },
  ascendBonusLine: { fontFamily: FONT_MONO, color: C.dim, fontSize: 11, textAlign: 'center', marginTop: 8 },
  ascendHistoryLine: { fontFamily: FONT_MONO, color: C.dimmer, fontSize: 9, textAlign: 'center', marginTop: 3 },
  ascendBonusMeter: { backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8 },
  ascendMeterLabel: { fontFamily: FONT_MONO, color: C.dim, fontSize: 9, letterSpacing: 1 },
  ascendSummaryCard: { backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  ascendSummaryTitle: { fontFamily: FONT_MONO, color: C.dim, fontSize: 9, letterSpacing: 2, marginBottom: 10 },
  ascendSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderColor: C.dimmer },
  ascendSummaryKey: { fontFamily: FONT_MONO, color: C.dim, fontSize: 11 },
  ascendSummaryVal: { fontFamily: FONT_MONO, color: C.white, fontSize: 11, fontWeight: '700' },
  ascendReqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 12 },
  ascendReqLabel: { fontFamily: FONT_MONO, color: C.dim, fontSize: 9, letterSpacing: 2 },
  ascendReqVal: { fontFamily: FONT_MONO, fontSize: 11, fontWeight: '700' },
  ascendBtn: { borderWidth: 2, paddingVertical: 16, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 10 },
  ascendBtnActive: { borderColor: C.gold, backgroundColor: 'rgba(245,197,24,0.08)' },
  ascendBtnLocked: { borderColor: C.dimmer, backgroundColor: 'transparent' },
  ascendBtnText: { fontFamily: FONT_MONO, color: C.gold, fontWeight: '900', fontSize: 15, letterSpacing: 3 },
  ascendFootnote: { fontFamily: FONT_MONO, color: C.dimmer, fontSize: 9, textAlign: 'center' },

  // Skill tree
  skillHeader: { alignItems: 'center', backgroundColor: C.surface2, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 4 },
  skillPoints: { fontFamily: FONT_MONO, color: C.cyan, fontSize: 40, fontWeight: '900' },
  skillPointsLabel: { fontFamily: FONT_MONO, color: C.cyanDark, fontSize: 9, letterSpacing: 2 },
  skillNote: { fontFamily: FONT_MONO, color: C.dimmer, fontSize: 9, textAlign: 'center', marginBottom: 8 },
  pathLockWarning: { backgroundColor: '#1a0e00', borderRadius: 6, borderWidth: 1, borderColor: C.orange, padding: 10, marginBottom: 8 },
  pathLockText: { fontFamily: FONT_MONO, color: C.orange, fontSize: 9, textAlign: 'center', letterSpacing: 0.5 },
  pathLockBadge: { borderWidth: 1, borderRadius: 6, padding: 8, alignItems: 'center', marginBottom: 8 },
  pathLockBadgeText: { fontFamily: FONT_MONO, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  skillBranch: { marginBottom: 10 },
  skillBranchHeader: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 6, marginTop: 4 },
  skillBranchTitle: { fontFamily: FONT_MONO, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  skillNode: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface2, borderRadius: 6, borderWidth: 1, borderColor: C.border, padding: 10, marginBottom: 4, gap: 8 },
  skillDot: { fontSize: 14, width: 20, textAlign: 'center' },
  skillName: { fontFamily: FONT_MONO, color: C.white, fontSize: 11, fontWeight: '700' },
  skillDesc: { color: C.dim, fontSize: 9, marginTop: 2 },
  skillUnlockBtn: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 4 },
  skillUnlockText: { fontFamily: FONT_MONO, fontSize: 10, fontWeight: '900' },
  lockedPaths: { gap: 6, marginTop: 8 },
  lockedPathRow: { borderWidth: 1, borderRadius: 6, padding: 10, alignItems: 'center' },
  lockedPathText: { fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: C.surface, borderRadius: 12, padding: 24, borderWidth: 1, borderColor: C.borderGlow },
  modalTitle: { fontFamily: FONT_MONO, color: C.cyan, fontSize: 14, fontWeight: '700', letterSpacing: 4, textAlign: 'center', marginBottom: 20 },
  modalBtn: { borderWidth: 1, padding: 16, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  modalBtnText: { fontFamily: FONT_MONO, fontWeight: '700', fontSize: 13, letterSpacing: 2 },
  modalClose: { padding: 16, alignItems: 'center', marginTop: 4 },
  modalCloseText: { fontFamily: FONT_MONO, color: C.dim, fontSize: 12, letterSpacing: 2 },

  // List rows (achievements)
  listRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface2, borderRadius: 6, borderWidth: 1, borderColor: C.border, padding: 10, marginBottom: 4, gap: 8 },
  listRowGreen: { borderColor: C.greenDark },
  listDot: { fontSize: 12, marginTop: 1, width: 16 },
  listName: { fontFamily: FONT_MONO, color: C.white, fontSize: 11, fontWeight: '700' },
  listSub: { color: C.dim, fontSize: 9, marginTop: 2 },

  // Dev
  devToggle: { position: 'absolute', bottom: 8, right: 12, padding: 6, opacity: 0.3 },
  devToggleText: { fontFamily: FONT_MONO, color: C.dim, fontSize: 8 },
  devPanel: { position: 'absolute', bottom: 30, right: 8, flexDirection: 'row', gap: 4, backgroundColor: C.surface, padding: 6, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  devBtn: { borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  devBtnText: { fontFamily: FONT_MONO, color: C.dim, fontSize: 9 },

  // Shared
  btnOff: { opacity: 0.3, borderColor: C.dim },
});
