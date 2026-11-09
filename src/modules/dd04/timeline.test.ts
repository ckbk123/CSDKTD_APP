import { describe, expect, it, vi } from 'vitest';
import { calculate, derive, initialize } from './math';
import { sampleTimeline } from './timeline';
const model=derive({kp:4,ki:2,kd:1,period:.1,integral:'trapezoidal',derivative:'backward',tau:.1}),initial=initialize(model,{e0:0,eMinus1:0,i0:0,d0:0});
describe('DD04 truthful input/committed-output timeline',()=>{
  it('keeps a fixed complete sample axis and draws no uncommitted output answers',()=>{
    const input={errors:[1,1,1,1,0,0],steps:[],error0:0,output0:0,period:.1,nextK:1,selectedInput:1,selectedOutput:0};
    const before=sampleTimeline(input);expect(before.error.svg.querySelectorAll('circle')).toHaveLength(7);expect(before.output.svg.querySelectorAll('circle')).toHaveLength(1);
    const after=sampleTimeline({...input,steps:[calculate(model,initial,1)],nextK:2});
    expect(after.output.svg.querySelectorAll('circle')).toHaveLength(2);expect(after.output.svg.querySelector('[data-sample-k="1"]')?.getAttribute('x1')).toBe('140');
    expect(before.error.svg.querySelector('[data-sample-k="1"]')?.getAttribute('x1')).toBe('140');expect(after.output.element.textContent).toContain('k=6\n0.6 s');
    expect(after.output.element.textContent).toContain('Blank future positions are not predicted outputs');
  });
  it('offers one selected future-input target and locks committed input history',()=>{
    const input={errors:[1,1],steps:[calculate(model,initial,1)],error0:0,output0:0,period:.1,nextK:2,selectedInput:1,selectedOutput:1};
    expect(sampleTimeline(input).error.element.querySelector('button')).toBeNull();
    const selected=sampleTimeline({...input,selectedInput:2});expect(selected.error.element.querySelectorAll('button')).toHaveLength(1);expect(selected.error.element.querySelector('button')?.getAttribute('aria-label')).toContain('e[2]=1');
    expect(selected.output.svg.querySelector('.pid-selected-sample')).not.toBeNull();
  });
  it('maps sample selection and values using the actual responsive signal rectangle',()=>{
    const drawing=sampleTimeline({errors:[1,1,1,1,0,0],steps:[],error0:0,output0:0,period:.1,nextK:1,selectedInput:1,selectedOutput:0}).error;
    vi.spyOn(drawing.svg,'getBoundingClientRect').mockReturnValue({left:100,top:20,width:240,height:180}as DOMRect);
    // k=3 lies halfway through six intervals; y=.5 has ordinate 110-88/3.
    expect(drawing.indexAt(220)).toBe(3);expect(drawing.valueAt(20+(110-88/3)*180/220)).toBeCloseTo(.5,14);
    expect(drawing.indexAt(NaN)).toBeUndefined();expect(drawing.valueAt(Infinity)).toBeUndefined();
  });
});
