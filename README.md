<div align="center">

<img width="100" height="100" src="media/react-logo.svg" alt="React logo">

<h1>use-transition-effect</h1>
<p>Run long effects without blocking the main thread</p>

[![npm version](https://img.shields.io/npm/v/use-transition-effect.svg)](https://www.npmjs.com/package/use-transition-effect)
[![build status](https://github.com/piotr-oles/use-transition-effect/workflows/CI/badge.svg?branch=main&event=push)](https://github.com/piotr-oles/use-transition-effect/actions?query=branch%3Amain+event%3Apush)

</div>

## Motivation

Let's say you want to render something complex on a canvas in a React application.
Canvas API is imperative, so to interact with it, you need to use the `useEffect()` hook.
Unfortunately, if rendering takes too long, you can block the main thread and make your
application unresponsive (especially on low-end devices).

The `useTransitionEffect()` hook provides a way to split long-running effects into smaller chunks
to unblock the main thread. It uses [scheduler](https://www.npmjs.com/package/scheduler) package (from React)
to schedule smaller units of work and coordinate it with React rendering.

I wrote an article about this on Medium: **[Non-blocking `<canvas />` Rendering in Concurrent React](https://levelup.gitconnected.com/non-blocking-canvas-rendering-with-concurrent-react-f46032b03efa)**

## Installation

This package requires [React 17+](https://www.npmjs.com/package/react) and [scheduler 0.20+](https://www.npmjs.com/package/scheduler)

```sh
# with npm
npm install use-transition-effect

# with yarn
yarn add use-transition-effect
```

## Usage

```typescript
const [isPending, startTransitionEffect, stopTransitionEffect] =
  useTransitionEffect();
```

The API is very similar to the `useTransition` hook from React.
It returns a stateful value for the pending state of the transition effect, a function to start it, and a function to stop it.

`startTransitionEffect` lets you schedule a long-running effect without blocking the main thread. It expects a generator
function as an argument, so you can yield to unblock the main thread:

```typescript
startTransitionEffect(function* () {
  for (let item of items) {
    doSomeComplexSideEffects(item);
    yield;
  }
});
```

Additionally, you can yield and return a cleanup function that will run on transition stop (including unmount):

```typescript
startTransitionEffect(function* () {
  const cleanup = () => cleanupSideEffects();

  for (let item of items) {
    doSomeComplexSideEffects(item);
    yield cleanup;
  }
  return cleanup;
});
```

`stopTransitionEffect` lets you stop the current long-running effect. You can use it as a `useEffect` cleanup:

```typescript
useEffect(() => {
  startTransitionEffect(function* () {
    // effect
  });

  return () => stopTransitionEffect();
}, []);
```

`isPending` indicates when a transition effect is active to show a pending state:

```tsx
function App() {
  const [isPending, startTransitionEffect, stopTransitionEffect] =
    useTransitionEffect();

  function handleStartClick() {
    startTransitionEffect(function* () {
      // do stuff, for example render something on a canvas
    });
  }
  function handleStopClick() {
    stopTransitionEffect();
  }

  return (
    <div>
      {isPending && <Spinner />}
      <button onClick={handleStartClick} disabled={isPending}>
        Start
      </button>
      <button onClick={handleStopClick} disabled={!isPending}>
        Stop
      </button>
    </div>
  );
}
```

The `scheduler` package exports the `unstable_shouldYield()` function that returns true if the current task takes too long.
You can use it to decide when to yield:

```typescript
import { unstable_shouldYield as shouldYield } from "scheduler";

startTransitionEffect(function* () {
  for (let item of items) {
    doSomeComplexSideEffects(item);
    if (shouldYield()) {
      yield;
    }
  }
});
```

If you want to update the state during a transition effect, you have to wrap this update with the `unstable_runWithPriority()` function
from the `scheduler` package (with a priority higher than `IdlePriority`). Otherwise, the state update inside the transition effect will run when the effect ends:

```typescript
import {
  unstable_runWithPriority as runWithPriority,
  unstable_NormalPriority as NormalPriority,
} from "scheduler";

startTransitionEffect(function* () {
  for (let item of items) {
    runWithPriority(NormalPriority, () => {
      setCount((prevCount) => prevCount + 1);
    });
    yield;
  }
});
```

## License

MIT
