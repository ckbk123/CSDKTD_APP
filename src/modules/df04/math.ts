/** Physical plant tau*y'=-y+g*u. Read output, update proportional control, then ZOH. */
export interface Plant { readonly gain: number; readonly tau: number }
export interface Task { readonly reference: number; readonly initial: number; readonly horizon: number }
export type Policy = 'fixed' | 'redesign';
export interface CaseSpec { readonly period: number; readonly policy: Policy; readonly fixedGain: number; readonly rate: number }
export interface Indices { readonly raw: number; readonly ise: number; readonly iae: number; readonly itae: number; readonly effort: number }
export interface Hold {
  readonly index: number; readonly time: number; readonly end: number; readonly weight: number;
  readonly output: number; readonly error: number; readonly control: number; readonly nextOutput: number;
  readonly contribution: Indices;
}
export interface Model {
  readonly a: number; readonly b: number; readonly gain: number; readonly pole: number;
  readonly targetPole: number | null; readonly targetResidual: number | null;
  readonly stability: 'inside' | 'boundary' | 'outside'; readonly equilibrium: number; readonly steadyOutput: number | null;
}
export interface Run {
  readonly plant: Plant; readonly task: Task; readonly spec: CaseSpec; readonly model: Model;
  readonly holds: readonly Hold[]; readonly indices: Indices; readonly terminal: number;
  readonly minimum: number; readonly maximum: number;
}
export const CIRCLE_TOLERANCE = 1e-9;
export const MAX_INTERVALS = 2000;
export const MAX_AMPLITUDE = 1e12;
const fail = (message: string): never => { throw new Error(message); };
function within(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) fail(`Use ${label} from ${minimum} to ${maximum}.`);
  return value;
}
export function validatePlant(plant: Plant): Plant {
  return { gain: within(plant.gain, 0.05, 20, 'plant DC gain g'), tau: within(plant.tau, 0.01, 10, 'time constant tau (s)') };
}
export function validateTask(task: Task): Task {
  return { reference: within(task.reference, 0.1, 10, 'reference R'), initial: within(task.initial, -10, 10, 'initial output y(0)'), horizon: within(task.horizon, 0.01, 60, 'common horizon H (s)') };
}
export function classifyPole(pole: number): Model['stability'] {
  if (!Number.isFinite(pole)) fail('The complete scalar pole must be finite.');
  return Math.abs(pole) < 1 - CIRCLE_TOLERANCE ? 'inside' : Math.abs(pole) > 1 + CIRCLE_TOLERANCE ? 'outside' : 'boundary';
}
export function modelAt(plant: Plant, task: Task, spec: CaseSpec): Model {
  const p = validatePlant(plant), t = validateTask(task);
  within(spec.period, 0.001, 10, 'sample period T (s)');
  if (spec.period / p.tau > 30) fail('Use T/tau at most 30 so the physical sampled pole remains numerically resolvable.');
  const a = Math.exp(-spec.period / p.tau), b = p.gain * -Math.expm1(-spec.period / p.tau);
  let gain: number, targetPole: number | null = null;
  if (spec.policy === 'fixed') gain = within(spec.fixedGain, 0, 100, 'fixed controller gain K');
  else if (spec.policy === 'redesign') {
    within(spec.rate, 0.01, 100, 'target physical decay rate lambda (1/s)');
    const excess = spec.rate - 1 / p.tau;
    if (excess < 0) fail('This nonnegative-gain redesign requires lambda at least 1/tau. A slower target would need a negative controller gain.');
    if (spec.rate * spec.period > 30) fail('Use lambda*T at most 30 for a resolvable target pole.');
    targetPole = Math.exp(-spec.rate * spec.period);
    // Difference of exponentials without subtracting nearly equal values.
    gain = within(a * -Math.expm1(-excess * spec.period) / b, 0, 100, 'redesigned controller gain K');
  } else return fail('Choose fixed gain or redesigned gain explicitly.');
  const pole = a - b * gain, targetResidual = targetPole === null ? null : Math.abs(pole - targetPole);
  if (targetPole !== null && targetResidual! > 1e-7 * targetPole) fail('This target pole cannot be resolved to the relative matching tolerance. Reduce T or the target rate.');
  const stability = classifyPole(pole), equilibrium = p.gain * gain * t.reference / (1 + p.gain * gain);
  return { a, b, gain, pole: pole || 0, targetPole, targetResidual, stability, equilibrium, steadyOutput: stability === 'inside' ? equilibrium : null };
}
function finiteAmplitude(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_AMPLITUDE) fail('This case exceeds the supported output/error/control magnitude of 10¹² before the common horizon. Reduce H or the gain; no partial metrics are reported.');
  return value || 0;
}
/** Exact first-order held-input flow, evaluated with expm1 for short intervals. */
export function heldFlow(plant: Plant, output: number, control: number, duration: number): number {
  const p = validatePlant(plant);
  if (!Number.isFinite(duration) || duration < 0 || duration > 60) fail('Use a finite hold duration from 0 to 60 seconds.');
  finiteAmplitude(output); finiteAmplitude(control);
  return finiteAmplitude(output + -Math.expm1(-duration / p.tau) * (p.gain * control - output));
}
/** All weighted intervals reach exactly the same terminal physical time H. */
export function simulate(plant: Plant, task: Task, spec: CaseSpec): Run {
  const p = validatePlant(plant), t = validateTask(task), model = modelAt(p, t, spec);
  const holds: Hold[] = [], sums = { raw: 0, ise: 0, iae: 0, itae: 0, effort: 0 }, corrections = { ...sums };
  let output = t.initial, minimum = output, maximum = output;
  for (let index = 0; index <= MAX_INTERVALS; index++) {
    const time = index * spec.period;
    if (time >= t.horizon) break;
    if (index === MAX_INTERVALS) fail('Use at most 2000 held intervals per case. Increase T or reduce the common horizon.');
    const end = Math.min((index + 1) * spec.period, t.horizon), weight = end - time;
    const error = finiteAmplitude(t.reference - output), control = finiteAmplitude(model.gain * error);
    const nextOutput = heldFlow(p, output, control, weight);
    const contribution: Indices = { raw: error * error, ise: weight * error * error, iae: weight * Math.abs(error), itae: weight * time * Math.abs(error), effort: weight * control * control };
    for (const key of Object.keys(sums) as (keyof Indices)[]) {
      const term = contribution[key] - corrections[key], next = sums[key] + term;
      corrections[key] = (next - sums[key]) - term; sums[key] = next;
      if (!Number.isFinite(next) || next > 1e28) fail('A common-horizon accumulation exceeds 10²⁸. Reduce H or the gain; no partial metrics are reported.');
    }
    holds.push({ index, time, end, weight, output, error, control, nextOutput, contribution });
    output = nextOutput; minimum = Math.min(minimum, output); maximum = Math.max(maximum, output);
  }
  return { plant: p, task: t, spec: { ...spec }, model, holds, indices: sums, terminal: output, minimum, maximum };
}
/** Reconstruct using the declared physical plant/ZOH; sample interpolation is not used. */
export function physicalOutputAt(run: Run, time: number): number {
  if (!Number.isFinite(time) || time < 0 || time > run.task.horizon) fail('Choose a physical time inside the common horizon.');
  if (time === run.task.horizon) return run.terminal;
  const index = Math.min(Math.floor(time / run.spec.period), run.holds.length - 1), hold = run.holds[index];
  return heldFlow(run.plant, hold.output, hold.control, Math.max(0, time - hold.time));
}
