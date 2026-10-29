import { abs, divide, evaluateExact, isZero, minus, neg, numeric, over, plus, rat, times, trim, zero, type Poly } from './exact';
export interface Complex { readonly re: number; readonly im: number }
export const addC = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const subC = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const mulC = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export function divC(a: Complex, b: Complex): Complex { const d = b.re ** 2 + b.im ** 2; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; }
export const norm = (z: Complex) => Math.hypot(z.re, z.im);
export const monic = (p: Poly): Poly => trim(p).map(c => over(c, trim(p).at(-1)!));
export const derivative = (p: Poly): Poly => p.length < 2 ? [zero] : p.slice(1).map((c, i) => times(c, rat(i + 1)));
export function gcdPolynomial(a: Poly, b: Poly): Poly {
  for (let i = 0; !isZero(b); i++) { if (i > 10) throw new Error('Exact polynomial reduction exceeded its bound.'); [a, b] = [b, divide(a, b).remainder]; }
  return monic(a);
}
/** Exact square-free decomposition prevents clustering from inventing multiplicity. */
export function squareFree(p: Poly): { polynomial: Poly; multiplicity: number }[] {
  p = monic(p); let c = gcdPolynomial(p, derivative(p)); let w: Poly = divide(p, c).quotient; const result = [];
  for (let i = 1; w.length > 1; i++) {
    if (i > 4) throw new Error('Use a polynomial of degree at most four.');
    const y = gcdPolynomial(w, c), f = divide(w, y).quotient;
    if (f.length > 1) result.push({ polynomial: f, multiplicity: i }); w = y; c = divide(c, y).quotient;
  }
  return result;
}
export function valueC(p: Poly, z: Complex): Complex { return p.reduceRight((v, c) => addC(mulC(v, z), { re: numeric(c), im: 0 }), { re: 0, im: 0 }); }
export function residual(p: Poly, z: Complex): number { const scale = p.reduceRight((v, c) => v * norm(z) + Math.abs(numeric(c)), 0); return norm(valueC(p, z)) / (scale || 1); }
export interface Root extends Complex { readonly multiplicity: number; readonly residual: number }
/** Analytic degree1–2 and bounded simultaneous degree3–4 roots, checked against
 * the input and the complete reconstructed coefficient vector. */
export function roots(input: Poly): Root[] {
  input = trim(input); if (input.length > 5 || isZero(input)) throw new Error('Root calculation supports nonzero degree0–4 polynomials.');
  if (input.length === 1) return [];
  const result: Root[] = [];
  for (const f of squareFree(input)) {
    const p = f.polynomial, n = p.length - 1; let zs: Complex[];
    if (n > 1 && p[0].n === 0n) zs = [{ re: 0, im: 0 }, ...roots(p.slice(1))];
    else if (n === 1) zs = [{ re: -numeric(p[0]), im: 0 }];
    else if (n === 2) {
      const b = numeric(p[1]), c = numeric(p[0]), delta = numeric(minus(times(p[1], p[1]), times(rat(4), p[0])));
      if (delta < 0) zs = [{ re: -b / 2, im: Math.sqrt(-delta) / 2 }, { re: -b / 2, im: -Math.sqrt(-delta) / 2 }];
      else { const q = -.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(delta)); zs = [{ re: q, im: 0 }, { re: c / q, im: 0 }]; }
    } else {
      const radius = Math.max(...p.slice(0, -1).map((c, i) => 2 * Math.abs(numeric(c)) ** (1 / (n - i))));
      const scaled = p.map((c, i) => numeric(c) / radius ** (n - i)); let solved: Complex[] | undefined;
      for (const offset of [.173, .397, .719]) {
        let candidates = Array.from({ length: n }, (_, i) => ({ re: Math.cos(2 * Math.PI * (i + offset) / n), im: Math.sin(2 * Math.PI * (i + offset) / n) }));
        for (let iteration = 0; iteration < 600; iteration++) {
          let maxStep = 0;
          candidates = candidates.map((z, i) => {
            let denominator: Complex = { re: 1, im: 0 }; candidates.forEach((w, j) => { if (i !== j) denominator = mulC(denominator, subC(z, w)); });
            const v = scaled.reduceRight((a, c) => addC(mulC(a, z), { re: c, im: 0 }), { re: 0, im: 0 }), correction = divC(v, denominator);
            maxStep = Math.max(maxStep, norm(correction)); return subC(z, correction);
          });
          if (candidates.some(z => !Number.isFinite(norm(z)))) break;
          if (maxStep < 1e-12 && candidates.every(z => residual(p, { re: z.re * radius, im: z.im * radius }) < 1e-10)) { solved = candidates.map(z => ({ re: z.re * radius, im: z.im * radius })); break; }
        }
        if (solved) break;
      }
      if (!solved) throw new Error('Numerical roots did not converge within three starts of600 iterations. Rescale the model.'); zs = solved;
    }
    for (const z of zs) { const error = residual(input, z); if (!Number.isFinite(error) || error > 1e-10) throw new Error('Root residual exceeds10⁻¹⁰; rescale the model.'); result.push({ ...z, multiplicity: f.multiplicity, residual: error }); }
  }
  let expanded: Complex[] = [{ re: 1, im: 0 }];
  for (const z of result) for (let m = 0; m < z.multiplicity; m++) {
    const next = Array.from({ length: expanded.length + 1 }, () => ({ re: 0, im: 0 }));
    expanded.forEach((c, i) => { next[i] = addC(next[i], mulC(c, { re: -z.re, im: -z.im })); next[i + 1] = addC(next[i + 1], c); }); expanded = next;
  }
  if (expanded.length !== input.length || expanded.some((c, i) => norm(subC(c, { re: numeric(over(input[i], input.at(-1)!)), im: 0 })) > 1e-8 * Math.max(1, Math.abs(numeric(over(input[i], input.at(-1)!)))))) throw new Error('Root list failed complete-coefficient reconstruction at10⁻⁸. Rescale the model.');
  return result.sort((a, b) => a.re - b.re || a.im - b.im);
}
/** Exact Sturm counts isolate every positive root, including tangencies, before
 * interval midpoints are converted to numerical frequencies. No frequency sweep. */
