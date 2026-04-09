import { NextRequest, NextResponse } from "next/server";

/**
 * Validates the Authorization: Bearer <ADMIN_SECRET> header.
 * Returns a 401 NextResponse if unauthorized, or null if the request is allowed.
 *
 * Usage:
 *   const unauth = checkAdminAuth(req);
 *   if (unauth) return unauth;
 */
export function checkAdminAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET is not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
