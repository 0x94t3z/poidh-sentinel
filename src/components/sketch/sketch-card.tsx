import { ComponentPropsWithoutRef } from "react";

interface SketchCardProps extends ComponentPropsWithoutRef<"div"> {
  padding?: "sm" | "md" | "lg";
}

export function SketchCard({
  children,
  className = "",
  padding = "md",
  ...props
}: SketchCardProps) {
  const paddingClasses = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={`sketch-card ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
