import { ONE, ZERO, addTF, divTF, mulTF, negTF, q, subTF, tf, zeroTF, type TF } from './algebra';

export type Port = Readonly<{ id: string; source: string | null; sign: 1 | -1 }>;
export type Node = Readonly<{ id: string; label: string; kind: 'source' | 'block' | 'sum' | 'junction' | 'output'; inputs: readonly Port[]; gain: TF; x: number; y: number }>;
export type Diagram = Readonly<{ nodes: readonly Node[]; nextSerial: number }>;
export type Channels = readonly [TF, TF];
export type Solution = Readonly<{ signals: Readonly<Record<string, Channels>>; reference: TF; disturbance: TF }>;

export function validateDiagram(graph: Diagram, complete = true): void {
  if (graph.nodes.filter(n => n.kind !== 'source').length > 12 || graph.nodes.length > 14) throw new Error('Use at most twelve non-source nodes and two sources.');
  if (graph.nodes.reduce((sum, n) => sum + n.inputs.length, 0) > 24) throw new Error('Use at most twenty-four input ports.');
  const ids = new Set(graph.nodes.map(n => n.id));
  if (ids.size !== graph.nodes.length || graph.nodes.some(n => !/^[a-z][a-z0-9]{0,15}$/i.test(n.id) || !/^[a-z][a-z0-9]{0,11}$/i.test(n.label))) throw new Error('Diagram node names must be unique short letters and digits.');
  const sources = graph.nodes.filter(n => n.kind === 'source'), outputs = graph.nodes.filter(n => n.kind === 'output');
  if (sources.length !== 2 || !sources.some(n => n.id === 'r') || !sources.some(n => n.id === 'd') || outputs.length !== 1 || outputs[0].id !== 'y') throw new Error('Keep the reference r, disturbance d and one retained output Y.');
  const ports = new Set<string>();
  for (const n of graph.nodes) {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || n.x < 40 || n.x > 1460 || n.y < 40 || n.y > 860) throw new Error('Keep node positions within x=40..1460 and y=40..860.');
    if (n.kind === 'source' ? n.inputs.length !== 0 : n.kind === 'sum' ? n.inputs.length < 1 || n.inputs.length > 4 : n.inputs.length !== 1) throw new Error('Each block/junction/output needs one port; a summer needs one to four signed ports.');
    for (const port of n.inputs) {
      if (!port.id || ports.has(port.id)) throw new Error('Each input port must have a unique identity.'); ports.add(port.id);
      if (port.sign !== 1 && port.sign !== -1 || n.kind !== 'sum' && port.sign !== 1) throw new Error('Only summer ports carry a plus or minus sign.');
      if (port.source === null) { if (complete) throw new Error(`Connect every input port of ${n.label} before calculating.`); }
      else if (!ids.has(port.source)) throw new Error(`The input of ${n.label} refers to a missing node.`);
    }
  }
}

/** Solve the actual structured equations, with the unselected independent input zero. */
export function solveDiagram(graph: Diagram): Solution {
  validateDiagram(graph);
  const unknown = graph.nodes.filter(n => n.kind !== 'source'), order = new Map(unknown.map((n, i) => [n.id, i])), count = unknown.length;
  const a = unknown.map((node, row) => {
    const entries = Array<TF>(count + 2).fill(ZERO); entries[row] = ONE;
    for (const port of node.inputs) {
      const gain = node.kind === 'block' ? node.gain : port.sign < 0 ? negTF(ONE) : ONE;
      if (port.source === 'r' || port.source === 'd') {
        const column = count + (port.source === 'r' ? 0 : 1); entries[column] = addTF(entries[column], gain);
      } else {
        const column = order.get(port.source!)!; entries[column] = subTF(entries[column], gain);
      }
    }
    return entries;
  });
  // At most twelve pivots; every rational-function operation has independent degree/bit bounds.
  for (let k = 0; k < count; k++) {
    const pivot = a.findIndex((row, i) => i >= k && !zeroTF(row[k]));
    if (pivot < 0) throw new Error('The diagram does not uniquely determine every signal: its signal equations are singular. Check the feedback signs and gains.');
    [a[k], a[pivot]] = [a[pivot], a[k]];
    const scale = a[k][k];
    for (let j = k; j < count + 2; j++) a[k][j] = divTF(a[k][j], scale);
    for (let i = 0; i < count; i++) {
      if (i === k || zeroTF(a[i][k])) continue;
      const factor = a[i][k];
      for (let j = k; j < count + 2; j++) a[i][j] = subTF(a[i][j], mulTF(factor, a[k][j]));
    }
  }
  const signals: Record<string, Channels> = { r: [ONE, ZERO], d: [ZERO, ONE] };
  unknown.forEach((n, i) => { signals[n.id] = [a[i][count], a[i][count + 1]]; });
  return { signals, reference: signals.y[0], disturbance: signals.y[1] };
}

export function baseline(innerSensor = 2): Diagram {
  const input = (id: string, source: string, sign: 1 | -1 = 1): Port => ({ id, source, sign });
  return { nextSerial: 10, nodes: [
    { id: 'r', label: 'r', kind: 'source', inputs: [], gain: ONE, x: 70, y: 220 },
    { id: 'd', label: 'd', kind: 'source', inputs: [], gain: ONE, x: 540, y: 70 },
    { id: 'e1', label: 'E1', kind: 'sum', inputs: [input('p1', 'r'), input('p2', 'h1', -1)], gain: ONE, x: 240, y: 220 },
    { id: 'g1', label: 'G1', kind: 'block', inputs: [input('p3', 'e1')], gain: tf([q(1)], [q(1), q(1)]), x: 420, y: 220 },
    { id: 'e2', label: 'E2', kind: 'sum', inputs: [input('p4', 'g1'), input('p5', 'd'), input('p6', 'h2', -1)], gain: ONE, x: 650, y: 220 },
    { id: 'g2', label: 'G2', kind: 'block', inputs: [input('p7', 'e2')], gain: tf([q(1)], [q(2), q(1)]), x: 850, y: 220 },
    { id: 'j', label: 'J', kind: 'junction', inputs: [input('p8', 'g2')], gain: ONE, x: 1060, y: 220 },
    { id: 'h2', label: 'H2', kind: 'block', inputs: [input('p9', 'j')], gain: tf([q(innerSensor)]), x: 850, y: 450 },
    { id: 'h1', label: 'H1', kind: 'block', inputs: [input('p10', 'j')], gain: ONE, x: 540, y: 650 },
    { id: 'y', label: 'Y', kind: 'output', inputs: [input('p11', 'j')], gain: ONE, x: 1290, y: 220 },
  ] };
}

export const consumers = (graph: Diagram, id: string): readonly { node: Node; port: Port }[] => graph.nodes.flatMap(node => node.inputs.filter(port => port.source === id).map(port => ({ node, port })));
export function signalOrigin(graph: Diagram, id: string): string {
  const seen = new Set<string>(); let current = id;
  while (!seen.has(current)) {
    seen.add(current); const n = graph.nodes.find(node => node.id === current);
    if (n?.kind !== 'junction' || !n.inputs[0].source) return current;
    current = n.inputs[0].source;
  }
  throw new Error('A cycle of empty junctions does not determine a signal.');
}
