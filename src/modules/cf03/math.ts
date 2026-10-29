import type { Controller, Plant } from './input';
export const metrics = ['IAE', 'ISE', 'ITAE', 'ITSE', 'Effort'] as const;
export type Metric = typeof metrics[number];
export interface Sample { t: number; y: number; e: number; u: number }
export interface Stability { stable: boolean; characteristic: number[]; conditions: { label: string; value: number; passed: boolean }[] }
export interface Run {
  plant: Plant; controller: Controller; horizon: number; tolerance: number;
  intervals: number; samples: Sample[]; totals: Record<Metric, number>;
  refinementChange: number; stability: Stability; sampledPeakControl: number;
}
const fail = (message: string): never => { throw new Error(message); };
export function validate(plant: Plant, controller: Controller): void {
  if (![2, 3].includes(plant.a.length) || plant.a[0] !== 1 || [...plant.a, plant.g].some(v => !Number.isFinite(v) || Math.abs(v) > 1000) || Math.abs(plant.g) < 1e-9) fail('Use a normalized nonzero constant-gain plant of order one or two, with coefficient magnitudes at most1000.');
  if ([controller.kp, controller.ki].some(v => !Number.isFinite(v) || Math.abs(v) > 1000) || (controller.ki !== 0 && Math.abs(controller.ki) < 1e-9)) fail('Use finite P/PI gains of magnitude at most1000; nonzero Ki magnitude at least10⁻⁹.');
}
export function stability(plant: Plant, controller: Controller): Stability {
  validate(plant, controller);
  const { a, g } = plant, { kp, ki } = controller;
  const p = ki === 0 ? [...a.slice(0, -1), a.at(-1)! + g * kp]
    : [...a.slice(0, -1), a.at(-1)! + g * kp, g * ki];
  const values: [string, number, number][] = p.slice(1).map((v, i) => [`a_${i + 1}>0`, v, Math.max(1, Math.abs(v))]);
  if (p.length === 4) values.push(['a_1a_2-a_3>0', p[1] * p[2] - p[3], Math.max(1, Math.abs(p[1] * p[2]), Math.abs(p[3]))]);
  const conditions = values.map(([label, value, scale]) => ({ label, value, passed: value > 1e-10 * scale }));
  return { stable: conditions.every(c => c.passed), characteristic: p, conditions };
}
export function density(sample: Sample, metric: Metric): number {
  if (metric === 'IAE') return Math.abs(sample.e);
  if (metric === 'ISE') return sample.e * sample.e;
  if (metric === 'ITAE') return sample.t * Math.abs(sample.e);
  if (metric === 'ITSE') return sample.t * sample.e * sample.e;
  return sample.u * sample.u;
}
const observe = (x: number[], t: number, order: number, controller: Controller): Sample => {
  const e = 1 - x[0], u = controller.kp * e + (controller.ki === 0 ? 0 : controller.ki * x[order]);
  if (![...x, u].every(Number.isFinite) || Math.max(...x.map(Math.abs), Math.abs(u)) > 1e8) fail('State/control magnitude exceeded10⁸; no checked finite-horizon comparison is available. Shortening a horizon does not establish stability.');
  return { t, y: x[0], e, u };
};
function derivative(x: number[], plant: Plant, controller: Controller): number[] {
  const order = plant.a.length - 1, sample = observe(x, 0, order, controller);
  const dx = order === 1 ? [-plant.a[1] * x[0] + plant.g * sample.u]
    : [x[1], -plant.a[1] * x[1] - plant.a[2] * x[0] + plant.g * sample.u];
  if (controller.ki !== 0) dx.push(sample.e);
  return dx;
}
function checkedSettings(horizon: number, intervals: number): void {
  if (!Number.isFinite(horizon) || horizon < .05 || horizon > 50) fail('Choose a common horizon from0.05 to50 seconds.');
  if (!Number.isInteger(intervals) || intervals < 2 || intervals > 32768 || intervals % 2 !== 0) fail('Use an even interval count from2 to32768.');
}
/** Independent state stepping and composite Simpson accumulation. Time samples
 * are a numerical illustration, never controller sample periods. */
