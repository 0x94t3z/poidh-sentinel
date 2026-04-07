/**
 * Truncates a blockchain address to a shortened format
 *
 * @param address - The full blockchain address (e.g., "0x1234...7890")
 * @param startChars - Number of characters to show at the start (default: 6)
 * @param endChars - Number of characters to show at the end (default: 4)
 * @returns Truncated address (e.g., "0x1234...7890")
 *
 * @example
 * ```tsx
 * truncateAddress("0x8E9bFa938E3631B9351A83DdA88C1f89d79E7585")
 * // Returns: "0x8E9b...7585"
 * ```
 */
export function truncateAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4,
): string {
  if (!address) return "";
  if (address.length <= startChars + endChars) return address;

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}
