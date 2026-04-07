/**
 * CoinGecko API query key factories
 * Hierarchical structure preserved from the excellent old system for proper cache management
 * Updated to match all routes from buildCoinGeckoRoutes in the new API handler architecture
 */

import {
  createQueryKeyFactory,
  createScopedQueryKeys,
  normalizeFilters,
} from "../../private/api-hooks/query-keys";

// Main CoinGecko query key factory
export const coinGeckoKeys = createQueryKeyFactory("coingecko");

// Scoped query key factories for each CoinGecko endpoint category
export const assetPlatformKeys = createScopedQueryKeys(
  "coingecko",
  "asset-platforms",
);
export const coinsKeys = createScopedQueryKeys("coingecko", "coins");
export const simpleKeys = createScopedQueryKeys("coingecko", "simple");
export const exchangeKeys = createScopedQueryKeys("coingecko", "exchanges");
export const derivativeKeys = createScopedQueryKeys("coingecko", "derivatives");
export const onchainKeys = createScopedQueryKeys("coingecko", "onchain");
export const companyKeys = createScopedQueryKeys("coingecko", "companies");
export const searchKeys = createScopedQueryKeys("coingecko", "search");
export const globalKeys = createScopedQueryKeys("coingecko", "global");
export const keyKeys = createScopedQueryKeys("coingecko", "key");
export const pingKeys = createScopedQueryKeys("coingecko", "ping");
export const exchangeRateKeys = createScopedQueryKeys(
  "coingecko",
  "exchange-rates",
);
export const nftKeys = createScopedQueryKeys("coingecko", "nfts");
export const tokenListKeys = createScopedQueryKeys("coingecko", "token-lists");

