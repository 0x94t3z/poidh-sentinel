/**
 * Neynar Fname API hooks
 *
 * Comprehensive set of hooks for Farcaster name (fname) operations.
 * Includes availability checking and validation utilities.
 */

import {
  useApiQuery,
  STALE_TIME,
  type QueryHookOptions,
  type QueryHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type { FnameAvailabilityResponse } from "../sdk-response-types";

/**
 * Check if a given fname is available
 *
 * Validates whether a Farcaster name (fname) is available for registration.
 * Useful for username availability checks during user onboarding or profile updates.
 *
 * **Special Behaviors:**
 * - Query auto-disabled when fname is empty or whitespace-only
 * - Returns boolean directly (extracts `available` field from response)
 *
 * @param fname - The Farcaster name to check availability for
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with fname availability
 *
 * @example
 * ```tsx
 * function FnameChecker() {
 *   const [username, setUsername] = useState("");
 *   const { data: isAvailable, isLoading } = useFnameAvailability(username);
 *
 *   return (
 *     <div>
 *       <input
 *         value={username}
 *         onChange={(e) => setUsername(e.target.value)}
 *         placeholder="Enter fname"
 *       />
 *       {isLoading && <span>Checking...</span>}
 *       {isAvailable !== undefined && (
 *         <span>{isAvailable ? "Available" : "Taken"}</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useUserByUsername} for fetching full user data by username
 * @see {@link https://docs.neynar.com/reference/is-fname-available}
 */
export function useFnameAvailability(
  fname: string,
  options?: QueryHookOptions<FnameAvailabilityResponse, boolean>,
): QueryHookResult<boolean> {
  const queryParams = buildNeynarQuery({ fname });

  return useApiQuery<FnameAvailabilityResponse, boolean>(
    neynarQueryKeys.fname.availability(fname),
    `/api/neynar/fname/availability?${queryParams}`,
    {
      enabled: Boolean(fname?.trim()),
      staleTime: STALE_TIME.VERY_STABLE,
      ...options,
      select: (response) => {
        // SDK returns: { available: boolean }
        // Extract just the boolean value
        return response.available;
      },
    },
  );
}
