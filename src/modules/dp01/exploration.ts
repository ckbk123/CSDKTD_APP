import { freeDecomposition, impulseDecomposition, modalSamples, parseModel, poles, simulate, type Experiment, type Model, type Pole, type Sample } from './math';
export interface Source { readonly expression: string; readonly experiment: Experiment; readonly customHistory: boolean }
export interface Checked extends Source { readonly model: Model; readonly roots: readonly Pole[]; readonly rows?: readonly Sample[]; readonly responseIssue: string; readonly freeFormula?: string; readonly impulseFormula: string }
export const baseline = (): Source => ({ expression: 'G(z)=\\frac{0.2}{z-0.8}', customHistory: false, experiment: { T: .1, count: 41, amplitude: 1, input: 'step', history: [0, 0] } });
function validateExperiment(e: Experiment): void {
  if (!Number.isFinite(e.T) || e.T < .0001 || e.T > 100) throw new Error('Sample period T must be from 0.0001 to 100 seconds.');
  if (!Number.isInteger(e.count) || e.count < 4 || e.count > 200) throw new Error('Show an integer from 4 to 200 samples.');
  if (e.history.length !== 2 || ![e.amplitude, ...e.history].every(x => Number.isFinite(x) && Math.abs(x) <= 1e4)) throw new Error('Amplitude and output histories must be finite, with magnitude at most 10⁴.');
  if (!['step', 'impulse', 'ramp', 'free'].includes(e.input)) throw new Error('Select step, impulse, ramp or free response.');
}
/** New source edits use the existing parser/recurrence. Only already checked rows are cached for inspection. */
export function compute(source: Source): Checked {
  const experiment: Experiment = { ...source.experiment, history: [...source.experiment.history] }; validateExperiment(experiment);
  const model = parseModel(source.expression), roots = poles(model);
  let rows: Sample[] | undefined, responseIssue = '';
  try { rows = simulate(model, experiment); } catch (error) { responseIssue = error instanceof Error ? error.message : 'This sampled response is unavailable.'; }
  // The bounded four-coefficient explanation must never impose a full unit-input plot bound.
  const impulseFormula = impulseDecomposition(model), freeFormula = rows ? freeDecomposition(model, rows) : undefined;
  return { expression: source.expression, customHistory: source.customHistory, experiment, model, roots, rows, responseIssue, freeFormula, impulseFormula };
}
export function inspect(checked: Checked, k: number) {
  if (!checked.rows) throw new Error(checked.responseIssue || 'No checked sampled response is available.');
  if (!Number.isInteger(k) || k < 0 || k >= checked.rows.length) throw new Error(`Choose an integer sample from 0 to ${checked.rows.length - 1}.`);
  const rows = checked.rows, row = rows[k];
  const output = checked.model.a.slice(1).map((a, j) => { const index = k - j - 1; return { index, weight: -a, value: index < 0 ? checked.experiment.history[-index - 1] : rows[index].y }; });
  const input = checked.model.b.map((weight, j) => ({ index: k - j, weight, value: rows[k - j]?.u ?? 0 }));
  return { row, output, input };
}

export interface LabDraft { readonly radius: number; readonly angleA: number; readonly angleB: number }
export interface Lab extends LabDraft { readonly a: readonly number[]; readonly b: readonly number[] }
export type LabPoint = 'a' | 'b';
export const labBaseline = (): LabDraft => ({ radius: .8, angleA: 0, angleB: 180 });
export function computeLab(draft: LabDraft): Lab {
  if (!Number.isFinite(draft.radius) || draft.radius < 0 || draft.radius > 1.5 || ![draft.angleA, draft.angleB].every(value => Number.isFinite(value) && value >= 0 && value <= 180)) throw new Error('Use shared radius 0–1.5 and angles 0–180 degrees per sample.');
  return { ...draft, a: modalSamples(draft.radius, draft.angleA * Math.PI / 180, 32), b: modalSamples(draft.radius, draft.angleB * Math.PI / 180, 32) };
}
/** Selected point controls one angle and the explicit shared radius; it never edits the transfer-function denominator. */
export function moveLab(source: LabDraft, selected: LabPoint, point: Pole): Lab {
  if (![point.re, point.im].every(Number.isFinite)) throw new Error('Use a finite comparison point.');
  const radius = Math.hypot(point.re, point.im), angle = radius === 0 ? source[selected === 'a' ? 'angleA' : 'angleB'] : Math.atan2(Math.abs(point.im), point.re) * 180 / Math.PI;
  return computeLab({ ...source, radius, [selected === 'a' ? 'angleA' : 'angleB']: angle });
}
