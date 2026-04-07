/**
 * CoinGecko Companies API Hooks
 *
 * Hooks for companies public treasury data including:
 * - Companies holding Bitcoin
 * - Companies holding Ethereum
 * - Public treasury data and holdings
 * - Advanced filtering and analysis capabilities
 * - Portfolio performance metrics
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type {
  CoinGeckoHookOptions,
  CompaniesPublicTreasuryResponse,
  CompanyHolding,
} from "../types";
import type { ExtendedQueryOptions } from "../../../private/api-hooks/types";

// ============================================================================
// Companies Public Treasury Hooks
// ============================================================================

/**
 * Fetches public treasury holdings data for companies holding Bitcoin or Ethereum
 *
 * This hook provides comprehensive data about companies that hold cryptocurrency in their
 * public treasuries, including total holdings, current values, and market dominance metrics.
 * Data is cached for 1 hour and optimized for performance with proper error handling.
 *
 * @param coinId - The cryptocurrency to query ("bitcoin" or "ethereum")
 * @param options - Optional query configuration parameters
 *
 * @returns UseQueryResult containing:
 * - `data.companies`: Array of company holdings with financial details
 * - `data.total_holdings`: Combined cryptocurrency holdings across all companies
 * - `data.total_value_usd`: Total USD value of all company holdings
 * - `data.market_cap_dominance`: Percentage of total supply held by companies
 *
 * @example
 * ```tsx
 * function CompanyHoldings() {
 *   const { data, isLoading, error } = useCompaniesPublicTreasury("bitcoin");
 *
 *   if (isLoading) return <div>Loading company data...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   const companies = data?.companies || [];
 *   const totalValue = data?.total_value_usd || 0;
 *
 *   return (
 *     <div>
 *       <h2>Total Value: ${totalValue.toLocaleString()}</h2>
 *       {companies.map(company => (
 *         <div key={company.name}>
 *           {company.name}: {company.total_holdings} BTC
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCompaniesPublicTreasury(
  coinId: string,
  options?: ExtendedQueryOptions<CompaniesPublicTreasuryResponse> &
    CoinGeckoHookOptions,
) {
  return useApiQuery<CompaniesPublicTreasuryResponse>(
    coinGeckoQueryKeys.companies.publicTreasury(coinId),
    `/api/coingecko/companies/public-treasury/${coinId}`,
    {
      enabled: Boolean(coinId?.trim()),
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      ...options,
    },
  );
}

/**
 * Fetches Bitcoin treasury holdings data for all companies with public Bitcoin positions
 *
 * This is a specialized hook that specifically queries Bitcoin holdings data, providing
 * a convenient interface when you only need Bitcoin company data without specifying the coin ID.
 *
 * @param options - Optional query configuration parameters
 *
 * @returns UseQueryResult containing Bitcoin treasury data for all companies
 * - `data.companies`: Array of companies holding Bitcoin with detailed financial metrics
 * - `data.total_holdings`: Total Bitcoin held across all companies
 * - `data.total_value_usd`: Combined USD value of all company Bitcoin holdings
 * - `data.market_cap_dominance`: Percentage of Bitcoin supply held by companies
 *
 * @example
 * ```tsx
 * function BitcoinCompanies() {
 *   const { data, isLoading } = useCompaniesBitcoinHoldings();
 *
 *   if (isLoading) return <div>Loading Bitcoin holdings...</div>;
 *
 *   const totalBTC = data?.total_holdings || 0;
 *   const dominance = data?.market_cap_dominance || 0;
 *
 *   return (
 *     <div>
 *       <h2>Corporate Bitcoin Holdings</h2>
 *       <p>Total: {totalBTC.toFixed(2)} BTC</p>
 *       <p>Market Dominance: {dominance.toFixed(2)}%</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCompaniesBitcoinHoldings(
  options?: ExtendedQueryOptions<CompaniesPublicTreasuryResponse> &
    CoinGeckoHookOptions,
) {
  return useCompaniesPublicTreasury("bitcoin", options);
}

/**
 * Fetches Ethereum treasury holdings data for all companies with public Ethereum positions
 *
 * This is a specialized hook that specifically queries Ethereum holdings data, providing
 * a convenient interface when you only need Ethereum company data without specifying the coin ID.
 *
 * @param options - Optional query configuration parameters
 *
 * @returns UseQueryResult containing Ethereum treasury data for all companies
 * - `data.companies`: Array of companies holding Ethereum with detailed financial metrics
 * - `data.total_holdings`: Total Ethereum held across all companies
 * - `data.total_value_usd`: Combined USD value of all company Ethereum holdings
 * - `data.market_cap_dominance`: Percentage of Ethereum supply held by companies
 *
 * @example
 * ```tsx
 * function EthereumCompanies() {
 *   const { data, isLoading } = useCompaniesEthereumHoldings();
 *
 *   if (isLoading) return <div>Loading Ethereum holdings...</div>;
 *
 *   const companies = data?.companies || [];
 *   const topCompany = companies[0];
 *
 *   return (
 *     <div>
 *       <h2>Corporate Ethereum Holdings</h2>
 *       {topCompany && (
 *         <p>Top Holder: {topCompany.name} ({topCompany.total_holdings.toFixed(2)} ETH)</p>
 *       )}
 *       <p>Total Companies: {companies.length}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCompaniesEthereumHoldings(
  options?: ExtendedQueryOptions<CompaniesPublicTreasuryResponse> &
    CoinGeckoHookOptions,
) {
  return useCompaniesPublicTreasury("ethereum", options);
}

/**
 * Fetches the top N companies ranked by their cryptocurrency holdings
 *
 * This hook automatically sorts companies by total holdings in descending order and optionally
 * limits the results to the specified number of top companies. Useful for creating leaderboards
 * or displaying the most significant corporate holders.
 *
 * @param coinId - The cryptocurrency to query ("bitcoin" or "ethereum")
 * @param limit - Optional number of top companies to return (if not specified, returns all companies sorted by holdings)
 * @param options - Optional query configuration parameters
 *
 * @returns UseQueryResult containing an array of CompanyHolding objects sorted by holdings descending
 * - `data[]`: Array of company holdings sorted by total_holdings (highest to lowest)
 * - Each company object includes: name, symbol, country, total_holdings, total_entry_value_usd, total_current_value_usd, percentage_of_total_supply
 *
 * @example
 * ```tsx
 * function TopBitcoinHolders() {
 *   const { data, isLoading } = useTopCompaniesByHoldings("bitcoin", 5);
 *
 *   if (isLoading) return <div>Loading top holders...</div>;
 *
 *   const topCompanies = data || [];
 *
 *   return (
 *     <div>
 *       <h2>Top 5 Bitcoin Holders</h2>
 *       {topCompanies.map((company, index) => (
 *         <div key={company.name}>
 *           #{index + 1}: {company.name} ({company.country})
 *           - {company.total_holdings.toFixed(2)} BTC
 *           - ${company.total_current_value_usd.toLocaleString()}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTopCompaniesByHoldings(
  coinId: string,
  limit?: number,
  options?: ExtendedQueryOptions<CompanyHolding[]> & CoinGeckoHookOptions,
) {
  const result = useApiQuery<CompanyHolding[]>(
    coinGeckoQueryKeys.companies.publicTreasury(coinId, { limit }),
    `/api/coingecko/companies/public-treasury/${coinId}`,
    {
      enabled: Boolean(coinId?.trim()),
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      select: (data: unknown) => {
        const response = data as CompaniesPublicTreasuryResponse;
        const companies = response?.companies || [];
        // Sort by total holdings descending and limit if specified
        const sortedCompanies = companies.sort(
          (a: CompanyHolding, b: CompanyHolding) =>
            b.total_holdings - a.total_holdings,
        );
        return limit ? sortedCompanies.slice(0, limit) : sortedCompanies;
      },
      ...options,
    },
  );

  return result;
}

/**
 * Filters companies by country for cryptocurrency holdings analysis
 *
 * This hook provides country-specific filtering of company treasury data, enabling
 * geographical analysis of corporate cryptocurrency adoption. Useful for regional
 * market analysis and compliance reporting.
 *
 * @param coinId - The cryptocurrency to analyze ("bitcoin" or "ethereum")
 * @param country - Optional country filter (case-insensitive, partial matches supported). If not provided, returns all companies
 * @param options - Optional query configuration parameters
 *
 * @returns UseQueryResult containing filtered array of CompanyHolding objects
 * - `data[]`: Array of companies filtered by country (or all companies if no country specified)
 * - Each company includes all standard fields: name, symbol, country, total_holdings, etc.
 *
 * @example
 * ```tsx
 * function USCompanyHoldings() {
 *   const { data, isLoading } = useCompaniesByCountry("bitcoin", "United States");
 *
 *   if (isLoading) return <div>Loading US companies...</div>;
 *
 *   const usCompanies = data || [];
 *   const totalUSHoldings = usCompanies.reduce((sum, company) => sum + company.total_holdings, 0);
 *
 *   return (
 *     <div>
 *       <h2>US Bitcoin Holdings</h2>
 *       <p>Companies: {usCompanies.length}</p>
 *       <p>Total Holdings: {totalUSHoldings.toFixed(2)} BTC</p>
 *       {usCompanies.map(company => (
 *         <div key={company.name}>
 *           {company.name}: {company.total_holdings.toFixed(2)} BTC
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 *
 * // Get all companies (no country filter)
 * function AllCompanies() {
 *   const { data } = useCompaniesByCountry("bitcoin");
 *   const allCompanies = data || [];
 *   return <div>Total companies: {allCompanies.length}</div>;
 * }
 * ```
 */
