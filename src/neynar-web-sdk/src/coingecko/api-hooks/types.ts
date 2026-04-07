/**
 * CoinGecko API hook types
 *
 * Types for CoinGecko API responses. These are based on the CoinGecko TypeScript SDK.
 */

// Basic types for CoinGecko data - the API handlers ensure proper typing from the SDK
export type Coin = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  fully_diluted_valuation?: number;
  total_volume?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;
  ath?: number;
  ath_change_percentage?: number;
  ath_date?: string;
  atl?: number;
  atl_change_percentage?: number;
  atl_date?: string;
  roi?: unknown;
  last_updated?: string;
};

export type CoinDetails = {
  id: string;
  symbol: string;
  name: string;
  description?: Record<string, string>;
  links?: {
    homepage?: string[];
    blockchain_site?: string[];
    official_forum_url?: string[];
    chat_url?: string[];
    announcement_url?: string[];
    twitter_screen_name?: string;
    facebook_username?: string;
    bitcointalk_thread_identifier?: number;
    telegram_channel_identifier?: string;
    subreddit_url?: string;
    repos_url?: {
      github?: string[];
      bitbucket?: string[];
    };
  };
  image?: {
    thumb?: string;
    small?: string;
    large?: string;
  };
  country_origin?: string;
  genesis_date?: string;
  sentiment_votes_up_percentage?: number;
  sentiment_votes_down_percentage?: number;
  market_cap_rank?: number;
  coingecko_rank?: number;
  coingecko_score?: number;
  developer_score?: number;
  community_score?: number;
  liquidity_score?: number;
  public_interest_score?: number;
  market_data?: {
    current_price?: Record<string, number>;
    total_value_locked?: Record<string, number>;
    mcap_to_tvl_ratio?: number;
    fdv_to_tvl_ratio?: number;
    roi?: unknown;
    ath?: Record<string, number>;
    ath_change_percentage?: Record<string, number>;
    ath_date?: Record<string, string>;
    atl?: Record<string, number>;
    atl_change_percentage?: Record<string, number>;
    atl_date?: Record<string, string>;
    market_cap?: Record<string, number>;
    market_cap_rank?: number;
    fully_diluted_valuation?: Record<string, number>;
    total_volume?: Record<string, number>;
    high_24h?: Record<string, number>;
    low_24h?: Record<string, number>;
    price_change_24h?: number;
    price_change_percentage_24h?: number;
    price_change_percentage_7d?: number;
    price_change_percentage_14d?: number;
    price_change_percentage_30d?: number;
    price_change_percentage_60d?: number;
    price_change_percentage_200d?: number;
    price_change_percentage_1y?: number;
    market_cap_change_24h?: number;
    market_cap_change_percentage_24h?: number;
    price_change_24h_in_currency?: Record<string, number>;
    price_change_percentage_1h_in_currency?: Record<string, number>;
    price_change_percentage_24h_in_currency?: Record<string, number>;
    price_change_percentage_7d_in_currency?: Record<string, number>;
    price_change_percentage_14d_in_currency?: Record<string, number>;
    price_change_percentage_30d_in_currency?: Record<string, number>;
    price_change_percentage_60d_in_currency?: Record<string, number>;
    price_change_percentage_200d_in_currency?: Record<string, number>;
    price_change_percentage_1y_in_currency?: Record<string, number>;
    market_cap_change_24h_in_currency?: Record<string, number>;
    market_cap_change_percentage_24h_in_currency?: Record<string, number>;
    total_supply?: number;
    max_supply?: number;
    circulating_supply?: number;
    last_updated?: string;
  };
  community_data?: unknown;
  developer_data?: unknown;
  public_interest_stats?: unknown;
  status_updates?: unknown[];
  last_updated?: string;
};

export type SimplePriceData = {
  [coinId: string]: {
    [currency: string]: number;
  };
};

