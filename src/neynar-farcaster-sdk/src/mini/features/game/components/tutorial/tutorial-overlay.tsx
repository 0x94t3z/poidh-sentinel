"use client";

import type { TutorialStep } from "../../hooks/tutorial/use-tutorial";
import { Button } from "@neynar/ui";

export type TutorialOverlayProps = {
  currentStep: TutorialStep | null;
  stepIndex: number;
  totalSteps: number;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  onComplete?: () => void;
};

/**
 * Tutorial overlay component
 *
 * Full-screen tutorial UI with step counter, navigation, and element highlighting.
 * Darkens screen except highlighted element, shows tooltip with instructions.
 *
 * @example
 * ```typescript
 * const tutorial = useTutorial(steps);
 *
 * {!tutorial.isComplete && (
 *   <TutorialOverlay {...tutorial} />
 * )}
 * ```
 */
export function TutorialOverlay({
  currentStep,
  stepIndex,
  totalSteps,
  nextStep,
  prevStep,
  skipTutorial,
  onComplete,
}: TutorialOverlayProps) {
  if (!currentStep) return null;

  const handleNext = () => {
    nextStep();
    if (stepIndex === totalSteps - 1) {
      onComplete?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70" onClick={skipTutorial} />

      {/* Tutorial card */}
      <div className="relative z-10 bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{currentStep.title}</h3>
            <span className="text-sm text-gray-500">
              {stepIndex + 1} / {totalSteps}
            </span>
          </div>

          <p className="text-gray-700">{currentStep.description}</p>

          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button onClick={prevStep} variant="outline" className="flex-1">
                Previous
              </Button>
            )}
            <Button onClick={handleNext} className="flex-1">
              {stepIndex === totalSteps - 1 ? "Finish" : "Next"}
            </Button>
          </div>

          <button
            onClick={skipTutorial}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Skip Tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
