import { describe, expect, it } from 'vitest';
import { modelFromText } from './model';
import { parsePolynomial } from './parser';
import { exactText } from './rational';
import { mapAt, winding } from './winding';

describe('DS05 independent complete-contour integration fixtures',()=>{
  // Q=D+N is chosen from known factors: CCW W=Z_inside-P_inside,
  // equivalently Z_out=P_out-W, with retained equal degree.
  it.each([
    {n:'.5',d:'z-1.2',w:1,p:1,z:0},
    {n:'-1.2',d:'z-.2',w:-1,p:0,z:1},
    {n:'2.1z-1.62',d:'(z-1.2)(z-1.4)',w:2,p:2,z:0},
    {n:'-2.1z+1.62',d:'(z-.2)(z-.3)',w:-2,p:0,z:2},
    {n:'.3(z-1.2)',d:'(z-1.2)(z-.5)',w:0,p:1,z:1},
    {n:'0',d:'z-.2',w:0,p:0,z:0},
  ])('checks signed winding and retained root counts %#',({n,d,w,p,z})=>{
    const model=modelFromText(n,d),result=winding(model);expect(result.kind).toBe('checked');expect(result.winding).toBe(w);expect(model.openRoots.outside).toBe(p);expect(model.closedRoots.outside).toBe(z);expect(p-result.winding!).toBe(z);
    if(n.startsWith('.3'))expect(model.cancelledRoots.outside).toBe(1);
  });
  it('maps the complete two-pole example with independent real and imaginary values',()=>{
    const model=modelFromText('2.1z-1.62','(z-1.2)(z-1.4)'),atOne=mapAt(model,0),atJ=mapAt(model,Math.PI/2);
    expect(atOne.loop!.re).toBeCloseTo(6,11);expect(atOne.returnDifference!.re).toBeCloseTo(7,11);
    expect(atJ.loop!.re).toBeCloseTo((-1.62*.68-2.1*2.6)/(.68**2+2.6**2),12);expect(atJ.loop!.im).toBeCloseTo((2.1*.68-1.62*2.6)/(.68**2+2.6**2),12);
  });
  it('does not assert an ordinary count at a boundary or after bounded-work failure',()=>{
    expect(winding(modelFromText('1','z^2+1')).kind).toBe('boundary');
    const limited=winding(modelFromText('.5','z-1.1'),{arcChecks:128,depth:0});expect(limited.kind).toBe('unresolved');expect(limited.winding).toBeUndefined();
    expect(()=>modelFromText('-z+.3','z-.8')).toThrow(/not well posed|singular/);
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s',s=>expect(()=>parsePolynomial(s)).toThrow(/blank space cannot fill a box/));
  it('retains boxed fractions and visible polynomial factors',()=>{
    expect(parsePolynomial(String.raw`\frac1{\;2}`).map(exactText)).toEqual(['1/2']);expect(parsePolynomial('(z-.2)(z-.3)').map(exactText)).toEqual(['3/50','-1/2','1']);
  });
});