export type Exchange = {
  id: string;
  name: string;
  year_established?: number;
  country?: string;
  description?: string;
  url?: string;
  image?: string;
  facebook_url?: string;
  reddit_url?: string;
  telegram_url?: string;
  slack_url?: string;
  other_url_1?: string;
  other_url_2?: string;
  twitter_handle?: string;
  has_trading_incentive?: boolean;
  centralized?: boolean;
  public_notice?: string;
  alert_notice?: string;
  trust_score?: number;
  trust_score_rank?: number;
  trade_volume_24h_btc?: number;
  trade_volume_24h_btc_normalized?: number;
};

export type MarketChartData = {
  prices: Array<[number, number]>;
  market_caps: Array<[number, number]>;
  total_volumes: Array<[number, number]>;
};

export type OHLCData = {
  [index: number]: number; // [timestamp, open, high, low, close]
};

/**
 * Common parameter types for CoinGecko API queries (page-based pagination)
 */
export type CoinGeckoPaginationParams = {
  page?: number;
  per_page?: number;
};

export type PriceParams = {
  ids?: string | string[];
  vs_currencies?: string | string[];
  include_market_cap?: boolean;
  include_24hr_vol?: boolean;
  include_24hr_change?: boolean;
  include_last_updated_at?: boolean;
  precision?: number;
};

