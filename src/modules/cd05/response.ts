import { complex, exponential, magnitude, plus, scale, times, type Complex } from './complex';
import { validateLead, validatePlant, type Lead, type Plant } from './input';
import { closedLoop } from './frequency';
import { roots, type Pole, type PoleResult } from './poles';
import { mv, solveComplex, sum, transition, type Matrix } from './numeric';
export interface ResponseRow { t: number; y: number; error: number; u: number }
export interface ModalTerm { pole: Complex; power: number; coefficient: Complex }
export interface TailEstimate { terms: ModalTerm[]; bound: number; condition: number; solveResidual: number; reconstructionResidual: number }
export interface ResponseMetrics {
  peak: number; peakTime: number; overshoot: number; rise10?: number; rise90?: number; rise?: number;
  settlingCandidate?: number; settling?: number;
}
export interface StepResponse {
  points: ResponseRow[]; metrics: ResponseMetrics; poles: PoleResult; states: number; dt: number;
  steps: number; work: number; refinementResidual: number; peakRefinementDelta: number;
  tail?: TailEstimate; tailMessage: string;
}
const fail = (message: string): never => { throw new Error(message); };
const factorial = (n: number): number => n === 2 ? 2 : 1;
function finite(values: number[], label: string): void {
  if (values.some(v => !Number.isFinite(v) || Math.abs(v) > 1e8)) fail(label + ' exceeds finite magnitude10⁸. Rescale the plant/controller or shorten the horizon.');
}
/** Physical states [y, ydot/w, filtered error]; homogeneous deviation from
 * the unit-step equilibrium [1,0,0] starts [-1,0,0]. The no-lead model has
 * no filter state. The full controller zero is retained in these equations. */
