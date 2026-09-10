import { expect, it } from 'vitest';
import { CircuitGraph } from '@veriscope/graph';
import { mutate, MutationBaselineError } from '../index';

it('does not credit mutations for failures already present in the original graph', async () => {
  let factories = 0;
  const factory = () => {
    factories++;
    const graph = new CircuitGraph();
    let input = false;
    const id = graph.registerNode({ name: 'input', type: 'signal' });
    graph.setNodeValue(id, () => input);
    graph.setNodeSetter(id, value => { input = value; });
    const assertion = graph.registerNode({ name: 'already-broken', type: 'assertion', deps: [id] });
    graph.setAssertionFn(assertion, () => false, 'always');
    return graph;
  };
  const error = await mutate(factory, { budget: 10, operators: ['negate'] }).catch(error => error);
  expect(error).toBeInstanceOf(MutationBaselineError);
  expect(error.message).toMatch(/baseline.*already-broken/i);
  expect(error.baseline.status).toBe('failed');
  expect(error.baseline.violations[0].assertionName).toBe('already-broken');
  expect(factories).toBe(1);
});
