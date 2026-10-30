/** Exact rational functions over Q[z]. Ascending coefficient order stays private.
 * Every public operation receives a caller-owned work budget. No float trimming. */
export type Q = Readonly<{ n: bigint; d: bigint }>;
export type Poly = readonly Q[];
export type Gain = Readonly<{ n: Poly; d: Poly }>;
export class Work {
  private left: number;
  constructor(limit = 200000) { this.left = limit; }
  tick() { if (--this.left < 0) throw new Error('Exact arithmetic work limit reached. Reduce the graph or gain orders.'); }
}
const abs = (n: bigint) => n < 0n ? -n : n;
function gcd(a: bigint, b: bigint): bigint { while (b) [a, b] = [b, a % b]; return abs(a); }
export function q(n: bigint, d = 1n): Q {
  if (!d) throw new Error('Division by zero.');
  if (abs(n).toString(2).length > 2048 || abs(d).toString(2).length > 2048) throw new Error('Exact coefficient size limit reached. Use simpler gains.');
  const g = gcd(n, d); return { n: n / g * (d < 0n ? -1n : 1n), d: abs(d / g) };
}
const Z = q(0n), O = q(1n);
function plus(a: Q, b: Q, w: Work) { w.tick(); return q(a.n * b.d + b.n * a.d, a.d * b.d); }
function times(a: Q, b: Q, w: Work) { w.tick(); return q(a.n * b.n, a.d * b.d); }
function over(a: Q, b: Q, w: Work) { w.tick(); return q(a.n * b.d, a.d * b.n); }
const negQ = (a: Q) => q(-a.n, a.d);
function trim(p: Q[]): Q[] { while (p.length > 1 && !p.at(-1)!.n) p.pop(); return p; }
const zeroPoly = (p: Poly) => p.length === 1 && !p[0].n;
function pAdd(a: Poly, b: Poly, w: Work): Q[] {
  return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => plus(a[i] ?? Z, b[i] ?? Z, w)));
}
function pMul(a: Poly, b: Poly, w: Work): Q[] {
  if (a.length + b.length > 66) throw new Error('Polynomial degree limit reached. Reduce the graph or gain orders.');
  const out: Q[] = Array(a.length + b.length - 1).fill(Z);
  a.forEach((x, i) => b.forEach((y, j) => { out[i + j] = plus(out[i + j], times(x, y, w), w); }));
  return trim(out);
}
function divrem(a: Poly, b: Poly, w: Work): [Q[], Q[]] {
  if (zeroPoly(b)) throw new Error('Zero polynomial divisor.');
  const r = [...a], out: Q[] = Array(Math.max(1, a.length - b.length + 1)).fill(Z);
  while (!zeroPoly(r) && r.length >= b.length) {
    const k = r.length - b.length, c = over(r.at(-1)!, b.at(-1)!, w); out[k] = c;
    for (let i = 0; i < b.length; i++) r[i + k] = plus(r[i + k], negQ(times(c, b[i], w)), w);
    trim(r);
  }
  return [trim(out), r];
}
function pGcd(a: Poly, b: Poly, w: Work): Poly {
  while (!zeroPoly(b)) { const r = divrem(a, b, w)[1]; a = b; b = r; }
  return a.map(x => over(x, a.at(-1)!, w));
}
export function rational(n: Poly, d: Poly, w: Work): Gain {
  n = trim([...n]); d = trim([...d]);
  if (zeroPoly(d)) throw new Error('A gain denominator is identically zero.');
  if (zeroPoly(n)) return { n: [Z], d: [O] };
  const common = pGcd(n, d, w); n = divrem(n, common, w)[0]; d = divrem(d, common, w)[0];
  const lead = d.at(-1)!;
  return { n: n.map(x => over(x, lead, w)), d: d.map(x => over(x, lead, w)) };
}
export const constant = (n: bigint, d = 1n): Gain => ({ n: [q(n, d)], d: [O] });
export const variable = (): Gain => ({ n: [Z, O], d: [O] });
export const isZero = (a: Gain) => zeroPoly(a.n);
export const negate = (a: Gain): Gain => ({ n: a.n.map(negQ), d: a.d });
export function add(a: Gain, b: Gain, w: Work): Gain { return rational(pAdd(pMul(a.n, b.d, w), pMul(b.n, a.d, w), w), pMul(a.d, b.d, w), w); }
export function sub(a: Gain, b: Gain, w: Work) { return add(a, negate(b), w); }
export function mul(a: Gain, b: Gain, w: Work): Gain { return rational(pMul(a.n, b.n, w), pMul(a.d, b.d, w), w); }
export function div(a: Gain, b: Gain, w: Work): Gain {
  if (isZero(b)) throw new Error('Singular equations: division by an identically zero gain.');
  return rational(pMul(a.n, b.d, w), pMul(a.d, b.n, w), w);
}
function integerForm(g: Gain): [bigint[], bigint[]] {
  let lcm = 1n;
  for (const c of [...g.n, ...g.d]) {
    lcm = lcm / gcd(lcm, c.d) * c.d;
    if (lcm.toString(2).length > 4096) throw new Error('The exact result is too large to display. Simplify the branch gains.');
  }
  let n = g.n.map(c => c.n * (lcm / c.d)), d = g.d.map(c => c.n * (lcm / c.d));
  let factor = 0n; for (const c of [...n, ...d]) factor = gcd(factor, c);
  n = n.map(c => c / factor); d = d.map(c => c / factor); return [n, d];
}
function pLatex(p: bigint[]): string {
  const terms: string[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i]; if (!c) continue;
    const mag = abs(c), coef = i && mag === 1n ? '' : mag.toString();
    terms.push(`${c < 0n ? '-' : terms.length ? '+' : ''}${coef}${i ? i === 1 ? 'z' : `z^{${i}}` : ''}`);
  }
  return terms.join('') || '0';
}
export function latex(g: Gain): string {
  const [n, d] = integerForm(g), result = d.length === 1 && d[0] === 1n ? pLatex(n) : `\\frac{${pLatex(n)}}{${pLatex(d)}}`;
  if (result.length > 8192) throw new Error('The exact equation is too large to display. Simplify the branch gains.');
  return result;
}
export function same(a: Gain, b: Gain, w: Work) { return isZero(sub(a, b, w)); }
export function coefficients(g: Gain) { const [n, d] = integerForm(g); return { numerator: n.map(String), denominator: d.map(String) }; }
export type Complex = { re: number; im: number };
export const ca = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const cn = (a: Complex): Complex => ({ re: -a.re, im: -a.im });
export const cm = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export function cd(a: Complex, b: Complex): Complex {
  const v = b.re * b.re + b.im * b.im;
  if (!(v > 0) || !Number.isFinite(v)) throw new Error('The selected evaluation point is singular or numerically too large.');
  return { re: (a.re * b.re + a.im * b.im) / v, im: (a.im * b.re - a.re * b.im) / v };
}
export const norm = (a: Complex) => Math.hypot(a.re, a.im);
export function evaluate(g: Gain, z: Complex): Complex {
  const at = (p: Poly) => p.reduceRight((v, c) => ca(cm(v, z), { re: Number(c.n) / Number(c.d), im: 0 }), { re: 0, im: 0 });
  const n = at(g.n), d = at(g.d);
  const scale = g.d.reduce((v, c, i) => v + Math.abs(Number(c.n) / Number(c.d)) * Math.max(1, norm(z)) ** i, 0);
  if (norm(d) < 1e-12 * Math.max(1, scale)) throw new Error('A retained gain has a pole or severe cancellation at this point. Choose another point.');
  const out = cd(n, d); if (![out.re, out.im].every(Number.isFinite)) throw new Error('Evaluation overflow. Choose a smaller point or simpler gains.');
  return out;
}
