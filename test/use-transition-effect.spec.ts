import { renderHook, act } from "@testing-library/react";
import { unstable_shouldYield as shouldYield } from "scheduler";
import { useTransitionEffect } from "../src/use-transition-effect";

describe("useTransitionEffect", () => {
  const IS_PENDING = 0;
  const START_TRANSITION_EFFECT = 1;
  const STOP_TRANSITION_EFFECT = 2;

  it("returns [isPending, startTransitionEffect, stopTransitionEffect]", () => {
    const { result } = renderHook(() => useTransitionEffect());

    expect(result.current[IS_PENDING]).toBe(false);
    expect(result.current[START_TRANSITION_EFFECT]).toBeInstanceOf(Function);
    expect(result.current[STOP_TRANSITION_EFFECT]).toBeInstanceOf(Function);
  });

  it("keeps stable callbacks", () => {
    const { result, rerender } = renderHook(() => useTransitionEffect());

    // store initial callbacks
    const startTransitionEffectInitial =
      result.current[START_TRANSITION_EFFECT];
    const stopTransitionEffectInitial = result.current[STOP_TRANSITION_EFFECT];

    // rerender
    rerender();

    // callbacks should be stable
    expect(result.current[START_TRANSITION_EFFECT]).toBe(
      startTransitionEffectInitial
    );
    expect(result.current[STOP_TRANSITION_EFFECT]).toBe(
      stopTransitionEffectInitial
    );
  });

  it("changes isPending on manual transition start and stop", async () => {
    const { result } = renderHook(() => useTransitionEffect());

    // initially isPending is false
    expect(result.current[IS_PENDING]).toBe(false);

    // start infinite transition
    await act(() => {
      result.current[START_TRANSITION_EFFECT](function* () {
        while (true) {
          if (shouldYield()) {
            yield;
          }
        }
      });
    });

    // is pending should be true
    expect(result.current[IS_PENDING]).toBe(true);

    // wait for some time
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // is pending still should be true
    expect(result.current[IS_PENDING]).toBe(true);

    // stop transition
    await act(() => {
      result.current[STOP_TRANSITION_EFFECT]();
    });

    // is pending should be false again
    expect(result.current[IS_PENDING]).toBe(false);
  });

  it("changes isPending on transition end", async () => {
    const { result } = renderHook(() => useTransitionEffect());

    // initially isPending is false
    expect(result.current[IS_PENDING]).toBe(false);

    // start finite transition
    await act(() => {
      result.current[START_TRANSITION_EFFECT](function* () {
        const deadline = performance.now() + 100;
        while (performance.now() < deadline) {
          // do nothing
          yield;
        }
      });
    });

    // is pending should be true
    expect(result.current[IS_PENDING]).toBe(true);

    // wait for some time
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    // is pending should be false
    expect(result.current[IS_PENDING]).toBe(false);
  });

  it("runs cleanup from yield on stop", async () => {
    const { result } = renderHook(() => useTransitionEffect());

    const cleanup = jest.fn();

    // start infinite transition
    await act(() => {
      result.current[START_TRANSITION_EFFECT](function* () {
        while (true) {
          if (shouldYield()) {
            yield cleanup;
          }
        }
      });
    });

    expect(cleanup).not.toHaveBeenCalled();

    await act(() => {
      result.current[STOP_TRANSITION_EFFECT]();
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("runs cleanup from yield on unmount", async () => {
    const { result, unmount } = renderHook(() => useTransitionEffect());

    const cleanup = jest.fn();

    // start infinite transition
    await act(() => {
      result.current[START_TRANSITION_EFFECT](function* () {
        while (true) {
          if (shouldYield()) {
            yield cleanup;
          }
        }
      });
    });

    expect(cleanup).not.toHaveBeenCalled();

    // unmount
    await act(() => {
      unmount();
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("runs cleanup from return on stop", async () => {
    const { result } = renderHook(() => useTransitionEffect());

    const cleanup = jest.fn();

    // start finite transition
    await act(() => {
      result.current[START_TRANSITION_EFFECT](function* () {
        yield;
        return cleanup;
      });
    });

    expect(cleanup).not.toHaveBeenCalled();

    // wait for some time
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(cleanup).not.toHaveBeenCalled();
    expect(result.current[IS_PENDING]).toEqual(false);

    await act(() => {
      result.current[STOP_TRANSITION_EFFECT]();
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("runs cleanup from return on unmount", async () => {
    const { result, unmount } = renderHook(() => useTransitionEffect());

    const cleanup = jest.fn();

    // start finite transition
    await act(() => {
      result.current[START_TRANSITION_EFFECT](function* () {
        for (let i = 0; i < 10; ++i) {
          yield;
        }

        return cleanup;
      });
    });

    expect(cleanup).not.toHaveBeenCalled();

    // wait for some time
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(cleanup).not.toHaveBeenCalled();
    expect(result.current[IS_PENDING]).toEqual(false);

    // unmount
    await act(() => {
      unmount();
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
