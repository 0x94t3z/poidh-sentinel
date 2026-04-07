/**
 * Game Features Module
 *
 * Pre-built game components and hooks for Farcaster mini apps.
 * All components handle both touch and keyboard input automatically.
 */

// Hooks - Initialization
export {
  useInitializeGame,
  gameConfigAtom,
  type GameConfig,
  type GameAction,
  type GameActionHandler,
  type GameActionHandlers,
} from "./hooks/initialization/use-initialize-game";
export { useGameLoop } from "./hooks/initialization/use-game-loop";

// Hooks - State (use{Name} for read, useSet{Name} for write)
export {
  useActiveGameActions,
  useSetActiveGameActions,
  useGameControlsEnabled,
  useSetGameControlsEnabled,
  useGamePaused,
  useSetGamePaused,
  useGameOver,
  useSetGameOver,
  useGameLoading,
  useSetGameLoading,
  useGameActionHandlers,
  useSetGameActionHandlers,
} from "./hooks/use-game-state";

// Components
export { DirectionalPad } from "./components/directional-pad";
export type { DirectionalPadProps } from "./components/directional-pad";

export { ActionButtons } from "./components/action-buttons";
export type { ActionButtonsProps } from "./components/action-buttons";

export { GameMiniLayout } from "./components/game-mini-layout";
export { GameBoard } from "./components/game-board";

// Hooks - Score & Progress
export { useScore } from "./hooks/use-score";
export { useCombo } from "./hooks/use-combo";
export { useStreak } from "./hooks/use-streak";

// Hooks - Time
export { useCountdown } from "./hooks/use-countdown";
export { useStopwatch } from "./hooks/use-stopwatch";

// Hooks - Persistence
export { useLocalStorageState } from "./hooks/use-local-storage-state";
export { useCheckpoint } from "./hooks/use-checkpoint";
export type { CheckpointInfo } from "./hooks/use-checkpoint";

// Components - Score & Progress
export { ScoreDisplay } from "./components/score-display";
export type { ScoreDisplayProps } from "./components/score-display";

export { ComboIndicator } from "./components/combo-indicator";
export type { ComboIndicatorProps } from "./components/combo-indicator";

export { ProgressBar } from "./components/progress-bar";
export type { ProgressBarProps } from "./components/progress-bar";

export { Timer } from "./components/timer";
export type { TimerProps } from "./components/timer";

export { ProgressTimer } from "./components/progress-timer";
export type { ProgressTimerProps } from "./components/progress-timer";

export { CountdownAnimation } from "./components/countdown-animation";
export type { CountdownAnimationProps } from "./components/countdown-animation";

// Utilities
export * from "./utilities";

// Wave 2: Visual Effects - Hooks
export { useScreenShake } from "./hooks/effects/use-screen-shake";
export { useParticles } from "./hooks/effects/use-particles";
export type { Particle, EmitConfig } from "./hooks/effects/use-particles";
export { useFlashEffect } from "./hooks/effects/use-flash-effect";
export { usePulse } from "./hooks/effects/use-pulse";
export { useScorePopup } from "./hooks/effects/use-score-popup";
export type { ScorePopup } from "./hooks/effects/use-score-popup";

// Wave 2: Visual Effects - Components
export { ParticleEmitter } from "./components/effects/particle-emitter";
export type { ParticleEmitterProps } from "./components/effects/particle-emitter";
export { ScreenShakeContainer } from "./components/effects/screen-shake-container";
export type { ScreenShakeContainerProps } from "./components/effects/screen-shake-container";
export { FloatingText } from "./components/effects/floating-text";
export type { FloatingTextProps } from "./components/effects/floating-text";
export { FlashOverlay } from "./components/effects/flash-overlay";
export type { FlashOverlayProps } from "./components/effects/flash-overlay";

// Wave 2: Tutorial System - Hooks
export { useTutorial } from "./hooks/tutorial/use-tutorial";
export type { TutorialStep } from "./hooks/tutorial/use-tutorial";

// Wave 2: Tutorial System - Components
export { TutorialOverlay } from "./components/tutorial/tutorial-overlay";
export type { TutorialOverlayProps } from "./components/tutorial/tutorial-overlay";
export { ControlsHelper } from "./components/tutorial/controls-helper";
export type { ControlsHelperProps } from "./components/tutorial/controls-helper";

// Wave 2: Power-ups & Collectibles - Hooks
export { usePowerUps } from "./hooks/powerups/use-power-ups";
export type {
  PowerUpDefinition,
  ActivePowerUp,
} from "./hooks/powerups/use-power-ups";
export { useInventory } from "./hooks/powerups/use-inventory";
export { useBuffs } from "./hooks/powerups/use-buffs";
export type { Buff } from "./hooks/powerups/use-buffs";

// Wave 2: Power-ups & Collectibles - Components
export { PowerUpIndicator } from "./components/powerups/power-up-indicator";
export type { PowerUpIndicatorProps } from "./components/powerups/power-up-indicator";
export { InventoryGrid } from "./components/powerups/inventory-grid";
export type { InventoryGridProps } from "./components/powerups/inventory-grid";
export { BuffIcon } from "./components/powerups/buff-icon";
export type { BuffIconProps } from "./components/powerups/buff-icon";