export function useCompaniesByCountry(
  coinId: string,
  country?: string,
  options?: ExtendedQueryOptions<CompanyHolding[]> & CoinGeckoHookOptions,
) {
  const result = useApiQuery<CompanyHolding[]>(
    coinGeckoQueryKeys.companies.publicTreasury(coinId, { country }),
    `/api/coingecko/companies/public-treasury/${coinId}`,
    {
      enabled: Boolean(coinId?.trim()),
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      select: (data: unknown) => {
        const response = data as CompaniesPublicTreasuryResponse;
        const companies = response?.companies || [];
        const filteredCompanies = !country
          ? companies
          : companies.filter((company: CompanyHolding) =>
              company.country.toLowerCase().includes(country.toLowerCase()),
            );
        return filteredCompanies;
      },
      ...options,
    },
  );

  return result;
}

/**
 * Filters companies by minimum cryptocurrency holdings threshold
 *
 * This hook allows filtering of companies based on their total holdings amount,
 * useful for identifying major institutional players or companies above specific
 * investment thresholds. Perfect for whale analysis and institutional tracking.
 *
 * @param coinId - The cryptocurrency to analyze ("bitcoin" or "ethereum")
 * @param minHoldings - Minimum holdings threshold (companies with holdings >= this value will be returned)
 * @param options - Optional query configuration parameters
 *
 * @returns UseQueryResult containing filtered array of CompanyHolding objects
 * - `data[]`: Array of companies with total_holdings >= minHoldings threshold
 * - Results are automatically filtered based on the specified minimum holdings amount
 * - Each company includes all standard fields: name, symbol, country, total_holdings, etc.
 *
 * @example
 * ```tsx
 * function MajorBitcoinHolders() {
 *   // Get companies holding at least 1000 BTC
 *   const { data, isLoading } = useCompaniesAboveThreshold("bitcoin", 1000);
 *
 *   if (isLoading) return <div>Loading major holders...</div>;
 *
 *   const majorHolders = data || [];
 *   const totalValue = majorHolders.reduce((sum, company) => sum + company.total_current_value_usd, 0);
 *
 *   return (
 *     <div>
 *       <h2>Major Bitcoin Holders (1000+ BTC)</h2>
 *       <p>Companies: {majorHolders.length}</p>
 *       <p>Combined Value: ${totalValue.toLocaleString()}</p>
 *       {majorHolders.map(company => (
 *         <div key={company.name} className="border-b p-2">
 *           <strong>{company.name}</strong> ({company.country})
 *           <br />
 *           Holdings: {company.total_holdings.toLocaleString()} BTC
 *           <br />
 *           Value: ${company.total_current_value_usd.toLocaleString()}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 *
 * // Find small institutional players
 * function SmallInstitutionalPlayers() {
 *   const { data } = useCompaniesAboveThreshold("ethereum", 100);
 *   const companies = data || [];
 *   return <div>Companies with 100+ ETH: {companies.length}</div>;
 * }
 * ```
 */
