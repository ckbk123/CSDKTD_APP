import { ONE, addTF, divTF, equalTF, mulTF, negTF, subTF, zeroTF, type TF } from './algebra';
import { consumers, signalOrigin, solveDiagram, validateDiagram, type Diagram, type Node, type Solution } from './model';

export type Operation = Readonly<{
  id: string; title: string; kind: 'series' | 'parallel' | 'feedback' | 'merge-sums' | 'sum-up' | 'sum-down' | 'pickoff-up' | 'pickoff-down';
  before: Diagram; expected: TF; focus: readonly string[]; identity: string;
  construct: (proposed: TF) => Diagram;
}>;
export type Preview = Readonly<{
  before: Solution; after: Solution; diagram: Diagram; correct: boolean;
  referenceEqual: boolean; disturbanceEqual: boolean; changedSignals: readonly string[]; removedSignals: readonly string[];
}>;
const signed = (value: TF, sign: 1 | -1) => sign === 1 ? value : negTF(value);
const productSign = (a: 1 | -1, b: 1 | -1): 1 | -1 => a === b ? 1 : -1;
const bounded = (x: number, max: number) => Math.min(max, Math.max(40, x));

function rebuild(base: Diagram, updates: readonly Node[], removed: readonly string[], remaps: ReadonlyMap<string, string> = new Map(), extra: readonly Node[] = [], nextSerial = base.nextSerial): Diagram {
  const changes = new Map(updates.map(n => [n.id, n]));
  return { nextSerial, nodes: [...base.nodes.filter(n => !removed.includes(n.id)).map(n => changes.get(n.id) ?? n), ...extra].map(n => ({ ...n, inputs: n.inputs.map(p => remaps.has(p.id) ? { ...p, source: remaps.get(p.id)! } : p) })) };
}
function compensation(base: Diagram, gain: TF, source: string, x: number, y: number, ordinal = 0): Node {
  const serial = base.nextSerial + ordinal;
  if (!Number.isSafeInteger(serial) || serial < 1 || serial > 100000) throw new Error('This visit has exceeded the bounded node identity range. Reset the example.');
  return { id: `c${serial}`, label: `C${serial}`, kind: 'block', gain, inputs: [{ id: `pc${serial}`, source, sign: 1 }], x: bounded(x, 1460), y: bounded(y, 860) };
}

