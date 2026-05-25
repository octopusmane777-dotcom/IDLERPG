import { EnginePlugin, GameState } from './BaseTypes';

export interface NetworkPluginState {
  nodes: Record<string, number>; // nodeId -> count owned
}

interface NodeDef {
  id: string;
  name: string;
  description: string;
  baseRate: number; // DPS per unit
  baseCost: number;
}

export const NETWORK_NODES: NodeDef[] = [
  { id: 'bot_farm',      name: 'Bot Farm',       description: '+1 DPS each',     baseRate: 1,     baseCost: 30 },
  { id: 'scraper',       name: 'Data Scraper',    description: '+5 DPS each',     baseRate: 5,     baseCost: 300 },
  { id: 'proxy_cluster', name: 'Proxy Cluster',   description: '+20 DPS each',    baseRate: 20,    baseCost: 2000 },
  { id: 'ai_server',     name: 'AI Server',       description: '+100 DPS each',   baseRate: 100,   baseCost: 12000 },
  { id: 'quantum_core',  name: 'Quantum Core',    description: '+600 DPS each',   baseRate: 600,   baseCost: 80000 },
];

function nodeCost(def: NodeDef, owned: number): number {
  return Math.round(def.baseCost * Math.pow(2, owned));
}

export class NetworkPlugin implements EnginePlugin {
  id = 'network';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      const nodes: Record<string, number> = {};
      for (const n of NETWORK_NODES) nodes[n.id] = 0;
      engine.setPluginState(this.id, { nodes } as NetworkPluginState);
    }
  }

  onTick(state: GameState, deltaSec: number) {
    const nState: NetworkPluginState = state.pluginState[this.id];
    if (!nState) return;

    // When a boss is active, network DPS is routed to the boss by BossPlugin instead.
    if (state.pluginState.boss?.bossActive) return;

    const ownedNodes = nState.nodes || {};
    let totalDps = 0;
    for (const n of NETWORK_NODES) {
      totalDps += (ownedNodes[n.id] || 0) * n.baseRate;
    }
    if (totalDps <= 0) return;

    // Apply DPS as damage to the current monster when adaptive plugin is present
    const adaptiveState = state.pluginState?.adaptive;
    if (!adaptiveState) {
      // Fallback: add gold directly (used in isolated tests / no combat module)
      return {
        resources: { ...state.resources, gold: (state.resources.gold || 0) + totalDps * deltaSec },
      };
    }

    const damage = totalDps * deltaSec;
    const hp = Math.max(0, (adaptiveState.monsterHp ?? 0) - damage);
    let newLevel = state.level;
    let goldGained = 0;
    let newMaxHp = adaptiveState.monsterMaxHp ?? 10;
    let newDefeated = adaptiveState.monstersDefeated ?? 0;

    if (hp <= 0 && (adaptiveState.monsterHp ?? 0) > 0) {
      newDefeated += 1;
      newLevel = state.level + 1;
      newMaxHp = Math.round(10 * Math.pow(1.12, newLevel));
      goldGained = 10 + 8 * newLevel;
      if (newLevel % 25 === 0) goldGained += 50 * newLevel;
    }

    const result: any = {
      pluginState: {
        adaptive: {
          ...adaptiveState,
          monsterHp: hp <= 0 ? newMaxHp : hp,
          monsterMaxHp: newMaxHp,
          monstersDefeated: newDefeated,
        },
      },
    };

    if (newLevel !== state.level) result.level = newLevel;
    if (goldGained > 0) {
      result.resources = { ...state.resources, gold: (state.resources.gold || 0) + goldGained };
    }

    return result;
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const nState: NetworkPluginState = state.pluginState[this.id];
    if (!nState) return undefined;

    const ownedNodes = nState.nodes || {};
    const gold = state.resources.gold || 0;
    let totalOutput = 0;
    const nodes = NETWORK_NODES.map(n => {
      const count = ownedNodes[n.id] || 0;
      const rate = count * n.baseRate;
      totalOutput += rate;
      const nextCost = nodeCost(n, count);
      return {
        id: n.id,
        name: n.name,
        description: n.description,
        count,
        rate,
        nextCost,
        canBuy: gold >= nextCost,
      };
    });

    return {
      network: { nodes, totalOutput },
    };
  }

  onAction(state: GameState, action: any) {
    if (action.type !== 'BUY_NODE') return;

    const nState: NetworkPluginState = state.pluginState[this.id];
    if (!nState) return;

    const nodeId: string = action.nodeId;
    const def = NETWORK_NODES.find(n => n.id === nodeId);
    if (!def) return;

    const owned = (nState.nodes || {})[nodeId] || 0;
    const cost = nodeCost(def, owned);
    const gold = state.resources.gold || 0;
    if (gold < cost) return;

    return {
      resources: { ...state.resources, gold: gold - cost },
      pluginState: {
        [this.id]: { nodes: { ...(nState.nodes || {}), [nodeId]: owned + 1 } },
      },
    };
  }
}
