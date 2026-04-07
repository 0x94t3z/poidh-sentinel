# Hand-Drawn Sketch Components

Quick reference for using hand-drawn sketch components during Phase 1 wireframing.

## 🎨 How It Works

The sketch system uses **SVG filters** (`feTurbulence` and `feDisplacementMap`) to create genuinely wobbly, hand-drawn effects that look like they were sketched on paper.

## ⚠️ Critical: Include SketchFilters

You **MUST** include the `<SketchFilters />` component in your app for the hand-drawn effects to work:

```tsx
import { SketchFilters } from "@/components/sketch";

export function MiniApp() {
  return (
    <>
      <SketchFilters /> {/* This is REQUIRED! */}
      <div className="min-h-screen sketch-paper p-6">{/* Your app */}</div>
    </>
  );
}
```

**Why?** The filters component renders invisible SVG filter definitions that all the sketch classes reference.

## 🚀 Quick Start Template

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
      <SketchFilters />
      <div className="min-h-screen sketch-paper p-6">
        <SketchCard padding="lg">
          <SketchHeading level={1} scribble>
            My Sketchy App
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

## 📦 Available Components

### SketchButton

```tsx
<SketchButton onClick={() => alert("Clicked!")}>Click Me</SketchButton>
```

- Wobbly borders
- Hand-written font
- Sketchy shadow

### SketchCard

```tsx
<SketchCard padding="lg">
  <h2>Card Title</h2>
  <p>Card content with paper texture</p>
</SketchCard>
```

Padding options: `"sm"`, `"md"` (default), `"lg"`

### SketchHeading

```tsx
<SketchHeading level={1}>Main Title</SketchHeading>
<SketchHeading level={2} underline>With Underline</SketchHeading>
<SketchHeading level={3} scribble>With Scribble</SketchHeading>
```

### SketchInput

```tsx
<SketchInput
  label="Name"
  placeholder="Type here..."
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

### SketchTextarea

```tsx
<SketchTextarea
  label="Description"
  placeholder="Type here..."
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  rows={4}
/>
```

### Regular Text

Use standard HTML elements with `className="sketch-text"`:

```tsx
<p className="sketch-text">Some text here</p>
<span className="sketch-text">Inline text</span>
<div className="sketch-text text-2xl">Large text</div>
```

## 🎯 Common Patterns

### Form with Multiple Inputs

```tsx
<SketchCard padding="lg">
  <SketchHeading level={2}>Contact Form</SketchHeading>

  <div className="space-y-4 mt-6">
    <SketchInput
      label="Name"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />

    <SketchInput
      label="Email"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />

    <SketchButton onClick={handleSubmit} className="w-full">
      Submit
    </SketchButton>
  </div>
</SketchCard>
```

### List of Items

```tsx
<SketchCard>
  <SketchHeading level={2}>Todo List</SketchHeading>

  <div className="mt-6 space-y-3">
    {todos.map((todo) => (
      <div key={todo.id} className="sketch-border p-4 flex items-center gap-3">
        <input type="checkbox" checked={todo.done} className="w-5 h-5" />
        <span className="sketch-text">{todo.text}</span>
      </div>
    ))}
  </div>
</SketchCard>
```

### Grid Layout

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <SketchCard>
    <SketchHeading level={3}>Card 1</SketchHeading>
    <p className="sketch-text mt-2">Content here</p>
  </SketchCard>

  <SketchCard>
    <SketchHeading level={3}>Card 2</SketchHeading>
    <p className="sketch-text mt-2">More content</p>
  </SketchCard>
</div>
```

## 🎨 CSS Utility Classes

### Text Styling

- `.sketch-text` - Hand-written font
- `.sketch-highlight` - Yellow highlight marker effect
- `.sketch-underline` - Hand-drawn underline
- `.sketch-scribble` - Scribble underline

### Borders & Containers

- `.sketch-border` - Wobbly border with shadow
- `.sketch-card` - Complete card styling
- `.sketch-paper` - Grid paper background

### Intensity Levels

Control how "wobbly" things look:

- `.sketch-light` - Subtle wobble
- (default) - Medium wobble
- `.sketch-heavy` - Very wobbly

