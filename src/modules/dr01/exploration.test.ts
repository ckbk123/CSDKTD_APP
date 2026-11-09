import {describe,expect,it,vi}from'vitest';
import * as original from './math';
import {inspectSequence,sequenceBaseline,sequenceTrial}from'./exploration';

describe('sequence exploration through the original bounded engines',()=>{
  it('preserves independent geometric, delayed alternating and initial-memory fixtures',()=>{
    const baseline=sequenceTrial(sequenceBaseline());[1,.8,.64,.512,.4096].forEach((value,k)=>expect(baseline.rows[k].value).toBeCloseTo(value,12));
    const changed=sequenceTrial({...sequenceBaseline(),gain:2,pole:-.5,delay:2,count:8});expect(changed.rows.map(r=>r.value)).toEqual([0,0,2,-1,.5,-.25,.125,-.0625]);
    const history=sequenceTrial({...sequenceBaseline(),history1:2});expect(history.model).toEqual(baseline.model);expect(history.zero).toEqual(baseline.zero);
    [2.6,2.08,1.664].forEach((v,k)=>expect(history.rows[k].value).toBeCloseTo(v,12));
    const inspected=inspectSequence(history,0);expect(inspected.old).toEqual([{index:-1,value:2,weight:.8,product:1.6}]);expect(inspected.row.value).toBe(2.6);
  });
  it('keeps moving sum/average different and publishes full precision through the original parser',()=>{
    const sum=sequenceTrial({...sequenceBaseline(),kind:'sum',length:4,delay:2,count:8});expect(sum.rows.map(r=>r.value)).toEqual([0,0,1,1,1,1,0,0]);expect(sum.atOne).toBe(4);
    const average=sequenceTrial({...sequenceBaseline(),kind:'average',length:3});expect(average.rows.slice(0,4).map(r=>r.value)).toEqual([1/3,1/3,1/3,0]);expect(average.atOne).toBe(1);
    expect(original.parseTransform(average.expression)).toEqual(average.model);expect(average.expression).toContain('0.3333333333333333');
  });
  it('caches only a period change and inspection, while source data always invokes the original full calculation',()=>{
    const trial=sequenceTrial(sequenceBaseline()),run=vi.spyOn(original,'samples');
    try{
      for(let k=0;k<16;k++)expect(inspectSequence(trial,k).time).toBe(k*.1);
      const timed=sequenceTrial({...sequenceBaseline(),period:.25},trial);expect(timed.rows).toBe(trial.rows);expect(timed.zero).toBe(trial.zero);expect(inspectSequence(timed,3).time).toBe(.75);expect(run).not.toHaveBeenCalled();
      const changed=sequenceTrial({...timed.draft,pole:-.8},timed);expect(run).toHaveBeenCalledTimes(2);expect(changed.rows[1].value).toBe(-.8);
    }finally{run.mockRestore();}
  });
  it('keeps snapshots immutable and rejects unsupported edits atomically without changing prior memory',()=>{
    const draft=sequenceBaseline(),trial=sequenceTrial(draft);draft.pole=-.8;expect(trial.draft.pole).toBe(.8);
    expect(()=>sequenceTrial({...trial.draft,kind:'sum',delay:12,length:4},trial)).toThrow('last nonzero');expect(trial.rows[1].value).toBe(.8);
    expect(()=>sequenceTrial({...trial.draft,pole:10,count:64},trial)).toThrow('numerical bound');
    expect(()=>sequenceTrial({...trial.draft,pole:1e-13},trial)).toThrow('10⁻¹²');expect(()=>sequenceTrial({...trial.draft,period:0},trial)).toThrow('Sample period');
    expect(()=>inspectSequence(trial,.5)).toThrow('integer');expect(()=>inspectSequence(trial,16)).toThrow('integer');expect(Object.isFrozen(trial.rows[0].feedback)).toBe(true);
  });
  it('distinguishes a convergent exterior sum from algebraic evaluation and singular DC',()=>{
    const stable=sequenceTrial(sequenceBaseline());expect(stable.convergentSum).toBe(true);expect(stable.atOne).toBeCloseTo(5,12);
    const alternating=sequenceTrial({...sequenceBaseline(),pole:-1});expect(alternating.atOne).toBe(.5);expect(alternating.convergentSum).toBe(false);
    const constant=sequenceTrial({...sequenceBaseline(),pole:1});expect(constant.atOne).toBeNull();expect(constant.convergentSum).toBe(false);
    const tiny=sequenceTrial({...sequenceBaseline(),pole:0,gain:0});expect(tiny.rows.every(r=>r.value===0)).toBe(true);expect(tiny.atOne).toBe(0);
  });
});
