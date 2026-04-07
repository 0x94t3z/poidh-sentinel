import { ButtonHTMLAttributes, ReactNode } from "react";

interface SketchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "default" | "heavy";
}

export function SketchButton({
  children,
  variant = "default",
  className = "",
  ...props
}: SketchButtonProps) {
  const baseClass =
    variant === "heavy" ? "sketch-button sketch-border-heavy" : "sketch-button";

  return (
    <button
      className={`${baseClass} ${className} px-6 py-3 text-lg`}
      {...props}
    >
      {children}
    </button>
  );
}
