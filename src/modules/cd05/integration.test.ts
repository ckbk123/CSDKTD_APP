import { describe, expect, it } from 'vitest';
import { closedLoop, designLead, frequency, margins } from './frequency';
import { parseLead } from './input';
import { parseTransfer } from './parser';
import { stepResponse } from './response';

describe('CD05 independent integration checks',()=>{
  it('recovers the course crossover/phase from direct complex-factor magnitudes',()=>{
    const plant={k:1,a:2},lead={K:4,T:1/Math.sqrt(2),alpha:.5},result=margins(plant,lead);
    expect(result.omega).toBeCloseTo(2,12);expect(result.phaseMargin).toBeCloseTo(45+(Math.atan(Math.sqrt(2))-Math.atan(1/Math.sqrt(2)))*180/Math.PI,12);expect(frequency(plant,lead,2).loopDb).toBeCloseTo(0,12);
    expect(closedLoop(plant,lead).Kv).toBeCloseTo(2,14);
  });
  it('matches a changed target by independently derived peak-phase geometry',()=>{
    const p={k:2,a:3},designed=designLead(p,3,60),alpha=(1-Math.sin(Math.PI/12))/(1+Math.sin(Math.PI/12));
    expect(designed.lead.alpha).toBeCloseTo(alpha,13);expect(designed.lead.T).toBeCloseTo(1/(3*Math.sqrt(alpha)),13);expect(designed.lead.K).toBeCloseTo(3*Math.sqrt(18)*Math.sqrt(alpha)/2,12);
    expect(margins(p,designed.lead).omega).toBeCloseTo(3,12);expect(margins(p,designed.lead).phaseMargin).toBeCloseTo(60,11);
    expect(()=>designLead(p,.01,1)).toThrow(/No positive lead/);
  });
  it('retains the full characteristic and agrees with a constant-controller analytic response',()=>{
    const p={k:3,a:4},lead={K:2,T:.5,alpha:.25},model=closedLoop(p,lead);expect(model.denominator).toEqual([1,12,56,48]);expect(model.numerator).toEqual([0,0,24,48]);
    const result=stepResponse(p,{K:2,T:1,alpha:1},4);
    for(const point of result.points.filter((_,i)=>i%50===0)){const w=Math.sqrt(2),y=1-Math.exp(-2*point.t)*(Math.cos(w*point.t)+Math.sqrt(2)*Math.sin(w*point.t));expect(point.y).toBeCloseTo(y,10);expect(point.u).toBeCloseTo(2*(1-y),10);}
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s',s=>expect(()=>parseLead(s)).toThrow(/blank space cannot fill a box/));
  it('rejects undefined zero powers rather than inventing a unit controller',()=>{
    for(const s of ['0^0','(0)^{0}','(1-1)^0'])expect(()=>parseLead(s)).toThrow(/zeroth power/);
    expect(parseLead('2^0').K).toBe(1);expect(parseTransfer('0^2').b[0].n).toBe(0n);expect(parseLead(String.raw`\frac1{\;2}`).K).toBe(.5);
  });
});
