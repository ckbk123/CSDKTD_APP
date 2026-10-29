import { parseTransfer } from './parser';
import { ONE, ZERO, compare, div, fromDecimal, mul, toNumber, type Q } from './rational';
export interface Plant { k: number; a: number }
export interface Lead { K: number; T: number; alpha: number }
const fail = (message: string): never => { throw new Error(message); };
function positive(q: Q): boolean { return compare(q, ZERO) > 0; }
function exactRange(value: Q, min: string, max: string, label: string): number {
  if (compare(value, fromDecimal(min)) < 0 || compare(value, fromDecimal(max)) > 0) fail(label + ' must be from ' + min + ' to ' + max + '.');
  return toNumber(value);
}
function range(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) fail(label + ' must be finite, from ' + min + ' to ' + max + '.');
}
export function validatePlant(p: Plant): void { range(p.k, .01, 100, 'Plant gain k'); range(p.a, .1, 100, 'Plant pole rate a (rad/s)'); }
export function validateLead(c: Lead): void {
  range(c.K, .01, 1000, 'Controller DC gain K'); range(c.T, .01, 10, 'Lead time T (s)'); range(c.alpha, .02, 1, 'Lead ratio alpha');
}
export function parsePlant(latex: string): Plant {
  const { a, b } = parseTransfer(latex);
  if (a.length !== 3 || a[2].n || b[0].n || b[1].n || !positive(a[1]) || !positive(b[2])) fail('Use the declared plant family k/[s(s+a)] with k>0 and a>0; retain one integrator and one negative real pole.');
  return { k: exactRange(b[2], '.01', '100', 'Plant gain k'), a: exactRange(a[1], '.1', '100', 'Plant pole rate a (rad/s)') };
}
export function parseLead(latex: string): Lead {
  const { a, b } = parseTransfer(latex);
  if (a.length === 1) return { K: exactRange(b[0], '.01', '1000', 'Controller DC gain K'), T: 1, alpha: 1 };
  if (a.length !== 2 || !positive(a[1]) || !positive(b[0]) || !positive(b[1])) fail('Use a positive constant or one proper lead section K(1+Ts)/(1+alpha T s), with K,T>0 and .02≤alpha≤1.');
  const K = div(b[1], a[1]), T = div(b[0], b[1]), alpha = div(b[1], mul(a[1], b[0]));
  if (compare(alpha, ONE) > 0) fail('This is a lag section: its pole is nearer the origin than its zero. CD05 supports lead or the alpha=1 no-lead case.');
  return { K: exactRange(K, '.01', '1000', 'Controller DC gain K'), T: exactRange(T, '.01', '10', 'Lead time T (s)'), alpha: exactRange(alpha, '.02', '1', 'Lead ratio alpha') };
}
/** Native numeric alternatives have exponent syntax; visual fields do not. */
export function decimal(value: number): string {
  if (!Number.isFinite(value)) return fail('Use finite numeric parameters.');
  if (value === 0) return '0';
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  const [mantissa, power] = text.toLowerCase().split('e'), sign = mantissa.startsWith('-') ? '-' : '', magnitude = mantissa.replace('-', ''), digits = magnitude.replace('.', '');
  const point = magnitude.split('.')[0].length + Number(power);
  return sign + (point <= 0 ? '0.' + '0'.repeat(-point) + digits : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point));
}
export function plantLatex(p: Plant): string {
  validatePlant(p); const latex = 'G(s)=\\frac{' + decimal(p.k) + '}{s(s+' + decimal(p.a) + ')}'; parsePlant(latex); return latex;
}
export function leadLatex(c: Lead): string {
  validateLead(c);
  if (c.alpha === 1) return 'C(s)=' + decimal(c.K);
  const latex = 'C(s)=(' + decimal(c.K) + ')\\frac{1+(' + decimal(c.T) + ')s}{1+(' + decimal(c.alpha) + ')(' + decimal(c.T) + ')s}';
  parseLead(latex); return latex;
}
