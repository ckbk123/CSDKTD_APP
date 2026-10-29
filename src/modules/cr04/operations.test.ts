import { describe, expect, it } from 'vitest';
import { ONE, equalTF, q, tf } from './algebra';
import { baseline, solveDiagram, type Diagram, type Node } from './model';
import { operations, previewOperation } from './operations';

function choose(graph: Diagram, id: string) {
  const operation = operations(graph).find(op => op.id === id); if (!operation) throw new Error(`Missing local operation ${id}`); return operation;
}
function apply(graph: Diagram, id: string): Diagram {
  const result = previewOperation(choose(graph, id)); expect(result.correct).toBe(true); return result.diagram;
}
describe('CR04 local reductions and compensated movements', () => {
  it('completes nested reduction while retaining the proposed disturbance channel', () => {
    for (const h of [2, 3]) {
      let graph = baseline(h), op = choose(graph, 'feedback:e2:g2:h2');
      expect(equalTF(op.expected, tf([q(1)], [q(2 + h), q(1)]))).toBe(true);
      graph = apply(graph, op.id);
      graph = apply(graph, 'sum-up:e2:g1:p4');
      graph = apply(graph, 'merge-sums:e1:e2:p4');
      graph = apply(graph, 'series:g1:g2');
      op = choose(graph, 'feedback:e2:g2:h1');
      expect(equalTF(op.expected, tf([q(1)], [q(3 + h), q(3 + h), q(1)]))).toBe(true);
      graph = apply(graph, op.id);
      const result = solveDiagram(graph);
      expect(equalTF(result.reference, tf([q(1)], [q(3 + h), q(3 + h), q(1)]))).toBe(true);
      expect(equalTF(result.disturbance, tf([q(1), q(1)], [q(3 + h), q(3 + h), q(1)]))).toBe(true);
    }
  });
  it('rejects wrong summer compensation even when the reference channel agrees', () => {
    const graph = apply(baseline(), 'feedback:e2:g2:h2'), op = choose(graph, 'sum-up:e2:g1:p4');
    expect(equalTF(op.expected, tf([q(1), q(1)]))).toBe(true);
    const wrong = previewOperation(op, ONE);
    expect(wrong.referenceEqual).toBe(true); expect(wrong.disturbanceEqual).toBe(false); expect(wrong.correct).toBe(false);
    expect(wrong.changedSignals).toContain('y');
    const correct = previewOperation(op);
    expect(correct.changedSignals).toContain('e2'); expect(correct.changedSignals).not.toContain('y');
  });
  it('moves summers downstream with matching side-path gain', () => {
    const graph = apply(baseline(), 'feedback:e2:g2:h2'), op = choose(graph, 'sum-down:e2:g2:p4');
    expect(equalTF(op.expected, tf([q(1)], [q(4), q(1)]))).toBe(true);
    expect(previewOperation(op).correct).toBe(true);
    expect(previewOperation(op, ONE).disturbanceEqual).toBe(false);
  });
  it('moves explicit pickoffs in both directions, preserving side paths', () => {
    const graph = baseline();
    const down = choose(graph, 'pickoff-down:j:h2');
    expect(equalTF(down.expected, tf([q(1, 2)]))).toBe(true);
    expect(previewOperation(down).correct).toBe(true); expect(previewOperation(down, ONE).correct).toBe(false);
    const up = choose(graph, 'pickoff-up:j:g2:p11');
    expect(equalTF(up.expected, tf([q(1)], [q(2), q(1)]))).toBe(true);
    expect(previewOperation(up).correct).toBe(true); expect(previewOperation(up, ONE).correct).toBe(false);
    expect(operations(baseline(0)).some(op => op.id === 'pickoff-down:j:h2')).toBe(false);
  });
  it('combines signed parallel blocks and never deletes a retained branch', () => {
    const source = baseline(), r = source.nodes.find(n => n.id === 'r')!, d = source.nodes.find(n => n.id === 'd')!, y = source.nodes.find(n => n.id === 'y')!;
    const block = (id: string, gain: number): Node => ({ id, label: id.toUpperCase(), kind: 'block', gain: tf([q(1)], [q(gain), q(1)]), inputs: [{ id: `input${id}`, source: 'r', sign: 1 }], x: 400, y: gain * 100 });
    const graph: Diagram = { nextSerial: 10, nodes: [r, d, block('a', 1), block('b', 2),
      { id: 'sum', label: 'S', kind: 'sum', inputs: [{ id: 'pa', source: 'a', sign: 1 }, { id: 'pb', source: 'b', sign: -1 }], gain: ONE, x: 700, y: 300 },
      { ...y, inputs: [{ id: 'py', source: 'sum', sign: 1 }] },
    ] };
    const op = choose(graph, 'parallel:sum:a:b');
    expect(equalTF(op.expected, tf([q(1)], [q(2), q(3), q(1)]))).toBe(true);
    expect(previewOperation(op).correct).toBe(true);
    const retained = { ...graph, nodes: graph.nodes.map(n => n.id === 'y' ? { ...n, inputs: [{ id: 'py', source: 'a', sign: 1 as const }] } : n) };
    expect(operations(retained).some(operation => operation.kind === 'parallel')).toBe(false);
  });
});
