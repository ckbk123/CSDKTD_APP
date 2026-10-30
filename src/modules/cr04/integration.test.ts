import { describe, expect, it } from 'vitest';
import { equalTF, q, tf } from './algebra';
import { baseline, solveDiagram } from './model';
import { operations, previewOperation } from './operations';
import { parseTransfer } from './parser';

describe('CR04 integrated exact core',()=>{
  it.each([0,4,7])('keeps independently derived nested reference/disturbance channels at H2=%s',h=>{
    const graph=baseline(h),solution=solveDiagram(graph),denominator=[q(3+h),q(3+h),q(1)];
    expect(equalTF(solution.reference,tf([q(1)],denominator))).toBe(true);expect(equalTF(solution.disturbance,tf([q(1),q(1)],denominator))).toBe(true);
    const reduction=operations(graph).find(op=>op.id==='feedback:e2:g2:h2')!;expect(equalTF(reduction.expected,tf([q(1)],[q(2+h),q(1)]))).toBe(true);expect(previewOperation(reduction).correct).toBe(true);
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s',s=>expect(()=>parseTransfer(s)).toThrow(/blank space cannot fill a box/));
  it('retains supported boxed fractions',()=>{
    expect(equalTF(parseTransfer(String.raw`\frac1{\;2}`),tf([q(1,2)]))).toBe(true);
    // The former blank-workspace assertion described the partial checkpoint.
    // The completed entry and resource lifetime are checked in workspace.test.ts.
  });
});
