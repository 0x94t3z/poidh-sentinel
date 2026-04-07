/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RouteMap } from "../../shared/api-handlers";
import type { Coingecko } from "@coingecko/coingecko-typescript";

/**
 * Creates route map for all CoinGecko SDK methods
 * Organized by API category to match the SDK structure
 *
 * Each route maps to a handler that calls the corresponding SDK method
 * Routes are bound to the provided client via closures
 *
 * Note: Using 'any' types here is intentional - this is a pure proxy layer
 * that passes parameters directly to the strongly-typed CoinGecko SDK methods.
 * The SDK handles all type validation and safety.
 *
 * @param client - Instantiated Coingecko client to bind to the routes
 * @returns RouteMap with all handlers bound to the client
 */
export function buildCoinGeckoRoutes(client: Coingecko): RouteMap {
  return {
    // Asset Platforms API
    "GET /asset-platforms": async ({ query }) =>
      client.assetPlatforms.get(query as any),

    // Coins API
    "GET /coins/:id": async ({ path, query }) =>
      client.coins.getID(path.id, query as any),

    // Coins Categories API
    "GET /coins/categories": async ({ query }) =>
      client.coins.categories.get(query as any),
    "GET /coins/categories/list": async () => client.coins.categories.getList(),

    // Coins List API
    "GET /coins/list": async ({ query }) => client.coins.list.get(query as any),
    "GET /coins/list/new": async () => client.coins.list.getNew(),

    // Coins Markets API
    "GET /coins/markets": async ({ query }) =>
      client.coins.markets.get(query as any),

    // Coins Top Gainers/Losers API
    "GET /coins/top-gainers-losers": async ({ query }) =>
      client.coins.topGainersLosers.get(query as any),

    // Coins Circulating Supply Chart API
    "GET /coins/:id/circulating-supply-chart": async ({ path, query }) =>
      client.coins.circulatingSupplyChart.get(path.id, query as any),
    "GET /coins/:id/circulating-supply-chart/range": async ({ path, query }) =>
      client.coins.circulatingSupplyChart.getRange(path.id, query as any),

    // Coins Contract API
    "GET /coins/:id/contract/:contract_address": async ({ path, query }) =>
      client.coins.contract.get(path.contract_address, {
        id: path.id,
        ...query,
      } as any),

    // Coins History API
    "GET /coins/:id/history": async ({ path, query }) =>
      client.coins.history.get(path.id, query as any),

    // Coins Market Chart API
    "GET /coins/:id/market-chart": async ({ path, query }) =>
      client.coins.marketChart.get(path.id, query as any),
    "GET /coins/:id/market-chart/range": async ({ path, query }) =>
      client.coins.marketChart.getRange(path.id, query as any),

    // Coins OHLC API
    "GET /coins/:id/ohlc": async ({ path, query }) =>
      client.coins.ohlc.get(path.id, query as any),
    "GET /coins/:id/ohlc/range": async ({ path, query }) =>
      client.coins.ohlc.getRange(path.id, query as any),

    // Coins Tickers API
    "GET /coins/:id/tickers": async ({ path, query }) =>
      client.coins.tickers.get(path.id, query as any),

    // Coins Total Supply Chart API
    "GET /coins/:id/total-supply-chart": async ({ path, query }) =>
      client.coins.totalSupplyChart.get(path.id, query as any),
    "GET /coins/:id/total-supply-chart/range": async ({ path, query }) =>
      client.coins.totalSupplyChart.getRange(path.id, query as any),

    // Companies API
    "GET /companies/public-treasury/:coin_id": async ({ path }) =>
      client.companies.publicTreasury.getCoinID(path.coin_id as any),

    // Derivatives API
    "GET /derivatives": async ({ query }) =>
      client.derivatives.get(query as any),
    "GET /derivatives/exchanges": async ({ query }) =>
      client.derivatives.exchanges.get(query as any),
    "GET /derivatives/exchanges/:id": async ({ path, query }) =>
      client.derivatives.exchanges.getID(path.id, query as any),
    "GET /derivatives/exchanges/list": async () =>
      client.derivatives.exchanges.getList(),

    // Exchange Rates API
    "GET /exchange-rates": async () => client.exchangeRates.get(),

    // Exchanges API
    "GET /exchanges": async ({ query }) => client.exchanges.get(query as any),
    "GET /exchanges/:id": async ({ path, query }) =>
      client.exchanges.getID(path.id, query as any),
    "GET /exchanges/list": async ({ query }) =>
      client.exchanges.getList(query as any),
    // Note: status-updates not available in current SDK version
    "GET /exchanges/:id/tickers": async ({ path, query }) =>
      client.exchanges.tickers.get(path.id, query as any),
    "GET /exchanges/:id/volume-chart": async ({ path, query }) =>
      client.exchanges.volumeChart.get(path.id, query as any),
    "GET /exchanges/:id/volume-chart/range": async ({ path, query }) =>
      client.exchanges.volumeChart.getRange(path.id, query as any),

    // Global API
    "GET /global": async () => client.global.get(),
    "GET /global/market-cap-chart": async ({ query }) =>
      client.global.marketCapChart.get(query as any),
    // Note: market-cap-chart range not available in current SDK version

    // Key API
    "GET /key": async () => client.key.get(),

    // NFTs API
    "GET /nfts/:id": async ({ path }) => client.nfts.getID(path.id),
    "GET /nfts/list": async ({ query }) => client.nfts.getList(query as any),
    "GET /nfts/markets": async ({ query }) =>
      client.nfts.getMarkets(query as any),
    // Note: NFT contract endpoint structure needs verification

    // Onchain API
    "GET /onchain/categories": async ({ query }) =>
      client.onchain.categories.get(query as any),
    "GET /onchain/categories/:category_id/pools": async ({ path, query }) =>
      client.onchain.categories.getPools(path.category_id, query as any),

    // Onchain Networks API
    "GET /onchain/networks": async ({ query }) =>
      client.onchain.networks.get(query as any),
    "GET /onchain/networks/:network/new-pools": async ({ path, query }) =>
      client.onchain.networks.newPools.get({
        network: path.network,
        ...query,
      } as any),
    "GET /onchain/networks/:network/trending-pools": async ({ path, query }) =>
      client.onchain.networks.trendingPools.get({
        network: path.network,
        ...query,
      } as any),
    "GET /onchain/networks/:network/dexes": async ({ path, query }) =>
      client.onchain.networks.dexes.get(path.network, query as any),
    "GET /onchain/networks/:network/pools": async ({ path, query }) =>
      client.onchain.networks.pools.get(path.network, query as any),
    "GET /onchain/networks/:network/pools/:pool_address": async ({
      path,
      query,
    }) =>
      client.onchain.networks.pools.getAddress(path.network, {
        poolAddress: path.pool_address,
        ...query,
      } as any),
    "GET /onchain/networks/:network/pools/:pool_address/ohlcv/:timeframe":
      async ({ path, query }) =>
        client.onchain.networks.pools.ohlcv.getTimeframe(
          path.timeframe as any,
          {
            network: path.network,
            poolAddress: path.pool_address,
            ...query,
          } as any,
        ),
    "GET /onchain/networks/:network/pools/:pool_address/trades": async ({
      path,
      query,
    }) =>
      client.onchain.networks.pools.trades.get(path.pool_address, {
        network: path.network,
        ...query,
      } as any),
    "GET /onchain/networks/:network/tokens/:address": async ({ path, query }) =>
      client.onchain.networks.tokens.getAddress(path.address, {
        network: path.network,
        ...query,
      } as any),

    // Onchain Pools API
    "GET /onchain/pools/megafilter": async ({ query }) =>
      client.onchain.pools.megafilter.get(query as any),
    "GET /onchain/pools/trending-search": async ({ query }) =>
      client.onchain.pools.trendingSearch.get(query as any),

    // Onchain Search API
    "GET /onchain/search/pools": async ({ query }) =>
      client.onchain.search.pools.get(query as any),

    // Onchain Simple API
    "GET /onchain/simple/networks/:network/token-price/:addresses": async ({
      path,
      query,
    }) =>
      client.onchain.simple.networks.tokenPrice.getAddresses(path.addresses, {
        network: path.network,
        ...query,
      } as any),

    // Onchain Tokens API
    "GET /onchain/tokens/info-recently-updated": async ({ query }) =>
      client.onchain.tokens.infoRecentlyUpdated.get(query as any),

    // Ping API
    "GET /ping": async () => client.ping.get(),

    // Search API
    "GET /search": async ({ query }) => client.search.get(query as any),

    // Simple API
    "GET /simple/price": async ({ query }) =>
      client.simple.price.get(query as any),
    "GET /simple/supported-vs-currencies": async () =>
      client.simple.supportedVsCurrencies.get(),
    "GET /simple/token-price/:id": async ({ path, query }) =>
      client.simple.tokenPrice.getID(path.id, query as any),

    // Token Lists API
    "GET /token-lists/:asset_platform_id/all.json": async ({ path }) =>
      client.tokenLists.getAllJson(path.asset_platform_id),
  };
}
