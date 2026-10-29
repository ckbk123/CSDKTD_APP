import { absC, distance, type Complex } from './complex';
import { characteristic, type Model } from './model';
import { decimal, rational } from './rational';
import { expandRoots, roots } from './roots';

export interface Match { readonly points: readonly Complex[]; readonly cost: number; readonly ambiguous: boolean }
function permutations(items: readonly number[]): number[][] { return items.length < 2 ? [[...items]] : items.flatMap((item, i) => permutations(items.filter((_, j) => i !== j)).map(rest => [item, ...rest])); }
/** Exhaustive minimum-distance assignment (at most 3! possibilities), never independent real-part sorting. */
export function matchRoots(previous: readonly Complex[], next: readonly Complex[]): Match {
  if (previous.length !== next.length || previous.length > 3 || !previous.length) throw new Error('Root matching needs the same one to three roots on both sides.');
  const choices = permutations(next.map((_, i) => i)).map(order => ({ order, cost: order.reduce((sum, j, i) => sum + distance(previous[i], next[j]) ** 2, 0) })).sort((a, b) => a.cost - b.cost);
  const best = choices[0], second = choices[1];
  // Permuting identical roots at a known collision has no geometrical effect.
  const equivalent = second && best.order.every((index, i) => index === second.order[i] || distance(next[index], next[second.order[i]]) < 1e-12 || previous.some((p, j) => j !== i && second.order[j] === index && distance(p, previous[i]) < 1e-12));
  const ambiguous = !!second && !equivalent && second.cost - best.cost < 1e-10 * Math.max(1, best.cost);
  return { points: best.order.map(i => next[i]), cost: best.cost, ambiguous };
}
export interface Frame { readonly gain: number; readonly points: readonly Complex[]; readonly connect: boolean; readonly issue?: string }
export interface Trace { readonly frames: readonly Frame[]; readonly evaluations: number; readonly gaps: number; readonly maxGain: number; readonly capped: boolean }
/** Finite sampled trace with adaptive midpoint refinement; unresolved collisions produce explicit gaps. */
export function trace(model: Model, maxGain: number, intervals = 64, budget = 2049): Trace {
  if (!Number.isFinite(maxGain) || maxGain <= 0 || maxGain > 1000) throw new Error('Trace gain maximum must be greater than zero and at most 1000.');
  if (!Number.isInteger(intervals) || intervals < 16 || intervals > 256) throw new Error('Use 16–256 initial gain intervals.');
  if (!Number.isInteger(budget) || budget < 17 || budget > 4097) throw new Error('Use a root-evaluation budget from 17 to 4097.');
  const cache = new Map<number, Frame>(); let evaluations = 0, capped = false;
  const sample = (gain: number): Frame => {
    const cached = cache.get(gain); if (cached) return cached;
    if (evaluations >= budget) { capped = true; return { gain, points: [], connect: false, issue: 'Root-evaluation budget reached; this interval is omitted.' }; }
    evaluations++;
    let frame: Frame;
    try { frame = { gain, points: expandRoots(roots(characteristic(model, gain === 0 ? rational(0n) : decimal(String(gain), true), true))), connect: false }; }
    catch (error) { frame = { gain, points: [], connect: false, issue: error instanceof Error ? error.message : 'Numerical roots were unresolved.' }; }
    cache.set(gain, frame); return frame;
  };
  const frames: Frame[] = [sample(0)];
  const advance = (left: Frame, rawRight: Frame, depth: number): void => {
    if (!left.points.length || !rawRight.points.length) { frames.push({ ...rawRight, connect: false, issue: rawRight.issue ?? left.issue ?? 'A previous interval was unresolved.' }); return; }
    const match = matchRoots(left.points, rawRight.points), right = { ...rawRight, points: match.points };
    const displacement = Math.max(...right.points.map((point, i) => distance(point, left.points[i]) / Math.max(1, absC(point), absC(left.points[i]))));
    const middle = sample((left.gain + right.gain) / 2);
    let curvature = Infinity;
    if (middle.points.length) {
      const matchedMiddle = matchRoots(left.points, middle.points);
      curvature = Math.max(...matchedMiddle.points.map((point, i) => Math.hypot(point.re - (left.points[i].re + right.points[i].re) / 2, point.im - (left.points[i].im + right.points[i].im) / 2) / Math.max(1, absC(point))));
    }
    const refine = match.ambiguous || displacement > .15 || curvature > .01;
    if (refine && depth < 12 && !capped) {
      advance(left, middle, depth + 1); advance(frames.at(-1)!, right, depth + 1); return;
    }
    const issue = match.ambiguous ? 'Branch identity is ambiguous near a root collision; no connection is drawn.' : refine ? 'The continuation resolution/budget bound was reached; no connection is drawn.' : undefined;
    frames.push({ ...right, connect: !issue, issue });
  };
  for (let i = 1; i <= intervals; i++) advance(frames.at(-1)!, sample(maxGain * i / intervals), 0);
  return { frames, evaluations, gaps: frames.filter((frame, i) => i > 0 && (!frame.connect || !frame.points.length)).length, maxGain, capped };
}