```tsx
<div className="sketch-light p-4 border-2 border-black">Slightly wobbly</div>
<div className="sketch-heavy p-4 border-3 border-black">Super wobbly!</div>
```

## 🛠️ Custom Wobbly Elements

Apply filters directly to any element:

```tsx
{
  /* Custom wobbly box */
}
<div
  className="p-4 border-2 border-black bg-white"
  style={{ filter: "url(#sketchy)" }}
>
  I'm wobbly!
</div>;

{
  /* Very wobbly box */
}
<div className="sketch-heavy p-4 border-3 border-black">Super wobbly!</div>;
```

## 📝 Complete Example: Game Scaffold

```tsx
"use client";
import { useState } from "react";
import {
  SketchButton,
  SketchCard,
  SketchHeading,
  SketchFilters,
} from "@/components/sketch";

// Mock data
const MOCK_SCORES = [
  { player: "Alice", score: 100 },
  { player: "Bob", score: 85 },
];

export function MiniApp() {
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  return (
    <>
      <SketchFilters />

      <div className="min-h-screen sketch-paper p-6">
        <SketchCard padding="lg">
          <SketchHeading level={1} scribble>
            🎮 Game Title
          </SketchHeading>

          {!gameStarted ? (
            <SketchButton
              onClick={() => setGameStarted(true)}
              className="mt-6 w-full"
            >
              Start Game
            </SketchButton>
          ) : (
            <div className="mt-6">
              <p className="sketch-text text-2xl">Score: {score}</p>

              <div className="flex gap-4 mt-4">
                <SketchButton onClick={() => setScore(score + 10)}>
                  +10 Points
                </SketchButton>
                <SketchButton onClick={() => setGameStarted(false)}>
                  End Game
                </SketchButton>
              </div>
            </div>
          )}
        </SketchCard>

        <SketchCard padding="md" className="mt-6">
          <SketchHeading level={2}>Leaderboard</SketchHeading>

          <div className="mt-4 space-y-2">
            {MOCK_SCORES.map((entry, i) => (
              <div key={i} className="sketch-border p-3 flex justify-between">
                <span className="sketch-text">{entry.player}</span>
                <span className="sketch-text font-bold">{entry.score}</span>
              </div>
            ))}
          </div>
        </SketchCard>
      </div>
    </>
  );
}
```

## 🎯 Tips for Phase 1 Wireframing

1. **Always include `<SketchFilters />`** - Without it, the wobbly effects won't work!
2. **Use `.sketch-paper` background** - Adds grid texture for that notebook vibe
3. **Combine with hand-written font** - Use `.sketch-text` class for consistency
4. **Focus on functionality first** - The sketch aesthetic signals "work in progress"
5. **Keep everything inline** - Put all code in `mini-app.tsx` during wireframing
6. **Use mock data** - Hardcode arrays and objects at the top of the file

## ⚡ Performance Note

SVG filters are GPU-accelerated and perform well even on mobile. However:

- Avoid using `sketch-heavy` on very large containers
- If you notice performance issues, use `sketch-light` instead
- The default effect is optimized for best balance

## 🎭 Available SVG Filters

The `<SketchFilters />` component includes these filters:

1. **`#sketchy`** - Light turbulence for subtle wobble
2. **`#sketchy-medium`** - Medium turbulence for more wobble
3. **`#sketchy-heavy`** - Heavy turbulence for maximum wobble
4. **`#rough-border`** - Specialized filter for wobbly borders
5. **`#pencil-sketch`** - Pencil texture effect

## 🔄 Phase 2 Transition

**These components are ONLY for Phase 1 wireframing!**

In Phase 2, all sketch components will be replaced with `@neynar/ui` components:

- `SketchButton` → `Button`
- `SketchCard` → `Card`
- `SketchHeading` → `Typography` or `h1-h6` tags
- `SketchInput` → `Input`
- `.sketch-text` → Remove class, use regular text
- `<SketchFilters />` → Remove completely
- `.sketch-paper` wrapper → Remove completely

The app should look visually identical after Phase 2, just with proper components instead of sketchy ones.
