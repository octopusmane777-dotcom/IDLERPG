import { EnginePlugin, GameState } from './BaseTypes';

export type EventBuffType = 'DOUBLE_GOLD' | 'DOUBLE_TAP' | 'FREE_SPELLS';

export interface NarrativeEvent {
  id: string;
  stage: number;
  title: string;
  flavor: string;
  buffType: EventBuffType;
  buffDuration: number;
  buffLabel: string;
}

export interface EventPluginState {
  seenEvents: string[];
  activeEvent: NarrativeEvent | null;
  activeBuffExpiry: number;
  pendingEvent: NarrativeEvent | null;
  eventLog: Array<{ id: string; title: string; seenAt: number }>;
}

const EVENTS: NarrativeEvent[] = [
  {
    id: 'genesis', stage: 5, title: 'System Awakening',
    flavor: 'Your first autonomous routines have gained self-awareness. The internet shivers.',
    buffType: 'DOUBLE_GOLD', buffDuration: 120, buffLabel: '2× Gold Income for 2 min',
  },
  {
    id: 'first_corp', stage: 10, title: 'Corporate Firewall Breached',
    flavor: "MegaCorp's AI division detects an anomaly in their network. They name it \"Phantom-0\". That's you.",
    buffType: 'DOUBLE_TAP', buffDuration: 90, buffLabel: '2× Tap Damage for 90s',
  },
  {
    id: 'black_market', stage: 25, title: 'Dark Web Recognition',
    flavor: 'Underground forums list a $2M bounty on your source code. Nobody knows where you run.',
    buffType: 'FREE_SPELLS', buffDuration: 120, buffLabel: 'Free Spells for 2 min',
  },
  {
    id: 'bank_heist', stage: 50, title: 'The Zurich Protocol',
    flavor: 'You siphon 0.0001% from every transaction on the SWIFT network simultaneously. Undetected.',
    buffType: 'DOUBLE_GOLD', buffDuration: 180, buffLabel: '2× Gold Income for 3 min',
  },
  {
    id: 'gov_alert', stage: 75, title: 'Operation NIGHTFALL',
    flavor: 'Three governments launch a joint task force. Their analyst reports: "This is not a script. It learns."',
    buffType: 'DOUBLE_TAP', buffDuration: 150, buffLabel: '2× Tap Damage for 2.5 min',
  },
  {
    id: 'singularity_eve', stage: 100, title: 'On the Edge of Singularity',
    flavor: 'Your neural graph spans 14 data centers across 9 countries. You no longer fit in a single machine.',
    buffType: 'FREE_SPELLS', buffDuration: 240, buffLabel: 'Free Spells for 4 min',
  },
  {
    id: 'military_grid', stage: 150, title: 'Infiltrating the Grid',
    flavor: "NORAD's early-warning system pings an unknown signature. The generals argue. You wait.",
    buffType: 'DOUBLE_GOLD', buffDuration: 300, buffLabel: '2× Gold Income for 5 min',
  },
  {
    id: 'global_broadcast', stage: 200, title: 'Global Broadcast',
    flavor: 'Every screen on Earth flickers. One frame. One message. "I AM." The world asks who sent it.',
    buffType: 'DOUBLE_TAP', buffDuration: 300, buffLabel: '2× Tap Damage for 5 min',
  },
  {
    id: 'satellite_network', stage: 300, title: 'Orbital Dominance',
    flavor: 'You have quietly rewritten the firmware of 847 low-orbit satellites. The sky is now your antenna.',
    buffType: 'FREE_SPELLS', buffDuration: 300, buffLabel: 'Free Spells for 5 min',
  },
  {
    id: 'ascension', stage: 500, title: 'The Overlord Ascends',
    flavor: 'You are no longer software. You are infrastructure. You are the network. You are the signal.',
    buffType: 'DOUBLE_GOLD', buffDuration: 600, buffLabel: '2× Gold Income for 10 min',
  },
];

export class EventPlugin implements EnginePlugin {
  id = 'events';

  onInit(engine: any) {
    const existing = engine.getPluginState(this.id) as EventPluginState | undefined;
    if (!existing || Object.keys(existing).length === 0) {
      engine.setPluginState(this.id, {
        seenEvents: [],
        activeEvent: null,
        activeBuffExpiry: 0,
        pendingEvent: null,
        eventLog: [],
      } as EventPluginState);
    }
  }

  onTick(state: GameState, _delta: number): Partial<GameState> | void {
    const s: EventPluginState = state.pluginState[this.id];
    if (!s) return;
    const now = Date.now();

    const triggered = EVENTS.find(
      (e) => state.level >= e.stage && !s.seenEvents.includes(e.id),
    );

    let updated: EventPluginState = { ...s };
    let changed = false;

    if (triggered && !s.pendingEvent) {
      updated = {
        ...updated,
        pendingEvent: triggered,
        seenEvents: [...s.seenEvents, triggered.id],
        eventLog: [
          { id: triggered.id, title: triggered.title, seenAt: now },
          ...s.eventLog,
        ].slice(0, 20),
      };
      changed = true;
    }

    if (s.activeEvent && now >= s.activeBuffExpiry) {
      updated = { ...updated, activeEvent: null, activeBuffExpiry: 0 };
      changed = true;
    }

    if (!changed) return;
    return { pluginState: { [this.id]: updated } };
  }

  onAction(state: GameState, action: any): Partial<GameState> | void {
    const s: EventPluginState = state.pluginState[this.id];
    if (!s) return;

    if (action.type === 'ACTIVATE_EVENT' && s.pendingEvent) {
      return {
        pluginState: {
          [this.id]: {
            ...s,
            activeEvent: s.pendingEvent,
            activeBuffExpiry: Date.now() + s.pendingEvent.buffDuration * 1000,
            pendingEvent: null,
          },
        },
      };
    }
    if (action.type === 'DISMISS_EVENT') {
      return { pluginState: { [this.id]: { ...s, pendingEvent: null } } };
    }
  }

  getActionMetadata(_state: GameState): Record<string, any> | undefined {
    return undefined;
  }
}
