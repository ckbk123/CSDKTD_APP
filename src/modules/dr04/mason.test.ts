import { describe, expect, it } from 'vitest';
import { Work, coefficients, constant, div, evaluate, latex, q, same } from './algebra';
import { baseline, disjoint, parsed } from './fixtures';
import { parseGain } from './input';
import { analyze, numericCheck, sharedNodes, solveEquations, trace, validate, type Net } from './mason';
const equivalent = (value: ReturnType<typeof parseGain>, text: string) => expect(same(value, parseGain(text), new Work())).toBe(true);

describe('bounded exact gain algebra and notation', () => {
  it('reduces rational polynomial identities exactly', () => {
    equivalent(parseGain(String.raw`\frac{(z+1)(z+2)}{(z+1)(z+3)}`), String.raw`\frac{z+2}{z+3}`);
    expect(coefficients(parseGain(String.raw`\frac{.5}{z+.25}`))).toEqual({ numerator: ['2'], denominator: ['1', '4'] });
    expect(latex(parseGain(String.raw`\frac{1}{z^2+5z+5}`))).toBe(String.raw`\frac{1}{z^{2}+5z+5}`);
  });
  it.each([String.raw`\frac12`, String.raw`\frac{1}2`, String.raw`\frac1{2}`, String.raw`\frac{1}{2}`, String.raw`(\frac12)`, String.raw`\left(\frac12\right)`])('preserves compact fraction %s', text => equivalent(parseGain(text), '.5'));
  it('supports explicit products, numeric subfractions, unary signs and proper powers', () => {
    equivalent(parseGain(String.raw`-\frac{1}{z+2}`), String.raw`\frac{-1}{z+2}`);
    equivalent(parseGain(String.raw`2\times\frac{1}{z+2}`), String.raw`\frac{2}{z+2}`);
    equivalent(parseGain(String.raw`\frac{\frac12}{z+1}`), String.raw`\frac{.5}{z+1}`);
    equivalent(parseGain(String.raw`\frac{1}{(z+1)^2}`), String.raw`\frac{1}{z^2+2z+1}`);
    equivalent(parseGain(String.raw`\frac{1}{z^{2}\times2+z+1}`), String.raw`\frac{1}{2z^2+z+1}`);
    equivalent(parseGain(String.raw`\frac{2^2}{z+1}`), String.raw`\frac{4}{z+1}`);
  });
  it.each(['', 'NaN', '1e-2', 'Infinity', '1{+2}', '{z+2}z', 'z', String.raw`\frac{1}{z^3}`, String.raw`\frac{1}{0}`, String.raw`2\frac12`, String.raw`2\,\frac12`, String.raw`(2)\frac12`, String.raw`\frac1\,2`, String.raw`\frac{1}{z^\,2+1}`, String.raw`\frac{1}{z^(2)+1}`, String.raw`2^12`, String.raw`2^{12}`, String.raw`\frac{1}{z^22+1}`, '0.'+'0'.repeat(24)+'1', '9'.repeat(49), '1/'.repeat(130)])('rejects unsupported or misleading %s', text => expect(() => parseGain(text)).toThrow());
  it('bounds arithmetic and division', () => {
    expect(() => q(1n, 0n)).toThrow(/zero/); expect(() => q(2n ** 2050n)).toThrow(/size limit/);
    expect(() => div(constant(1n), constant(0n), new Work())).toThrow(/Singular/);
    expect(() => parseGain('1+2+3')).not.toThrow();
    expect(() => same(constant(1n), constant(1n), new Work(0))).toThrow(/work limit/);
    expect(() => evaluate(parseGain(String.raw`\frac1{z+1}`), { re: -1, im: 0 })).toThrow(/pole/);
  });
  it.each(['1 2', String.raw`1\,2`, '1.2.3', String.raw`\frac{1}{z^{2}2+1}`, '0^0', '(z-z)^0', '0^{-0}', '(z-z)^{-0}', String.raw`\frac{0^{-0}}{z+1}`])('rejects ambiguous adjacency or undefined power %s', value => expect(() => parseGain(value)).toThrow());
  it.each([
    ['2^{-0}', ['1'], ['1']],
    ['2^{-1}', ['1'], ['2']],
    ['(-2)^{-3}', ['-1'], ['8']],
    ['z^{-2}', ['1'], ['0', '0', '1']],
    ['0^2', ['0'], ['1']],
  ] as const)('preserves the defined power %s', (value, numerator, denominator) => {
    expect(coefficients(parseGain(value))).toEqual({ numerator, denominator });
  });
});

