import { describe, expect, it } from 'vitest';
import { aliasExperiment, decimalLiteral, inversePole, mapPole, modeSamples, parsePole, radialMovement } from './math';

describe('DP02 pole notation', () => {
  it.each([
    ['s=-2+3j', -2, 3], ['-2-3j', -2, -3], ['j', 0, 1], ['-j', 0, -1],
    ['0', 0, 0], ['0.0012+2j', 0.0012, 2],
    [String.raw`s=\left(-\frac{1}{2}+\frac{\pi}{2}\mathrm{j}\right)`, -0.5, Math.PI / 2],
    [String.raw`-2+3\times j`, -2, 3], ['-2+j(3/2)', -2, 1.5],
    [String.raw`-1\div2+4j`, -0.5, 4], ['−1÷2+4×j', -0.5, 4],
    ['0.' + '0'.repeat(299) + '1+j', 1e-300, 1], ['0+j', 0, 1],
    [String.raw`-\frac12+4j`, -0.5, 4], [String.raw`-\frac1{20}+j`, -0.05, 1],
    [String.raw`\frac{10}2+j\frac\pi2`, 5, Math.PI / 2],
    [String.raw`\frac1\frac23+j`, 1.5, 1],
  ])('parses %s', (input, real, imag) => expect(parsePole(input)).toEqual({ real, imag }));
  it.each(['', 's=', '1/0', 'NaN', 'Infinity', 'x+2j', 'j*j', '1/(1+j)', 'sin(2)',
    '2^3', '1..2', '2 3', '1+', '(1+2j', '1+2j)', '2=3', String.raw`\placeholder{}`, String.raw`\frac1`, String.raw`\frac{1}{}`, String.raw`\frac{1}{2`, '1e999', '1'.repeat(1025), '('.repeat(14) + '1' + ')'.repeat(14), Array(45).fill('1').join('+')])('rejects %s', input => {
    expect(() => parsePole(input)).toThrow();
  });
  const small = '0.' + '0'.repeat(199) + '1', large = '1' + '0'.repeat(200);
  it.each(['0.' + '0'.repeat(330) + '1+j', `${small}*${small}+j`, `${small}/${large}+j`, `${small}j/${large}`])('rejects silent numeric underflow in %s', input => {
    expect(() => parsePole(input)).toThrow(/too small to represent/);
  });
  it.each(['1e-2+3j', '1E-2+3j', '0e-999+j', '1.2e-3+2j'])('rejects visually algebraic exponent notation %s', input => {
    expect(() => parsePole(input)).toThrow(/visual field treats e and E as symbols/);
  });
  it('expands normal HTML numeric exponents without changing visual meaning', () => {
    expect(decimalLiteral(0.01)).toBe('0.01');
    expect(decimalLiteral(-1e-7)).toBe('-0.0000001');
    expect(decimalLiteral(1e-300)).toBe('0.' + '0'.repeat(299) + '1');
    expect(decimalLiteral(Number.MIN_VALUE)).toBe('0.' + '0'.repeat(323) + '5');
    expect(parsePole(`s=${decimalLiteral(1e-7)}+3j`)).toEqual({ real: 1e-7, imag: 3 });
    expect(() => decimalLiteral(NaN)).toThrow();
  });
});

