import { EnginePlugin, GameState } from './BaseTypes';

export interface OnboardingPluginState {
  /** Current tutorial step (0 = not started, -1 = completed) */
  step: number;
  /** Whether the player has ever completed the tutorial */
  completed: boolean;
}

const STEPS = [
  { id: 'start', title: 'Welcome to IDLERPG', tip: 'Tap Self-Train to earn your first compute.' },
  { id: 'upgrade', title: 'Upgrade Compute', tip: 'Spend compute to increase your per-second generation. Look for the Self-Optimization card.' },
  { id: 'stage', title: 'Advance Stage', tip: 'When you have enough, advance to the next stage for +2 compute/sec.' },
  { id: 'adaptive', title: 'Adaptive Module', tip: 'Toggle the Adaptive Module to fight threats and earn bonus compute.' },
  { id: 'done', title: 'You\'re Ready!', tip: 'Keep upgrading, advancing, and eventually prestige for permanent bonuses.' },
];

export class OnboardingPlugin implements EnginePlugin {
  id = 'onboarding';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id);
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        step: 0,
        completed: false,
      } as OnboardingPluginState);
    }
  }

  /** Advance to the next tutorial step */
  advance(currentState: OnboardingPluginState): Partial<OnboardingPluginState> {
    const next = Math.min(currentState.step + 1, STEPS.length - 1);
    return {
      step: next,
      completed: next === STEPS.length - 1,
    };
  }

  getActionMetadata(state: GameState): Record<string, any> | undefined {
    const oState: OnboardingPluginState = state.pluginState[this.id];
    if (!oState || typeof oState.step !== 'number' || oState.completed) return undefined;

    const current = STEPS[oState.step] || STEPS[STEPS.length - 1];
    return {
      onboarding: {
        step: oState.step,
        total: STEPS.length,
        completed: oState.completed,
        title: current.title,
        tip: current.tip,
      },
    };
  }

  onAction(state: GameState, action: any) {
    const oState: OnboardingPluginState = state.pluginState[this.id];
    if (!oState) return;

    if (action.type === 'NEXT_STEP') {
      const next = this.advance(oState);
      return {
        pluginState: {
          [this.id]: { ...oState, ...next },
        },
      };
    }

    if (action.type === 'SKIP_TUTORIAL') {
      return {
        pluginState: {
          [this.id]: { step: STEPS.length - 1, completed: true },
        },
      };
    }
  }
}