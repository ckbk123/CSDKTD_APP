import { impulseAt, modeAt, num, stateAt, type Analysis, type Model } from './math';

export interface Curve { readonly name: string; readonly values: readonly number[]; readonly pattern: string }
export interface Series { readonly curves: readonly Curve[]; readonly error?: string }
export interface Traces { readonly times: readonly number[]; readonly free: Series; readonly impulse: Series; readonly modes: readonly { ordinary: Series; generalized: Series }[] }
const attempt = (build: () => readonly Curve[]): Series => { try { return { curves: build() }; } catch (error) { return { curves: [], error: error instanceof Error ? error.message : 'This numerical trace is unavailable.' }; } };
/** Cache only sampled illustrations; classification always comes from the unchanged exact analyze(). */
export function sampleTraces(model: Model, analysis: Analysis, initial: readonly number[], horizon: number): Traces {
  const frequency = Math.max(0, ...analysis.eigenvalues.map(root => Math.abs(root.im))), count = Math.max(241, Math.ceil(horizon * frequency * 24 / (2 * Math.PI)) + 1);
  if (!Number.isFinite(horizon) || horizon < .05 || horizon > 30) throw new Error('Use a horizon from 0.05 to 30 seconds.');
  if (count > 2049) {
    const failure = { curves: [], error: 'Shorten the horizon to resolve the oscillation within 2,049 plot points. Analytic classification remains valid.' };
    return { times: [], free: failure, impulse: failure, modes: analysis.eigenvalues.map(() => ({ ordinary: failure, generalized: failure })) };
  }
  const times = Array.from({ length: count }, (_, i) => horizon * i / (count - 1));
  const free = attempt(() => { const states = times.map(t => stateAt(model, initial, t)), c = model.c.map(num); return [
    { name: 'x₁', values: states.map(x => x[0]), pattern: '' }, { name: 'x₂', values: states.map(x => x[1]), pattern: '7 4' }, { name: 'y', values: states.map(x => c[0] * x[0] + c[1] * x[1]), pattern: '2 4' },
  ]; });
  const impulse = attempt(() => [{ name: 'h(t), t>0', values: times.map(t => impulseAt(analysis, t)), pattern: '' }]);
  const modes = analysis.eigenvalues.map(root => ({
    ordinary: attempt(() => [{ name: 'Normalized real mode', values: times.map(t => modeAt(root, false, t)), pattern: '' }]),
    generalized: analysis.defective && root.multiplicity === 2 ? attempt(() => [{ name: 'Generalized t·exp(λt)', values: times.map(t => modeAt(root, true, t)), pattern: '' }]) : { curves: [] },
  }));
  return { times, free, impulse, modes };
}
