import { ReactNode } from "react";

interface SketchHeadingProps {
  children: ReactNode;
  level?: 1 | 2 | 3 | 4;
  underline?: boolean;
  scribble?: boolean;
  highlight?: boolean;
  className?: string;
}

export function SketchHeading({
  children,
  level = 1,
  underline = false,
  scribble = false,
  highlight = false,
  className = "",
}: SketchHeadingProps) {
  const sizes = {
    1: "text-5xl",
    2: "text-4xl",
    3: "text-3xl",
    4: "text-2xl",
  };

  const Tag = `h${level}` as keyof HTMLElementTagNameMap;

  let effectClass = "";
  if (underline) effectClass = "sketch-underline";
  if (scribble) effectClass = "sketch-scribble";
  if (highlight) effectClass = "sketch-highlight";

  return (
    <Tag
      className={`sketch-text font-bold ${sizes[level]} ${effectClass} ${className}`}
    >
      {children}
    </Tag>
  );
}
