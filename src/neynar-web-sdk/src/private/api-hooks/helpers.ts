const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Common stale time presets for different data types
export const STALE_TIME = {
  REALTIME: 30 * SECOND, // 30 seconds - for dynamic content (feeds, conversations)
  FREQUENT: 2 * MINUTE, // 2 minutes - for frequently changing content (search, social)
  NORMAL: 5 * MINUTE, // 5 minutes - for semi-stable content (users, channels)
  STABLE: 10 * MINUTE, // 10 minutes - for stable content (power users, metadata)
  VERY_STABLE: 24 * HOUR, // 24 hours - for very stable content (URL metadata)
} as const;
