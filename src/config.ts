export function getEnv(name: string, fallback = ""): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getBool(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function getBoolAny(names: string[], fallback: boolean): boolean {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (!value) {
      continue;
    }
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }
  return fallback;
}

export function getInt(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getIntAny(names: string[], fallback: number): number {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (!value) {
      continue;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}
