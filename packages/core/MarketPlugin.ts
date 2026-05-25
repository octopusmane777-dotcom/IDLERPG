import { EnginePlugin, GameState } from './BaseTypes';

export interface MarketItem {
  id: string;
  name: string;
  description: string;
  currency: 'matter' | 'antimatter';
  cost: number;
  category: 'permanent' | 'consumable' | 'premium';
  purchased: boolean;
}

export interface MarketPluginState {
  purchased: string[];
  inventorySlotBonus: number;
  dropRateBonus: number;
  offlineCapBonus: number;
  xpMultiplier: number;
}

export const MARKET_ITEMS: Omit<MarketItem, 'purchased'>[] = [
  // MATTER items (earned via missions)
  { id: 'inventory_expand', name: 'Storage Array',       description: '+10 max inventory slots',           currency: 'matter',     cost: 15,  category: 'permanent' },
  { id: 'drop_boost',       name: 'Loot Protocol',       description: '+10% hardware drop rate (stacks)',   currency: 'matter',     cost: 20,  category: 'permanent' },
  { id: 'offline_boost',    name: 'Async Buffer',        description: '+2 hours offline earnings cap',      currency: 'matter',     cost: 25,  category: 'permanent' },
  { id: 'xp_boost_1',       name: 'Overclock v1',        description: '×1.25 XP multiplier',               currency: 'matter',     cost: 30,  category: 'permanent' },
  { id: 'xp_boost_2',       name: 'Overclock v2',        description: '×1.5 XP multiplier (replaces v1)',   currency: 'matter',     cost: 60,  category: 'permanent' },
  { id: 'scrap_boost',      name: 'Refinery Module',     description: '+50% scrap gold value',              currency: 'matter',     cost: 40,  category: 'permanent' },
  // ANTIMATTER items (purchased with real money via IAP)
  { id: 'am_cosmetic_1',    name: 'Neon Skin Pack',      description: 'Unlocks neon visual theme',          currency: 'antimatter', cost: 100, category: 'premium' },
  { id: 'am_xp_boost',      name: 'Hyper Boost (24h)',   description: '×2 all income for 24 hours',         currency: 'antimatter', cost: 200, category: 'consumable' },
  { id: 'am_starter_pack',  name: 'Starter Pack',        description: 'Skip first 3 motherboard upgrades',  currency: 'antimatter', cost: 500, category: 'premium' },
];

export class MarketPlugin implements EnginePlugin {
  id = 'market';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        purchased: [],
        inventorySlotBonus: 0,
        dropRateBonus: 0,
        offlineCapBonus: 0,
        xpMultiplier: 1,
      } as MarketPluginState);
    }
  }

  onTick(_state: GameState, _deltaSec: number) {
    return;
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const mktState: MarketPluginState = state.pluginState[this.id];
    if (!mktState) return undefined;

    const matter = (state.pluginState?.missions?.matter as number) ?? 0;
    const antimatter = (state.pluginState?.iap?.antimatter as number) ?? 0;
    const purchased = new Set<string>(mktState.purchased ?? []);

    const items: MarketItem[] = MARKET_ITEMS.map(item => ({
      ...item,
      purchased: purchased.has(item.id),
    }));

    return {
      market: {
        items,
        matter,
        antimatter,
        inventorySlotBonus: mktState.inventorySlotBonus ?? 0,
        dropRateBonus: mktState.dropRateBonus ?? 0,
        offlineCapBonus: mktState.offlineCapBonus ?? 0,
        xpMultiplier: mktState.xpMultiplier ?? 1,
      },
    };
  }

  onAction(state: GameState, action: any) {
    if (action.type !== 'BUY_MARKET_ITEM') return;

    const mktState: MarketPluginState = state.pluginState[this.id];
    if (!mktState) return;

    const itemDef = MARKET_ITEMS.find(i => i.id === action.itemId);
    if (!itemDef) return;

    const purchased = new Set<string>(mktState.purchased ?? []);
    if (purchased.has(itemDef.id) && itemDef.category !== 'consumable') return;

    let matterDelta = 0;
    let antimatterDelta = 0;

    if (itemDef.currency === 'matter') {
      const matter = (state.pluginState?.missions?.matter as number) ?? 0;
      if (matter < itemDef.cost) return;
      matterDelta = -itemDef.cost;
    } else {
      const antimatter = (state.pluginState?.iap?.antimatter as number) ?? 0;
      if (antimatter < itemDef.cost) return;
      antimatterDelta = -itemDef.cost;
    }

    purchased.add(itemDef.id);
    const newMktState = { ...mktState, purchased: Array.from(purchased) };

    // Apply permanent stat effects
    if (itemDef.id === 'inventory_expand') newMktState.inventorySlotBonus = (mktState.inventorySlotBonus ?? 0) + 10;
    if (itemDef.id === 'drop_boost')       newMktState.dropRateBonus = Math.min(0.5, (mktState.dropRateBonus ?? 0) + 0.10);
    if (itemDef.id === 'offline_boost')    newMktState.offlineCapBonus = (mktState.offlineCapBonus ?? 0) + 2;
    if (itemDef.id === 'scrap_boost')      { /* tracked via purchased flag */ }
    if (itemDef.id === 'xp_boost_1')       newMktState.xpMultiplier = Math.max(newMktState.xpMultiplier ?? 1, 1.25);
    if (itemDef.id === 'xp_boost_2')       newMktState.xpMultiplier = Math.max(newMktState.xpMultiplier ?? 1, 1.50);

    const pluginStatePatch: Record<string, any> = { [this.id]: newMktState };
    if (matterDelta !== 0 && state.pluginState?.missions) {
      pluginStatePatch.missions = {
        ...state.pluginState.missions,
        matter: ((state.pluginState.missions as any).matter ?? 0) + matterDelta,
      };
    }
    if (antimatterDelta !== 0 && state.pluginState?.iap) {
      pluginStatePatch.iap = {
        ...state.pluginState.iap,
        antimatter: ((state.pluginState.iap as any).antimatter ?? 0) + antimatterDelta,
      };
    }

    return { pluginState: pluginStatePatch };
  }
}
