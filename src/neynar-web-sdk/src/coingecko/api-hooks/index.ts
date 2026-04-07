/**
 * CoinGecko API hooks
 * Complete implementation covering all CoinGecko API endpoints
 */

// Asset Platforms hooks
export { useAssetPlatforms } from "./hooks/asset-platforms";

// Categories hooks
export { useCoinsCategories, useCoinsCategoriesList } from "./hooks/categories";

// Coins hooks
export {
  useCoinsList,
  useCoinsMarkets,
  useCoin,
  useCoinMarketChart,
  useCoinMarketChartRange,
  useCoinOHLC,
} from "./hooks/coins";

// Companies hooks
export { useCompaniesPublicTreasury } from "./hooks/companies";

// Derivatives hooks
export {
  useDerivatives,
  useDerivativesExchanges,
  useDerivativesExchange,
  useDerivativesExchangesList,
} from "./hooks/derivatives";

// Exchange Rates hooks
export { useExchangeRates } from "./hooks/exchange-rates";

// Exchanges hooks
export {
  useExchanges,
  useExchange,
  useExchangesList,
  useExchangeTickers,
  useExchangeVolumeChart,
  useExchangeVolumeChartRange,
} from "./hooks/exchanges";

// Global hooks
export {
  useGlobal,
  useGlobalMarketCapChart,
  useGlobalDefi,
} from "./hooks/global";

// Key hooks
export { useKeyInfo } from "./hooks/key";

// NFTs hooks
export { useNFT, useNFTsList, useNFTsMarkets } from "./hooks/nfts";

// Onchain hooks
export {
  useOnchainCategories,
  useOnchainCategoryPools,
  useOnchainNetworks,
  useOnchainNetworkNewPools,
} from "./hooks/onchain";

// Ping hooks
export { usePing } from "./hooks/ping";

// Search hooks
export { useSearch } from "./hooks/search";

// Simple hooks
export {
  useSimplePrice,
  useSupportedVsCurrencies,
  useTokenPrice,
} from "./hooks/simple";

// Token Lists hooks
export { useTokenList } from "./hooks/token-lists";

// Export query keys for advanced cache management
export { coinGeckoQueryKeys } from "./query-keys";

// Export types
export type * from "./types";