export function positiveRoots(p: Poly): number[] {
  p = trim(p); if (isZero(p)) throw new Error('The crossing equation vanishes identically; no isolated crossing is defined.');
  if (p.length > 5) throw new Error('Crossing equations support degree at most four in squared frequency.');
  p = divide(p, gcdPolynomial(p, derivative(p))).quotient;
  while (p.length > 1 && p[0].n === 0n) p = p.slice(1);
  if (p.length === 1) return [];
  const sturm: Poly[] = [p, derivative(p)];
  while (!isZero(sturm.at(-1)!)) {
    const r = divide(sturm.at(-2)!, sturm.at(-1)!).remainder.map(neg); if (isZero(r)) break;
    const lead = r.at(-1)!, positiveScale = rat(abs(lead.n), lead.d); sturm.push(r.map(c => over(c, positiveScale)));
    if (sturm.length > 6) throw new Error('Sturm sequence exceeded its degree bound.');
  }
  const variations = (x: ReturnType<typeof rat>) => { const signs = sturm.map(q => evaluateExact(q, x).n).filter(v => v !== 0n).map(v => v > 0n ? 1 : -1); return signs.slice(1).filter((v, i) => v !== signs[i]).length; };
  let bound = 1n; for (const c of p.slice(0, -1)) { const q = over(c, p.at(-1)!); const ceil = (abs(q.n) + q.d - 1n) / q.d; if (ceil + 1n > bound) bound = ceil + 1n; }
  if (bound > 1000000000000n) throw new Error('Crossing isolation exceeds the squared-frequency bound10¹². Rescale seconds/model.');
  const found: number[] = []; let work = 0;
  function isolate(a: ReturnType<typeof rat>, b: ReturnType<typeof rat>, va: number, vb: number, depth: number): void {
    if (va === vb) return; if (++work > 500 || depth > 80) throw new Error('Closely spaced crossings exceeded the isolation limit. Rescale the model.');
    const lo = numeric(a), hi = numeric(b), mid = over(plus(a, b), rat(2));
    if (va - vb === 1 && hi - lo <= 1e-10 * Math.max(1e-12, Math.abs(lo), Math.abs(hi))) { found.push(numeric(mid)); return; }
    const vm = variations(mid); isolate(a, mid, va, vm, depth + 1); isolate(mid, b, vm, vb, depth + 1);
  }
  isolate(zero, rat(bound), variations(zero), variations(rat(bound)), 0); return found;
}
