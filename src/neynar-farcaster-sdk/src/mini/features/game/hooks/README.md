# Game Hooks

This directory contains hooks for managing game state and controls using Jotai for global state management.

## Architecture

All game state is stored in Jotai atoms in `use-game-state.ts`. The hooks provide clean interfaces to access and modify this global state without prop drilling.

**Naming Convention**:

- `useInitialize{Name}()` - Initialization hooks (call once at root)
- `use{Name}()` - Read hooks (get the value)
- `useSet{Name}()` - Write hooks (set the value)

This pattern is **crystal clear for LLMs and developers** - the hook name tells you exactly what it does.

## Core Hooks

### Initialization

**`useInitializeGameActionHandlers(config)`** - Initialize game controls (call ONCE at root)

- Sets up keyboard listeners and global handlers
- Should only be called once in your root game component
- Stores handlers globally via atoms

### State Hooks

All state atoms follow the `use{Name}` / `useSet{Name}` pattern:

**Active Game Actions** (which keys/buttons are pressed)

- `useActiveGameActions()` - Get active keys Set
- `useSetActiveGameActions()` - Set active keys

**Game Controls Enabled** (enable/disable all controls)

- `useGameControlsEnabled()` - Check if enabled
- `useSetGameControlsEnabled()` - Enable/disable

**Game Paused**

- `useGamePaused()` - Check if paused
- `useSetGamePaused()` - Set paused state

**Game Over**

- `useGameOver()` - Check if game over
- `useSetGameOver()` - Set game over state

**Game Loading**

- `useGameLoading()` - Check if loading
- `useSetGameLoading()` - Set loading state

**Game Action Handlers** (the button/key handlers)

- `useGameActionHandlers()` - Get handlers object
- `useSetGameActionHandlers()` - Set handlers (internal use only)

## Usage Pattern

```tsx
// Root game component - initialize ONCE
function MyGame() {
  const setControlsEnabled = useSetGameControlsEnabled();

  useInitializeGameActionHandlers({
    actions: {
      left: () => movePlayer("left"),
      right: () => movePlayer("right"),
      jump: () => playerJump(),
      pause: () => togglePause(),
    },
    debounceMs: 100,
  });

  // Disable controls during animations
  useEffect(() => {
    if (isAnimating) {
      setControlsEnabled(false);
    } else {
      setControlsEnabled(true);
    }
  }, [isAnimating, setControlsEnabled]);

  return <GameUI />;
}

// Child components - access state with use{Name} hooks
function GameControls() {
  const handlers = useGameActionHandlers();
  const activeKeys = useActiveGameActions();
  const isPaused = useGamePaused();
  const setIsPaused = useSetGamePaused();

  return (
    <div>
      <button
        onTouchStart={handlers.left}
        className={activeKeys.has("left") ? "active" : ""}
      >
        ←
      </button>
      <button onTouchStart={handlers.right}>→</button>
      <button onTouchStart={handlers.jump}>Jump</button>

      {isPaused && <div>PAUSED</div>}
      <button onClick={() => setIsPaused(!isPaused)}>
        {isPaused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}

// Another child component - same handlers!
function AnotherComponent() {
  const handlers = useGameActionHandlers();
  const isGameOver = useGameOver();
  const setIsGameOver = useSetGameOver();

  return (
    <button onClick={handlers.action}>
      {isGameOver ? "Restart" : "Action"}
    </button>
  );
}
```

## Benefits

✅ **Self-documenting** - Hook names make intent obvious
✅ **Easy for LLMs** - Clear, consistent naming pattern
✅ **No prop drilling** - Access game state from any component
✅ **No duplicate instances** - Handlers created once and shared
✅ **Type-safe** - Full TypeScript support
✅ **Keyboard + Touch** - Unified interface
✅ **Visual feedback** - Track active keys for button states
✅ **Global control** - Enable/disable controls from anywhere

## React Compiler

This codebase uses React Compiler, so:

- ✅ No `useCallback` or `useMemo` needed for optimization
- ✅ Functions defined as regular `function` declarations
- ✅ React Compiler automatically memoizes when beneficial

## Why Not Context?

We use Jotai atoms instead of React Context because:

- Simpler API (no Provider needed)
- Better performance (granular subscriptions)
- Easier to test and debug
- Built-in dev tools support
- Clear read/write separation
