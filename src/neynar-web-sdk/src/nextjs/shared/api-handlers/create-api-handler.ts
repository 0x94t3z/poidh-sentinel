import { normalizeResponse } from "./normalize-response";
import type {
  RouteHandler,
  RouteParams,
  MethodHandlers,
  RouteMap,
} from "./types";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Creates HTTP route handlers for API endpoints
 *
 * This is the main factory function that creates Next.js API route handlers.
 * It takes a map of routes (already bound to their dependencies) and returns
 * handlers for each HTTP method that can be used directly in Next.js API routes.
 *
 * HOW IT WORKS:
 * 1. You define routes in a RouteMap (e.g., "GET /users" -> handler function)
 * 2. This factory creates HTTP method handlers (GET, POST, etc.)
 * 3. When a request comes in, it matches the route and calls your handler
 * 4. Your handler receives request parameters and returns the result
 * 5. The response is normalized and returned with proper CORS headers
 *
 * @param params - Router configuration
 * @param params.routes - Map of route patterns to handler functions (e.g., "GET /users/bulk" -> handler)
 * @param params.headers - Response headers to apply to all responses (including CORS headers)
 * @returns Object with HTTP method handlers (GET, POST, PUT, DELETE, etc.) ready for Next.js
 *
 * @example Basic API route setup
 * ```typescript
 * // In your Next.js API route file: /api/myservice/[...route]/route.ts
 * const routes = {
 *   "GET /users/bulk": async (params) => someClient.fetchBulkUsers(params.query)
 * };
 *
 * export const { GET, POST, PUT, DELETE } = createRouter({
 *   routes,
 *   headers: {
 *     "Access-Control-Allow-Origin": "*",
 *     "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
 *     "Access-Control-Allow-Headers": "Content-Type, Authorization",
 *     "Cache-Control": "public, max-age=60"
 *   }
 * });
 * ```
 */
