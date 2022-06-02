import { useCallback, useEffect, useRef, useState } from 'react';
import {
  unstable_cancelCallback as cancelCallback,
  unstable_scheduleCallback as scheduleCallback,
  unstable_shouldYield as shouldYield,
  unstable_runWithPriority as runWithPriority,
  unstable_ImmediatePriority as ImmediatePriority,
  unstable_IdlePriority as IdlePriority,
  CallbackNode
} from 'scheduler';

/**
 * Cleanup function (like in the useEffect hook)
 */
export type CleanupFunction = () => void;

/**
 * Generator that can yield or return cleanup function
 */
export type TransitionEffectGenerator = Generator<
  CleanupFunction | void,
  CleanupFunction | void,
  // eslint-disable-next-line
  any
>;

/**
 * Function that returns effect generator (function*() {})
 *
 * @param shouldYield Function that returns true if the current task takes too long.
 */
export type TransitionEffectCallback = (
  shouldYield: () => boolean
) => TransitionEffectGenerator;

// use interface for IDE to pick-up js docs
export interface StartTransitionEffect {
  /**
   * State updates and effects inside the callback generator function are allowed to be deferred.
   * It will return control to the main-thread on each yield.
   * The generator can yield and return cleanup function that will run when transition stops
   * (on stopTransitionEffect() call or on hook unmount).
   *
   * @param callback Generator function to run.
   * @param [priorityLevel] Optional priority level from the scheduler package.
   */
  (callback: TransitionEffectCallback, priorityLevel?: number): void;
}

// use interface for IDE to pick-up js docs
export interface StopTransitionEffect {
  /**
   * Stops running transition effect. Does nothing if effect is not running.
   */
  (): void;
}

/**
 * Allows components to run long effects without blocking the main thread. It does this by splitting
 * long tasks into smaller chunks of work using generator function.
 *
 * The `useTransitionEffect` hook has similar API to the `useTransition` hook. It returns three values in an array.
 *
 * The first is a boolean, a way of informing us whether we’re waiting for the transition effect to finish.
 * The second is a function that takes a generator function. We can use it to run and split (with yield) long effect.
 * The third is a function that stop the running effect.
 */
export function useTransitionEffect(): [
  boolean,
  StartTransitionEffect,
  StopTransitionEffect
] {
  // store pending state
  const [isPending, setPending] = useState(false);
  // store task and cleanup ref (so we can access them in a separate stopGenerator function)
  const taskRef = useRef<CallbackNode>();
  const cleanupRef = useRef<CleanupFunction | void>();

  const stopTransitionEffect = useCallback<StopTransitionEffect>(() => {
    if (taskRef.current) {
      // cancel current task
      cancelCallback(taskRef.current);
      taskRef.current = undefined;
      setPending(false);
    }
    if (cleanupRef.current) {
      // run cleanup effect
      cleanupRef.current();
      cleanupRef.current = undefined;
    }
  }, []);

  const startTransitionEffect = useCallback<StartTransitionEffect>(
    (
      callback: TransitionEffectCallback,
      priorityLevel = IdlePriority
    ): void => {
      // stop ongoing transition effect (just in case)
      stopTransitionEffect();

      // call generator function to get generator
      const generator = callback(shouldYield);

      // define callback to schedule
      const iterate = () => {
        const result = generator.next();
        // store yielded/returned value as a cleanup function
        cleanupRef.current = result.value;

        if (result.done) {
          setPending(false);
        } else {
          // we're not done - return itself
          // scheduler package will automatically schedule it as a "continuation callback"
          return iterate;
        }
      };
      // start synchronously
      const nextCallback = iterate();

      // we have next callback - schedule it
      if (nextCallback) {
        // set pending to true with the highest priority (to run before nextCallback)
        runWithPriority(ImmediatePriority, () => setPending(true));
        // schedule next iterations using scheduler
        taskRef.current = scheduleCallback(priorityLevel, nextCallback);
      }
    },
    []
  );

  useEffect(() => {
    // stop transition effect on unmount
    return stopTransitionEffect;
  }, []);

  return [isPending, startTransitionEffect, stopTransitionEffect];
}
