import { EnginePlugin, GameState } from './BaseTypes';

export interface IAPPluginState {
  antimatter: number;
  purchases: string[];
}

/** SKU → antimatter grant mapping — matches Play Store / App Store product IDs */
export const IAP_PRODUCTS: { sku: string; antimatter: number; label: string }[] = [
  { sku: 'antimatter_100',  antimatter: 100,  label: '100 ANTIMATTER' },
  { sku: 'antimatter_500',  antimatter: 500,  label: '500 ANTIMATTER' },
  { sku: 'antimatter_2000', antimatter: 2000, label: '2000 ANTIMATTER' },
];

export class IAPPlugin implements EnginePlugin {
  id = 'iap';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        antimatter: 0,
        purchases: [],
      } as IAPPluginState);
    }
  }

  onTick(_state: GameState, _deltaSec: number) {
    return;
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const iapState: IAPPluginState = state.pluginState[this.id];
    if (!iapState) return undefined;
    return {
      iap: {
        antimatter: iapState.antimatter ?? 0,
        products: IAP_PRODUCTS,
      },
    };
  }

  onAction(state: GameState, action: any) {
    const iapState: IAPPluginState = state.pluginState[this.id];
    if (!iapState) return;

    if (action.type === 'GRANT_ANTIMATTER') {
      const amount = (action.amount as number) ?? 0;
      const sku = (action.sku as string) ?? '';
      if (amount <= 0) return;
      return {
        pluginState: {
          [this.id]: {
            ...iapState,
            antimatter: (iapState.antimatter ?? 0) + amount,
            purchases: sku ? [...(iapState.purchases ?? []), sku] : iapState.purchases,
          },
        },
      };
    }

    if (action.type === 'SPEND_ANTIMATTER') {
      const amount = (action.amount as number) ?? 0;
      if (amount <= 0) return;
      if ((iapState.antimatter ?? 0) < amount) return;
      return {
        pluginState: {
          [this.id]: {
            ...iapState,
            antimatter: iapState.antimatter - amount,
          },
        },
      };
    }
  }
}
