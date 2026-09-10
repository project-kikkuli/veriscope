import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { CircuitGraph } from '@veriscope/graph';
import { useSignal } from '../useSignal';
import { useDerived } from '../useDerived';
import { useEdgeEffect } from '../useEdgeEffect';
import { useTrackedEffect } from '../useTrackedEffect';

const tick = () => new Promise<void>(resolve => queueMicrotask(resolve));

describe('Solid without instrumentation', () => {
  it.each(['before creation', 'after creation', 'after clearing'] as const)(
    'preserves signal, derived, and effect behavior when disabled %s',
    async timing => {
      const graph = new CircuitGraph();
      if (timing === 'before creation') graph.disableInstrumentation();

      await createRoot(async dispose => {
        try {
          const count = useSignal(0, 'count', { graph });
          const positive = useDerived(() => count.val > 0, [count], 'positive', { graph });
          const onPositive = vi.fn();
          const values: number[] = [];
          useEdgeEffect(positive, 'posedge', onPositive, 'on-positive', { graph });
          useTrackedEffect(() => { values.push(count.val); }, [count], 'observe', { graph });
          await tick();

          if (timing !== 'before creation') {
            graph.disableInstrumentation({ clear: timing === 'after clearing' });
          }
          const events = vi.fn();
          const unsubscribe = graph.subscribe(events);
          try {
            count.set(1);
            await tick();
            expect(count.val).toBe(1);
            expect(positive.val).toBe(true);
            expect(onPositive).toHaveBeenCalledTimes(1);

            count.set(previous => previous + 1);
            await tick();
            expect(count.val).toBe(2);
            expect(onPositive).toHaveBeenCalledTimes(1);

            count.set(0);
            await tick();
            expect(positive.val).toBe(false);
            expect(values).toEqual([0, 1, 2, 0]);
            expect(events).not.toHaveBeenCalled();
          } finally {
            unsubscribe();
          }
        } finally {
          dispose();
        }
      });
    },
  );
});
