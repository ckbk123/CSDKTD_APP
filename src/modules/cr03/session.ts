import { BASELINE, coordinates, equivalence, identity, samples, transferOf, validateModel, type Matrix, type Sample, type StateModel } from './math';

export interface Experiment { model: StateModel; T: Matrix; initial: readonly number[]; command: number; horizon: number; count: number }
export interface Checked { experiment: Experiment; transformed: ReturnType<typeof coordinates>; original: readonly Sample[]; changed: readonly Sample[]; outputError: number }
export function baseline(): Experiment { return { model: BASELINE, T: identity(2), initial: [0, 0], command: 1, horizon: 5, count: 201 }; }
export function family(n: number, i: number, j: number, s: number, h: number): number[][] {
  if (!Number.isInteger(n) || n < 0 || n > 4 || !Number.isFinite(s) || s < .5 || s > 2 || !Number.isFinite(h) || h < -2 || h > 2) throw new Error('Use scale 0.5–2 and shear −2–2, for zero to four states.');
  const T = identity(n); if (!n) return T;
  if (!Number.isInteger(i) || i < 0 || i >= n || (n > 1 && (!Number.isInteger(j) || j < 0 || j >= n || i === j))) throw new Error('Select two distinct state coordinates.');
  T[i][i] = s; if (n > 1) { T[i][j] = h; T[j][j] = 1 / s; } return T;
}
/** Caller-owned, one-entry caches. A coordinate edit still independently evaluates the changed model. */
export function createSession() {
  let originalKey = '', original: readonly Sample[] = [];
  let checkedKey = '', cached: Checked | undefined;
  return { evaluate(input: Experiment): Checked {
    // Clone accepted data; neither editable drafts nor callers may mutate an accepted preview.
    const experiment: Experiment = JSON.parse(JSON.stringify(input)) as Experiment;
    validateModel(experiment.model);
    const key = JSON.stringify(experiment); if (key === checkedKey && cached) return cached;
    const transformed = coordinates(experiment.model, experiment.T, experiment.initial);
    if (!equivalence(transferOf(experiment.model), transferOf(transformed.model)).matches) throw new Error('The transformed transfer exceeds equivalence tolerance. Use better-scaled coordinates.');
    const baseKey = JSON.stringify([experiment.model, experiment.initial, experiment.command, experiment.horizon, experiment.count]);
    const nextOriginal = baseKey === originalKey ? original : samples(experiment.model, experiment.initial, experiment.command, experiment.horizon, experiment.count);
    const changed = samples(transformed.model, transformed.initial, experiment.command, experiment.horizon, experiment.count);
    const outputError = Math.max(...nextOriginal.map((point, i) => Math.abs(point.output - changed[i].output)));
    const scale = Math.max(0, ...nextOriginal.map(point => Math.abs(point.output)), ...changed.map(point => Math.abs(point.output)));
    if (outputError !== 0 && (scale === 0 || outputError / scale > 1e-7)) throw new Error('The numerical coordinate comparison exceeds tolerance. Shorten the horizon or improve T.');
    const next = { experiment, transformed, original: nextOriginal, changed, outputError };
    originalKey = baseKey; original = nextOriginal; checkedKey = key; cached = next; return next;
  } };
}
export function inspect(checked: Checked, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= checked.original.length) throw new Error('Choose an integer computed-sample index in the shown range.');
  return { original: checked.original[index], changed: checked.changed[index] };
}