export function uniform(plant: Plant, controller: Controller, horizon: number, intervals: number): Pick<Run, 'samples' | 'totals'> {
  validate(plant, controller); checkedSettings(horizon, intervals);
  const order = plant.a.length - 1, h = horizon / intervals;
  let x = Array(order + (controller.ki !== 0 ? 1 : 0)).fill(0) as number[];
  const samples: Sample[] = [];
  for (let k = 0; k <= intervals; k++) {
    samples.push(observe(x, k * h, order, controller));
    if (k === intervals) break;
    const first = derivative(x, plant, controller);
    const second = derivative(x.map((v, i) => v + .5 * h * first[i]), plant, controller);
    const third = derivative(x.map((v, i) => v + .5 * h * second[i]), plant, controller);
    const fourth = derivative(x.map((v, i) => v + h * third[i]), plant, controller);
    x = x.map((v, i) => v + h / 6 * (first[i] + 2 * second[i] + 2 * third[i] + fourth[i]));
  }
  const totals = Object.fromEntries(metrics.map(metric => {
    let sum = density(samples[0], metric) + density(samples[intervals], metric);
    for (let i = 1; i < intervals; i++) sum += (i % 2 ? 4 : 2) * density(samples[i], metric);
    return [metric, h / 3 * sum];
  })) as Record<Metric, number>;
  if (Object.values(totals).some(v => !Number.isFinite(v))) fail('An integral exceeded the finite numerical range.');
  return { samples, totals };
}
export function simulate(plant: Plant, controller: Controller, horizon: number, tolerance = 1e-5): Run {
  validate(plant, controller);
  if (!Number.isFinite(tolerance) || tolerance < 1e-8 || tolerance > 1e-2) fail('Choose a refinement tolerance from10⁻⁸ to10⁻².');
  checkedSettings(horizon, 2);
  const order = plant.a.length - 1;
  const speed = Math.max(1, Math.abs(plant.a[1]), Math.sqrt(Math.abs(plant.a.at(-1)!) + Math.abs(plant.g * controller.kp)), Math.cbrt(Math.abs(plant.g * controller.ki)));
  let intervals = 2 ** Math.ceil(Math.log2(Math.max(128, horizon * speed / .5)));
  if (intervals >= 16384) fail('Dynamics are too fast for the bounded refinement grid. Reduce gains/horizon; no checked integral is available.');
  let coarse = uniform(plant, controller, horizon, intervals);
  while (intervals < 16384) {
    const fine = uniform(plant, controller, horizon, intervals * 2);
    let change = 0;
    for (const metric of metrics) change = Math.max(change, Math.abs(fine.totals[metric] - coarse.totals[metric]) / (1 + Math.abs(fine.totals[metric])));
    coarse.samples.forEach((sample, i) => {
      for (const key of ['e', 'u'] as const) change = Math.max(change, Math.abs(sample[key] - fine.samples[2 * i][key]) / (1 + Math.abs(fine.samples[2 * i][key])));
    });
    intervals *= 2;
    if (change <= tolerance) return {
      plant, controller, horizon, tolerance, intervals, ...fine, refinementChange: change,
      stability: stability(plant, controller), sampledPeakControl: Math.max(...fine.samples.map(s => Math.abs(s.u))),
    };
    coarse = fine;
  }
  return fail(`Resolution did not meet the requested tolerance within16384 intervals (plant order${order}). Relax tolerance or reduce gains/horizon; no checked result is returned.`);
}
export function panel(run: Run, time: number, metric: Metric): { index: number; samples: Sample[]; contribution: number; cumulative: number } {
  if (!Number.isFinite(time) || time < 0 || time > run.horizon) fail('Choose an inspection time within the common horizon.');
  const h = run.horizon / run.intervals;
  const index = Math.min(run.intervals - 2, 2 * Math.floor(time / (2 * h)));
  const samples = run.samples.slice(index, index + 3);
  const value = (at: number) => h / 3 * (density(run.samples[at], metric) + 4 * density(run.samples[at + 1], metric) + density(run.samples[at + 2], metric));
  let cumulative = 0;
  for (let i = 0; i <= index; i += 2) cumulative += value(i);
  return { index, samples, contribution: value(index), cumulative };
}
/** Different quadrature rule on a twice-finer state grid. This tests numerical
 * consistency, not a certified bound on exact ODE/quadrature error. */
export function verifyIntegral(run: Run, metric: Metric): { trapezoid: number; fineSimpson: number; relativeChange: number; ruleChange: number; consistent: boolean; intervals: number; tolerance: number } {
  if (run.tolerance <= 1e-8) fail('Already at the supported finest tolerance10⁻⁸; a finer-tolerance check is unavailable.');
  const tolerance = Math.max(1e-8, run.tolerance / 10);
  const refined = simulate(run.plant, run.controller, run.horizon, tolerance);
  const intervals = refined.intervals * 2;
  const fine = uniform(run.plant, run.controller, run.horizon, intervals);
  const h = run.horizon / intervals;
  let sum = (density(fine.samples[0], metric) + density(fine.samples.at(-1)!, metric)) / 2;
  for (let i = 1; i < fine.samples.length - 1; i++) sum += density(fine.samples[i], metric);
  const trapezoid = sum * h, relativeChange = Math.abs(trapezoid - run.totals[metric]) / (1 + Math.abs(trapezoid));
  const ruleChange = Math.abs(trapezoid - fine.totals[metric]) / (1 + Math.abs(fine.totals[metric]));
  return { trapezoid, fineSimpson: fine.totals[metric], relativeChange, ruleChange, consistent: ruleChange <= 5 * tolerance && relativeChange <= 5 * run.tolerance, intervals, tolerance };
}
export function ranking(a: number, b: number): 'A' | 'B' | 'tie' {
  return Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b)) ? 'tie' : a < b ? 'A' : 'B';
}
