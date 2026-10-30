import { Work, add, ca, cd, cm, cn, constant, div, evaluate, isZero, mul, negate, norm, same, sub, type Complex, type Gain } from './algebra';
export type Branch = { id: string; from: string; to: string; gain: Gain };
export type Net = { nodes: string[]; source: string; target: string; branches: Branch[] };
export type Trace = { nodes: string[]; edges: string[]; gain: Gain };
export type LoopSet = { loops: number[]; nodes: string[]; gain: Gain };
export type Analysis = { paths: Trace[]; loops: Trace[]; sets: LoopSet[]; delta: Gain; cofactors: Gain[]; eligibleSets: LoopSet[][]; transfer: Gain; signals: Map<string, Gain> };

export function validate(net: Net) {
  if (net.nodes.length < 2 || net.nodes.length > 7 || new Set(net.nodes).size !== net.nodes.length || net.nodes.some(n => !/^[A-Za-z][A-Za-z0-9]{0,7}$/.test(n))) throw new Error('Use 2–7 distinct signal names, each a letter followed by at most 7 letters/digits.');
  if (!net.nodes.includes(net.source) || !net.nodes.includes(net.target) || net.source === net.target) throw new Error('Choose different input and output signals from this graph.');
  if (!net.branches.length || net.branches.length > 16 || new Set(net.branches.map(e => e.id)).size !== net.branches.length) throw new Error('Use 1–16 branches with distinct IDs.');
  for (const b of net.branches) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,7}$/.test(b.id) || !net.nodes.includes(b.from) || !net.nodes.includes(b.to)) throw new Error('Every branch needs a valid ID and two existing signal endpoints.');
    if (b.to === net.source && !isZero(b.gain)) throw new Error('The externally imposed input signal must have no incoming nonzero branches. Choose another input or edit that branch.');
    if (b.gain.n.length > 3 || b.gain.d.length > 3 || b.gain.n.length > b.gain.d.length) throw new Error('Each branch must be a proper rational function of degree at most 2.');
  }
}
export function trace(net: Net, ids: string[], kind: 'path' | 'loop', w = new Work()): Trace {
  validate(net);
  if (!ids.length || ids.length > net.nodes.length || new Set(ids).size !== ids.length) throw new Error('Select a nonempty sequence of distinct branches.');
  const edges = ids.map(id => { const e = net.branches.find(b => b.id === id); if (!e || isZero(e.gain)) throw new Error(`Branch ${id} is absent or has zero gain.`); return e; });
  const nodes = [edges[0].from]; let gain = constant(1n);
  edges.forEach((edge, i) => { if (edge.from !== nodes.at(-1)) throw new Error(`Branch ${edge.id} does not start at ${nodes.at(-1)}. Keep the arrows connected.`); nodes.push(edge.to); gain = mul(gain, edge.gain, w);
    if (i < edges.length - 1 && nodes.slice(0, -1).includes(edge.to)) throw new Error(`Signal ${edge.to} is repeated before the trace ends.`);
  });
  if (kind === 'path') {
    if (nodes[0] !== net.source || nodes.at(-1) !== net.target || new Set(nodes).size !== nodes.length) throw new Error(`A forward path must go from ${net.source} to ${net.target} without repeating a signal.`);
  } else {
    if (nodes[0] !== nodes.at(-1) || new Set(nodes.slice(0, -1)).size !== nodes.length - 1) throw new Error('An elementary loop must close at its starting signal and repeat no other signal.');
    nodes.pop();
  }
  return { nodes, edges: ids, gain };
}
export function sharedNodes(a: Trace, b: Trace): string[] { return a.nodes.filter(n => b.nodes.includes(n)); }
function determinant(sets: LoopSet[], w: Work): Gain {
  return sets.reduce((sum, set) => add(sum, set.loops.length % 2 ? negate(set.gain) : set.gain, w), constant(1n));
}

/** Independent route: assemble x_i=sum(g_ji*x_j), clamp source=1,
 * and perform exact Gaussian elimination directly on the original branches. */
