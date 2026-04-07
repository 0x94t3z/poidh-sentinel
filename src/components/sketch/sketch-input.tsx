import { InputHTMLAttributes } from "react";

interface SketchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function SketchInput({
  label,
  className = "",
  ...props
}: SketchInputProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="sketch-text text-lg font-bold">{label}</label>
      )}
      <input className={`sketch-input text-base ${className}`} {...props} />
    </div>
  );
}
