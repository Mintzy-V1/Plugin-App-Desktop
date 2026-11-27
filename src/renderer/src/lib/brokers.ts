/**
 * Every broker this build of the app supports, in one place.
 *
 * To add a broker: add it here, add its credential fields in
 * components/plugin/ConnectBrokerForm.tsx, its API client in src/main/api.js
 * (the Electron main process can't import this file), and its guide text in
 * pages/docsGuide.tsx. Everything else (routes, labels, admin lists, which
 * flows it supports) reads this table.
 */
export type BrokerKey = 'angle_one' | 'tradex' | 'bear_street' | 'firstock' | 'fivepaisa';

/** A broker name this build doesn't know. Never treated as Angel One. */
export type BrokerOrUnsupported = BrokerKey | 'unsupported';

export interface BrokerInfo {
  key: BrokerKey;
  /** What the user sees. */
  label: string;
  /** What the admin pages show (Bear Street's user-facing name is its broker's brand). */
  adminLabel: string;
  /** Gateway route prefix. */
  apiPrefix: string;
  /** Route that starts a session: Angel-style brokers simulate first, TradeX starts directly. */
  startRoute: 'start' | 'start-simulation';
  /** Runs the simulation → live pyramid flow and exposes pyramid P&L and exited symbols. */
  pyramid: boolean;
  /** Logs in with the credentials call alone (no TOTP screen). */
  skipTotp: boolean;
  /** Takes the PIN on the TOTP screen instead of the credentials form (5paisa). */
  pinWithTotp: boolean;
  /** Names the gateway may use for it, normalised (lower case, no spaces, _ or -). */
  names: readonly string[];
}

export const BROKERS: readonly BrokerInfo[] = [
  {
    key: 'angle_one', label: 'Angel One', adminLabel: 'Angel One', apiPrefix: '/api/v1/angle_one',
    startRoute: 'start-simulation', pyramid: true, skipTotp: false, pinWithTotp: false,
    names: ['angleone', 'angelone'],
  },
  {
    key: 'tradex', label: 'TradeX', adminLabel: 'TradeX', apiPrefix: '/api/v1/tradex',
    startRoute: 'start', pyramid: false, skipTotp: true, pinWithTotp: false,
    names: ['tradex'],
  },
  {
    key: 'bear_street', label: 'GLOBE CAPITALS', adminLabel: 'Bear Street', apiPrefix: '/api/v1/bear_street',
    startRoute: 'start-simulation', pyramid: true, skipTotp: true, pinWithTotp: false,
    names: ['bearstreet', 'bear'],
  },
  {
    key: 'firstock', label: 'Firstock', adminLabel: 'Firstock', apiPrefix: '/api/v1/firstock',
    startRoute: 'start-simulation', pyramid: true, skipTotp: false, pinWithTotp: false,
    names: ['firstock'],
  },
  {
    key: 'fivepaisa', label: '5paisa', adminLabel: '5paisa', apiPrefix: '/api/v1/fivepaisa',
    startRoute: 'start-simulation', pyramid: true, skipTotp: false, pinWithTotp: true,
    names: ['fivepaisa', '5paisa'],
  },
];

export const BROKER_KEYS: readonly BrokerKey[] = BROKERS.map((b) => b.key);

const BY_KEY = new Map<BrokerKey, BrokerInfo>(BROKERS.map((b) => [b.key, b]));

export function brokerInfo(key: BrokerKey): BrokerInfo {
  const info = BY_KEY.get(key);
  if (!info) throw new Error(`Unknown broker key: ${key}`);
  return info;
}

const normalise = (name: string | null | undefined) => String(name || '').toLowerCase().replace(/[\s_-]+/g, '');

/**
 * The broker for a name from the gateway (the user's profile or JWT, e.g.
 * "angle one", "bear_street", "5paisa"). No name at all is Angel One: accounts
 * from before brokers were recorded are all Angel One. A name this build
 * doesn't know is 'unsupported', never Angel One, so its orders can't go to
 * Angel One's routes.
 */
export function brokerFromName(name: string | null | undefined): BrokerOrUnsupported {
  const n = normalise(name);
  if (!n) return 'angle_one';
  for (const b of BROKERS) {
    if (b.names.includes(n)) return b.key;
  }
  // older gateways sent "bear street" variants
  if (n.includes('bear')) return 'bear_street';
  return 'unsupported';
}

export function isBrokerKey(value: unknown): value is BrokerKey {
  return typeof value === 'string' && BY_KEY.has(value as BrokerKey);
}

/** The user-facing name; 'unsupported' reads as a sentence fragment ("your broker"). */
export function brokerLabel(broker: BrokerOrUnsupported, unsupported = 'Unsupported broker'): string {
  return broker === 'unsupported' ? unsupported : brokerInfo(broker).label;
}