export type MarketParams = CoinGeckoPaginationParams & {
  vs_currency?: string;
  ids?: string;
  category?: string;
  order?: string;
  per_page?: number;
  page?: number;
  sparkline?: boolean;
  price_change_percentage?: string;
  locale?: string;
  precision?: number;
  [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
};

export type ChartParams = {
  vs_currency?: string;
  days?: string | number;
  interval?: string;
  precision?: number;
  [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
};

/**
 * Company treasury holdings data structure from CoinGecko API
 */
export type CompanyHolding = {
  name: string;
  symbol: string;
  country: string;
  total_holdings: number;
  total_entry_value_usd: number;
  total_current_value_usd: number;
  percentage_of_total_supply: number;
};

export type CompaniesPublicTreasuryResponse = {
  companies: CompanyHolding[];
  total_holdings: number;
  total_value_usd: number;
  market_cap_dominance: number;
};

/**
 * Asset Platform data structure for blockchain networks
 */
export type AssetPlatform = {
  id: string;
  chain_identifier?: number;
  name: string;
  shortname?: string;
  native_coin_id?: string;
  image?: {
    thumb?: string;
    small?: string;
    large?: string;
  };
};

/**
 * Ping response from CoinGecko API
 */
export type PingResponse = {
  gecko_says: string;
};

/**
 * NFT Collection data structure
 */
export type NFTCollection = {
  id: string;
  contract_address: string;
  name: string;
  description?: string;
  image?: {
    small?: string;
    large?: string;
  };
  banner_image?: string;
  floor_price_24h_percentage_change?: number;
  number_of_unique_addresses?: number;
  number_of_unique_addresses_24h_percentage_change?: number;
  total_supply?: number;
  one_day_sales?: number;
  one_day_sales_24h_percentage_change?: number;
  one_day_average_sale_price?: number;
  one_day_average_sale_price_24h_percentage_change?: number;
  links?: {
    homepage?: string;
    twitter?: string;
    discord?: string;
  };
  floor_price?: {
    native_currency?: number;
    usd?: number;
  };
  market_cap?: {
    native_currency?: number;
    usd?: number;
  };
  volume_24h?: {
    native_currency?: number;
    usd?: number;
  };
};

/**
 * NFT Market data structure for markets endpoint
 */
export type NFTMarket = {
  id: string;
  name: string;
  floor_price_in_usd_24h_percentage_change?: number;
  h24_volume_in_usd?: number;
  h24_average_sale_price_in_usd?: number;
  market_cap_in_usd?: number;
  floor_price_in_usd?: number;
  floor_price_in_native_currency?: number;
  native_currency?: string;
  native_currency_symbol?: string;
};

/**
 * NFT List item structure for list endpoint
 */
export type NFTListItem = {
  id: string;
  name: string;
  symbol?: string;
  thumb?: string;
};

/**
 * NFT query parameters for list endpoint
 */
export type NFTListParams = CoinGeckoPaginationParams & {
  order?: string;
  asset_platform_id?: string;
};

/**
 * NFT query parameters for markets endpoint
 */
export type NFTMarketsParams = CoinGeckoPaginationParams & {
  asset_platform_id?: string;
  order?: string;
};

/**
 * API Key information response
 */
export type KeyInfo = {
  plan: string;
  monthly_call_credit: number;
  current_total_monthly_calls: number;
  current_remaining_monthly_calls: number;
};

/**
 * Token information in a token list
 */
export type TokenListToken = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
};

/**
 * Token list response structure from CoinGecko
 */
export type TokenList = {
  name: string;
  logoURI?: string;
  keywords: string[];
  timestamp: string;
  tokens: TokenListToken[];
};

/**
 * Coin category data with market information from CoinGecko categories endpoint
 */
export type CoinCategory = {
  /** Unique identifier for the category */
  id: string;
  /** Display name of the category */
  name: string;
  /** Total market capitalization of all coins in category (USD) */
  market_cap: number;
  /** 24-hour change in market cap percentage */
  market_cap_change_24h: number;
  /** Brief description of the category */
  content?: string;
  /** Number of top coins included in calculation */
  top_3_coins?: string[];
  /** Volume in the last 24 hours (USD) */
  volume_24h: number;
  /** Last updated timestamp */
  updated_at: string;
};

/**
 * Simple category list item for filtering purposes from categories/list endpoint
 */
export type CategoryListItem = {
  /** Unique identifier for the category */
  category_id: string;
  /** Display name of the category */
  name: string;
};

/**
 * Parameters for coins categories query
 */
export type CoinsCategoriesParams = {
  /**
   * Order results by field
   * @example "market_cap_desc", "market_cap_asc", "name_desc", "name_asc", "market_cap_change_24h_desc", "market_cap_change_24h_asc"
   */
  order?: string;
};

/**
 * Search API response structures
 */
export type SearchCoin = {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank?: number;
  thumb?: string;
  large?: string;
};

export type SearchExchange = {
  id: string;
  name: string;
  market_type: string;
  thumb?: string;
  large?: string;
};

export type SearchCategory = {
  id: number;
  name: string;
};

export type SearchNft = {
  id: string;
  name: string;
  symbol?: string;
  thumb?: string;
};

export type SearchResponse = {
  coins: SearchCoin[];
  exchanges: SearchExchange[];
  categories: SearchCategory[];
  nfts: SearchNft[];
};

/**
 * Response wrapper types for CoinGecko hooks
 */

/**
 * Exchange rates response structures
 */

/**
 * Individual exchange rate entry structure
 */
export type ExchangeRateEntry = {
  name: string;
  unit: string;
  value: number;
  type: "fiat" | "crypto";
};

/**
 * BTC exchange rates response structure from CoinGecko API
 *
 * Contains exchange rates for Bitcoin against multiple fiat currencies
 * and cryptocurrencies with normalized value representation.
 */
export type ExchangeRatesResponse = {
  rates: Record<string, ExchangeRateEntry>;
};

export type CoinGeckoHookOptions = {
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
};

// ============================================================================
// Onchain/DeFi Types
// ============================================================================

/**
 * Onchain category data structure for DeFi protocol categories
 */
export type OnchainCategory = {
  id: string;
  name: string;
  description?: string;
  pool_count?: number;
  tvl_usd?: number;
  volume_24h_usd?: number;
};

/**
 * Onchain network data structure for supported blockchain networks
 */
export type OnchainNetwork = {
  id: string;
  name: string;
  shortname: string;
  chain_identifier: number;
  native_coin_id: string;
  image?: {
    thumb?: string;
    small?: string;
    large?: string;
  };
  pool_count?: number;
  total_volume_24h?: number;
};

/**
 * Onchain pool data structure for DEX pools and liquidity pairs
 */
export type OnchainPool = {
  id: string;
  name: string;
  address: string;
  network: string;
  dex_id: string;
  tokens: {
    base_token: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
    };
    quote_token: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
    };
  };
  reserve_in_usd?: number;
  price_change_percentage?: {
    "1h"?: number;
    "24h"?: number;
    "7d"?: number;
  };
  volume_24h?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  transactions?: {
    "24h"?: {
      buys?: number;
      sells?: number;
    };
  };
};

