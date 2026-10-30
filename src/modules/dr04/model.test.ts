import {describe,expect,it} from 'vitest';
import {Work,coefficients,constant,evaluate,latex,same} from './algebra';
import {parsed} from './fixtures';
import {parseGain} from './input';
import {analyze,numericCheck} from './mason';
import {causalUpdate,coefficientsFromIntegers,convert,samples,sourceDefault} from './model';
const baseline=()=>convert(sourceDefault());
describe('exact sampled boundaries and original physical delay',()=>{
  it('derives the declared source independently and retains the one-sample transport delay',()=>{
    const c=baseline(),net=parsed(c.graph),a=analyze(net);
    expect(c.m).toBe(1); expect(same(c.plant,parseGain('(z+1)/(10z(z-1)^2)','transfer'),new Work())).toBe(true);
    expect(coefficients(a.transfer)).toEqual({numerator:['-10','40','50'],denominator:['-1','4','55','-100','50']});
    expect(evaluate(a.transfer,{re:2,im:0}).re).toBeCloseTo(270/227,13);
    expect(a.paths).toHaveLength(1);expect(a.loops).toHaveLength(1);expect(causalUpdate(net,a)).toBe(true);
    expect(numericCheck(net,a,{re:2,im:0}).difference).toBeLessThan(1e-12);
    // Independent exact physical held-state recurrence, not the transfer recurrence.
    const y=[0,0,1,2.8,4.3,5.44,5.946,5.62],s=samples(a.transfer);
    s.impulse.forEach((v,k)=>expect(evaluate(v,{re:2,im:0}).re).toBeCloseTo(y[k],12));
    expect(s.step.map(latex)).toEqual(['0','0','1','\\frac{19}{5}','\\frac{81}{10}','\\frac{677}{50}','\\frac{9743}{500}','\\frac{12553}{500}']);
  });
  it.each([
    [{boundary:'split' as const},90/109,[0,0,0,2,3.6,5.2,6.4,6.96]],
    [{feedback:'positive' as const},270/173,[0,0,1,2.8,4.5,6.56,9.274,12.948]],
    [{tau:'0'},270/127,[0,1,2.7,3.85,4.419,4.2921,3.45947,2.025905]],
    [{T:'0.1'},270/1627,[0,0,0,.25,.7,1.1,1.49375,1.865]],
  ])('preserves changed topology/timing %j',(patch,at2,physical)=>{
    const c=convert({...sourceDefault(),...patch}),a=analyze(parsed(c.graph));
    expect(evaluate(a.transfer,{re:2,im:0}).re).toBeCloseTo(at2,13);
    samples(a.transfer).impulse.forEach((v,k)=>expect(evaluate(v,{re:2,im:0}).re).toBeCloseTo(physical[k],12));
  });
  it('does not multiply separately ZOH-converted integrators for a continuous cascade',()=>{
    const c=baseline();expect(same(c.whole,c.split,new Work())).toBe(false);
    expect(evaluate(c.whole,{re:2,im:0}).re).toBeCloseTo(.3);expect(evaluate(c.split,{re:2,im:0}).re).toBeCloseTo(.2);
    expect(same(convert({...sourceDefault(),boundary:'split'}).whole,c.whole,new Work())).toBe(true);
  });
  it.each([{T:'0'},{T:'2'},{g:'0'},{H:'-1'},{tau:'-0.2'},{tau:'0.3'},{tau:'0.6'},{c0:'1001'},{g:'z-z+5'},{T:'0.01+1/999999999'}])('rejects unsupported or ambiguous source data %j',patch=>expect(()=>convert({...sourceDefault(),...patch})).toThrow());
  it('keeps zero controller and open feedback meaningful',()=>{
    const zero=analyze(parsed(convert({...sourceDefault(),c0:'0',c1:'0'}).graph));expect(zero.paths).toHaveLength(0);expect(latex(zero.transfer)).toBe('0');
    expect(samples(zero.transfer).step.every(v=>latex(v)==='0')).toBe(true);
    const c=convert({...sourceDefault(),feedback:'open'}),a=analyze(parsed(c.graph));expect(a.loops).toHaveLength(0);expect(evaluate(a.transfer,{re:2,im:0}).re).toBeCloseTo(1.35);
  });
  it('round-trips derived editable gains at supported exact-fraction extremes',()=>{
    const c=convert({...sourceDefault(),g:'100/997',T:'1/99',tau:'2/99',H:'1/999999999',c0:'999/997',c1:'-1/999999999'});
    expect(c.m).toBe(2);expect(()=>parsed(c.graph)).not.toThrow();
  });
});
describe('new discrete grammar, formal transfers and causality',()=>{
  it('accepts delay powers and full feedback predictions but rejects advances in a branch',()=>{
    expect(latex(parseGain('10-2z^{-1}'))).toBe('\\frac{10z-2}{z}');
    const t=parseGain('(z^2+.8z-.2)/(z^4-2z^3+1.1z^2+.08z-.02)','transfer');
    expect(same(t,analyze(parsed(baseline().graph)).transfer,new Work())).toBe(true);
    expect(()=>parseGain('z')).toThrow(/proper/);expect(()=>parseGain('0^{-1}')).toThrow();
    expect(()=>parseGain('z/z','scalar')).toThrow(/constant/);expect(()=>parseGain('z^{-3}')).toThrow(/degree/);
  });
  it('withholds a direct causal update when instantaneous loop sums are singular',()=>{
    const net={nodes:['R','Y'],source:'R',target:'Y',branches:[{id:'b1',from:'R',to:'Y',gain:constant(1n)},{id:'b2',from:'Y',to:'Y',gain:parseGain('1-z^{-1}')}]};
    const a=analyze(net);expect(latex(a.transfer)).toBe('z');expect(causalUpdate(net,a)).toBe(false);expect(()=>samples(a.transfer)).toThrow(/improper/);
  });
  it('separates an exact result from a retained branch pole in the numeric audit',()=>{
    const net=parsed(baseline().graph),a=analyze(net);expect(()=>numericCheck(net,a,{re:1,im:0})).toThrow(/pole/);
    expect(coefficients(a.transfer).denominator).toHaveLength(5);
    expect(()=>samples(a.transfer,13)).toThrow(/12/);
    const raw=coefficientsFromIntegers([-10n,40n,50n],[-1n,4n,55n,-100n,50n]);expect(same(raw,a.transfer,new Work())).toBe(true);
  });
});