// Specific query key patterns for common use cases
export const coinGeckoQueryKeys = {
  // System queries
  ping: () => ["coingecko", "ping"] as const,

  // Asset platforms
  assetPlatforms: {
    all: () => assetPlatformKeys.all(),
    list: (params?: Record<string, unknown>) =>
      assetPlatformKeys.list(normalizeFilters(params)),
  },

  // Simple price queries (most common)
  simple: {
    all: () => simpleKeys.all(),
    price: (
      ids: string[],
      vsCurrencies: string[],
      options?: Record<string, unknown>,
    ) =>
      simpleKeys.custom("price", {
        ids: ids.sort().join(","),
        vs_currencies: vsCurrencies.sort().join(","),
        ...normalizeFilters(options),
      }),
    supportedCurrencies: () => simpleKeys.custom("supported-currencies"),
    tokenPrice: (
      network: string,
      addresses: string[],
      vsCurrencies: string[],
      options?: Record<string, unknown>,
    ) =>
      simpleKeys.custom("token-price", network, {
        contract_addresses: addresses.sort().join(","),
        vs_currencies: vsCurrencies.sort().join(","),
        ...normalizeFilters(options),
      }),
  },

  // Coin details and information
  coins: {
    all: () => coinsKeys.all(),
    list: (params?: Record<string, unknown>) =>
      coinsKeys.list(normalizeFilters(params)),
    listNew: () => coinsKeys.custom("list-new"),
    categories: (params?: Record<string, unknown>) =>
      coinsKeys.custom("categories", normalizeFilters(params)),
    categoriesList: () => coinsKeys.custom("categories-list"),
    markets: (params?: Record<string, unknown>) =>
      coinsKeys.custom("markets", normalizeFilters(params)),
    topGainersLosers: (params?: Record<string, unknown>) =>
      coinsKeys.custom("top-gainers-losers", normalizeFilters(params)),
    detail: (id: string, options?: Record<string, unknown>) =>
      coinsKeys.detail(id, normalizeFilters(options)),
    tickers: (id: string, options?: Record<string, unknown>) =>
      coinsKeys.custom("tickers", id, normalizeFilters(options)),
    history: (id: string, date: string, localization?: boolean) =>
      coinsKeys.custom("history", id, { date, localization }),
    marketChart: (
      id: string,
      vsCurrency: string,
      days: string | number,
      options?: Record<string, unknown>,
    ) =>
      coinsKeys.custom("market-chart", id, {
        vs_currency: vsCurrency,
        days,
        ...normalizeFilters(options),
      }),
    marketChartRange: (
      id: string,
      vsCurrency: string,
      from: number,
      to: number,
    ) =>
      coinsKeys.custom("market-chart-range", id, {
        vs_currency: vsCurrency,
        from,
        to,
      }),
    ohlc: (id: string, vsCurrency: string, days: number) =>
      coinsKeys.custom("ohlc", id, { vs_currency: vsCurrency, days }),
    circulatingSupplyChart: (id: string, days: string) =>
      coinsKeys.custom("circulating-supply-chart", id, { days }),
    totalSupplyChart: (id: string, days: string) =>
      coinsKeys.custom("total-supply-chart", id, { days }),
  },

  // Exchange data
  exchanges: {
    all: () => exchangeKeys.all(),
    list: (params?: Record<string, unknown>) =>
      exchangeKeys.list(normalizeFilters(params)),
    detail: (id: string, params?: Record<string, unknown>) =>
      exchangeKeys.detail(id, normalizeFilters(params)),
    tickers: (id: string, params?: Record<string, unknown>) =>
      exchangeKeys.custom("tickers", id, normalizeFilters(params)),
    statusUpdates: (id: string, params?: Record<string, unknown>) =>
      exchangeKeys.custom("status-updates", id, normalizeFilters(params)),
    volumeChart: (
      id: string,
      params: number | { days: number } | { from: number; to: number },
    ) => {
      if (typeof params === "number") {
        return exchangeKeys.custom("volume-chart", id, { days: params });
      } else if ("days" in params) {
        return exchangeKeys.custom("volume-chart", id, params);
      } else {
        return exchangeKeys.custom("volume-chart-range", id, params);
      }
    },
  },

  // Derivatives
  derivatives: {
    all: () => derivativeKeys.all(),
    list: (params?: Record<string, unknown>) =>
      derivativeKeys.list(normalizeFilters(params)),
    exchanges: {
      all: () => derivativeKeys.custom("exchanges", "all"),
      list: (params?: Record<string, unknown>) =>
        derivativeKeys.custom("exchanges", "list", normalizeFilters(params)),
      detail: (id: string, params?: Record<string, unknown>) =>
        derivativeKeys.custom(
          "exchanges",
          "detail",
          id,
          normalizeFilters(params),
        ),
      simpleList: () => derivativeKeys.custom("exchanges", "simple-list"),
    },
  },

  // On-chain/DeFi data
  onchain: {
    all: () => onchainKeys.all(),

    // Categories
    categories: {
      list: (params?: Record<string, unknown>) =>
        onchainKeys.custom("categories", "list", normalizeFilters(params)),
      pools: (categoryId: string, params?: Record<string, unknown>) =>
        onchainKeys.custom(
          "categories",
          "pools",
          categoryId,
          normalizeFilters(params),
        ),
    },

    // Networks and network-specific data
    networks: {
      list: (params?: Record<string, unknown>) =>
        onchainKeys.custom("networks", "list", normalizeFilters(params)),
      newPools: (network: string, params?: Record<string, unknown>) =>
        onchainKeys.custom(
          "networks",
          "new-pools",
          network,
          normalizeFilters(params),
        ),
      trendingPools: (network: string, params?: Record<string, unknown>) =>
        onchainKeys.custom(
          "networks",
          "trending-pools",
          network,
          normalizeFilters(params),
        ),
      dexes: (network: string, params?: Record<string, unknown>) =>
        onchainKeys.custom(
          "networks",
          "dexes",
          network,
          normalizeFilters(params),
        ),
      pools: (network: string, params?: Record<string, unknown>) =>
        onchainKeys.custom(
          "networks",
          "pools",
          network,
          normalizeFilters(params),
        ),
      poolDetail: (network: string, address: string) =>
        onchainKeys.custom("networks", "pool", network, address),
      poolOHLCV: (
        network: string,
        address: string,
        timeframe: string,
        params?: Record<string, unknown>,
      ) =>
        onchainKeys.custom(
          "networks",
          "pool-ohlcv",
          network,
          address,
          timeframe,
          normalizeFilters(params),
        ),
      poolTrades: (
        network: string,
        address: string,
        params?: Record<string, unknown>,
      ) =>
        onchainKeys.custom(
          "networks",
          "pool-trades",
          network,
          address,
          normalizeFilters(params),
        ),
      token: (network: string, address: string) =>
        onchainKeys.custom("networks", "token", network, address),
    },

    // Pools
    pools: {
      megafilter: (params?: Record<string, unknown>) =>
        onchainKeys.custom("pools", "megafilter", normalizeFilters(params)),
      trendingSearch: (params?: Record<string, unknown>) =>
        onchainKeys.custom(
          "pools",
          "trending-search",
          normalizeFilters(params),
        ),
    },

    // Search
    search: {
      pools: (params?: Record<string, unknown>) =>
        onchainKeys.custom("search", "pools", normalizeFilters(params)),
    },

    // Simple pricing
    simple: {
      tokenPrices: (
        network: string,
        addresses: string,
        params?: Record<string, unknown>,
      ) =>
        onchainKeys.custom(
          "simple",
          "token-prices",
          network,
          addresses,
          normalizeFilters(params),
        ),
    },

    // Tokens
    tokens: {
      recentlyUpdated: (params?: Record<string, unknown>) =>
        onchainKeys.custom(
          "tokens",
          "recently-updated",
          normalizeFilters(params),
        ),
    },
  },

  // Company holdings
  companies: {
    all: () => companyKeys.all(),
    publicTreasury: (coinId?: string, params?: Record<string, unknown>) =>
      companyKeys.custom("public-treasury", {
        coin_id: coinId,
        ...normalizeFilters(params),
      }),
  },

  // Search functionality
  search: {
    all: () => searchKeys.all(),
    query: (query: string) => searchKeys.custom("query", { query }),
    trending: () => searchKeys.custom("trending"),
  },

  // Global market data
  global: {
    all: () => globalKeys.all(),
    data: () => globalKeys.custom("data"),
    defiData: () => globalKeys.custom("defi"),
    marketCapChart: (days: string, vsCurrency: string) =>
      globalKeys.custom("market-cap-chart", { days, vs_currency: vsCurrency }),
  },

  // Exchange rates
  exchangeRates: {
    all: () => exchangeRateKeys.all(),
    btc: () => exchangeRateKeys.custom("btc"),
  },

  // NFT data
  nfts: {
    all: () => nftKeys.all(),
    detail: (id: string) => nftKeys.detail(id),
    list: (params?: Record<string, unknown>) =>
      nftKeys.custom("list", normalizeFilters(params)),
    markets: (params?: Record<string, unknown>) =>
      nftKeys.custom("markets", normalizeFilters(params)),
  },

  // Token Lists
  tokenLists: {
    all: () => tokenListKeys.all(),
    platform: (assetPlatformId: string) =>
      tokenListKeys.custom("platform", assetPlatformId),
  },

  // Key API information
  key: {
    all: () => keyKeys.all(),
    info: () => keyKeys.custom("info"),
  },
} as const;
