// Minimum time a bounty must be open before evaluation (72h default, env-overridable)
export const MIN_OPEN_DURATION_HOURS = parseInt(process.env.MIN_OPEN_DURATION_HOURS ?? "72");

// If a bounty has no submissions for this long, post a reminder nudge (default: 7 days)
export const NO_SUBMISSION_NUDGE_HOURS = parseInt(process.env.NO_SUBMISSION_NUDGE_HOURS ?? "168");

// Post no-submission reminders at most once every 48h
export const NO_SUBMISSION_NUDGE_INTERVAL_HOURS = parseInt(process.env.NO_SUBMISSION_NUDGE_INTERVAL_HOURS ?? "48");

// Platform fee charged on top of the bounty amount (kept by the bot wallet)
export const PLATFORM_FEE_PCT = 2.5;
