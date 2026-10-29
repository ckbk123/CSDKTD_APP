import { describe, expect, it } from 'vitest';
import { ONE, equalTF, q, tf } from './algebra';
import { baseline, solveDiagram, validateDiagram, type Diagram } from './model';

describe('CR04 structured signal equations', () => {
  it('derives both declared nested-loop channels and changed inner feedback', () => {
    for (const h of [2, 3, -1, 0, 4]) {
      const result = solveDiagram(baseline(h));
      const denominator = [q(3 + h), q(3 + h), q(1)]; // (s+1)(s+2+h)+1
      expect(equalTF(result.reference, tf([q(1)], denominator))).toBe(true);
      expect(equalTF(result.disturbance, tf([q(1), q(1)], denominator))).toBe(true);
      expect(equalTF(result.signals.g1[0], tf([q(2 + h), q(1)], denominator))).toBe(true);
    }
  });
  it('treats wire crossings/positions as geometry only', () => {
    const source = baseline(), changed = { ...source, nodes: source.nodes.map(n => ({ ...n, x: 700, y: 450 })) };
    expect(solveDiagram(changed)).toEqual(solveDiagram(source));
  });
  it('keeps exact signed parallel and self-feedback equations', () => {
    const graph = baseline(), bare = graph.nodes.filter(n => ['r', 'd', 'y'].includes(n.id));
    const parallel: Diagram = { nextSerial: 2, nodes: [...bare.filter(n => n.id !== 'y'),
      { id: 's1', label: 'S1', kind: 'sum', inputs: [{ id: 'a', source: 'r', sign: 1 }, { id: 'b', source: 'd', sign: -1 }, { id: 'c', source: 's1', sign: -1 }], gain: ONE, x: 400, y: 300 },
      { ...bare.find(n => n.id === 'y')!, inputs: [{ id: 'out', source: 's1', sign: 1 }] },
    ] };
    expect(equalTF(solveDiagram(parallel).reference, tf([q(1, 2)]))).toBe(true);
    expect(equalTF(solveDiagram(parallel).disturbance, tf([q(-1, 2)]))).toBe(true);
    const singular = { ...parallel, nodes: parallel.nodes.map(n => n.id === 's1' ? { ...n, inputs: n.inputs.map(p => p.id === 'c' ? { ...p, sign: 1 as const } : p) } : n) };
    expect(() => solveDiagram(singular)).toThrow('singular');
  });
  it('reports incomplete/dangling ports and invalid diagram dimensions', () => {
    const graph = baseline(), incomplete = { ...graph, nodes: graph.nodes.map(n => n.id === 'g1' ? { ...n, inputs: [{ id: 'p3', source: null, sign: 1 as const }] } : n) };
    expect(() => solveDiagram(incomplete)).toThrow('Connect every');
    expect(() => validateDiagram(incomplete, false)).not.toThrow();
    expect(() => solveDiagram({ ...graph, nodes: graph.nodes.filter(n => n.id !== 'g1') })).toThrow('missing node');
    expect(() => solveDiagram({ ...graph, nodes: [...graph.nodes, graph.nodes[0]] })).toThrow('unique');
    expect(() => solveDiagram({ ...graph, nodes: graph.nodes.map(n => ({ ...n, x: NaN })) })).toThrow('positions');
  });
});
