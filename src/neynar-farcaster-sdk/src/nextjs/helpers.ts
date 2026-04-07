import { NextRequest } from "next/server";

type Params = Record<string, string | string[] | undefined>;

export function parseNextRequestSearchParams(
  request: NextRequest,
): Record<string, string> {
  return Object.fromEntries(request.nextUrl.searchParams.entries());
}

export async function parsePageSearchParams(
  params: Promise<Params>,
): Promise<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(await params)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string>;
}
