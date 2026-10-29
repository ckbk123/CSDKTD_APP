import {describe,expect,it} from 'vitest';
import {parsePlant,parseScalar,parseTarget} from './parser';
describe('bounded plant and desired-polynomial visual notation',()=>{
  it.each([String.raw`G(s)=\frac1{(s+1)(s+2)}`,'1/((s+1)(s+2))',String.raw`\frac{2}{2s^2+6s+4}`,String.raw`\frac{1\,}{s^{\,2}+3s+2}`])('normalizes the course plant %s',s=>expect(parsePlant(s)).toEqual({b:1,a1:3,a0:2}));
  it('preserves signed compact outer/nested fractions',()=>{expect(parsePlant(String.raw`(-\frac{\frac12}{s^2+3s+2})`)).toEqual({b:-.5,a1:3,a0:2});expect(parseScalar(String.raw`\frac 1 2`)).toBe(.5);});
  it('expands actual quadratic/cubic/quartic target powers and products',()=>{
    expect(parseTarget('(s+2)(s+4)',2)).toEqual([1,6,8]);expect(parseTarget('(s+1)^3',3)).toEqual([1,3,3,1]);expect(parseTarget('(s+17)(s+2)^3',4)).toEqual([1,23,114,212,136]);
    expect(parseTarget(String.raw`s^{4}+23s^3+\frac{228}{2}s^2+212s+136`,4)).toEqual([1,23,114,212,136]);
    expect(parseTarget(String.raw`s^ 2+\frac{1\,}{2}s+8`,2)).toEqual([1,.5,8]);
  });
  it.each([String.raw`\frac1\,2`,String.raw`\frac\,12`,String.raw`s^\,2+3s+2`,String.raw`\frac{1}{s^\;2+3s+2}`])('rejects unbraced spacing-atom arguments: %s',s=>{expect(()=>parseTarget(s,2)).toThrow();expect(()=>parsePlant(s)).toThrow();});
  it.each(['s^12+3s+2','s^02+3s+2','s^-2+3s+2','s^{2}2+3s+2','s^2+1e-2','s^2+2\\frac12s+2','s^2+1{+2}','{s+1}(s+2)','s^5+1','s^2+1/s','s^2+1/0','2s^2+3s+2','0^0s^2+3s+2',''])('rejects ambiguous, unsupported or nonmonic target %s',s=>expect(()=>parseTarget(s,2)).toThrow());
  it.each([String.raw`\frac{s+1}{s^2+3s+2}`,String.raw`\frac1{s+1}`,String.raw`\frac1{s^3+1}`,'exp(-s)/(s^2+1)','1/','',String.raw`\frac1{2\frac12s^2+3s+2}`])('rejects unsupported plant %s',s=>expect(()=>parsePlant(s)).toThrow());
});
