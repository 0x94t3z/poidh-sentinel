/**
 * Common game math utilities
 *
 * Pure functions for clamping, interpolation, distance calculation,
 * and angle conversions.
 */

/**
 * Clamp value between min and max
 *
 * @param value - Value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Value clamped to [min, max] range
 *
 * @example
 * ```typescript
 * // Keep health between 0-100
 * const health = clamp(newHealth, 0, 100);
 *
 * // Keep player position on screen
 * const x = clamp(playerX, 0, screenWidth);
 * const y = clamp(playerY, 0, screenHeight);
 * ```
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between start and end
 *
 * @param start - Starting value
 * @param end - Ending value
 * @param t - Progress from 0 to 1 (0 = start, 1 = end)
 * @returns Interpolated value
 *
 * @example
 * ```typescript
 * // Smooth camera movement
 * const cameraX = lerp(currentX, targetX, 0.1);
 *
 * // Animate score counter
 * const displayScore = lerp(oldScore, newScore, progress);
 *
 * // Fade opacity
 * const opacity = lerp(0, 1, fadeProgress);
 * ```
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Calculate distance between two points
 *
 * @param x1 - First point X coordinate
 * @param y1 - First point Y coordinate
 * @param x2 - Second point X coordinate
 * @param y2 - Second point Y coordinate
 * @returns Euclidean distance between the points
 *
 * @example
 * ```typescript
 * // Check if player is near enemy
 * const dist = distance(playerX, playerY, enemyX, enemyY);
 * if (dist < 50) {
 *   takeDamage();
 * }
 *
 * // Check if click hit target
 * const clickDist = distance(clickX, clickY, targetX, targetY);
 * if (clickDist < targetRadius) {
 *   hit();
 * }
 * ```
 */
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Convert degrees to radians
 *
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 *
 * @example
 * ```typescript
 * // Rotate sprite
 * const radians = degreesToRadians(45);
 * sprite.rotation = radians;
 *
 * // Calculate circular motion
 * const angle = degreesToRadians(currentAngle);
 * const x = centerX + Math.cos(angle) * radius;
 * const y = centerY + Math.sin(angle) * radius;
 * ```
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 *
 * @param radians - Angle in radians
 * @returns Angle in degrees
 *
 * @example
 * ```typescript
 * // Display angle to user
 * const degrees = radiansToDegrees(sprite.rotation);
 * console.log(`Rotation: ${degrees}°`);
 *
 * // Calculate angle between points
 * const radians = Math.atan2(dy, dx);
 * const degrees = radiansToDegrees(radians);
 * ```
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}
