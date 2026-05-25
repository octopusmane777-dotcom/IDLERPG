import { EnginePlugin, GameState } from './BaseTypes';

export interface NetworkPluginState {
  nodes: Record<string, number>; // nodeId -> count owned
}

interface NodeDef {
  id: string;
  name: string;
  description: string;
  baseRate: number; // gold/sec per unit
  baseCost: number;
}

export const NETWORK_NODES: NodeDef[] = [
  { id: 'bot_farm',       name: 'Bot Farm',        description: '+0.5 CPU/s each',  baseRate: 0.5,   baseCost: 50 },
  { id: 'scraper',        name: 'Data Scraper',     description: '+3 CPU/s each',    baseRate: 3,     baseCost: 500 },
  { id: 'proxy_cluster',  name: 'Proxy Cluster',    description: '+15 CPU/s each',   baseRate: 15,    baseCost: 3000 },
  { id: 'ai_server',      name: 'AI Server',        description: '+75 CPU/s each',   baseRate: 75,    baseCost: 20000 },
  { id: 'quantum_core',   name: 'Quantum Core',     description: '+400 CPU/s each',  baseRate: 400,   baseCost: 150000 },
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

    let totalRate = 0;
    for (const n of NETWORK_NODES) {
      totalRate += (nState.nodes[n.id] || 0) * n.baseRate;
    }
    if (totalRate <= 0) return;

    return {
      resources: { ...state.resources, gold: (state.resources.gold || 0) + totalRate * deltaSec },
    };
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const nState: NetworkPluginState = state.pluginState[this.id];
    if (!nState) return undefined;

    const gold = state.resources.gold || 0;
    let totalOutput = 0;
    const nodes = NETWORK_NODES.map(n => {
      const count = nState.nodes[n.id] || 0;
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

    const owned = nState.nodes[nodeId] || 0;
    const cost = nodeCost(def, owned);
    const gold = state.resources.gold || 0;
    if (gold < cost) return;

    return {
      resources: { ...state.resources, gold: gold - cost },
      pluginState: {
        [this.id]: { nodes: { ...nState.nodes, [nodeId]: owned + 1 } },
      },
    };
  }
}