/**
 * Onchain DEX data structure for decentralized exchanges
 */
export type OnchainDex = {
  id: string;
  name: string;
  network: string;
  pool_count: number;
  volume_24h_usd?: number;
  website?: string;
  logo?: string;
};

/**
 * Onchain token data structure for network-specific token information
 */
export type OnchainToken = {
  address: string;
  network: string;
  name: string;
  symbol: string;
  decimals: number;
  image?: string;
  current_price?: number;
  price_change_percentage_24h?: number;
  market_cap?: number;
  total_supply?: number;
  circulating_supply?: number;
  pools?: OnchainPool[];
};

/**
 * OHLCV data structure for pool price charts
 */
export type OnchainPoolOHLCV = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/**
 * Pool trade data structure for transaction history
 */
export type OnchainPoolTrade = {
  id: string;
  timestamp: number;
  tx_hash: string;
  kind: "buy" | "sell";
  volume_in_usd: number;
  volume_in_token: number;
  price_from_in_currency_token: number;
  price_to_in_currency_token: number;
  from_token_amount: number;
  to_token_amount: number;
  trader_address?: string;
};

/**
 * Simple token price data structure for price queries
 */
export type OnchainSimplePrice = {
  [tokenAddress: string]: {
    [currency: string]: number | string | undefined;
    usd_24h_change?: number | string;
  };
};

// ============================================================================
// Onchain Parameter Types
// ============================================================================

/**
 * Parameters for onchain categories query
 */
export type OnchainCategoriesParams = {
  page?: number;
  per_page?: number;
};

/**
 * Parameters for onchain category pools query
 */
export type OnchainCategoryPoolsParams = {
  page?: number;
  per_page?: number;
};

/**
 * Parameters for onchain networks query
 */
export type OnchainNetworksParams = {
  page?: number;
  per_page?: number;
};

/**
 * Parameters for onchain network pools query
 */
export type OnchainNetworkPoolsParams = {
  page?: number;
  per_page?: number;
  include?: string;
};

/**
 * Parameters for pool OHLCV query
 */
export type OnchainPoolOHLCVParams = {
  currency?: string;
  token?: string;
};

/**
 * Parameters for pool trades query
 */
export type OnchainPoolTradesParams = {
  page?: number;
  per_page?: number;
};

/**
 * Parameters for pools megafilter query with advanced filtering
 */
export type OnchainPoolsMegafilterParams = {
  network?: string;
  attributes?: string;
  token_addresses?: string;
  pool_addresses?: string;
  order_by?: string;
  order_direction?: "asc" | "desc";
  page?: number;
  per_page?: number;
};

/**
 * Parameters for trending pool search
 */
export type OnchainPoolsTrendingSearchParams = {
  include?: string;
  network?: string;
};

/**
 * Parameters for pool search query
 */
export type OnchainSearchPoolsParams = {
  query?: string;
  network?: string;
  page?: number;
  per_page?: number;
};

/**
 * Parameters for simple token prices query
 */
export type OnchainSimpleTokenPricesParams = {
  vs_currencies?: string;
  include_24hr_change?: boolean;
};

/**
 * Parameters for recently updated tokens query
 */
export type OnchainTokensRecentlyUpdatedParams = {
  page?: number;
  per_page?: number;
};
