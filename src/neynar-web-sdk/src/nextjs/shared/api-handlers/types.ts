import type { NextRequest } from "next/server";

/**
 * Standardized error structure
 */
export interface ApiError {
  message: string;
  code?: string;
  status: number;
  details?: unknown;
}

/**
 * Route handler function signature
 * Takes request parameters and returns a result
 * Client dependencies should be bound via closures
 */
export type RouteHandler<T = unknown> = (params: RouteParams) => Promise<T>;

/**
 * Parameters extracted from the request
 */
export interface RouteParams {
  path: Record<string, string>;
  query: Record<string, string | string[]>;
  body?: unknown;
}

/**
 * Collection of route handlers grouped by HTTP method
 */
export interface MethodHandlers {
  GET?: (
    request: NextRequest,
    context: { params: Promise<{ route: string[] }> },
  ) => Promise<Response>;
  POST?: (
    request: NextRequest,
    context: { params: Promise<{ route: string[] }> },
  ) => Promise<Response>;
  PUT?: (
    request: NextRequest,
    context: { params: Promise<{ route: string[] }> },
  ) => Promise<Response>;
  DELETE?: (
    request: NextRequest,
    context: { params: Promise<{ route: string[] }> },
  ) => Promise<Response>;
  PATCH?: (
    request: NextRequest,
    context: { params: Promise<{ route: string[] }> },
  ) => Promise<Response>;
  OPTIONS?: (
    request: NextRequest,
    context: { params: Promise<{ route: string[] }> },
  ) => Promise<Response>;
}

/**
 * Route matcher that maps URL patterns to handlers
 * Pattern format: "{METHOD} {path}" where METHOD is HTTP method and path is the route
 */
export interface RouteMap {
  [
    pattern: `${"GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS"} ${string}`
  ]: RouteHandler;
}
