"use client";

import { useState } from "react";

export type TutorialStep = {
  id: string;
  title: string;
  description: string;
  target?: string;
  position?: "top" | "bottom" | "left" | "right";
  onComplete?: () => void;
};

/**
 * Multi-step tutorial system hook
 *
 * Manages tutorial flow with navigation, progress tracking, and completion callbacks.
 *
 * @param steps - Array of tutorial steps
 * @returns Object with current step, navigation functions, and completion state
 *
 * @example
 * ```typescript
 * const tutorial = useTutorial([
 *   {
 *     id: 'welcome',
 *     title: 'Welcome!',
 *     description: 'Click the button to start'
 *   },
 *   {
 *     id: 'controls',
 *     title: 'Controls',
 *     description: 'Use arrow keys to move',
 *     target: '#game-controls'
 *   }
 * ]);
 *
 * <TutorialOverlay {...tutorial} />
 * ```
 */
export function useTutorial(steps: TutorialStep[]) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const currentStep = stepIndex < steps.length ? steps[stepIndex] : null;

  const nextStep = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      setIsComplete(true);
      currentStep?.onComplete?.();
    }
  };

  const prevStep = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const skipTutorial = () => {
    setIsComplete(true);
    setStepIndex(steps.length);
  };

  const resetTutorial = () => {
    setStepIndex(0);
    setIsComplete(false);
  };

  return {
    currentStep,
    stepIndex,
    totalSteps: steps.length,
    nextStep,
    prevStep,
    skipTutorial,
    resetTutorial,
    isComplete,
  };
}
