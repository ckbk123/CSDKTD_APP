import { describe, expect, it } from 'vitest';
import { parseOde, parseTransfer } from './parser';

describe('CR03 bounded visual transfer grammar', () => {
  it('protects the shared ODE notation path and retains a proper fraction box',()=>{
    expect(()=>parseOde("y''+\\frac1\u20092y=u")).toThrow(/box/);
    expect(parseOde("y''+\\frac1{\u20092}y=u")).toEqual({numerator:[1],denominator:[1,0,.5]});
  });
  it.each(['\\frac1\u20092','s^\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left\left\,2}`,String.raw`\frac1{\left2\;}`])('rejects changed TeX argument meaning before notation erasure in %s',source=>expect(()=>parseTransfer(source)).toThrow(/box/));
  it('retains true braced Unicode arguments and visible fences',()=>{
    expect(parseTransfer('\\frac1{\u20092}')).toEqual({numerator:[.5],denominator:[1]});
    expect(parseTransfer('\\frac1{s^{\u20092}+3s+2}')).toEqual({numerator:[1],denominator:[1,3,2]});
    expect(parseTransfer(String.raw`\frac1{\left(\;2\right)}`)).toEqual({numerator:[.5],denominator:[1]});
  });
  it.each([String.raw`G(s)=\frac1{s^2+3s+2}`,String.raw`\frac{1}{(s+1)(s+2)}`, '1/(s+1)/(s+2)',String.raw`\frac1{(s+1)\times(s+2)}`])('preserves equivalent baseline notation: %s', text => {
    expect(parseTransfer(text)).toEqual({ numerator: [1], denominator: [1, 3, 2] });
  });
  it('expands a changed numerator, rational sums and a biproper quotient', () => {
    expect(parseTransfer('(s+4)/(s^2+3s+2)')).toEqual({ numerator: [1, 4], denominator: [1, 3, 2] });
    expect(parseTransfer('1/(s+1)+1/(s+2)')).toEqual({ numerator: [2, 3], denominator: [1, 3, 2] });
    expect(parseTransfer('(2s^2+7s+9)/(s^2+3s+2)')).toEqual({ numerator: [2, 7, 9], denominator: [1, 3, 2] });
  });
  it('keeps signs, grouping and compact numeric fractions separate from multiplication', () => {
    for (const text of [String.raw`-\frac12`,String.raw`\left(-\frac12\right)`,String.raw`\frac{-1}2`,'-(-(-.5))']) expect(parseTransfer(text)).toEqual({ numerator: [-.5], denominator: [1] });
    for (const text of [String.raw`2\times\frac12`,String.raw`2(\frac12)`,String.raw`(\frac12)2`]) expect(parseTransfer(text)).toEqual({ numerator: [1], denominator: [1] });
    expect(parseTransfer(String.raw`2+\frac12`)).toEqual({ numerator: [2.5], denominator: [1] });
    expect(parseTransfer(String.raw`\frac12\times\frac12`)).toEqual({ numerator: [.25], denominator: [1] });
  });
  it('accepts numeric presentation wrappers and nested rational fractions', () => {
    expect(parseTransfer(String.raw`\frac{\mathrm{1}}{2}`)).toEqual({ numerator: [.5], denominator: [1] });
    expect(parseTransfer(String.raw`-\frac{\mathrm{1}}{\mathrm{2}}`)).toEqual({ numerator: [-.5], denominator: [1] });
    expect(parseTransfer(String.raw`\frac{\frac12}{s+1}`)).toEqual({ numerator: [.5], denominator: [1, 1] });
    expect(parseTransfer(String.raw`\frac1{\frac{s+1}{s+2}}`)).toEqual({ numerator: [1, 2], denominator: [1, 1] });
  });
  it.each([String.raw`2\frac12`,String.raw`(-2\frac12)`,String.raw`-\left(2\frac{1}2\right)`,String.raw`\frac{2\frac12}{3}`,String.raw`2\frac{\mathrm{1}}{2}`])('rejects ambiguous mixed-number adjacency: %s', text => {
    expect(() => parseTransfer(text)).toThrow(/mixed number/);
  });
  it.each(['1{+2}',String.raw`\frac1{{s+2}s}`,String.raw`\frac{{s+2}s}{(s+1)^2}`,'1{+2}/(s+1)'])('does not invent visible parentheses from formatting braces: %s', text => {
    expect(() => parseTransfer(text)).toThrow(/visible parentheses/);
  });
  it('preserves genuine fraction/power boxes and visible algebraic groups', () => {
    expect(parseTransfer('(1+2)/(s+1)')).toEqual({numerator:[3],denominator:[1,1]});
    expect(parseTransfer(String.raw`\frac1{(s+2)s}`)).toEqual({numerator:[1],denominator:[1,2,0]});
    expect(parseTransfer(String.raw`\frac1{s^{2}+3s+2}`)).toEqual({numerator:[1],denominator:[1,3,2]});
  });
  it('preserves actual powers of ten without interpreting raw e/E as programming literals', () => {
    expect(parseTransfer(String.raw`1\times10^{-2}`)).toEqual({ numerator: [.01], denominator: [1] });
    expect(parseTransfer('s^{-2}')).toEqual({ numerator: [1], denominator: [1, 0, 0] });
    for (const text of ['1e-2','1E2','e/(s+1)']) expect(() => parseTransfer(text)).toThrow(/visual e\/E/);
  });
  it('preserves TeX single-token exponent arguments instead of absorbing trailing digits', () => {
    expect(parseTransfer('10^02')).toEqual({ numerator: [2], denominator: [1] });
    expect(parseTransfer('10^{02}')).toEqual({ numerator: [100], denominator: [1] });
    expect(parseTransfer('1/(s^22+3s+2)')).toEqual({ numerator: [.5], denominator: [1, 1.5, 1] });
  });
  it('does not turn a displayed zero exponent into a fourth-order pole', () => {
    expect(parseTransfer(String.raw`\frac1{s^04}`)).toEqual({ numerator: [.25], denominator: [1] });
    expect(parseTransfer(String.raw`\frac1{s^42}`)).toEqual({ numerator: [.5], denominator: [1, 0, 0, 0, 0] });
  });
  it('rejects an unbraced signed power instead of inventing a larger exponent argument', () => {
    for (const text of ['s^-2','10^+2','s^(-2)']) expect(() => parseTransfer(text)).toThrow(/power box/);
    expect(parseTransfer(String.raw`10^{-2}`)).toEqual({ numerator: [.01], denominator: [1] });
  });
  it('retains nonminimal denominator factors rather than erasing state modes', () => {
    expect(parseTransfer('(s-1)/((s-1)(s+2))')).toEqual({ numerator: [1, -1], denominator: [1, 1, -2] });
    expect(parseTransfer('0/(s-1)')).toEqual({ numerator: [0], denominator: [1, -1] });
  });
  it.each(['','1/(s-s)','s+1','s^5','0^0','1/0','1/(s+1)^4/(s+2)^4/(s+3)','1/(s+1)+','sin(s)','G(z)=1','(1+2','1.2.3','\\frac1','\\sqrt{2}'])('rejects malformed, unsupported or excessive transfer data: %s', text => {
    expect(() => parseTransfer(text)).toThrow();
  });
  it('rejects floating-point underflow, overflow and excessive work before constructing a model', () => {
    expect(() => parseTransfer(`0.${'0'.repeat(330)}1`)).toThrow(/floating-point/);
    const small = `0.${'0'.repeat(199)}1`;
    expect(() => parseTransfer(`${small}*${small}`)).toThrow(/underflows/);
    expect(() => parseTransfer('1000000^4')).toThrow(/coefficient range/);
    expect(() => parseTransfer(`1${'+1'.repeat(130)}`)).toThrow(/tokens/);
    expect(() => parseTransfer('('.repeat(40) + '1' + ')'.repeat(40))).toThrow(/nested/);
    expect(() => parseTransfer('1'.repeat(601))).toThrow(/600/);
  });
});

describe('CR03 linear ODE grammar', () => {
  it.each(["y''+3y'+2y={1+2}u","{y''+y}2=u"])('rejects hidden grouping in an ODE instead of changing its meaning: %s', text => {
    expect(()=>parseOde(text)).toThrow(/visible parentheses/);
  });
  it.each(["y''+3y'+2y=u",String.raw`y^{\prime}^{\prime}+3y^{\prime}+2y=u`,String.raw`y^{\doubleprime}+3y^{\prime}+2y=u`,String.raw`\ddot{y}+3\dot{y}+2y=u`,'y″+3y′+2y=u'])('reads ordinary and actual MathLive derivative notation: %s', text => {
    expect(parseOde(text)).toEqual({ numerator: [1], denominator: [1, 3, 2] });
  });
  it('derives the changed input-derivative and biproper numerators', () => {
    expect(parseOde("y''+3y'+2y=u'+4u")).toEqual({ numerator: [1, 4], denominator: [1, 3, 2] });
    expect(parseOde("y''+3y'+2y=2u''+7u'+9u")).toEqual({ numerator: [2, 7, 9], denominator: [1, 3, 2] });
  });
  it('supports linear grouping, coefficient fractions and balanced terms on either side', () => {
    expect(parseOde("2(y''+3y'+2y)=2u")).toEqual({ numerator: [1], denominator: [1, 3, 2] });
    expect(parseOde(String.raw`\frac{y''+3y'+2y}2=\fracu2`)).toEqual({ numerator: [1], denominator: [1, 3, 2] });
    expect(parseOde("u+y''+3y'=2u-2y")).toEqual({ numerator: [1], denominator: [1, 3, 2] });
    expect(parseOde(String.raw`\frac12y''+1.5y'+y=\frac12u`)).toEqual({ numerator: [1], denominator: [1, 3, 2] });
    expect(parseOde('2+y=2+u')).toEqual({ numerator: [1], denominator: [1] });
  });
  it('supports fourth derivatives and static ODEs within the same proper convention', () => {
    expect(parseOde(String.raw`y^{(4)}+10y^{(3)}+35y''+50y'+24y=u`)).toEqual({ numerator: [1], denominator: [1, 10, 35, 50, 24] });
    expect(parseOde(String.raw`y^{\prime}^{\prime}^{\prime}^{\prime}+10y^{\prime}^{\prime}^{\prime}+35y^{\prime}^{\prime}+50y^{\prime}+24y=u`)).toEqual({ numerator: [1], denominator: [1, 10, 35, 50, 24] });
    expect(parseOde('2y=6u')).toEqual({ numerator: [3], denominator: [1] });
    expect(parseOde(String.raw`y=10^{-2}u`)).toEqual({ numerator: [.01], denominator: [1] });
  });
  it.each(["y''=u'''","y'''''=u",'y^2=u','y*u=u','y/u=u','y=2',"y''+3y'+2y=",'y=y','Y0=u','y=1e-2u',String.raw`y=2\frac12u`,'x=u'])('rejects nonlinear, improper, ambiguous or incomplete ODE %s', text => {
    expect(() => parseOde(text)).toThrow();
  });
});