describe('Mason and original signal equations', () => {
  it('derives the course nested loops independently', () => {
    // y=G2(G1(r-y)-2y) => y/r=1/[(z+1)(z+2)+2(z+1)+1].
    const net = parsed(baseline()), a = analyze(net);
    expect(a.paths.map(p => p.edges)).toEqual([['b1', 'b2', 'b3']]);
    expect(a.loops).toHaveLength(2); expect(a.sets).toHaveLength(2);
    expect(sharedNodes(a.loops[0], a.loops[1]).sort()).toEqual(['x', 'y']);
    equivalent(a.transfer, String.raw`\frac1{z^2+5z+5}`);
    expect(coefficients(a.transfer)).toEqual({ numerator: ['1'], denominator: ['5', '5', '1'] });
    expect(a.cofactors.every(g => same(g, constant(1n), new Work()))).toBe(true);
    expect(numericCheck(net, a, { re: 0, im: 0 }).direct.re).toBeCloseTo(.2, 14);
    expect(numericCheck(net, a, { re: 0, im: 2 }).mason).toEqual(expect.objectContaining({ re: expect.closeTo(1 / 101, 12), im: expect.closeTo(-10 / 101, 12) }));
  });
  it('recomputes changed sensor gain and selected output channel', () => {
    const d = baseline(); d.branches[3].value = '-3'; const net = parsed(d);
    equivalent(analyze(net).transfer, String.raw`\frac1{z^2+6z+6}`);
    net.target = 'x'; equivalent(analyze(net).transfer, String.raw`\frac{z+2}{z^2+6z+6}`);
  });
  it('uses a changed quadratic gain entered with real fraction/power controls', () => {
    // y=G2(G1(r-y)-2y), G1=1/(z+1)^2 => denominator (z+1)^2(z+4)+1.
    const d = baseline(); d.branches[1].value = String.raw`\frac{1}{z^2+2z+1}`;
    expect(coefficients(analyze(parsed(d)).transfer)).toEqual({ numerator: ['1'], denominator: ['5', '9', '6', '1'] });
  });
  it('includes all pair and triple terms with distinct path cofactors', () => {
    // a=1+a/2=>2; b=a+b/3=>3; c=b+c/4=>4; y=c+2=6.
    // Delta=(1-1/2)(1-1/3)(1-1/4)=1/4; direct path cofactor=1/4.
    const net = parsed(disjoint()), a = analyze(net);
    expect(a.paths).toHaveLength(2); expect(a.loops).toHaveLength(3);
    expect(a.sets.map(z => z.loops.length).sort()).toEqual([1, 1, 1, 2, 2, 2, 3]);
    equivalent(a.delta, '.25'); equivalent(a.cofactors[0], '1'); equivalent(a.cofactors[1], '.25'); equivalent(a.transfer, '6');
    expect(numericCheck(net, a, { re: 1, im: 3 }).direct.re).toBeCloseTo(6, 13);
    const solved = solveEquations(net, new Work());
    equivalent(solved.get('a')!, '2'); equivalent(solved.get('b')!, '3'); equivalent(solved.get('c')!, '4');
  });
  it('counts parallel branches and cycle rotations once, keeps signs', () => {
    const net: Net = { nodes: ['r', 'a', 'y'], source: 'r', target: 'y', branches: [
      { id: 'p', from: 'r', to: 'a', gain: constant(1n) }, { id: 'q', from: 'r', to: 'a', gain: constant(2n) },
      { id: 'f', from: 'a', to: 'y', gain: constant(3n) }, { id: 'h', from: 'y', to: 'a', gain: constant(-1n) },
    ] };
    const a = analyze(net); expect(a.loops).toHaveLength(1); expect(a.paths).toHaveLength(2); equivalent(a.transfer, '2.25');
    const first = trace(net, ['f', 'h'], 'loop'), rotated = trace(net, ['h', 'f'], 'loop');
    expect(first.nodes.sort()).toEqual(rotated.nodes.sort());
    expect(() => trace(net, ['p', 'h'], 'path')).toThrow(/connected/);
    expect(() => trace(net, ['p', 'f', 'h'], 'path')).toThrow(/without repeating/);
    expect(() => trace(net, ['f'], 'loop')).toThrow(/close/);
  });
  it('returns zero with no path, but rejects a singular internal network', () => {
    const d = baseline(); d.branches[0].value = '0'; const net = parsed(d); equivalent(analyze(net).transfer, '0');
    expect(() => trace(net, ['b1', 'b2', 'b3'], 'path')).toThrow(/zero/);
    const trip = disjoint(); trip.branches[5].value = '1'; expect(() => analyze(parsed(trip))).toThrow(/singular/);
  });
  it('reports boundary numeric singularities even when the network transfer cancels', () => {
    const net: Net = { nodes: ['r', 'a', 'y'], source: 'r', target: 'y', branches: [
      { id: 'p', from: 'r', to: 'y', gain: constant(1n) }, { id: 'h', from: 'a', to: 'a', gain: parseGain(String.raw`\frac1{z+1}`) },
    ] };
    const a = analyze(net); equivalent(a.transfer, '1');
    expect(() => numericCheck(net, a, { re: 0, im: 0 })).toThrow(/singular/);
    expect(numericCheck(net, a, { re: 1, im: 0 }).direct.re).toBe(1);
  });
  it('validates graph resources, endpoints and the imposed input', () => {
    const net = parsed(baseline()); expect(() => analyze(net, 0)).toThrow(/work limit/);
    expect(() => validate({ ...net, nodes: [...net.nodes, 'r'] })).toThrow(/distinct/);
    expect(() => validate({ ...net, source: 'y' })).toThrow(/different/);
    expect(() => validate({ ...net, source: 'e' })).toThrow(/incoming/);
    expect(() => validate({ ...net, branches: [...net.branches, net.branches[0]] })).toThrow(/distinct/);
    expect(() => numericCheck(net, analyze(net), { re: 101, im: 0 })).toThrow(/100/);
  });
  it('stops real over-limit path and non-touching-set enumerations without partial answers', () => {
    const nodes = ['r', 'a', 'b', 'c', 'd', 'e', 'y'], branches: Net['branches'] = [];
    const counts = [3, 3, 3, 3, 2, 2];
    counts.forEach((count, i) => { for (let j = 0; j < count; j++) branches.push({ id: `p${i}${j}`, from: nodes[i], to: nodes[i + 1], gain: constant(1n) }); });
    expect(() => analyze({ nodes, branches, source: 'r', target: 'y' })).toThrow(/128.*paths|128-path/);
    const self: Net['branches'] = [];
    counts.forEach((count, i) => { for (let j = 0; j < count; j++) self.push({ id: `l${i}${j}`, from: nodes[i + 1], to: nodes[i + 1], gain: constant(1n, 10n) }); });
    expect(() => analyze({ nodes, branches: self, source: 'r', target: 'y' })).toThrow(/256.*sets/);
  });
  it('keeps exact near-singular algebra distinct from a reliable numeric check', () => {
    const net: Net = { nodes: ['r', 'a', 'b', 'y'], source: 'r', target: 'y', branches: [
      { id: 'p', from: 'r', to: 'a', gain: constant(1n) }, { id: 'f', from: 'a', to: 'b', gain: parseGain('.999999') }, { id: 'h', from: 'b', to: 'a', gain: parseGain('1.000001') }, { id: 'o', from: 'b', to: 'y', gain: constant(1n) },
    ] };
    const a = analyze(net); expect(coefficients(a.transfer)).toEqual({ numerator: ['999999000000'], denominator: ['1'] });
    expect(() => numericCheck(net, a, { re: 0, im: 0 })).toThrow(/poorly conditioned/);
  });
});
