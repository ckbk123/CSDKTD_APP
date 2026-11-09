import { decompose, inspect, parseModel, stepAt, termAt, type Model, type StepSolution } from './math';
import { latexRat } from './algebra';

/** The displayed coefficients, reparsed through the existing bounded grammar,
 * are authoritative after a committed geometric edit. No solver is added. */
export function displayedModel(model: Model): Model {
  return parseModel(latexRat(model.a1), latexRat(model.a0), latexRat(model.b1), latexRat(model.b0));
}
/** Preserve the original sample policy, full Taylor evaluation and growth guards.
 * A valid exact model can remain inspectable when numerical modes are withheld. */
export function prepare(model: Model, horizon: number) {
  if (!Number.isFinite(horizon) || horizon < .1 || horizon > 20) throw new Error('Use a time horizon from 0.1 to 20 s.');
  const analysis = inspect(model), count = Math.min(1201, Math.max(401, Math.ceil(horizon * Math.max(...analysis.poles.map(p => Math.abs(p.im))) * 32 / (2 * Math.PI)) + 1));
  const times = Array.from({ length: count }, (_, i) => horizon * i / (count - 1));
  let solution: StepSolution | undefined, output: number[] | undefined, components: number[][] = [], error = '';
  try { solution = decompose(model); output = times.map(t => stepAt(solution!, t)); components = solution.terms.map(term => times.map(t => termAt(t, term))); }
  catch (failure) { output = undefined; components = []; error = failure instanceof Error ? failure.message : 'The numerical trace is unresolved.'; }
  return { model, horizon, analysis, times, solution, output, components, error };
}
export type Prepared = ReturnType<typeof prepare>;
