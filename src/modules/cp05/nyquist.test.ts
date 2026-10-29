import { describe, expect, it } from 'vitest';
import { atFrequency, construct, frequencySamples, imaginaryPoles, response, validateModel } from './nyquist';
import { parsePolynomial as parse } from './expression';
import { textR } from './exact';
const baseline = () => construct(parse('4'), parse('(s+1)(s+2)'), 10, .1);
describe('CP05 independent response and finite-contour fixtures', () => {
  it('evaluates the accepted baseline at0,j andsqrt2j by independent complex division', () => {
    const c = baseline(), dc = atFrequency(c, 0).bode, unit = atFrequency(c, 1).bode, vertical = atFrequency(c, Math.sqrt(2)).bode;
    expect(dc.kind).toBe('value'); if (dc.kind === 'value') expect(dc.value).toEqual({ re: 2, im: 0 });
    expect(unit.kind).toBe('value'); if (unit.kind === 'value') { expect(unit.value.re).toBeCloseTo(.4, 12); expect(unit.value.im).toBeCloseTo(-1.2, 12); expect(unit.magnitude).toBeCloseTo(Math.sqrt(1.6), 12); expect(unit.phase).toBeCloseTo(-Math.atan(3), 12); }
    if (vertical.kind === 'value') { expect(vertical.value.re).toBeCloseTo(0, 12); expect(vertical.value.im).toBeCloseTo(-4 / (3 * Math.sqrt(2)), 12); }
    expect(textR(c.outerLimit)).toBe('0'); expect(c.decayOrder).toBe(2);
  });
  it('closes the entire clockwise RHP contour including its actual mapped outer arc', () => {
    const c = baseline(), first = c.points[0], last = c.points.at(-1)!;
    expect(first.source).toEqual({ re: 0, im: -10 }); expect(last.source).toEqual(first.source); expect(last.response).toEqual(first.response);
    expect(c.segments.map(s => s.kind)).toEqual(['negative-axis', 'positive-axis', 'outer-arc']);
    const arc = c.segments.at(-1)!; expect(arc.points[64].source.re).toBeCloseTo(10, 12); expect(arc.points[64].source.im).toBeCloseTo(0, 12);
    const mapped = arc.points[64].response; if (mapped.kind === 'value') { expect(mapped.value.re).toBeCloseTo(1 / 33, 12); expect(mapped.value.im).toBeCloseTo(0, 12); }
    // Signed area is negative for the clockwise RHP source boundary.
    const area = c.points.reduce((sum, p, i) => { const next = c.points[(i + 1) % c.points.length].source; return sum + p.source.re * next.im - next.re * p.source.im; }, 0);
    expect(area).toBeLessThan(0); expect(c.points.length).toBeLessThanOrEqual(1200);
  });
  it('preserves real-coefficient conjugacy and changed first-order/feedthrough results', () => {
    const c = baseline(); for (const w of [.1, .7, 2, 9]) { const a = atFrequency(c, w).bode, b = atFrequency(c, -w).bode; if (a.kind === 'value' && b.kind === 'value') { expect(a.value.re).toBeCloseTo(b.value.re, 12); expect(a.value.im).toBeCloseTo(-b.value.im, 12); } }
    const first = construct(parse('1'), parse('s+1'), 5, .1), r = atFrequency(first, 1).bode; if (r.kind === 'value') expect(r.value).toEqual({ re: .5, im: -.5 });
    const feedthrough = construct(parse('2s+3'), parse('s+1'), 5, .1); expect(textR(feedthrough.outerLimit)).toBe('2'); expect(feedthrough.decayOrder).toBe(0);
  });
  it('maps a simple-origin indentation with the correct orientation and unbounded limit', () => {
    const c = construct(parse('1'), parse('s'), 5, .1); expect(c.axisPoles).toHaveLength(1); expect(c.axisPoles[0].unboundedOrder).toBe(1);
    const arc = c.segments.find(s => s.kind === 'indent')!;
    expect(arc.points[0].source.im).toBe(-.1); expect(arc.points.at(-1)!.source.im).toBe(.1);
    const center = arc.points[32].response; if (center.kind === 'value') { expect(center.value.re).toBeCloseTo(10, 12); expect(center.value.im).toBeCloseTo(0, 12); }
    const cursor = atFrequency(c, 0); expect(cursor.indented).toBe(true); expect(cursor.contourPoint.source.re).toBe(.1); expect(cursor.bode.kind).toBe('undefined');
    expect(c.points.every(p => p.response.kind === 'value')).toBe(true);
  });
  it('counts repeated-origin and paired-axis factors exactly, without clustering roots', () => {
    const repeated = construct(parse('1'), parse('s^2'), 5, .1); expect(repeated.axisPoles[0].multiplicity).toBe(2); expect(repeated.axisPoles[0].unboundedOrder).toBe(2);
    const middle = repeated.segments.find(s => s.kind === 'indent')!.points[32].response; if (middle.kind === 'value') expect(middle.value.re).toBeCloseTo(100, 10);
    const pair = construct(parse('1'), parse('s^2+1'), 5, .1); expect(pair.axisPoles.map(p => p.frequency)).toEqual([-1, 1]); expect(pair.segments.filter(s => s.kind === 'indent')).toHaveLength(2);
    const mapped = atFrequency(pair, 1).contourPoint.response;
    if (mapped.kind === 'value') { expect(mapped.value.re).toBeCloseTo(.01 / (.0001 + .04), 12); expect(mapped.value.im).toBeCloseTo(-.2 / (.0001 + .04), 12); }
    expect(construct(parse('1'), parse('s(s^2+4)'), 5, .1).axisPoles.map(p => p.frequency)).toEqual([-2, 0, 2]);
  });
  it('retains removable original denominator points and labels finite extensions explicitly', () => {
    const c = construct(parse('s'), parse('s'), 5, .1); expect(c.axisPoles[0].multiplicity).toBe(1); expect(c.axisPoles[0].numeratorOrder).toBe(1); expect(c.axisPoles[0].unboundedOrder).toBe(0); expect(c.axisPoles[0].extension).toEqual({ re: 1, im: 0 });
    expect(atFrequency(c, 0).bode.kind).toBe('undefined'); expect(c.points.every(p => p.response.kind === 'value' && Math.abs(p.response.value.re - 1) < 1e-12)).toBe(true);
    const zero = construct(parse('0', true), parse('s'), 5, .1); expect(zero.axisPoles[0].numeratorOrder).toBeNull(); expect(zero.axisPoles[0].extension).toEqual({ re: 0, im: 0 });
    const zeroFrequency = atFrequency(zero, 1).bode; expect(zeroFrequency.kind).toBe('value'); if (zeroFrequency.kind === 'value') { expect(zeroFrequency.magnitude).toBe(0); expect(zeroFrequency.phase).toBeNull(); expect(zeroFrequency.db).toBeNull(); }
  });
  it('explicitly includes pole and zero frequencies in the sampled Bode list', () => {
    const poles = construct(parse('1'), parse('s^2+2'), 5, .1); const singular = frequencySamples(poles).find(x => x.frequency === Math.sqrt(2))!; expect(singular.response.kind).toBe('undefined');
    const zeros = construct(parse('s^2+2'), parse('(s+1)^3'), 5, .1); const z = frequencySamples(zeros).find(x => x.frequency === Math.sqrt(2))!; expect(z.response.kind).toBe('value'); if (z.response.kind === 'value') expect(z.response.phase).toBeNull();
  });
  it('keeps axis roots outside a finite contour explicit and distinguishes LHP/RHP outer collisions', () => {
    const outside = construct(parse('1'), parse('s^2+4'), 1, .1); expect(outside.outsideAxis.map(p => p.frequency)).toEqual([-2, 2]); expect(outside.segments.some(s => s.kind === 'indent')).toBe(false);
    expect(() => construct(parse('1'), parse('(s-1)(s+2)'), 1, .1)).toThrow(/outer semicircle/);
    expect(() => construct(parse('1'), parse('(s+1)(s+2)'), 2, .1)).not.toThrow();
    expect(() => construct(parse('1'), parse('s^2+1'), 1, .1)).toThrow(/endpoint/);
    expect(() => construct(parse('1'), parse('s(s+.01)'), 1, .1)).toThrow(/another denominator/);
  });
  it('validates dimensions, finite bounds and cursor work', () => {
    expect(() => validateModel(parse('s^2'), parse('s+1'))).toThrow(/proper/); expect(() => validateModel(parse('1'), parse('s^4+1'))).toThrow(/degree/);
    expect(() => construct(parse('1'), parse('s'), 0, .1)).toThrow(/radius/); expect(() => construct(parse('1'), parse('s'), 1, .3)).toThrow(/R\/4/);
    expect(() => atFrequency(baseline(), 11)).toThrow(/within/); expect(() => response(baseline().model, { re: Infinity, im: 0 })).toThrow(/finite/);
  });
});
describe('CP05 carried-forward visual argument boundaries', () => {
  it.each(['\\frac1\u20092','s^\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left\left\,2}`,String.raw`\frac1{\left2\;}`])('protects original argument tokens in %s',source=>expect(()=>parse(source)).toThrow(/box/));
  it('retains true braced Unicode arguments and visible fences',()=>{
    expect(parse('\\frac1{\u20092}').map(textR)).toEqual(['1/2']);expect(parse('s^{\u20092}').map(textR)).toEqual(['0','0','1']);expect(parse(String.raw`\frac1{\left(\;2\right)}`).map(textR)).toEqual(['1/2']);
  });
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`2^\;2`, String.raw`2\frac12`, 's{+1}', 's^12', '1e-2'])('rejects ambiguous/incomplete input%s', value => expect(() => parse(value)).toThrow());
  it('retains proper boxed spacing, compact fractions and signed powers', () => {
    expect(parse(String.raw`\frac1{\;2}`).map(textR)).toEqual(['1/2']); expect(parse(String.raw`2^{\;2}`).map(textR)).toEqual(['4']); expect(parse(String.raw`\frac12`).map(textR)).toEqual(['1/2']); expect(parse('2^{-2}').map(textR)).toEqual(['1/4']);
  });
  it('does not infer imaginary-axis poles from approximate near matches', () => {
    const exact = validateModel(parse('1'), parse('s^3+2s^2+3s+6')), near = validateModel(parse('1'), parse('s^3+2s^2+3s+6.001'));
    expect(imaginaryPoles(exact).map(p => p.frequency)).toEqual([-Math.sqrt(3), Math.sqrt(3)]); expect(imaginaryPoles(near)).toEqual([]);
  });
});
