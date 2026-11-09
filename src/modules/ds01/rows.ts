import { classify, parsePole, samples, validateModel, type Complex, type Mode, type Sample } from './math';

export interface ModalRow { readonly id: number; readonly mode: Mode }
export interface Source { readonly rows: readonly ModalRow[]; readonly period: number; readonly horizon: number }
export type AmplitudeSample = Omit<Sample, 't'>;
interface Cached { readonly key: string; readonly data: readonly AmplitudeSample[] }
export interface Checked extends Source { readonly cache: ReadonlyMap<number, Cached>; readonly verdict: ReturnType<typeof classify> }
export const baseline = (): Source => ({ rows: [{ id: 1, mode: { pole: { re: .8, im: 0 }, structure: 'simple', visible: true } }, { id: 2, mode: { pole: { re: -.8, im: 0 }, structure: 'simple', visible: true } }], period: .1, horizon: 20 });
/** Cache amplitudes without physical timestamps; changing T never changes fixed-z samples. */
export function check(source: Source, previous?: Checked): Checked {
  const modes = source.rows.map(row => row.mode); validateModel(modes, source.period, source.horizon);
  if (new Set(source.rows.map(row => row.id)).size !== source.rows.length) throw new Error('Each modal row needs its own identity.');
  const cache = new Map<number, Cached>();
  for (const row of source.rows) {
    const key = JSON.stringify([row.mode.pole, row.mode.structure, source.horizon]), old = previous?.cache.get(row.id);
    cache.set(row.id, old?.key === key ? old : { key, data: samples(row.mode, 1, source.horizon).map(({ t: _t, ...amplitude }) => amplitude) });
  }
  return { ...source, cache, verdict: classify(modes) };
}
export function sampleAt(checked: Checked, rowId: number, k: number): Sample {
  if (!Number.isInteger(k) || k < 0 || k > checked.horizon) throw new Error(`Choose an integer sample from 0 to ${checked.horizon}.`);
  const value = checked.cache.get(rowId)?.data[k]; if (!value) throw new Error('Select a current modal row.'); return { ...value, t: k * checked.period };
}
export function replaceRow(source: Source, id: number, mode: Mode): Source {
  if (!source.rows.some(row => row.id === id)) throw new Error('Select a current modal row.'); return { ...source, rows: source.rows.map(row => row.id === id ? { id, mode } : row) };
}
export function moveRow(source: Source, id: number, pole: Complex): Source {
  const row = source.rows.find(row => row.id === id); if (!row) throw new Error('Select a current modal row.'); return replaceRow(source, id, { ...row.mode, pole });
}
export function appendRow(source: Source, id: number): Source {
  if (source.rows.length >= 4) throw new Error('At most four distinct modal rows are supported.');
  for (const re of [0, .25, -.25, .5, -.5]) {
    const next = { ...source, rows: [...source.rows, { id, mode: { pole: { re, im: 0 }, structure: 'simple' as const, visible: true } }] };
    try { validateModel(next.rows.map(row => row.mode), next.period, next.horizon); return next; } catch { /* Try another explicit, unused starting pole. */ }
  }
  throw new Error('Choose a distinct starting pole for the new row.');
}
export function removeRow(source: Source, id: number): Source { if (source.rows.length <= 1) throw new Error('Retain at least one modal row.'); if (!source.rows.some(row => row.id === id)) throw new Error('Select a current modal row.'); return { ...source, rows: source.rows.filter(row => row.id !== id) }; }
export const snap = (value: number): number => { if (!Number.isFinite(value)) throw new Error('Use finite pole coordinates.'); const result = Math.round(value * 100) / 100; return result === 0 ? 0 : result; };
/** Round-trip a retained number through the existing visual grammar, without e/E symbols. */
function decimal(value: number): string {
  const text = String(value); if (!text.includes('e')) return text;
  const [mantissa, exponent] = String(Math.abs(value)).split('e'), digits = mantissa.replace('.', ''), point = (mantissa.includes('.') ? mantissa.indexOf('.') : mantissa.length) + Number(exponent), sign = value < 0 ? '-' : '';
  return sign + (point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`);
}
export const poleEntry = (pole: Complex): string => `${decimal(pole.re)}${pole.im ? `${pole.im < 0 ? '-' : '+'}${decimal(Math.abs(pole.im))}j` : ''}`;
export function nativePole(re: number, im: number): Complex { if (![re, im].every(Number.isFinite)) throw new Error('Use finite real and imaginary parts.'); return parsePole(poleEntry({ re, im })); }