export function useCompaniesAboveThreshold(
  coinId: string,
  minHoldings: number,
  options?: ExtendedQueryOptions<CompanyHolding[]> & CoinGeckoHookOptions,
) {
  const result = useApiQuery<CompanyHolding[]>(
    coinGeckoQueryKeys.companies.publicTreasury(coinId, { minHoldings }),
    `/api/coingecko/companies/public-treasury/${coinId}`,
    {
      enabled: Boolean(coinId?.trim()) && minHoldings >= 0,
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      select: (data: unknown) => {
        const response = data as CompaniesPublicTreasuryResponse;
        const companies = response?.companies || [];
        const filteredCompanies = companies.filter(
          (company: CompanyHolding) => company.total_holdings >= minHoldings,
        );
        return filteredCompanies;
      },
      ...options,
    },
  );

  return result;
}

/**
 * Fetches aggregated market dominance metrics for companies holding Bitcoin or Ethereum
 *
 * This hook transforms the complete treasury data into focused market dominance statistics,
 * providing key metrics about corporate cryptocurrency adoption and market impact. Perfect
 * for dashboard widgets and summary displays.
 *
 * @param coinId - The cryptocurrency to analyze ("bitcoin" or "ethereum")
 * @param options - Optional query configuration parameters
 *
 * @returns UseQueryResult containing market dominance summary data
 * - `data.total_holdings`: Combined cryptocurrency holdings across all companies
 * - `data.total_value_usd`: Total USD value of all corporate holdings
 * - `data.market_cap_dominance`: Percentage of total supply controlled by companies
 * - `data.companies_count`: Number of companies with public treasury positions
 *
 * @example
 * ```tsx
 * function MarketDominanceWidget() {
 *   const { data, isLoading } = useCompaniesMarketDominance("bitcoin");
 *
 *   if (isLoading) return <div>Loading market data...</div>;
 *
 *   if (!data) return null;
 *
 *   return (
 *     <div className="grid grid-cols-2 gap-4">
 *       <div>
 *         <h3>Total Holdings</h3>
 *         <p>{data.total_holdings.toFixed(2)} BTC</p>
 *       </div>
 *       <div>
 *         <h3>USD Value</h3>
 *         <p>${data.total_value_usd.toLocaleString()}</p>
 *       </div>
 *       <div>
 *         <h3>Market Dominance</h3>
 *         <p>{data.market_cap_dominance.toFixed(2)}%</p>
 *       </div>
 *       <div>
 *         <h3>Companies</h3>
 *         <p>{data.companies_count}</p>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCompaniesMarketDominance(
  coinId: string,
  options?: ExtendedQueryOptions<{
    total_holdings: number;
    total_value_usd: number;
    market_cap_dominance: number;
    companies_count: number;
  }> &
    CoinGeckoHookOptions,
) {
  const result = useApiQuery<{
    total_holdings: number;
    total_value_usd: number;
    market_cap_dominance: number;
    companies_count: number;
  }>(
    coinGeckoQueryKeys.companies.publicTreasury(coinId, { dominance: true }),
    `/api/coingecko/companies/public-treasury/${coinId}`,
    {
      enabled: Boolean(coinId?.trim()),
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      select: (data: unknown) => {
        const response = data as CompaniesPublicTreasuryResponse;
        return {
          total_holdings: response?.total_holdings || 0,
          total_value_usd: response?.total_value_usd || 0,
          market_cap_dominance: response?.market_cap_dominance || 0,
          companies_count: response?.companies?.length || 0,
        };
      },
      ...options,
    },
  );

  return result;
}

/**
 * Calculates portfolio performance metrics for all companies with treasury holdings
 *
 * This hook enriches company data with calculated performance metrics including unrealized
 * gains/losses, percentage returns, and performance categorization. Essential for portfolio
 * analysis, performance tracking, and investment research on corporate cryptocurrency positions.
 *
 * @param coinId - The cryptocurrency to analyze ("bitcoin" or "ethereum")
 * @param options - Optional query configuration parameters
 *
 * @returns UseQueryResult containing enhanced company data with performance metrics
 * - `data[]`: Array of CompanyHolding objects enriched with performance data
 * - Additional fields per company:
 *   - `unrealized_gain_loss`: Dollar amount of unrealized gains/losses
 *   - `unrealized_gain_loss_percentage`: Percentage return on investment
 *   - `performance_category`: "profit" | "loss" | "breakeven" categorization
 * - All original CompanyHolding fields are preserved
 *
 * @example
 * ```tsx
 * function CompanyPerformanceAnalysis() {
 *   const { data, isLoading } = useCompaniesPortfolioPerformance("bitcoin");
 *
 *   if (isLoading) return <div>Calculating performance...</div>;
 *
 *   const companies = data || [];
 *   const profitableCompanies = companies.filter(c => c.performance_category === "profit");
 *   const totalUnrealized = companies.reduce((sum, c) => sum + c.unrealized_gain_loss, 0);
 *
 *   return (
 *     <div>
 *       <h2>Corporate Bitcoin Performance</h2>
 *       <div className="stats-grid">
 *         <div>Total Unrealized: ${totalUnrealized.toLocaleString()}</div>
 *         <div>Profitable: {profitableCompanies.length}/{companies.length}</div>
 *       </div>
 *
 *       {companies.map(company => (
 *         <div
 *           key={company.name}
 *           className={`company-card ${company.performance_category}`}
 *         >
 *           <h3>{company.name}</h3>
 *           <div>Holdings: {company.total_holdings.toFixed(2)} BTC</div>
 *           <div>Entry Value: ${company.total_entry_value_usd.toLocaleString()}</div>
 *           <div>Current Value: ${company.total_current_value_usd.toLocaleString()}</div>
 *           <div className={`performance ${company.performance_category}`}>
 *             P&L: ${company.unrealized_gain_loss.toLocaleString()}
 *             ({company.unrealized_gain_loss_percentage.toFixed(2)}%)
 *           </div>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 *
 * // Performance summary widget
 * function PerformanceSummary() {
 *   const { data } = useCompaniesPortfolioPerformance("ethereum");
 *   const companies = data || [];
 *
 *   const summary = companies.reduce((acc, company) => {
 *     acc[company.performance_category] += 1;
 *     return acc;
 *   }, { profit: 0, loss: 0, breakeven: 0 });
 *
 *   return (
 *     <div className="grid grid-cols-3 gap-2">
 *       <div className="profit">Profitable: {summary.profit}</div>
 *       <div className="loss">Loss: {summary.loss}</div>
 *       <div className="breakeven">Breakeven: {summary.breakeven}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCompaniesPortfolioPerformance(
  coinId: string,
  options?: ExtendedQueryOptions<
    Array<
      CompanyHolding & {
        unrealized_gain_loss: number;
        unrealized_gain_loss_percentage: number;
        performance_category: "profit" | "loss" | "breakeven";
      }
    >
  > &
    CoinGeckoHookOptions,
) {
  const result = useApiQuery<
    Array<
      CompanyHolding & {
        unrealized_gain_loss: number;
        unrealized_gain_loss_percentage: number;
        performance_category: "profit" | "loss" | "breakeven";
      }
    >
  >(
    coinGeckoQueryKeys.companies.publicTreasury(coinId, { performance: true }),
    `/api/coingecko/companies/public-treasury/${coinId}`,
    {
      enabled: Boolean(coinId?.trim()),
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      select: (data: unknown) => {
        const response = data as CompaniesPublicTreasuryResponse;
        const companies = response?.companies || [];
        const transformedCompanies = companies.map(
          (company: CompanyHolding) => {
            const unrealizedGainLoss =
              company.total_current_value_usd - company.total_entry_value_usd;
            const unrealizedGainLossPercentage =
              company.total_entry_value_usd > 0
                ? (unrealizedGainLoss / company.total_entry_value_usd) * 100
                : 0;

            let performanceCategory: "profit" | "loss" | "breakeven";
            if (unrealizedGainLoss > 0) {
              performanceCategory = "profit";
            } else if (unrealizedGainLoss < 0) {
              performanceCategory = "loss";
            } else {
              performanceCategory = "breakeven";
            }

            return {
              ...company,
              unrealized_gain_loss: unrealizedGainLoss,
              unrealized_gain_loss_percentage: unrealizedGainLossPercentage,
              performance_category: performanceCategory,
            };
          },
        );

        return transformedCompanies;
      },
      ...options,
    },
  );

  return result;
}
