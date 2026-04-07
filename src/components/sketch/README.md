# Sketch Components

Hand-drawn wireframe components for Phase 1 prototyping.

## Quick Start

```tsx
"use client";
import { useState } from "react";
import {
  SketchButton,
  SketchCard,
  SketchHeading,
  SketchInput,
  SketchFilters,
} from "@/components/sketch";

export function MiniApp() {
  const [count, setCount] = useState(0);

  return (
    <>
      <SketchFilters /> {/* REQUIRED! */}
      <div className="min-h-screen sketch-paper p-6">
        <SketchCard padding="lg">
          <SketchHeading level={1} scribble>
            My App
          </SketchHeading>

          <p className="sketch-text text-xl mt-4">Count: {count}</p>

          <SketchButton onClick={() => setCount(count + 1)}>
            Increment
          </SketchButton>
        </SketchCard>
      </div>
    </>
  );
}
```

## Available Components

- **SketchButton** - Hand-drawn buttons
- **SketchCard** - Sketchy container with padding (`"sm"`, `"md"`, `"lg"`)
- **SketchHeading** - Headings (levels 1-6, optional `underline` or `scribble`)
- **SketchInput** - Form inputs
- **SketchTextarea** - Multi-line text inputs
- **SketchFilters** - SVG filter definitions (REQUIRED at top of component)

## CSS Utilities

- `.sketch-text` - Hand-written font
- `.sketch-paper` - Grid paper background
- `.sketch-border` - Wobbly border with shadow
- `.sketch-light` / `.sketch-heavy` - Control wobble intensity

## Documentation

📖 **[HAND-DRAWN.md](./HAND-DRAWN.md)** - Complete usage guide with examples, patterns, and tips

## Phase 1 Only

⚠️ **These components are for Phase 1 wireframing only!**

In Phase 2, they'll be replaced with `@neynar/ui` components:

- `SketchButton` → `Button`
- `SketchCard` → `Card`
- `SketchHeading` → `Typography` or `h1-h6`
- `SketchInput` → `Input`
- `<SketchFilters />` → Remove
- `.sketch-paper` wrapper → Remove

The app will look the same, just with proper components instead of sketchy ones.
