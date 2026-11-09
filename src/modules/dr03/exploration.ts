import { run, validateModel, zohBaseline, type Experiment, type Result } from './math';
import type { Model } from './parser';
export interface Source { readonly model: Model; readonly experiment: Experiment; readonly sourceT: number | null }
export interface Checked extends Source { readonly result: Result }
export type Target = number | 'y';
export function baseline(): Source { return { model: zohBaseline(.1).model, sourceT: .1, experiment: { T: .1, count: 21, delay: 0, amplitude: 1, kind: 'step', pastY: [0, 0], pastU: [0, 0] } }; }
/** Every model/history/input edit uses the existing qualified computation.
 * Only inspection/replay cache its returned rows, never an unqualified new trajectory. */
export function compute(source: Source): Checked {
  const model = { a: [...source.model.a], b: [...source.model.b] }, experiment = { ...source.experiment, pastY: [...source.experiment.pastY], pastU: [...source.experiment.pastU] };
  return { model, experiment, sourceT: source.sourceT, result: run(model, experiment) };
}
/** An explicit new model retains matching declared history coordinates; new cells start at zero. */
export function withModel(source: Source, model: Model): Source {
  const n = validateModel(model), resize = (values: number[], length: number) => Array.from({ length }, (_, i) => values[i] ?? 0);
  return { model, sourceT: null, experiment: { ...source.experiment, pastY: resize(source.experiment.pastY, n), pastU: resize(source.experiment.pastU, n + source.experiment.delay) } };
}
export function inspect(checked: Checked, k: number, target: Target) {
  if (!Number.isInteger(k) || k < 0 || k >= checked.result.rows.length) throw new Error(`Choose an integer sample from 0 to ${checked.result.rows.length - 1}.`);
  const { result } = checked, row = result.rows[k], system = result.history;
  if (target !== 'y' && (!Number.isInteger(target) || target < 0 || target >= system.A.length)) throw new Error('Choose a current history state or the scalar output.');
  return { row, target, coefficients: target === 'y' ? system.C : system.A[target], inputWeight: target === 'y' ? system.D : system.B[target], value: target === 'y' ? row.y : row.next[target], controller: result.controller?.rows[k], observer: result.observer?.rows[k] };
}
