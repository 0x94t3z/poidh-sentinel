"use client";

export type ControlsHelperProps = {
  controls: {
    key: string;
    label: string;
    description: string;
  }[];
  visible: boolean;
  onClose?: () => void;
};

/**
 * Keyboard/touch control overlay component
 *
 * Shows list of keyboard/touch controls in a semi-transparent overlay.
 * Formatted like "Arrow Keys - Move player".
 *
 * @example
 * ```typescript
 * <ControlsHelper
 *   visible={showControls}
 *   onClose={() => setShowControls(false)}
 *   controls={[
 *     { key: 'Arrow Keys', label: 'Move', description: 'Move player' },
 *     { key: 'Space', label: 'Jump', description: 'Jump over obstacles' }
 *   ]}
 * />
 * ```
 */
export function ControlsHelper({
  controls,
  visible,
  onClose,
}: ControlsHelperProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Controls</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 font-bold text-xl"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        <div className="space-y-3">
          {controls.map((control, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="bg-gray-100 px-3 py-1 rounded font-mono text-sm min-w-[100px] text-center">
                {control.key}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{control.label}</div>
                <div className="text-sm text-gray-600">
                  {control.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