/** Enumerate only the supported self-contained local motifs. Ports, not screen geometry, decide. */
export function operations(graph: Diagram): readonly Operation[] {
  validateDiagram(graph, false);
  const out: Operation[] = [], blocks = graph.nodes.filter(n => n.kind === 'block'), sums = graph.nodes.filter(n => n.kind === 'sum');
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const append = (make: () => Operation) => { try { out.push(make()); } catch { /* A zero inverse or resource-bound local expression is not a legal reduction. */ } };
  for (const b of blocks) {
    const a = byId.get(b.inputs[0].source ?? '');
    if (a?.kind === 'block' && a.id !== b.id && consumers(graph, a.id).length === 1 && a.inputs[0].source) {
      append(() => ({ id: `series:${a.id}:${b.id}`, title: `Series: ${a.label} then ${b.label}`, kind: 'series', before: graph,
        expected: mulTF(b.gain, a.gain), focus: [a.id, b.id], identity: String.raw`v=B(Au)=(BA)u`,
        construct: proposed => rebuild(graph, [{ ...b, gain: proposed, inputs: [{ ...b.inputs[0], source: a.inputs[0].source }] }], [a.id]),
      }));
    }
  }
  for (const sum of sums) {
    for (let i = 0; i < sum.inputs.length; i++) for (let j = i + 1; j < sum.inputs.length; j++) {
      const pa = sum.inputs[i], pb = sum.inputs[j], a = byId.get(pa.source ?? ''), b = byId.get(pb.source ?? '');
      if (a?.kind !== 'block' || b?.kind !== 'block' || a.id === b.id || !a.inputs[0].source || a.inputs[0].source !== b.inputs[0].source || consumers(graph, a.id).length !== 1 || consumers(graph, b.id).length !== 1) continue;
      append(() => ({ id: `parallel:${sum.id}:${a.id}:${b.id}`, title: `Parallel into ${sum.label}: ${pa.sign < 0 ? '−' : '+'}${a.label}, ${pb.sign < 0 ? '−' : '+'}${b.label}`, kind: 'parallel', before: graph,
        expected: addTF(signed(a.gain, pa.sign), signed(b.gain, pb.sign)), focus: [a.id, b.id, sum.id], identity: String.raw`v=\sigma_1 Au+\sigma_2 Bu=(\sigma_1 A+\sigma_2 B)u`,
        construct: proposed => rebuild(graph, [{ ...a, gain: proposed }, { ...sum, inputs: sum.inputs.filter(p => p.id !== pb.id).map(p => p.id === pa.id ? { ...p, sign: 1 } : p) }], [b.id]),
      }));
    }
    for (const main of sum.inputs) {
      const parent = byId.get(main.source ?? '');
      if (parent?.kind === 'sum' && parent.id !== sum.id && consumers(graph, parent.id).length === 1 && parent.inputs.every(p => p.source) && sum.inputs.length + parent.inputs.length - 1 <= 4) {
        append(() => ({ id: `merge-sums:${parent.id}:${sum.id}:${main.id}`, title: `Flatten adjacent summers ${parent.label} and ${sum.label}`, kind: 'merge-sums', before: graph,
          expected: ONE, focus: [parent.id, sum.id], identity: String.raw`v=\sigma(a+b)+c=\sigma a+\sigma b+c`,
          construct: () => rebuild(graph, [{ ...sum, inputs: sum.inputs.flatMap(p => p.id === main.id ? parent.inputs.map(side => ({ ...side, sign: productSign(main.sign, side.sign) })) : [p]) }], [parent.id]),
        }));
      }
      // Summer after a block: G u + d = G(u + d/G). The old block output has no other branch.
      if (parent?.kind === 'block' && consumers(graph, parent.id).length === 1 && parent.inputs[0].source && parent.inputs[0].source !== sum.id && sum.inputs.length >= 2 && sum.inputs.every(p => p.source && p.source !== sum.id) && !zeroTF(parent.gain)) {
        append(() => ({ id: `sum-up:${sum.id}:${parent.id}:${main.id}`, title: `Move ${sum.label} upstream of ${parent.label}`, kind: 'sum-up', before: graph,
          expected: divTF(ONE, parent.gain), focus: [parent.id, sum.id], identity: String.raw`v=\sigma Gu+\sum_i\sigma_i d_i=G\left(\sigma u+\sum_i\sigma_i\frac{d_i}{G}\right)`,
          construct: proposed => {
            const sides = sum.inputs.filter(p => p.id !== main.id), comp = sides.map((p, i) => compensation(graph, proposed, p.source!, sum.x + i * 150, sum.y + 180, i));
            const moved = { ...sum, x: parent.x, y: parent.y, inputs: sum.inputs.map(p => p.id === main.id ? { ...p, source: parent.inputs[0].source } : { ...p, source: comp[sides.findIndex(s => s.id === p.id)].id }) };
            const block = { ...parent, x: sum.x, y: sum.y, inputs: [{ ...parent.inputs[0], source: sum.id }] };
            const remaps = new Map(consumers(graph, sum.id).map(c => [c.port.id, parent.id]));
            return rebuild(graph, [moved, block], [], remaps, comp, graph.nextSerial + comp.length);
          },
        }));
      }
    }
    for (const g of blocks.filter(b => b.inputs[0].source === sum.id)) {
      // A local loop can return through explicit copying junctions, but not through another dynamic block.
      for (const feedback of sum.inputs) {
        const h = byId.get(feedback.source ?? '');
        if (h?.kind !== 'block' || h.id === g.id || !h.inputs[0].source || consumers(graph, h.id).length !== 1 || consumers(graph, sum.id).length !== 1 || sum.inputs.length < 2) continue;
        let origin: string; try { origin = signalOrigin(graph, h.inputs[0].source); } catch { continue; }
        if (origin !== g.id) continue;
        append(() => ({ id: `feedback:${sum.id}:${g.id}:${h.id}`, title: `${feedback.sign < 0 ? 'Negative' : 'Positive'} feedback: ${g.label}, ${h.label}`, kind: 'feedback', before: graph,
          expected: divTF(g.gain, subTF(ONE, signed(mulTF(g.gain, h.gain), feedback.sign))), focus: [sum.id, g.id, h.id], identity: String.raw`v=G(u+\sigma Hv)\quad\Longrightarrow\quad v=\frac{G}{1-\sigma GH}u`,
          construct: proposed => rebuild(graph, [{ ...g, gain: proposed }, { ...sum, inputs: sum.inputs.filter(p => p.id !== feedback.id) }], [h.id]),
        }));
      }
      if (consumers(graph, sum.id).length !== 1 || sum.inputs.length < 2 || sum.inputs.some(p => !p.source || p.source === sum.id || p.source === g.id)) continue;
      for (const main of sum.inputs) {
        append(() => ({ id: `sum-down:${sum.id}:${g.id}:${main.id}`, title: `Move ${sum.label} downstream of ${g.label}; main input ${byId.get(main.source!)!.label}`, kind: 'sum-down', before: graph,
          expected: g.gain, focus: [sum.id, g.id], identity: String.raw`v=G\left(\sigma u+\sum_i\sigma_i d_i\right)=\sigma Gu+\sum_i\sigma_i Gd_i`,
          construct: proposed => {
            const sides = sum.inputs.filter(p => p.id !== main.id), comp = sides.map((p, i) => compensation(graph, proposed, p.source!, sum.x + i * 150, sum.y + 180, i));
            const moved = { ...sum, x: g.x, y: g.y, inputs: sum.inputs.map(p => p.id === main.id ? { ...p, source: g.id } : { ...p, source: comp[sides.findIndex(s => s.id === p.id)].id }) };
            const block = { ...g, x: sum.x, y: sum.y, inputs: [{ ...g.inputs[0], source: main.source }] };
            const remaps = new Map(consumers(graph, g.id).map(c => [c.port.id, sum.id]));
            return rebuild(graph, [moved, block], [], remaps, comp, graph.nextSerial + comp.length);
          },
        }));
      }
    }
  }
  for (const junction of graph.nodes.filter(n => n.kind === 'junction')) {
    const branches = consumers(graph, junction.id);
    for (const main of branches) {
      const g = main.node;
      if (g.kind !== 'block' || !junction.inputs[0].source || junction.inputs[0].source === g.id || junction.inputs[0].source === junction.id || branches.length < 2 || zeroTF(g.gain)) continue;
      append(() => ({ id: `pickoff-down:${junction.id}:${g.id}`, title: `Move junction ${junction.label} downstream of ${g.label}`, kind: 'pickoff-down', before: graph,
        expected: divTF(ONE, g.gain), focus: [junction.id, g.id], identity: String.raw`w=u\quad\Longrightarrow\quad w=\frac{1}{G}(Gu)`,
        construct: proposed => {
          const comp = compensation(graph, proposed, junction.id, junction.x, junction.y + 180), side = branches.filter(c => c.port.id !== main.port.id);
          const remaps = new Map([...side.map(c => [c.port.id, comp.id] as const), ...consumers(graph, g.id).map(c => [c.port.id, junction.id] as const)]);
          return rebuild(graph, [{ ...g, x: junction.x, y: junction.y, inputs: [{ ...g.inputs[0], source: junction.inputs[0].source }] }, { ...junction, x: g.x, y: g.y, inputs: [{ ...junction.inputs[0], source: g.id }] }], [], remaps, [comp], graph.nextSerial + 1);
        },
      }));
    }
    const g = byId.get(junction.inputs[0].source ?? '');
    if (g?.kind !== 'block' || !g.inputs[0].source || g.inputs[0].source === junction.id || consumers(graph, g.id).length !== 1 || branches.length < 2) continue;
    for (const main of branches) {
      append(() => ({ id: `pickoff-up:${junction.id}:${g.id}:${main.port.id}`, title: `Move junction ${junction.label} upstream of ${g.label}; main path to ${main.node.label}`, kind: 'pickoff-up', before: graph,
        expected: g.gain, focus: [junction.id, g.id], identity: String.raw`w=Gu\quad\Longrightarrow\quad w=G(u)`,
        construct: proposed => {
          const comp = compensation(graph, proposed, junction.id, junction.x, junction.y + 180);
          const remaps = new Map(branches.map(c => [c.port.id, c.port.id === main.port.id ? g.id : comp.id]));
          return rebuild(graph, [{ ...g, x: junction.x, y: junction.y, inputs: [{ ...g.inputs[0], source: junction.id }] }, { ...junction, x: g.x, y: g.y, inputs: [{ ...junction.inputs[0], source: g.inputs[0].source }] }], [], remaps, [comp], graph.nextSerial + 1);
        },
      }));
    }
  }
  return out;
}

export function previewOperation(operation: Operation, proposed = operation.expected): Preview {
  const graph = operation.construct(proposed); validateDiagram(graph);
  const before = solveDiagram(operation.before), after = solveDiagram(graph);
  const referenceEqual = equalTF(before.reference, after.reference), disturbanceEqual = equalTF(before.disturbance, after.disturbance);
  const changedSignals = Object.keys(before.signals).filter(id => after.signals[id] && before.signals[id].some((value, channel) => !equalTF(value, after.signals[id][channel])));
  return { before, after, diagram: graph, referenceEqual, disturbanceEqual,
    correct: equalTF(proposed, operation.expected) && referenceEqual && disturbanceEqual,
    changedSignals, removedSignals: Object.keys(before.signals).filter(id => !after.signals[id]),
  };
}
