import { describe, expect, it } from 'vitest';
import { parseErrors } from './input';
import { calculate, derive, initialize, simulate } from './math';
import { editFutureError, errorDecimal } from './sequence';

const model = derive({ kp:4, ki:2, kd:1, period:.1, integral:'trapezoidal', derivative:'backward', tau:.1 });
const initial = {e0:0,eMinus1:0,i0:0,d0:0};
describe('DD04 bounded error-stem editing policy',()=>{
  it('changes the current input without mutating old memory or committing its independently known output',()=>{
    const errors=Object.freeze([1,1,1]),memory=Object.freeze(initialize(model,initial));
    const edited=editFutureError(errors,memory.k,1,.5),step=calculate(model,memory,edited.errors[0]);
    // P=2; I=.1*.5=.05; D=10*.5=5, hence u=7.05.
    expect(step.position).toBeCloseTo(7.05,14); expect(step.incremental).toBeCloseTo(7.05,14);
    expect(memory).toEqual({k:1,ePrev:0,eOlder:0,integral:0,derivative:0,output:0,delta:0});expect(errors).toEqual([1,1,1]);
    expect(parseErrors(edited.latex)).toEqual([.5,1,1]);
  });
  it('preserves committed history when a future error changes and retains exact calculation/commit timing',()=>{
    const first=calculate(model,initialize(model,initial),1),edited=editFutureError([1,1,1],first.next.k,2,-1);
    const second=calculate(model,first.next,edited.errors[1]);
    // At k=2: P=-4, I=.1-.1+.1=.1, D=10*(-1-1)=-20.
    expect(second.position).toBeCloseTo(-23.9,12);expect(first.position).toBeCloseTo(14.1,14);
    expect(first.next.k).toBe(2);expect(first.next.output).toBeCloseTo(14.1,14);
    expect(simulate(model,initial,edited.errors)[0]).toEqual(first);
    expect(()=>editFutureError(edited.errors,2,1,2)).toThrow('already committed');
  });
  it('keeps full round-trip digits rather than seven-digit display precision',()=>{
    const sequence=[1/3,-.5,1e-30],edited=editFutureError(sequence,1,2,.12345678901234567);
    expect(edited.errors).toEqual([1/3,.12345678901234567,1e-30]);expect(edited.latex).not.toMatch(/[eE]/);
    expect(Number(errorDecimal(1e-30))).toBe(1e-30);expect(Number(errorDecimal(-1e-7))).toBe(-1e-7);
  });
  it('rejects invalid selection, overflow and unrepresentable entry resources atomically',()=>{
    const original=Object.freeze([1,1]);
    expect(()=>editFutureError(original,1,0,2)).toThrow('actual error sample');
    expect(()=>editFutureError(original,1,1,10001)).toThrow('magnitude');
    expect(()=>editFutureError(original,1,1,Infinity)).toThrow('finite');
    expect(()=>editFutureError(original,1,1,1e-300)).toThrow('equation-entry limits');
    expect(original).toEqual([1,1]);expect(editFutureError(original,1,1,-10000).errors[0]).toBe(-10000);
  });
});