export function physicalModel(p: Plant, c: Lead): { A: Matrix; initial: number[]; acceleration: number } {
  validatePlant(p); validateLead(c);
  const acceleration = p.k * c.K / c.alpha, w = Math.sqrt(acceleration);
  if (c.alpha === 1) return { A: [[0, w], [-w, -p.a]], initial: [-1, 0], acceleration };
  const rate = 1 / (c.alpha * c.T);
  return { A: [[0, w, 0], [-w, -p.a, -w * (1 - c.alpha)], [-rate, 0, -rate]], initial: [-1, 0, 0], acceleration };
}
function simulate(A: Matrix, initial: number[], c: Lead, horizon: number, steps: number): ResponseRow[] {
  const dt = horizon / steps, step = transition(A, dt), rows: ResponseRow[] = [];
  let state = [...initial];
  for (let k = 0; k <= steps; k++) {
    const error = -state[0], y = 1 + state[0];
    const u = c.alpha === 1 ? c.K * error : -c.K / c.alpha * sum([state[0], (1 - c.alpha) * state[2]]);
    finite([y, error, u], 'Response'); rows.push({ t: horizon * k / steps, y, error, u });
    if (k < steps) { state = mv(step, state); finite(state, 'Response state'); }
  }
  return rows;
}
function crossing(rows: ResponseRow[], level: number): number | undefined {
  for (let i = 1; i < rows.length; i++) if (rows[i - 1].y < level && rows[i].y >= level) {
    const a = rows[i - 1], b = rows[i]; return a.t + (level - a.y) / (b.y - a.y) * (b.t - a.t);
  }
  return undefined;
}
function metrics(rows: ResponseRow[]): ResponseMetrics {
  const peak = rows.reduce((best, row) => row.y > best.y ? row : best, rows[0]);
  const rise10 = crossing(rows, .1), rise90 = crossing(rows, .9);
  let lastOutside = -1;
  rows.forEach((row, i) => { if (Math.abs(row.error) > .02) lastOutside = i; });
  const settlingCandidate = lastOutside >= 0 && lastOutside < rows.length - 1 ? rows[lastOutside + 1].t : undefined;
  return { peak: peak.y, peakTime: peak.t, overshoot: Math.max(0, peak.y - 1) * 100, rise10, rise90,
    rise: rise10 !== undefined && rise90 !== undefined ? rise90 - rise10 : undefined, settlingCandidate };
}
const power = (value: Complex, n: number): Complex => n === 0 ? complex(1) : n === 1 ? value : times(value, value);
function modalValue(terms: ModalTerm[], time: number): Complex {
  return terms.reduce((total, term) => plus(total, scale(times(term.coefficient, exponential(scale(term.pole, time))), time ** term.power / factorial(term.power))), complex(0));
}
function tailEstimate(poles: Pole[], acceleration: number, rows: ResponseRow[]): TailEstimate {
  const n = poles.reduce((total, pole) => total + pole.multiplicity, 0);
  if (poles.some(pole => pole.re >= 0)) fail('A decaying modal tail cannot be asserted for a nonnegative-real-part pole.');
  const basis = poles.flatMap(pole => Array.from({ length: pole.multiplicity }, (_, j) => ({ pole: complex(pole.re, pole.im), power: j })));
  const matrix = Array.from({ length: n }, (_, k) => basis.map(term => {
    if (k < term.power) return complex(0);
    const binomial = k === 2 && term.power === 1 ? 2 : 1;
    return scale(power(term.pole, k - term.power), binomial);
  }));
  const derivatives = [1, 0, -acceleration].slice(0, n).map(value => complex(value)), solved = solveComplex(matrix, derivatives);
  const terms = basis.map((term, i) => ({ ...term, coefficient: solved.value[i] }));
  const indices = [...new Set([0, 1, ...[.01, .1, .25, .5, .75, 1].map(f => Math.floor((rows.length - 1) * f))])];
  let reconstructionResidual = 0;
  for (const i of indices) {
    const actual = modalValue(terms, rows[i].t);
    reconstructionResidual = Math.max(reconstructionResidual, Math.hypot(actual.re - rows[i].error, actual.im) / Math.max(1, Math.abs(rows[i].error)));
  }
  if (!Number.isFinite(reconstructionResidual) || reconstructionResidual > 1e-8) fail('The numerical modal tail does not reconstruct the independent state response within10⁻⁸.');
  const H = rows.at(-1)!.t;
  // sup(t>=H) t^j exp(-lambda*t) occurs at max(H,j/lambda).
  const bound = terms.reduce((total, term) => {
    const at = Math.max(H, term.power / -term.pole.re);
    return total + magnitude(term.coefficient) * at ** term.power / factorial(term.power) * Math.exp(term.pole.re * at);
  }, 0) + 1e-8;
  if (!Number.isFinite(bound)) fail('The numerical modal-tail bound is unrepresentable.');
  return { terms, bound, condition: solved.condition, solveResidual: solved.residual, reconstructionResidual };
}
export function stepResponse(p: Plant, c: Lead, horizon: number): StepResponse {
  validatePlant(p); validateLead(c);
  if (!Number.isFinite(horizon) || horizon < .1 || horizon > 200) fail('Use a response horizon from .1 to200 seconds.');
  const polynomial = closedLoop(p, c), fullPoles = roots(polynomial.denominator);
  if (fullPoles.values.some(pole => pole.re >= 0)) fail('The numerical pole set is not strictly stable; no settled-response claim is made.');
  const physical = physicalModel(p, c), speed = Math.max(1, ...fullPoles.values.map(magnitude));
  let coarseSteps = 400 * Math.max(5, Math.ceil(25 * horizon * speed / 400));
  if (2 * coarseSteps > 40000) fail('The full response needs more than40000 refined steps to resolve every pole on this horizon. Shorten the horizon or move very fast corners.');
  let coarse = simulate(physical.A, physical.initial, c, horizon, coarseSteps), work = coarseSteps;
  let fine: ResponseRow[], refinementResidual: number, peakRefinementDelta: number, fineMetrics: ResponseMetrics;
  while (true) {
    const fineSteps = 2 * coarseSteps;
    fine = simulate(physical.A, physical.initial, c, horizon, fineSteps); work += fineSteps;
    refinementResidual = 0;
    for (let i = 0; i < coarse.length; i++) for (const key of ['y', 'u'] as const) {
      refinementResidual = Math.max(refinementResidual, Math.abs(coarse[i][key] - fine[2 * i][key]) / Math.max(1, Math.abs(fine[2 * i][key])));
    }
    if (refinementResidual > 1e-8) fail('Full-response step refinement disagrees beyond10⁻⁸. Rescale or shorten the horizon.');
    fineMetrics = metrics(fine); peakRefinementDelta = Math.abs(fineMetrics.peak - metrics(coarse).peak);
    if (peakRefinementDelta <= 1e-4) break;
    if (2 * fineSteps > 40000) fail('Peak sampling did not converge within the40000-step response limit. Shorten the horizon or change the corners.');
    coarseSteps = fineSteps; coarse = fine;
  }
  const steps = fine.length - 1, stride = steps / 400;
  const points = Array.from({ length: 401 }, (_, i) => fine[i * stride]);
  const out: StepResponse = { points, metrics: fineMetrics, poles: fullPoles, states: physical.A.length, steps, work, dt: horizon / steps,
    refinementResidual, peakRefinementDelta, tailMessage: '' };
  try {
    out.tail = tailEstimate(fullPoles.values, physical.acceleration, fine);
    if (out.tail.bound <= .02) {
      out.metrics.settling = out.metrics.settlingCandidate;
      out.tailMessage = 'Numerical full-mode tail bound after the horizon is within the2% band. Settling time remains a sampled candidate with the stated time resolution.';
    } else out.tailMessage = 'The numerical full-mode tail bound still exceeds2%; the horizon does not confirm settling. Extend it within the work limit.';
  } catch (error) {
    out.tailMessage = 'Tail estimate unavailable: ' + (error instanceof Error ? error.message : 'Check modal conditioning.') + ' The full state response and observed metrics remain available.';
  }
  return out;
}
