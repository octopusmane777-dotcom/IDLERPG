import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Animated, ScrollView, Dimensions, Modal, Alert } from 'react-native';
import { ProgressBar, useToast } from '@idlerpg/ui';
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

const { height: SCREEN_H } = Dimensions.get('window');

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
  ],
  repo: repository,
  userId: 'player',
});

interface DamageNum {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  anim: Animated.Value;
}

let dmgIdCounter = 0;

export default function App() {
  const [state, setState] = useState(engine.getState());
  const { showMessage, ToastComponent } = useToast();
  const [damageNums, setDamageNums] = useState<DamageNum[]>([]);
  const [tab, setTab] = useState<'upgrades' | 'energy' | 'prestige' | 'achievements' | 'gear' | 'missions' | 'skilltree'>('upgrades');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const tapScale = useRef(new Animated.Value(1)).current;
  const drawerHeight = useRef(new Animated.Value(1)).current;
  const monsterRef = useRef<View>(null);

  const spawnDamage = (text: string, color: string) => {
    const anim = new Animated.Value(1);
    const id = ++dmgIdCounter;
    const x = Math.random() * 100 - 50;
    const y = -20 - Math.random() * 40;
    const dmg: DamageNum = { id, x, y, text, color, anim };
    setDamageNums(prev => [...prev, dmg]);
    Animated.parallel([
      Animated.timing(anim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      Animated.timing(new Animated.Value(y), { toValue: y - 60, duration: 1200, useNativeDriver: true } as any),
    ]).start(() => {
      setDamageNums(prev => prev.filter(d => d.id !== id));
    });
  };

  useEffect(() => {
    if (damageNums.length > 10) {
      setDamageNums(prev => prev.slice(-8));
    }
  }, [damageNums.length]);

  const toggleMenu = () => {
    const toValue = menuOpen ? 0 : 1;
    Animated.spring(drawerHeight, { toValue, useNativeDriver: false, tension: 80, friction: 12 }).start();
    setMenuOpen(!menuOpen);
  };

  const meta = engine.getUpgradeMetadata();

  useEffect(() => {
    const init = async () => {
      // Try anonymous auth for cross-device sync (non-blocking if unavailable)
      const firebaseRepo = (repository as any)._repos?.find?.((r: any) => typeof r.ensureAnonymousAuth === 'function');
      if (firebaseRepo) {
        await firebaseRepo.ensureAnonymousAuth();
      }
      const saved = await repository.loadGame('player');
      if (saved?.state) engine.loadSavedState(saved.state);
      else engine.initializePlugins();
      setState(engine.getState());
      engine.start();
    };
    init();
    return engine.subscribe(setState);
  }, []);

  const prevState = useRef(state);

  const triggerHaptic = async (type:string) => { try { const h = await import("expo-haptics").then(m=>m).catch(()=>null); if(!h)return; if(type==="tap")h.impactAsync?.(h.ImpactFeedbackStyle?.Light);else if(type==="spell")h.impactAsync?.(h.ImpactFeedbackStyle?.Heavy);else if(type==="kill")h.notificationAsync?.(h.NotificationFeedbackType?.Success); } catch {} }; const handleTap = () => { triggerHaptic("tap");
    spawnDamage(`-${tapDamage + (meta?.plugins?.equipment?.equipment?.bonuses?.tapDamage||0)}`, '#e94560');
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'combo', action: { type: 'TAP_DAMAGE' } } });
    engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'missions', action: { type: 'TAP_DAMAGE' } } });
    // Route tap damage to boss if active, otherwise to adaptive
    const bossState = engine.getState().pluginState.boss;
    if (bossState?.bossActive) {
      const tapDmg = (engine.getState().pluginState.adaptive?.tapDamage ?? 1);
      engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'boss', action: { type: 'BOSS_DAMAGE', damage: tapDmg } } });
    } else {
      engine.dispatch({ type: 'PLUGIN_ACTION', payload: { pluginId: 'adaptive', action: { type: 'TAP_DAMAGE' } } });
    }
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 0.9, duration: 50, useNativeDriver: true }),
      Animated.timing(tapScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    const prev = prevState.current;
    if (state.level > prev.level) { triggerHaptic("kill"); const goldDiff = (state.resources.gold ?? 0) - (prev.resources.gold ?? 0);
      if (goldDiff > 0) spawnDamage(`+${goldDiff.toFixed(0)} 💰`, '#ffd700');
      if (state.level % 25 === 0) showMessage(`Stage ${state.level} Milestone! +${(50 * state.level).toLocaleString()} bonus!`, 3000);
    }
    prevState.current = state;
  }, [state]);

  const gold = (state.resources?.gold ?? 0);
  const a = state.pluginState.adaptive;
  const monsterHp = a?.monsterHp ?? 0;
  const monsterMaxHp = a?.monsterMaxHp ?? 0;
  const monstersDefeated = a?.monstersDefeated ?? 0;
  const tapDamage = a?.tapDamage ?? 1;
  const hpPct = monsterMaxHp > 0 ? monsterHp / monsterMaxHp : 1;
  const canUpgradeTap = gold >= (meta.plugins['adaptive']?.upgrade?.cost ?? 0);
  const combo = meta.plugins['combo']?.combo;
  const boss = meta.plugins['boss']?.boss;
  const network = meta.plugins['network']?.network;
  const missions = meta.plugins['missions']?.missions;
  const skilltree = meta.plugins['skilltree']?.skilltree;

  const drawerMaxH = drawerHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [50, SCREEN_H * 0.55],
  });

  const spacerH = drawerHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.goldDisplay}>
          <Text style={styles.goldLabel}>CPU</Text>
          <Text style={styles.goldValue}>{gold < 1000 ? gold.toFixed(0) : gold < 1000000 ? (gold / 1000).toFixed(1) + 'K' : (gold / 1000000).toFixed(2) + 'M'}</Text>
        </View>
        <View style={styles.stageDisplay}>
          <Text style={styles.stageLabel}>TIER</Text>
          <Text style={styles.stageValue}>{state.level}</Text>
        </View>
        <Pressable style={styles.settingsBtn} onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel="Open settings">
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
      </View>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Settings</Text>
          <Pressable style={styles.modalBtn} onPress={async () => { await engine.flushSave(); showMessage('Game saved!'); }}><Text style={styles.modalBtnText}>Manual Save</Text></Pressable>
          <Pressable style={[styles.modalBtn, { backgroundColor: '#1a3a2a' }]} onPress={async () => { const json = JSON.stringify({ state: engine.getState(), exportedAt: Date.now() }); try { if (navigator?.clipboard?.writeText) { await navigator.clipboard.writeText(json); showMessage('Copied!'); } } catch { Alert.alert('Export', json.slice(0,500)+'...'); } }}>
            <Text style={styles.modalBtnText}>Export Save</Text>
          </Pressable>
          <Pressable style={[styles.modalBtn,{backgroundColor:'#3a2a1a'}]} onPress={async () => { try { const t = await navigator?.clipboard?.readText(); if(t){ engine.loadSavedState(JSON.parse(t).state||JSON.parse(t)); setState(engine.getState()); showMessage('Imported!'); } } catch { showMessage('Import failed'); } }}>
            <Text style={styles.modalBtnText}>Import Save</Text>
          </Pressable>
          <Pressable style={[styles.modalBtn,{backgroundColor:'#555'}]} onPress={()=>setSettingsOpen(false)}><Text style={styles.modalBtnText}>Close</Text></Pressable>
        </View></View>
      </Modal>

      <ToastComponent />

      {meta.plugins['onboarding']?.onboarding && !meta.plugins['onboarding']?.onboarding?.completed && (
        <View style={styles.tutorialCard}>
          <Text style={styles.tutorialStep}>Tutorial ({meta.plugins['onboarding']?.onboarding?.step + 1}/{meta.plugins['onboarding']?.onboarding?.total})</Text>
          <Text style={styles.tutorialTitle}>{meta.plugins['onboarding']?.onboarding?.title}</Text>
          <Text style={styles.tutorialTip}>{meta.plugins['onboarding']?.onboarding?.tip}</Text>
          <View style={styles.tutorialBtns}>
            <Pressable style={styles.tutBtnPrimary} onPress={()=>engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'onboarding',action:{type:'NEXT_STEP'}}})}><Text style={styles.tutBtnText}>Next</Text></Pressable>
            <Pressable style={styles.tutBtnSkip} onPress={()=>engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'onboarding',action:{type:'SKIP_TUTORIAL'}}})}><Text style={styles.tutBtnTextSkip}>Skip</Text></Pressable>
          </View>
        </View>
      )}

      <View style={styles.damageOverlay} pointerEvents="none">
        {damageNums.map(d => (
          <Animated.Text key={d.id} style={[styles.damageNum, { color: d.color, opacity: d.anim, transform: [{ translateX: d.x }, { translateY: d.anim.interpolate({ inputRange: [0, 1], outputRange: [d.y + 60, d.y] }) }] }]}>
            {d.text}
          </Animated.Text>
        ))}
      </View>

      {combo?.count > 2 && (
        <View style={styles.comboOverlay} pointerEvents="none">
          <Text style={[styles.comboText, { color: combo.count >= 15 ? '#ff4400' : combo.count >= 8 ? '#ffa500' : '#ffd700' }]}>
            x{combo.multiplier.toFixed(1)} COMBO!
          </Text>
        </View>
      )}

      {boss?.bossActive && (
        <View style={styles.bossBar}>
          <Text style={styles.bossLabel}>BOSS ALERT  {boss.bossTimer.toFixed(0)}s</Text>
          <ProgressBar current={boss.bossHp} max={boss.bossMaxHp} color="#ff4400" bgColor="#1a0000" />
          <Text style={styles.bossHpText}>{boss.bossHp.toFixed(0)} / {boss.bossMaxHp}</Text>
        </View>
      )}

      <Pressable style={styles.monsterArea} onPress={handleTap}>
        <Animated.View style={{transform:[{scale:tapScale}]}}><Text style={styles.monsterEmoji}>{boss?.bossActive ? '⚠️' : stageEmoji(state.level)}</Text></Animated.View>
        <Text style={[styles.monsterName, boss?.bossActive && {color:'#ff4400'}]}>{boss?.bossActive ? 'BOSS' : stageName(state.level)} Lv.{state.level}</Text>
        {!boss?.bossActive && <ProgressBar current={monsterHp} max={monsterMaxHp} color="#e94560" bgColor="#1a1a2e" />}
        {!boss?.bossActive && <Text style={styles.healthText}>{monsterHp.toFixed(0)} / {monsterMaxHp}</Text>}
        <Text style={styles.dpsText}>Hack: {tapDamage} | Daemon: 1 | Compromised: {monstersDefeated}</Text>
      </Pressable>

      <View style={styles.spellBar}>
        {(meta.plugins['energy']?.energy?.spells ?? []).map((s:any)=>(
          <Pressable key={s.id} style={[styles.spellCircle,{borderColor:s.color||'#fff'},!s.canCast&&styles.spellCircleDisabled,s.cooldownRemaining>0&&styles.spellCircleCooldown]} onPress={()=>{if(s.canCast){triggerHaptic("spell");spawnDamage(`-${((tapDamage + (meta?.plugins?.equipment?.equipment?.bonuses?.tapDamage||0)) * s.multiplier).toFixed(0)} ${s.name}!`,s.color);engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'energy',action:{type:s.id}}});showMessage(s.name+'!');}}} disabled={!s.canCast} accessibilityRole="button" accessibilityLabel={`${s.name}. ${s.canCast?'Available':s.cooldownRemaining>0?`CD ${s.cooldownRemaining.toFixed(0)}s`:'Need energy'}`} accessibilityState={{disabled:!s.canCast}}>
            <Text style={[styles.spellCircleName,{color:s.color||'#fff'}]}>{s.name}</Text>
            {s.cooldownRemaining>0?<Text style={styles.spellCircleCD}>{s.cooldownRemaining.toFixed(0)}s</Text>:<Text style={styles.spellCircleCost}>{s.cost}⚡</Text>}
          </Pressable>
        ))}
      </View>

      <Animated.View style={{ height: spacerH }} />

      <Animated.View style={[styles.drawer, { height: drawerMaxH }]}>
        <Pressable style={styles.drawerHandle} onPress={toggleMenu}>
          <View style={styles.handleBar} />
          <Text style={styles.handleText}>{menuOpen ? '▲ Hide' : '▼ Show'}</Text>
        </Pressable>

        <View style={styles.tabBar}>
          {(['upgrades','energy','missions','prestige','gear','achievements','skilltree']as const).map(t=>(
            <Pressable key={t} style={[styles.tab,tab===t&&styles.tabActive]} onPress={()=>setTab(t)}>
              <Text style={[styles.tabText,tab===t&&styles.tabTextActive]}>{
                t==='upgrades'?'Upgrades':
                t==='energy'?'CPU Power':
                t==='missions'?'Missions':
                t==='prestige'?'Prestige':
                t==='gear'?'Hardware':
                t==='achievements'?'Milestones':
                'Skill Tree'
              }</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={{flex:1}}>
          {tab==='upgrades'&&(
            <View>
              <View style={styles.upgradeRow}>
                <View style={{flex:1}}>
                  <Text style={styles.upgradeName}>Tap Power Lv.{Math.max(0,(tapDamage-1))}</Text>
                  <Text style={styles.upgradeEffect}>+1 Tap Dmg</Text>
                </View>
                <Pressable style={[styles.upgradeBtn,!canUpgradeTap&&styles.upgradeBtnDisabled]} onPress={()=>{if(canUpgradeTap){engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'adaptive',action:{type:'UPGRADE_TAP',payload:{cost:meta.plugins['adaptive']?.upgrade?.cost}}}});showMessage('Tap Dmg +1');}}} disabled={!canUpgradeTap}>
                  <Text style={styles.upgradeBtnText}>{meta.plugins['adaptive']?.upgrade?.cost??'?'}</Text>
                </Pressable>
              </View>
              <Text style={styles.sectionHeader}>Network Nodes</Text>
              <Text style={styles.sectionSubtitle}>{(network?.totalOutput??0).toFixed(1)} CPU/s passive</Text>
              {(network?.nodes??[]).map((n:any)=>(
                <View key={n.id} style={styles.upgradeRow}>
                  <View style={{flex:1}}>
                    <Text style={styles.upgradeName}>{n.name} ({n.count})</Text>
                    <Text style={styles.upgradeEffect}>{n.description} | +{(n.rate).toFixed(1)}/s total</Text>
                  </View>
                  <Pressable style={[styles.upgradeBtn,!n.canBuy&&styles.upgradeBtnDisabled]} onPress={()=>{if(n.canBuy){engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'network',action:{type:'BUY_NODE',nodeId:n.id}}});showMessage(n.name+' +1');}}} disabled={!n.canBuy} accessibilityRole="button" accessibilityLabel={`Buy ${n.name}. Cost: ${n.nextCost}`} accessibilityState={{disabled:!n.canBuy}}>
                    <Text style={styles.upgradeBtnText}>{n.nextCost>=1000000?(n.nextCost/1000000).toFixed(1)+'M':n.nextCost>=1000?(n.nextCost/1000).toFixed(0)+'K':n.nextCost}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {tab==='energy'&&(
            <>
              <View style={{marginHorizontal:16,marginTop:12}}>
                <ProgressBar current={meta.plugins['energy']?.energy?.current??0} max={meta.plugins['energy']?.energy?.max??50} color="#00b4d8" bgColor="#1a1a2e" />
                <Text style={styles.energyText}>{(meta.plugins['energy']?.energy?.current??0).toFixed(0)}/{meta.plugins['energy']?.energy?.max??50}</Text>
              </View>
               {(meta.plugins['energy']?.energy?.spells??[]).map((s:any)=>(
                 <View key={s.id} style={[styles.spellRow,!s.canCast&&styles.spellRowDisabled]}>
                   <View style={{flex:1}}>
                     <Text style={[styles.spellName,{color:s.color||'#fff'}]}>{s.name} <Text style={styles.spellLevel}>Lv.{s.level}</Text></Text>
                     <Text style={styles.spellEffect}>x{s.multiplier} dmg | {s.cooldown}s CD</Text>
                     <View style={{flexDirection:'row',marginTop:6,gap:8}}>
                       <Pressable style={[styles.spellCostBadge,{borderColor:s.color||'#fff'}]} onPress={()=>{if(s.canCast){engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'energy',action:{type:s.id}}});showMessage(s.name+'!');}}} disabled={!s.canCast} accessibilityRole="button" accessibilityLabel={`Cast ${s.name}`} accessibilityState={{disabled:!s.canCast}}>
                         <Text style={[styles.spellCostText,{color:s.color||'#fff'}]}>{s.cost}</Text><Text style={styles.spellCostLabel}>⚡</Text>
                       </Pressable>
                       <Pressable style={[styles.spellUpgradeBtn,!s.canUpgrade&&styles.spellUpgradeBtnDisabled]} onPress={()=>{if(s.canUpgrade){engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'energy',action:{type:s.upgradeAction}}});showMessage(`${s.name} Lv.${s.level+1}!`);}}} disabled={!s.canUpgrade} accessibilityRole="button" accessibilityLabel={`Upgrade ${s.name} to level ${s.level+1}. Cost: ${s.upgradeCost}`} accessibilityState={{disabled:!s.canUpgrade}}>
                         <Text style={[styles.spellUpgradeText,!s.canUpgrade&&styles.spellUpgradeTextDisabled]}>{s.canUpgrade ? `${s.upgradeCost}` : s.upgradeCost}</Text>
                       </Pressable>
                     </View>
                   </View>
                 </View>
              ))}
            </>
          )}
          {tab==='prestige'&&(
            <View style={styles.prestigeCard}>
              <Text style={styles.prestigeCore}>{meta.plugins['prestige']?.prestige?.cores??0} Shards</Text>
              <Text style={styles.prestigeBonus}>+{(((meta.plugins['prestige']?.prestige?.bonusMultiplier??1)-1)*100).toFixed(1)}%</Text>
              <Text style={styles.prestigeNext}>Next: Tier {meta.plugins['prestige']?.prestige?.requiredLevel??10}</Text>
              <Pressable style={[styles.prestigeBtn,!meta.plugins['prestige']?.prestige?.canPrestige&&styles.prestigeBtnDisabled]} onPress={()=>{if(meta.plugins['prestige']?.prestige?.canPrestige){engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'prestige',action:{type:'PRESTIGE'}}});showMessage('Evolution!');}}} disabled={!meta.plugins['prestige']?.prestige?.canPrestige}>
                <Text style={styles.prestigeBtnText}>{meta.plugins['prestige']?.prestige?.canPrestige?'ASCEND AI':`NEED TIER ${meta.plugins['prestige']?.prestige?.requiredLevel??10}`}</Text>
              </Pressable>
            </View>
          )}
          {tab==='gear'&&(
            <View style={{paddingHorizontal:16}}>
              <Text style={{color:'#ffd700',fontSize:13,fontWeight:'700',marginTop:12,marginBottom:4}}>Equipped</Text>
              {(['weapon','armor','ring']as const).map(slot=>{
                const gearId = meta.plugins['equipment']?.equipment?.equipped?.[slot];
                const gear = gearId ? (meta.plugins['equipment']?.equipment?.inventory??[]).find((g:any)=>g.id===gearId) : null;
                return (
                  <View key={slot} style={[styles.gearSlotRow,!gear&&styles.gearSlotEmpty]}>
                    <Text style={styles.gearSlotLabel}>{slot.toUpperCase()}</Text>
                    {gear ? (
                      <View style={{flex:1}}>
                        <Text style={{color:gear.color||'#aaa',fontWeight:'700',fontSize:13}}>{gear.name}</Text>
                        <Text style={{color:'#888',fontSize:10}}>{Object.entries(gear.bonuses||{}).map(([k,v]:any)=>`+${v} ${k}`).join(' | ')}</Text>
                      </View>
                    ) : <Text style={{color:'#555',fontSize:12,flex:1}}>Empty</Text>}
                    {gear && (
                      <Pressable style={styles.gearBtn} onPress={()=>engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'equipment',action:{type:'UNEQUIP',slot}}})}>
                        <Text style={styles.gearBtnText}>Un</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
              <Text style={{color:'#ffd700',fontSize:13,fontWeight:'700',marginTop:16,marginBottom:4}}>Inventory</Text>
              {(meta.plugins['equipment']?.equipment?.inventory??[]).filter((g:any)=>!g.equipped).map((g:any)=>(
                <View key={g.id} style={styles.gearRow}>
                  <View style={{flex:1}}>
                    <Text style={{color:g.color||'#aaa',fontWeight:'700',fontSize:12}}>{g.name}</Text>
                    <Text style={{color:'#888',fontSize:9}}>{g.slot} | {Object.entries(g.bonuses||{}).map(([k,v]:any)=>`+${v} ${k}`).join(' | ')}</Text>
                  </View>
                  <Pressable style={[styles.gearBtn,{marginRight:4}]} onPress={()=>engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'equipment',action:{type:'EQUIP',gearId:g.id}}})}>
                    <Text style={styles.gearBtnText}>Eqp</Text>
                  </Pressable>
                  <Pressable style={[styles.gearBtn,{backgroundColor:'#3a1a1a'}]} onPress={()=>engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'equipment',action:{type:'SCRAP',gearId:g.id}}})}>
                    <Text style={[styles.gearBtnText,{color:'#e94560'}]}>Scr</Text>
                  </Pressable>
                </View>
              ))}
              {(meta.plugins['equipment']?.equipment?.inventory??[]).filter((g:any)=>!g.equipped).length===0&&(
                <Text style={{color:'#555',fontSize:12,marginTop:8}}>No hardware. Compromise targets to find parts!</Text>
              )}
            </View>
          )}
          {tab==='achievements'&&(
            <View style={{paddingHorizontal:16}}>
              <Text style={styles.achCount}>{meta.plugins['achievements']?.achievements?.unlockedCount??0}/{meta.plugins['achievements']?.achievements?.total??6} Milestones</Text>
              {(meta.plugins['achievements']?.achievements?.list??[]).map((a:any)=>(<View key={a.id} style={[styles.achRow,a.unlocked&&styles.achUnlocked]}><Text style={styles.achName}>{a.unlocked?'✅':'⬜'} {a.name}</Text><Text style={styles.achDesc}>{a.description}{a.unlocked?` (+${a.reward})`:''}</Text></View>))}
            </View>
          )}
          {tab==='missions'&&(
            <View style={{paddingHorizontal:16}}>
              <Text style={styles.achCount}>Daily Missions — resets in {missions?.hoursUntilReset??0}h</Text>
              {(missions?.list??[]).map((m:any)=>(
                <View key={m.id} style={[styles.achRow, m.completed&&!m.claimed&&styles.achUnlocked, m.claimed&&{opacity:0.4}]}>
                  <View style={{flex:1}}>
                    <Text style={styles.achName}>{m.claimed?'✅':m.completed?'🎯':''} {m.description}</Text>
                    <Text style={styles.achDesc}>{m.progress}/{m.target} | Reward: {m.reward} CPU</Text>
                  </View>
                  {m.completed&&!m.claimed&&(
                    <Pressable style={[styles.upgradeBtn,{paddingHorizontal:12,paddingVertical:8}]} onPress={()=>{engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'missions',action:{type:'CLAIM_MISSION',missionId:m.id}}});showMessage('+'+m.reward+' CPU!');}} accessibilityRole="button" accessibilityLabel={`Claim mission reward: ${m.reward} CPU`}>
                      <Text style={styles.upgradeBtnText}>Claim</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
          {tab==='skilltree'&&(
            <View style={{paddingHorizontal:16}}>
              <Text style={styles.achCount}>{skilltree?.points??0} skill point{(skilltree?.points??0)!==1?'s':''} available</Text>
              <Text style={{color:'#888',fontSize:11,marginBottom:8}}>Earn points by prestiging. Each branch unlocks in order.</Text>
              {(['HACK','INFRA','GHOST']as const).map(branch=>(
                <View key={branch} style={{marginTop:12}}>
                  <Text style={styles.sectionHeader}>{branch==='HACK'?'Hack Branch':branch==='INFRA'?'Infra Branch':'Ghost Branch'}</Text>
                  {(skilltree?.nodes??[]).filter((n:any)=>n.branch===branch).map((n:any)=>(
                    <View key={n.id} style={[styles.achRow,n.unlocked&&styles.achUnlocked,n.locked&&{opacity:0.35}]}>
                      <View style={{flex:1}}>
                        <Text style={styles.achName}>{n.unlocked?'✅':n.available?'○':'🔒'} {n.name}</Text>
                        <Text style={styles.achDesc}>{n.description}</Text>
                      </View>
                      {n.available&&(
                        <Pressable style={[styles.upgradeBtn,{paddingHorizontal:12,paddingVertical:8}]} onPress={()=>{engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'skilltree',action:{type:'UNLOCK_SKILL',nodeId:n.id}}});showMessage(n.name+' unlocked!');}} accessibilityRole="button" accessibilityLabel={`Unlock ${n.name}`}>
                          <Text style={styles.upgradeBtnText}>1pt</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <Pressable style={styles.devToggle} onPress={()=>engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'debug',action:{type:'TOGGLE_DEBUG'}}})}><Text style={styles.devToggleText}>{meta.plugins['debug']?.debug?.visible?'Hide':'Dev'}</Text></Pressable>
      {meta.plugins['debug']?.debug?.visible&&(
        <View style={styles.devPanel}>
          <Pressable style={styles.devBtn} onPress={()=>engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'debug',action:{type:'ADD_GOLD',amount:1000}}})}><Text style={styles.devBtnText}>+1K</Text></Pressable>
          <Pressable style={styles.devBtn} onPress={()=>engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'debug',action:{type:'ADD_GOLD',amount:100000}}})}><Text style={styles.devBtnText}>+100K</Text></Pressable>
          <Pressable style={styles.devBtn} onPress={()=>engine.dispatch({type:'PLUGIN_ACTION',payload:{pluginId:'debug',action:{type:'SET_LEVEL',level:15}}})}><Text style={styles.devBtnText}>St.15</Text></Pressable>
          <Pressable style={[styles.devBtn,{backgroundColor:'#e94560'}]} onPress={async()=>{try{localStorage.removeItem('idlerpg_user_player')}catch{};location.reload()}}><Text style={styles.devBtnText}>Reset</Text></Pressable>
        </View>
      )}
    </View>
  );
}

