// ===========================================
// CRYPTO AI AGENT - CONFIGURATION
// ===========================================

export const CONFIG = {
  // API Endpoints
  API: {
    DEXSCREENER_BASE: 'https://api.dexscreener.com',
    DEXSCREENER_SEARCH: '/latest/dex/search',
    DEXSCREENER_TOKENS: '/latest/dex/tokens',
    DEXSCREENER_PAIRS: '/latest/dex/pairs',
    DEXSCREENER_PROFILES: '/token-profiles/latest/v1',
  },

  // Blocked large-cap tokens (these should NOT be analyzed)
  BLOCKED_TOKENS: [
    'BTC', 'BITCOIN',
    'ETH', 'ETHEREUM',
    'USDT', 'TETHER',
    'USDC', 'USD COIN',
    'BNB', 'BINANCE',
    'XRP', 'RIPPLE',
    'SOL', 'SOLANA',
    'ADA', 'CARDANO',
    'DOGE', 'DOGECOIN',
    'DOT', 'POLKADOT',
    'MATIC', 'POLYGON',
    'AVAX', 'AVALANCHE',
    'LINK', 'CHAINLINK',
    'LTC', 'LITECOIN',
    'ATOM', 'COSMOS',
    'UNI', 'UNISWAP',
    'SHIB', // Shiba is too large now
  ],

  // Market cap threshold for "large cap" (in USD)
  LARGE_CAP_THRESHOLD: 1_000_000_000, // $1B

  // Risk thresholds
  RISK: {
    LIQUIDITY_LOW: 10000,      // < $10K liquidity = high risk
    LIQUIDITY_MEDIUM: 100000,  // < $100K liquidity = medium risk
    HOLDER_CONCENTRATION_HIGH: 0.5, // Top holder > 50% = high risk
    VOLUME_TO_MCAP_LOW: 0.01,  // Volume < 1% of mcap = low activity
  },

  // Supported chains for memecoin analysis
  SUPPORTED_CHAINS: [
    'solana',
    'ethereum',
    'bsc',
    'base',
    'arbitrum',
    'polygon',
    'avalanche',
    'fantom',
    'optimism',
  ],

  // External links
  EXTERNAL: {
    DEXSCREENER: 'https://dexscreener.com',
    AXIOM: 'https://axiom.trade',
  }
};

// Chain display names
export const CHAIN_NAMES = {
  solana: 'Solana',
  ethereum: 'Ethereum',
  bsc: 'BNB Chain',
  base: 'Base',
  arbitrum: 'Arbitrum',
  polygon: 'Polygon',
  avalanche: 'Avalanche',
  fantom: 'Fantom',
  optimism: 'Optimism',
};

// Risk level labels
export const RISK_LEVELS = {
  LOW: { label: 'Low', color: '#00ff88', class: 'low' },
  MEDIUM: { label: 'Medium', color: '#ffaa00', class: 'medium' },
  HIGH: { label: 'High', color: '#ff4444', class: 'high' },
};

export default CONFIG;
