export const PLUGIN_TICKERS = [
  "ABB", "ACC", "ADANIENT", "ADANIGREEN", "ADANIPORTS", "ADANIPOWER", "ALKEM", "AMBUJACEM",
  "APOLLOHOSP", "ASIANPAINT", "ASTRAL", "AUROPHARMA", "AXISBANK", "BAJAJFINSV", "BAJAJHLDNG",
  "BAJFINANCE", "BANDHANBNK", "BANKBARODA", "BERGEPAINT", "BHARTIARTL", "BOSCHLTD", "BRITANNIA",
  "CHOLAFIN", "CIPLA", "COALINDIA", "COLPAL", "CONCOR", "DABUR", "DIVISLAB", "DLF", "DRREDDY",
  "EICHERMOT", "FEDERALBNK", "GAIL", "GODREJCP", "GRASIM", "HAVELLS", "HCLTECH", "HDFCAMC",
  "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "HINDZINC", "ICICIBANK",
  "ICICIGI", "ICICIPRULI", "INDIGO", "INDUSTOWER", "INFY", "ITC", "JINDALSTEL", "JSWENERGY",
  "JSWSTEEL", "KOTAKBANK", "LICI", "LTIM", "LUPIN", "MARICO", "MARUTI", "MOTHERSON", "MRF",
  "MUTHOOTFIN", "NESTLEIND", "NMDC", "NTPC", "OIL", "ONGC", "PAGEIND", "PIIND", "PIDILITIND", "PNB",
  "POWERGRID", "RECLTD", "SBILIFE", "SBIN", "SHREECEM", "SIEMENS", "SRF", "SUNPHARMA", "TATACHEM",
  "TATACONSUM", "TATAELXSI", "TATAPOWER", "TATASTEEL", "TCS", "TORNTPHARM", "TORNTPOWER", "TRENT",
  "TVSMOTOR", "UBL", "ULTRACEMCO", "VEDL", "WIPRO",
].sort();

export interface TradingStockDraft {
  symbol: string;
  capital: string;
  stop_loss: number;
}

export interface TradingConfigurationDraft {
  candle: string;
  strategy: string;
  useBrokerCash: boolean;
  stocks: TradingStockDraft[];
}

export const createEmptyStockDraft = (): TradingStockDraft => ({
  symbol: '', capital: '', stop_loss: 5,
});

export const createDefaultConfig = (): TradingConfigurationDraft => ({
  candle: '5m', strategy: 'A', useBrokerCash: true,
  stocks: [createEmptyStockDraft()],
});

export const validateConfig = (draft: TradingConfigurationDraft): string | null => {
  if (draft.stocks.length === 0) return 'Add at least one stock';
  if (draft.stocks.some(s => !s.symbol || !s.capital)) return 'Fill all symbol and capital fields';
  if (draft.stocks.some(s => Number.isNaN(Number(s.capital)) || Number(s.capital) <= 0)) return 'Capital must be > 0';
  if (draft.stocks.some(s => Number.isNaN(s.stop_loss) || s.stop_loss <= 0)) return 'Stop loss must be > 0';
  const symbols = draft.stocks.map(s => s.symbol);
  if (new Set(symbols).size !== symbols.length) return 'Each stock can only be added once';
  return null;
};

export const buildPayload = (draft: TradingConfigurationDraft) => ({
  symbols: draft.stocks.map(s => ({
    symbol: s.symbol,
    capital: Number(s.capital),
    stop_loss: s.stop_loss / 100,
  })),
  use_broker_cash: draft.useBrokerCash,
  candle: draft.candle,
  strategy: draft.strategy,
});

/** Hydrate the config form from a saved-configuration API payload. */
export const draftFromConfiguration = (raw: Record<string, unknown> | null | undefined): TradingConfigurationDraft => {
  const base = createDefaultConfig();
  if (!raw || typeof raw !== 'object') return base;

  const candle = typeof raw.candle === 'string' && raw.candle ? raw.candle : base.candle;
  const strategy = typeof raw.strategy === 'string' && raw.strategy ? raw.strategy : base.strategy;
  const useBrokerCash = typeof raw.use_broker_cash === 'boolean'
    ? raw.use_broker_cash
    : typeof raw.useBrokerCash === 'boolean'
      ? raw.useBrokerCash
      : base.useBrokerCash;

  const symbolsRaw = Array.isArray(raw.symbols)
    ? raw.symbols
    : Array.isArray(raw.stocks)
      ? raw.stocks
      : [];

  const stocks: TradingStockDraft[] = symbolsRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const s = item as Record<string, unknown>;
      const symbol = String(s.symbol ?? s.Symbol ?? '').trim();
      if (!symbol) return null;
      const capitalVal = s.capital ?? s.Capital ?? '';
      const slRaw = Number(s.stop_loss ?? s.stopLoss ?? s.Stop_Loss ?? 5);
      // Stored payloads use a fraction (0.05); form uses percent (5).
      const stop_loss = Number.isFinite(slRaw)
        ? (slRaw > 0 && slRaw <= 1 ? slRaw * 100 : slRaw)
        : 5;
      return {
        symbol,
        capital: capitalVal === '' || capitalVal == null ? '' : String(capitalVal),
        stop_loss,
      };
    })
    .filter((s): s is TradingStockDraft => s != null);

  return {
    candle,
    strategy,
    useBrokerCash,
    stocks: stocks.length > 0 ? stocks : base.stocks,
  };
};

const STRATEGY_LABELS: Record<string, string> = {
  A: 'Stoppage Reversal',
  B: 'Exposure Expansion',
};

/** Compact summary for list cards / pickers. */
export const summarizeConfiguration = (raw?: Record<string, unknown> | null) => {
  const draft = draftFromConfiguration(raw);
  const symbols = draft.stocks.map(s => s.symbol).filter(Boolean);
  return {
    symbolCount: symbols.length,
    symbols,
    candle: draft.candle,
    strategy: draft.strategy,
    strategyLabel: STRATEGY_LABELS[draft.strategy] || draft.strategy,
    useBrokerCash: draft.useBrokerCash,
    totalCapital: draft.stocks.reduce((sum, s) => sum + (Number(s.capital) || 0), 0),
  };
};
