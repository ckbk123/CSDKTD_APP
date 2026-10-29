import { describe, expect, it } from 'vitest';
import { decimal, leadLatex, parseLead, parsePlant, plantLatex, validateLead, validatePlant } from './input';
import { parseTransfer } from './parser';
import { ONE, add, div, fromDecimal, fromNumber, rational, sub, toNumber } from './rational';

describe('CD05 exact transfer grammar and family extraction', () => {
  it.each(['1/(s(s+2))', 'G(s)=\\frac{1}{s(s+2)}', '\\frac1{s(s+2)}', '(2/2)/(s^2+2s)', '\\frac{1/2}{.5s^2+s}'])('extracts the source plant from %s', source => expect(parsePlant(source)).toEqual({ k: 1, a: 2 }));
  it('normalizes a changed positive plant exactly and retains its integrator', () => {
    expect(parsePlant('G(s)=6/(2s(s+4))')).toEqual({ k: 3, a: 4 });
    const exact = parseTransfer('(3s+6)/(2s+4)');
    expect(exact.a).toEqual([rational(1n), rational(2n)]);
    expect(exact.b).toEqual([rational(3n, 2n), rational(3n)]);
  });
  it('extracts the course rounded controller without rounded-monic ratio errors', () => {
    expect(parseLead('C(s)=4(1+.7071067812s)/(1+.3535533906s)')).toEqual({ K: 4, T: .7071067812, alpha: .5 });
    expect(parseLead('3(1+2s)/(1+.5s)')).toEqual({ K: 3, T: 2, alpha: .25 });
  });
  it.each(['4', 'C(s)=\\frac{8}{2}', '\\frac82', '4(1+s)/(1+s)', '.3(1+.1s)/(1+.1s)'])('recognizes constant/no-lead case %s', source => {
    const c = parseLead(source); expect(c.alpha).toBe(1); expect(c.T).toBe(source.startsWith('.3') ? .1 : 1);
    expect(c.K).toBe(source.startsWith('.3') ? .3 : 4);
  });
  it.each([
    ['\\frac12', .5], ['\\frac{1}2', .5], ['\\frac1{2}', .5], ['-\\frac{-1}2', .5],
    ['\\frac{\\frac12}{2}', .25], ['2+\\frac12', 2.5], ['2\\times\\frac12', 1], ['\\mathrm{2}+\\mathsf{3}', 5],
  ])('preserves visible numeric fraction semantics %s', (source, K) => expect(parseLead(source).K).toBe(K));
  it('keeps exact identities before extracting a small valid gain', () => {
    expect(parseLead('(100000+.1)^2-100000^2-20000')).toEqual({ K: .01, T: 1, alpha: 1 });
  });
  it.each([
    ['2\\frac12', /Mixed/], ['-2\\frac12', /Mixed/], ['\\frac{2\\frac12}{2}', /Mixed/],
    ['{s+2}s', /visible parentheses/], ['1{+2}', /invisible-group/], ['1e-2', /e\/E/],
    ['1E-2', /e\/E/], ['\\sin(s)', /Unsupported/], ['\\mathbf{s}', /Unsupported/],
    ['s^12', /power box/], ['s^{12}', /power box/], ['s^-2', /power box/], ['s^{0}2', /grouping/],
    ['1/(s^3+1)', /power box/], ['1/(s-s)', /zero/], ['s+1', /proper/], ['', /Enter/],
    ['1/(s(s+1)(s+2))', /order/], ['1000001', /entered/],
  ])('rejects malformed, unsupported or excessive notation %s', (source, expected) => expect(() => parseTransfer(source)).toThrow(expected));
  it.each(['1/(s+2)', '1/(s^2+2s+1)', '(s+1)/(s(s+2))', '-1/(s(s+2))', '1/(s(s-2))'])('rejects a plant outside the declared family %s', source => expect(() => parsePlant(source)).toThrow(/family/));
  it.each(['0', '-4', '.001', '1001'])('rejects constant controller gain %s', source => expect(() => parseLead(source)).toThrow(/gain/));
  it('identifies lag, unstable/nonminimum-phase and higher-order sections', () => {
    expect(() => parseLead('(1+s)/(1+2s)')).toThrow(/lag/);
    for (const source of ['(1-s)/(1+.5s)', '(1+s)/(1-.5s)', '1/(1+s)', '(1+s)/(1+s+s^2)']) expect(() => parseLead(source)).toThrow(/proper lead section/);
    expect(() => parseLead('(1+s)/(1+.001s)')).toThrow(/ratio/);
  });
  it('bounds source length, leading scale, normalized work and family ranges', () => {
    expect(() => parseTransfer('1'.repeat(513))).toThrow(/512/);
    expect(() => parseTransfer('1/(.000000001s+1)')).toThrow(/leading/);
    expect(() => parseTransfer('1000000/(.00000001s+1)')).toThrow(/Normalized/);
    expect(() => parsePlant('.001/(s(s+2))')).toThrow(/gain/);
    expect(() => parsePlant('1/(s(s+.01))')).toThrow(/rate/);
    expect(() => parseTransfer('('.repeat(21) + '1' + ')'.repeat(21))).toThrow(/20/);
  });
});

describe('CD05 native parameter alternatives and bounded rationals', () => {
  it('round-trips native parameters without combining a rounded alpha*T coefficient', () => {
    for (const alpha of [.02, .5, .9999999999999999]) for (const T of [.01, 1 / Math.sqrt(2), 10]) {
      const c = { K: 3.6, alpha, T }, source = leadLatex(c);
      expect(parseLead(source)).toEqual(c); expect(source).not.toMatch(/[eE]/);
    }
    expect(parsePlant(plantLatex({ k: .01, a: .1 }))).toEqual({ k: .01, a: .1 });
    expect(leadLatex({ K: 4, T: 2, alpha: 1 })).toBe('C(s)=4');
  });
  it('keeps native exponent notation separate from displayed algebraic e', () => {
    expect(decimal(.01)).toBe('0.01'); expect(decimal(1e-7)).toBe('0.0000001');
    expect(decimal(-1.2345e-7)).toBe('-0.00000012345'); expect(decimal(1e21)).toBe('1000000000000000000000');
    expect(() => decimal(Infinity)).toThrow(/finite/);
  });
  it('validates finite coupled family inputs', () => {
    expect(() => validatePlant({ k: NaN, a: 2 })).toThrow(/finite/);
    expect(() => validatePlant({ k: 1, a: 101 })).toThrow(/rate/);
    expect(() => validateLead({ K: 4, T: 0, alpha: .5 })).toThrow(/time/);
    expect(() => validateLead({ K: 4, T: 1, alpha: 1.01 })).toThrow(/ratio/);
    expect(() => validateLead({ K: Infinity, T: 1, alpha: .5 })).toThrow(/gain/);
  });
  it('separates exact decimal and binary values and rounds halfway ties correctly', () => {
    expect(sub(fromNumber(.1), fromDecimal('.1'))).toEqual(rational(1n, 180143985094819840n));
    const denominator = 1n << 53n;
    expect(toNumber(rational(denominator + 1n, denominator))).toBe(1);
    expect(toNumber(rational(denominator + 3n, denominator))).toBe(1 + 2 ** -51);
    expect(toNumber(fromNumber(Number.MIN_VALUE), Number.MIN_VALUE)).toBe(Number.MIN_VALUE);
    expect(toNumber(add(fromDecimal('.1'), fromDecimal('.2')))).toBe(.3);
    expect(() => div(ONE, rational(0n))).toThrow(/zero/);
    expect(() => rational(1n << 8192n)).toThrow(/8192/);
  });
});
