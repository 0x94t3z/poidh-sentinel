// Minimum time a bounty must be open before evaluation (72h default, env-overridable)
export const MIN_OPEN_DURATION_HOURS = parseInt(process.env.MIN_OPEN_DURATION_HOURS ?? "72");
