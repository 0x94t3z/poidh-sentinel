import type { ApiError } from "./types";

/**
 * Normalizes SDK responses for API handlers
 *
 * ARCHITECTURE DECISION: This module ONLY normalizes errors, not success responses.
 *
 * Success responses are passed through unchanged from the SDK to hooks.
 * This ensures zero data loss and lets hooks use React Query's select() to extract
 * exactly what they need from the raw SDK response.
 *
 * Error normalization is kept because:
 * - SDK errors vary (Axios errors, HTTP errors, etc.)
 * - We want consistent { message, code, status, details } shape
 * - Errors are the exception path where normalization adds value
 */

/**
 * Pass through SDK responses unchanged
 * Only wraps errors in normalized format
 *
 * @param result - Raw SDK response (passed through as-is)
 * @param error - Optional error to normalize
 * @returns Raw SDK response or normalized error
 */
export function normalizeResponse<T>(
  result: unknown,
  error?: unknown,
): T | { error: ApiError } {
  if (error) {
    return {
      error: normalizeError(error),
    };
  }

  // Pass through SDK response unchanged
  return result as T;
}

/**
 * Normalizes any error into the standardized ApiError format
 * todo: this feels too specific to the individual sdks/apis this wraps, responsibility belongs there
 */
export function normalizeError(error: unknown): ApiError {
  // Handle Neynar SDK errors (Axios errors)
  if (isAxiosError(error)) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message || error.message || "API request failed";
    const code = error.response?.data?.code || error.code;

    return {
      message,
      code,
      status,
      details: error.response?.data,
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      message: error.message,
      status: 500,
      details: {
        name: error.name,
        stack: error.stack,
      },
    };
  }

  // Handle string errors
  if (typeof error === "string") {
    return {
      message: error,
      status: 500,
    };
  }

  // Handle unknown error types
  return {
    message: "An unknown error occurred",
    status: 500,
    details: error,
  };
}

/**
 * Type guard to check if an error is an Axios error
 */
function isAxiosError(error: unknown): error is {
  response?: {
    status: number;
    data?: {
      message?: string;
      code?: string;
    };
  };
  message: string;
  code?: string;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    "message" in error
  );
}