export function solveEquations(net: Net, w: Work): Map<string, Gain> {
  validate(net); const names = net.nodes.filter(n => n !== net.source), count = names.length;
  const a = names.map((_, i) => Array.from({ length: count + 1 }, (_, j) => constant(i === j ? 1n : 0n)));
  for (const e of net.branches) {
    if (isZero(e.gain)) continue;
    const row = names.indexOf(e.to);
    if (e.from === net.source) a[row][count] = add(a[row][count], e.gain, w);
    else { const col = names.indexOf(e.from); a[row][col] = sub(a[row][col], e.gain, w); }
  }
  for (let k = 0; k < count; k++) {
    const pivot = a.findIndex((row, i) => i >= k && !isZero(row[k]));
    if (pivot < 0) throw new Error('The original signal equations are singular: internal signals are not uniquely determined.');
    [a[k], a[pivot]] = [a[pivot], a[k]];
    const divisor = a[k][k]; for (let j = k; j <= count; j++) a[k][j] = div(a[k][j], divisor, w);
    for (let i = 0; i < count; i++) if (i !== k && !isZero(a[i][k])) {
      const factor = a[i][k]; for (let j = k; j <= count; j++) a[i][j] = sub(a[i][j], mul(factor, a[k][j], w), w);
    }
  }
  return new Map([[net.source, constant(1n)], ...names.map((name, i): [string, Gain] => [name, a[i][count]])]);
}
export function analyze(net: Net, maxVisits = 10000): Analysis {
  validate(net); const w = new Work(), paths: Trace[] = [], loops: Trace[] = [], sets: LoopSet[] = [];
  let visits = 0;
  const tick = () => { if (++visits > maxVisits) throw new Error('Graph enumeration work limit reached. Reduce branches or feedback connections.'); };
  const edges = net.branches.filter(b => !isZero(b.gain));
  const outgoing = (n: string) => edges.filter(b => b.from === n);
  const pathDfs = (n: string, nodes: string[], ids: string[], gain: Gain) => {
    tick(); if (paths.length > 128) throw new Error('More than 128 forward paths. Reduce parallel routes.');
    if (n === net.target) { paths.push({ nodes, edges: ids, gain }); return; }
    for (const edge of outgoing(n)) if (!nodes.includes(edge.to)) pathDfs(edge.to, [...nodes, edge.to], [...ids, edge.id], mul(gain, edge.gain, w));
  };
  pathDfs(net.source, [net.source], [], constant(1n));
  for (let start = 0; start < net.nodes.length; start++) {
    const first = net.nodes[start];
    const dfs = (n: string, nodes: string[], ids: string[], gain: Gain) => {
      tick(); if (loops.length > 128) throw new Error('More than 128 elementary loops. Reduce feedback connections.');
      for (const e of outgoing(n)) {
        if (e.to === first) loops.push({ nodes, edges: [...ids, e.id], gain: mul(gain, e.gain, w) });
        else if (net.nodes.indexOf(e.to) > start && !nodes.includes(e.to)) dfs(e.to, [...nodes, e.to], [...ids, e.id], mul(gain, e.gain, w));
      }
    };
    dfs(first, [first], [], constant(1n));
  }
  if (paths.length > 128 || loops.length > 128) throw new Error('The 128-path/loop enumeration limit was exceeded.');
  const combine = (from: number, selected: number[], used: string[], gain: Gain) => {
    tick();
    for (let i = from; i < loops.length; i++) if (!loops[i].nodes.some(n => used.includes(n))) {
      const next = { loops: [...selected, i], nodes: [...used, ...loops[i].nodes], gain: mul(gain, loops[i].gain, w) };
      sets.push(next); if (sets.length > 256) throw new Error('More than 256 non-touching loop sets. Reduce the graph.');
      combine(i + 1, next.loops, next.nodes, next.gain);
    }
  };
  combine(0, [], [], constant(1n));
  sets.sort((a, b) => a.loops.length - b.loops.length || a.loops.join(',').localeCompare(b.loops.join(','), 'en'));
  const delta = determinant(sets, w);
  if (isZero(delta)) throw new Error('Δ is identically zero. The signal equations are singular; there is no unique general transfer.');
  const eligibleSets = paths.map(path => sets.filter(set => !set.nodes.some(n => path.nodes.includes(n))));
  const cofactors = eligibleSets.map(allowed => determinant(allowed, w));
  const sum = paths.reduce((v, path, i) => add(v, mul(path.gain, cofactors[i], w), w), constant(0n));
  const transfer = div(sum, delta, w), signals = solveEquations(net, w);
  if (!same(transfer, signals.get(net.target)!, w)) throw new Error('The two exact derivations disagree. Simplify the graph and report this case.');
  return { paths, loops, sets, delta, cofactors, eligibleSets, transfer, signals };
}

/** Numeric audit preserves poles of the simplified branch gains. It is separate from symbolic
 * transfer cancellation and uses a scaled pivot/forward-residual check. */
export function numericCheck(net: Net, result: Analysis, z: Complex) {
  if (![z.re, z.im].every(Number.isFinite) || norm(z) > 100) throw new Error('Use a finite evaluation point with |z| ≤ 100 (dimensionless).');
  const names = net.nodes.filter(n => n !== net.source), count = names.length;
  const a = names.map((_, i) => Array.from({ length: count + 1 }, (_, j) => ({ re: i === j ? 1 : 0, im: 0 })));
  for (const e of net.branches) {
    if (isZero(e.gain)) continue;
    const g = evaluate(e.gain, z), row = names.indexOf(e.to);
    const col = e.from === net.source ? count : names.indexOf(e.from);
    a[row][col] = ca(a[row][col], col === count ? g : cn(g));
  }
  const original = a.map(row => row.map(c => ({ ...c })));
  for (let k = 0; k < count; k++) {
    let pivot = k; for (let i = k + 1; i < count; i++) if (norm(a[i][k]) > norm(a[pivot][k])) pivot = i;
    const scale = Math.max(...a.map(row => row.slice(0, count).reduce((v, c) => v + norm(c), 0)), 1);
    if (norm(a[pivot][k]) < 1e-11 * scale) throw new Error('Original equations are singular or poorly conditioned at this point. Choose another z.');
    [a[k], a[pivot]] = [a[pivot], a[k]]; const p = a[k][k];
    for (let j = k; j <= count; j++) a[k][j] = cd(a[k][j], p);
    for (let i = 0; i < count; i++) if (i !== k) { const f = a[i][k]; for (let j = k; j <= count; j++) a[i][j] = ca(a[i][j], cn(cm(f, a[k][j]))); }
  }
  const x = a.map(row => row[count]);
  const residual = Math.max(...original.map(row => {
    const lhs = row.slice(0, count).reduce((v, c, j) => ca(v, cm(c, x[j])), { re: 0, im: 0 });
    const scale = norm(row[count]) + row.slice(0, count).reduce((v, c, j) => v + norm(c) * norm(x[j]), 0);
    return norm(ca(lhs, cn(row[count]))) / Math.max(1, scale);
  }));
  const direct = x[names.indexOf(net.target)], mason = evaluate(result.transfer, z), difference = norm(ca(direct, cn(mason))) / Math.max(1, norm(direct), norm(mason));
  if (!Number.isFinite(residual) || residual > 1e-9 || !Number.isFinite(difference) || difference > 1e-8) throw new Error('The numerical check lost accuracy at this point. Choose another z or simpler gains.');
  return { direct, mason, residual, difference };
}
