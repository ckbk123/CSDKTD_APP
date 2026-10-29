import { describe, expect, it } from 'vitest';
import { equalTF, q, tf } from './algebra';
import { baseline, solveDiagram } from './model';
import { operations, previewOperation } from './operations';
import { parseTransfer } from './parser';
import { mount } from './workspace';

describe('CR04 inert partial core integration',()=>{
  it.each([0,4,7])('keeps independently derived nested reference/disturbance channels at H2=%s',h=>{
    const graph=baseline(h),solution=solveDiagram(graph),denominator=[q(3+h),q(3+h),q(1)];
    expect(equalTF(solution.reference,tf([q(1)],denominator))).toBe(true);expect(equalTF(solution.disturbance,tf([q(1),q(1)],denominator))).toBe(true);
    const reduction=operations(graph).find(op=>op.id==='feedback:e2:g2:h2')!;expect(equalTF(reduction.expected,tf([q(1)],[q(2+h),q(1)]))).toBe(true);expect(previewOperation(reduction).correct).toBe(true);
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s',s=>expect(()=>parseTransfer(s)).toThrow(/blank space cannot fill a box/));
  it('retains supported boxed fractions and leaves the student workspace blank',()=>{
    expect(equalTF(parseTransfer(String.raw`\frac1{\;2}`),tf([q(1,2)]))).toBe(true);
    const container=document.createElement('div'),controller=new AbortController();expect(mount({container,signal:controller.signal})).toBeUndefined();expect(container.children.length).toBe(0);controller.abort();
  });
});
