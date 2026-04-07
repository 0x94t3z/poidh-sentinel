"use client";

export type TimerProps = {
  milliseconds: number;
  format?: "MM:SS" | "MM:SS.mmm" | "HH:MM:SS" | "seconds";
  className?: string;
};

/**
 * Formatted time display component
 *
 * Displays time in various formats. This is a presentation component
 * (doesn't manage state - just displays the provided milliseconds).
 * Use with useCountdown or useStopwatch hooks.
 *
 * @param milliseconds - Time value in milliseconds
 * @param format - Display format (default: 'MM:SS')
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * const { timeLeft } = useCountdown(60);
 *
 * // Display as MM:SS
 * <Timer milliseconds={timeLeft} format="MM:SS" />
 * // Output: "01:00", "00:45", "00:00"
 *
 * // Display with milliseconds
 * <Timer milliseconds={elapsed} format="MM:SS.mmm" />
 * // Output: "01:23.456"
 *
 * // Display as seconds
 * <Timer milliseconds={elapsed} format="seconds" />
 * // Output: "83s"
 * ```
 */
export function Timer({
  milliseconds,
  format = "MM:SS",
  className = "",
}: TimerProps) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const ms = milliseconds % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number, length: number = 2) =>
    num.toString().padStart(length, "0");

  let display = "";

  switch (format) {
    case "MM:SS":
      display = `${pad(minutes)}:${pad(seconds)}`;
      break;

    case "MM:SS.mmm":
      display = `${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`;
      break;

    case "HH:MM:SS":
      display = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      break;

    case "seconds":
      display = `${totalSeconds}s`;
      break;

    default:
      display = `${pad(minutes)}:${pad(seconds)}`;
  }

  return <div className={className}>{display}</div>;
}