describe('DP02 independent analytic fixtures', () => {
  it('matches Euler evaluation for the accepted baseline and conjugate', () => {
    // exp(-.2)(cos .3 + j sin .3), independently tabulated to 15 digits.
    const z = mapPole({ real: -2, imag: 3 }, 0.1);
    expect(z.radius).toBeCloseTo(0.818730753077982, 14);
    expect(z.real).toBeCloseTo(0.782163363184683, 14);
    expect(z.imag).toBeCloseTo(0.241951481349599, 14);
    expect(z.angle).toBeCloseTo(0.3, 14);
    expect(z.classification).toBe('decay');
    const conjugate = mapPole({ real: -2, imag: -3 }, 0.1);
    expect(conjugate.real).toBeCloseTo(z.real, 14);
    expect(conjugate.imag).toBeCloseTo(-z.imag, 14);
    const samples = modeSamples({ real: -2, imag: 3 }, 0.1, 4);
    expect(samples[0].value).toBe(1);
    expect(samples[1].value).toBeCloseTo(0.782163363184683, 14);
    expect(samples[2].value).toBeCloseTo(0.553239007381108, 14);
    expect(samples[4].time).toBe(0.4);
  });
  it('changes period by squaring the complex pole when T doubles', () => {
    const z = mapPole({ real: -2, imag: 3 }, 0.2);
    expect(z.radius).toBeCloseTo(0.670320046035639, 14);
    expect(z.real).toBeCloseTo(0.553239007381108, 14);
    expect(z.imag).toBeCloseTo(0.378491168759837, 14);
    expect(radialMovement({ real: -2, imag: 3 }, 0.1, 0.2)).toBe('inward');
    expect(radialMovement({ real: 2, imag: 3 }, 0.1, 0.2)).toBe('outward');
    expect(radialMovement({ real: 0, imag: 3 }, 0.1, 0.2)).toBe('unchanged');
    expect(radialMovement({ real: -2, imag: 3 }, 0.2, 0.1)).toBe('outward');
    expect(radialMovement({ real: Number.MIN_VALUE, imag: 0 }, 0.1, 0.2)).toBe('outward');
    expect(radialMovement({ real: -Number.MIN_VALUE, imag: 0 }, 0.1, 0.2)).toBe('inward');
  });
  it('negative-real z=-0.8 is decaying and alternating, not unstable', () => {
    const s = { real: Math.log(0.8) / 0.1, imag: Math.PI / 0.1 };
    const z = mapPole(s, 0.1);
    expect(z.real).toBeCloseTo(-0.8, 14);
    expect(z.imag).toBeCloseTo(0, 14);
    expect(z.classification).toBe('decay');
    const samples = modeSamples(s, 0.1, 4);
    [1, -0.8, 0.64, -0.512, 0.4096].forEach((value, i) => expect(samples[i].value).toBeCloseTo(value, 14));
  });
  it('inverse branches recover distinct frequencies mapping to one z', () => {
    const z = { real: 0, imag: 0.5 };
    const principal = inversePole(z, 0.25, 0);
    const other = inversePole(z, 0.25, -1);
    expect(principal.real).toBeCloseTo(-4 * Math.LN2, 13);
    expect(principal.imag).toBeCloseTo(2 * Math.PI, 13);
    expect(other.imag).toBeCloseTo(-6 * Math.PI, 13);
    expect(mapPole(other, 0.25).real).toBeCloseTo(0, 13);
    expect(mapPole(other, 0.25).imag).toBeCloseTo(0.5, 13);
    expect(inversePole({ real: -0.8, imag: -0 }, 0.1, 0).imag).toBeCloseTo(10 * Math.PI, 12);
  });
  it('aliases agree at every sample despite differing continuous frequencies', () => {
    const experiment = aliasExperiment({ real: -2, imag: 3 }, 0.1, 100);
    expect(experiment.alias.imag).toBeCloseTo(65.83185307179586, 12);
    expect(experiment.residual).toBeLessThan(1e-12);
    // Another fixture: j*pi/2 and j*5pi/2 both give 1,0,-1,0,1 at T=1.
    const values = modeSamples({ real: 0, imag: 5 * Math.PI / 2 }, 1, 4).map(p => p.value);
    [1, 0, -1, 0, 1].forEach((value, i) => expect(values[i]).toBeCloseTo(value, 13));
  });
  it('qualifies the unit circle and respects the radius tolerance', () => {
    expect(mapPole({ real: 0, imag: 2 }, 0.1).classification).toBe('boundary');
    expect(mapPole({ real: 1e-12, imag: 2 }, 0.1).classification).toBe('boundary');
    expect(mapPole({ real: 1e-6, imag: 2 }, 0.1).classification).toBe('growth');
    expect(mapPole({ real: -1e-6, imag: 2 }, 0.1).classification).toBe('decay');
  });
  it('bounds numerical work and rejects nonfinite or singular inputs', () => {
    for (const period of [0, -1, NaN, Infinity, 0.0001, 11]) expect(() => mapPole({ real: -2, imag: 3 }, period)).toThrow();
    for (const pole of [{ real: NaN, imag: 0 }, { real: 0, imag: Infinity }, { real: 1001, imag: 0 }, { real: 0, imag: 10001 }, { real: 3, imag: 0 }]) {
      expect(() => mapPole(pole, 10)).toThrow();
    }
    expect(() => mapPole({ real: 0, imag: 1000 }, 1)).toThrow(/phase/);
    expect(() => inversePole({ real: 0, imag: 0 }, 1, 0)).toThrow(/no finite/);
    for (const branch of [0.5, 6, NaN]) expect(() => inversePole({ real: 1, imag: 0 }, 1, branch)).toThrow();
    for (const n of [3, 101, 5.5, NaN]) expect(() => modeSamples({ real: -1, imag: 0 }, 1, n)).toThrow();
    expect(() => modeSamples({ real: 1, imag: 0 }, 1, 100)).toThrow(/Growth/);
    expect(modeSamples({ real: -20, imag: 0 }, 1, 100).every(p => Number.isFinite(p.value))).toBe(true);
  });
});