function stageEmoji(level: number): string {
  if (level >= 40) return '⚔️';
  if (level >= 30) return '🏛️';
  if (level >= 20) return '💰';
  if (level >= 10) return '🏢';
  return '🔌';
}

function stageName(level: number): string {
  if (level >= 40) return 'Military';
  if (level >= 30) return 'Gov';
  if (level >= 20) return 'Bank';
  if (level >= 10) return 'Corp';
  return 'ISP';
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#0a0a12',paddingTop:50},
  topBar:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:20,paddingBottom:10,borderBottomWidth:1,borderColor:'#1a1a2e'},
  goldDisplay:{alignItems:'flex-start'},
  goldLabel:{color:'#b8860b',fontSize:10,fontWeight:'700',letterSpacing:2},
  goldValue:{color:'#ffd700',fontSize:26,fontWeight:'900'},
  gpsText:{color:'#666',fontSize:12},
  stageDisplay:{alignItems:'flex-end'},
  stageLabel:{color:'#6b8cff',fontSize:10,fontWeight:'700',letterSpacing:2},
  stageValue:{color:'#fff',fontSize:26,fontWeight:'900'},
  settingsBtn:{paddingHorizontal:8,justifyContent:'center'},
  settingsIcon:{fontSize:20},
  tutorialCard:{margin:16,padding:16,backgroundColor:'#1a1a2e',borderRadius:12,borderWidth:1,borderColor:'#ffd700'},
  tutorialStep:{color:'#888',fontSize:11,marginBottom:4},
  tutorialTitle:{color:'#ffd700',fontSize:16,fontWeight:'700'},
  tutorialTip:{color:'#ccc',fontSize:13,marginTop:4},
  tutorialBtns:{flexDirection:'row',gap:10,marginTop:12},
  tutBtnPrimary:{flex:1,backgroundColor:'#ffd700',padding:12,borderRadius:8,alignItems:'center'},
  tutBtnText:{color:'#0a0a12',fontWeight:'700'},
  tutBtnSkip:{flex:1,backgroundColor:'#333',padding:12,borderRadius:8,alignItems:'center'},
  tutBtnTextSkip:{color:'#aaa'},
  monsterArea:{alignItems:'center',paddingVertical:20,paddingHorizontal:30},
  monsterEmoji:{fontSize:40,marginBottom:8,color:'#e94560',fontWeight:'900'},
  monsterName:{color:'#e94560',fontSize:14,fontWeight:'700',marginBottom:10},
  healthText:{color:'#aaa',fontSize:11,marginTop:4},
  dpsText:{color:'#888',fontSize:11,marginTop:4},
  damageOverlay:{position:'absolute',top:'30%',left:'20%',right:'20%',bottom:'40%',alignItems:'center',justifyContent:'center',zIndex:20},
  damageNum:{fontSize:20,fontWeight:'900',position:'absolute'},
  spellBar:{flexDirection:'row',justifyContent:'center',gap:10,paddingHorizontal:16,marginBottom:12},
  spellCircle:{width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center',borderWidth:2,backgroundColor:'#12121e'},
  spellCircleDisabled:{opacity:0.35},
  spellCircleCooldown:{borderStyle:'dashed'},
  spellCircleName:{fontSize:8,fontWeight:'700'},
  spellCircleCD:{fontSize:9,color:'#888',marginTop:1},
  spellCircleCost:{fontSize:8,color:'#888',marginTop:1},
  drawer:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#0d0d18',borderTopLeftRadius:20,borderTopRightRadius:20,borderWidth:1,borderColor:'#1a1a2e',overflow:'hidden',minHeight:56},
  drawerHandle:{alignItems:'center',paddingVertical:12,backgroundColor:'#1a1a2e',borderTopLeftRadius:20,borderTopRightRadius:20},
  handleBar:{width:36,height:4,borderRadius:2,backgroundColor:'#aaa',marginBottom:4},
  handleText:{color:'#aaa',fontSize:10,fontWeight:'600'},
  tabBar:{flexDirection:'row',borderTopWidth:1,borderColor:'#1a1a2e'},
  tab:{flex:1,paddingVertical:12,alignItems:'center',borderBottomWidth:2,borderColor:'transparent'},
  tabActive:{borderColor:'#ffd700'},
  tabText:{color:'#555',fontSize:11,fontWeight:'600'},
  tabTextActive:{color:'#ffd700'},
  upgradeRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#12121e',padding:14,borderRadius:10,marginHorizontal:16,marginTop:8},
  upgradeName:{color:'#fff',fontSize:14,fontWeight:'600'},
  upgradeEffect:{color:'#888',fontSize:11,marginTop:2},
  upgradeBtn:{backgroundColor:'#7b2ff7',paddingHorizontal:20,paddingVertical:12,borderRadius:8},
  upgradeBtnDisabled:{backgroundColor:'#2a2a3a'},
  upgradeBtnText:{color:'#fff',fontWeight:'700',fontSize:14},
  energyText:{color:'#fff',fontWeight:'700',fontSize:13,textAlign:'center',marginTop:2},
  spellRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#12121e',padding:14,borderRadius:10,marginHorizontal:16,marginTop:8},
  spellRowDisabled:{backgroundColor:'#0e0e15',opacity:0.5},
  spellName:{fontSize:15,fontWeight:'700'},
  spellEffect:{color:'#888',fontSize:11,marginTop:2},
  spellCostBadge:{flexDirection:'row',alignItems:'center',gap:2,paddingHorizontal:12,paddingVertical:8,borderRadius:8,borderWidth:1},
  spellCostText:{fontSize:13,fontWeight:'700'},
  spellCostLabel:{fontSize:10},
  spellLevel:{fontSize:11,fontWeight:'600',color:'#888'},
  spellUpgradeBtn:{backgroundColor:'rgba(123,47,247,0.3)',paddingHorizontal:10,paddingVertical:6,borderRadius:6,borderWidth:1,borderColor:'#7b2ff7'},
  spellUpgradeBtnDisabled:{backgroundColor:'#1a1a2e',borderColor:'#333'},
  spellUpgradeText:{color:'#7b2ff7',fontSize:11,fontWeight:'700'},
  spellUpgradeTextDisabled:{color:'#444',fontSize:11,fontWeight:'700'},
  prestigeCard:{alignItems:'center',paddingVertical:20},
  prestigeCore:{color:'#00d4ff',fontSize:24,fontWeight:'900'},
  prestigeBonus:{color:'#ffd700',fontSize:13,marginTop:4},
  prestigeNext:{color:'#888',fontSize:12,marginTop:8},
  prestigeBtn:{backgroundColor:'#00d4ff',paddingHorizontal:30,paddingVertical:14,borderRadius:25,marginTop:16},
  prestigeBtnDisabled:{backgroundColor:'#2a2a3a'},
  prestigeBtnText:{color:'#0a0a12',fontWeight:'900',fontSize:14},
  achCount:{color:'#ffd700',fontSize:14,fontWeight:'700',marginTop:12,marginBottom:8},
  achRow:{backgroundColor:'#12121e',padding:12,borderRadius:8,marginTop:6},
  achUnlocked:{borderColor:'#04d361',borderWidth:1},
  achName:{color:'#fff',fontSize:13,fontWeight:'600'},
  achDesc:{color:'#888',fontSize:11,marginTop:2},
  gearSlotRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#12121e',padding:12,borderRadius:8,marginTop:6},
  gearSlotEmpty:{opacity:0.4},
  gearSlotLabel:{color:'#888',fontSize:10,fontWeight:'700',width:60},
  gearRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#12121e',padding:8,borderRadius:8,marginTop:4},
  gearBtn:{backgroundColor:'#7b2ff7',paddingHorizontal:10,paddingVertical:6,borderRadius:6},
  gearBtnText:{color:'#fff',fontSize:10,fontWeight:'700'},
  comboOverlay:{position:'absolute',top:120,left:0,right:0,alignItems:'center',zIndex:25},
  comboText:{fontSize:22,fontWeight:'900',letterSpacing:2},
  bossBar:{marginHorizontal:16,marginTop:4,backgroundColor:'#1a0000',padding:10,borderRadius:8,borderWidth:1,borderColor:'#ff4400'},
  bossLabel:{color:'#ff4400',fontSize:12,fontWeight:'700',marginBottom:4,textAlign:'center'},
  bossHpText:{color:'#ff8888',fontSize:10,textAlign:'center',marginTop:2},
  sectionHeader:{color:'#ffd700',fontSize:12,fontWeight:'700',marginTop:14,marginBottom:2,marginHorizontal:16},
  sectionSubtitle:{color:'#888',fontSize:10,marginBottom:4,marginHorizontal:16},
  devToggle:{position:'absolute',bottom:55,right:16,padding:8},
  devToggleText:{color:'#444',fontSize:10},
  devPanel:{position:'absolute',bottom:100,right:8,flexDirection:'row',gap:4,backgroundColor:'#1a1a2e',padding:8,borderRadius:8},
  devBtn:{backgroundColor:'#333',paddingHorizontal:10,paddingVertical:6,borderRadius:6},
  devBtnText:{color:'#aaa',fontSize:10},
  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'center',padding:20},
  modalCard:{backgroundColor:'#1a1a2e',borderRadius:16,padding:24,borderWidth:1,borderColor:'#333'},
  modalTitle:{color:'#fff',fontSize:20,fontWeight:'700',marginBottom:20,textAlign:'center'},
  modalBtn:{padding:16,borderRadius:12,marginTop:10,alignItems:'center',backgroundColor:'#7b2ff7'},
  modalBtnText:{color:'#fff',fontWeight:'700',fontSize:15},
});