export function createRouter({
  routes,
  headers,
}: {
  routes: RouteMap;
  headers: Record<string, string>;
}): MethodHandlers {
  /**
   * The main request handler that processes all incoming HTTP requests
   * This function is used for all HTTP methods (GET, POST, PUT, etc.)
   *
   * REQUEST FLOW:
   * 1. Extract route segments from Next.js dynamic route (e.g., /api/neynar/users/bulk -> ["users", "bulk"])
   * 2. Handle CORS preflight requests (OPTIONS method)
   * 3. Parse request parameters (query params, path params, body)
   * 4. Find the matching route handler from our route map
   * 5. Execute the handler with the SDK client and parameters
   * 6. Normalize the response and add CORS headers
   */
  async function handleRequest(
    request: NextRequest,
    context: { params: Promise<{ route: string[] }> },
  ) {
    // Extract the route segments from Next.js dynamic routing
    // e.g., /api/neynar/users/bulk becomes ["users", "bulk"]
    const params = await context.params;
    const route = params?.route || [];
    const method = request.method;

    // Handle CORS preflight requests
    // Browsers send OPTIONS requests before actual requests to check CORS policy
    if (method === "OPTIONS") {
      const response = new NextResponse(null, { status: 200 });
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    try {
      // Parse all the different types of parameters from the request
      // - Query params: ?fid=123&limit=10
      // - Path params: /users/:id (from route patterns like "GET /users/:id")
      // - Body: JSON payload for POST/PUT requests
      const { handler, matchedPattern } = findRouteHandlerWithPattern(
        method,
        route,
        routes,
      );

      if (!handler) {
        // Return a 404 error if no handler matches this route
        const response = normalizeResponse(null, {
          message: `Route ${method} /${route.join("/")} not found`,
          status: 404,
        });
        return createApiResponse({ headers, data: response });
      }

      const routeParams = await extractRouteParams(
        request,
        route,
        matchedPattern,
      );

      // Execute the matched handler with the extracted parameters
      // Handler is already bound to its dependencies (e.g., SDK client)
      const result = await handler(routeParams);

      // Normalize the response to our standard format: { data: T } for success
      const response = normalizeResponse(result);

      // Create the final HTTP response with proper headers
      return createApiResponse({ headers, data: response });
    } catch (error) {
      // Handle any errors that occur during processing
      console.error("API Error:", {
        route: `${method} /${route.join("/")}`,
        error: error,
        message: error instanceof Error ? error.message : String(error),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: (error as any)?.status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response: (error as any)?.response,
      });

      // Normalize the error to our standard format: { error: ApiError }
      const response = normalizeResponse(null, error);
      return createApiResponse({ headers, data: response });
    }
  }

  // Return handlers for all HTTP methods
  // Next.js will call the appropriate handler based on the request method
  // All methods use the same handler function since routing logic is the same
  return {
    GET: handleRequest, // Handle GET requests
    POST: handleRequest, // Handle POST requests
    PUT: handleRequest, // Handle PUT requests
    DELETE: handleRequest, // Handle DELETE requests
    PATCH: handleRequest, // Handle PATCH requests
    OPTIONS: handleRequest, // Handle OPTIONS requests (CORS preflight)
  } as const;
}

/**
 * Find route handler and return both the handler and the matched pattern
 *
 * This combines the route finding logic and returns additional information
 * needed for path parameter extraction.
 */
function findRouteHandlerWithPattern(
  method: string,
  route: string[],
  routeMap: RouteMap,
): { handler: RouteHandler | null; matchedPattern: string | null } {
  // Build the route key from method + path
  const routeKey = `${method} /${route.join("/")}`;

  // Try exact match first
  if (routeKey in routeMap) {
    return {
      handler: routeMap[routeKey as keyof RouteMap],
      matchedPattern: routeKey,
    };
  }

  // Try pattern matching for dynamic routes
  for (const [pattern, handler] of Object.entries(routeMap)) {
    if (matchRoutePattern(pattern, method, route)) {
      return { handler, matchedPattern: pattern };
    }
  }

  return { handler: null, matchedPattern: null };
}

/**
 * Extract parameters from the request
 *
 * This function parses a Next.js request and extracts all the different types
 * of parameters that route handlers might need:
 * - Query parameters: ?fid=123&limit=10
 * - Path parameters: /users/:id becomes path.id = "123"
 * - Request body: JSON payload for POST/PUT requests
 *
 * EXAMPLES:
 * - GET /api/neynar/users/bulk?fids=1,2,3
 *   → query: { fids: "1,2,3" }
 * - GET /api/neynar/users/:id with /users/123
 *   → path: { id: "123" } (if route pattern uses :id)
 * - POST /api/neynar/casts with JSON body
 *   → body: { text: "Hello world", parent_url: "..." }
 */
async function extractRouteParams(
  request: NextRequest,
  route: string[],
  matchedPattern: string | null,
): Promise<RouteParams> {
  const url = new URL(request.url);
  const query: Record<string, string | string[]> = {};

  // Extract query parameters from URL search params
  // Handle duplicate keys by converting to arrays (e.g., ?tag=a&tag=b → tag: ["a", "b"])
  url.searchParams.forEach((value, key) => {
    const existing = query[key];
    if (existing) {
      // If key already exists, convert to array or append to existing array
      query[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      // First occurrence of this key
      query[key] = value;
    }
  });

  // Extract path parameters using the matched pattern
  const path: Record<string, string> = {};

  if (matchedPattern) {
    // Split pattern to get the path part (e.g., "GET /coins/:id" -> "/coins/:id")
    const [, patternPath] = matchedPattern.split(" ");
    const patternSegments = patternPath.split("/").filter(Boolean);

    // Match pattern segments with actual route segments
    patternSegments.forEach((segment, index) => {
      if (segment.startsWith(":")) {
        // Remove the ":" prefix to get parameter name
        const paramName = segment.slice(1);
        // Get the corresponding value from the actual route
        path[paramName] = route[index] || "";
      }
    });
  }

  // Extract request body for methods that typically have one
  // GET and OPTIONS requests don't usually have bodies
  let body: unknown;
  if (request.method !== "GET" && request.method !== "OPTIONS") {
    try {
      const contentType = request.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        // Parse JSON body (most common for API requests)
        body = await request.json();
      } else {
        // Fallback to raw text for other content types
        body = await request.text();
      }
    } catch {
      // Ignore body parsing errors - some requests might not have valid bodies
      // This is fine, the handler can check if body is undefined
    }
  }

  return { path, query, body };
}

/**
 * Simple route pattern matching
 *
 * This function checks if a route pattern (like "GET /users/:id") matches
 * an actual incoming request route (like "GET /users/123").
 *
 * PATTERN SYNTAX:
 * - Exact segments must match exactly: "/users" matches "/users"
 * - Parameter segments start with ":": "/:id" matches "/123", "/abc", etc.
 *
 * EXAMPLES:
 * - Pattern "GET /users/:id" matches request "GET /users/123" ✅
 * - Pattern "GET /users/:id" matches request "GET /users/abc" ✅
 * - Pattern "GET /users/:id" matches request "POST /users/123" ❌ (wrong method)
 * - Pattern "GET /users/:id" matches request "GET /users/123/posts" ❌ (wrong length)
 */
function matchRoutePattern(
  pattern: string,
  method: string,
  route: string[],
): boolean {
  // Split pattern into method and path parts
  // e.g., "GET /users/:id" → ["GET", "/users/:id"]
  const [patternMethod, patternPath] = pattern.split(" ");

  // Method must match exactly (GET, POST, etc.)
  if (patternMethod !== method) {
    return false;
  }

  // Split path into segments and remove empty ones
  // e.g., "/users/:id" → ["users", ":id"]
  const patternSegments = patternPath.split("/").filter(Boolean);

  // Route length must match exactly - no partial matches
  // e.g., "/users/:id" should not match "/users/123/posts"
  if (patternSegments.length !== route.length) {
    return false;
  }

  // Check each segment - either exact match or parameter match
  return patternSegments.every((segment, index) => {
    // Parameter segments (starting with ":") match any value
    // Exact segments must match the route segment exactly
    return segment.startsWith(":") || segment === route[index];
  });
}

/**
 * Create a standardized API response with headers
 *
 * This function creates the final HTTP response that gets sent back to the client.
 * It handles both success and error cases with a consistent format that works
 * perfectly with Tanstack Query.
 *
 * RESPONSE FORMATS (OPTIMIZED FOR REACT QUERY):
 *
 * SUCCESS: Returns natural Neynar format (unwrapped)
 * - HTTP 200 status
 * - Body: { users: [...], next: { cursor: "..." } } (direct access to data)
 * - React Query usage: const users = data.users; const cursor = data.next?.cursor;
 * - Perfect for infinite queries with cursor-based pagination
 *
 * ERROR: Returns wrapped { error } structure for consistency
 * - HTTP 4xx/5xx status (from error.status)
 * - Body: { error: { message: "Not found", code: "NOT_FOUND", status: 404 } }
 * - React Query can easily check: if (response.error) then handle error
 *
 * All responses include configured headers (including CORS headers).
 */
function createApiResponse({
  headers,
  data,
}: {
  headers: Record<string, string>;
  data: unknown;
}): NextResponse {
  // Check if data is an error object
  const responseObj = data as { error?: { status?: number } };

  // HANDLE ERROR RESPONSES
  if (responseObj.error) {
    // Extract status code from error, default to 500 for unknown errors
    const errorStatus = responseObj.error.status || 500;

    // Create error response with the full error structure
    const nextResponse = NextResponse.json(data, {
      status: errorStatus,
    });

    // Apply all headers (including CORS)
    Object.entries(headers).forEach(([key, value]) => {
      nextResponse.headers.set(key, value);
    });

    return nextResponse;
  }

  // HANDLE SUCCESS RESPONSES
  // Pass through raw SDK response - hooks will extract what they need via select()
  const nextResponse = NextResponse.json(data, { status: 200 });

  // Apply all headers (including CORS)
  Object.entries(headers).forEach(([key, value]) => {
    nextResponse.headers.set(key, value);
  });

  return nextResponse;
}
