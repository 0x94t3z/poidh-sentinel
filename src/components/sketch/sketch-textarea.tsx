import { TextareaHTMLAttributes } from "react";

interface SketchTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function SketchTextarea({
  label,
  className = "",
  ...props
}: SketchTextareaProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="sketch-text text-lg font-bold">{label}</label>
      )}
      <textarea
        className={`sketch-input text-base min-h-[100px] ${className}`}
        {...props}
      />
    </div>
  );
}
