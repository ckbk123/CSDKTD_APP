import{describe,expect,it,vi}from'vitest';
import*as original from'./math';
import{exactText}from'./rational';
import{errorBaseline,errorExperiment,inspectError,nearestErrorPoint}from'./exploration';
const finite=(value:original.Limit)=>{if(value.kind!=='finite')throw Error('Expected finite');return exactText(value.value);};
describe('error exploration through original exact and numerical computations',()=>{
  it('keeps independent exact baseline/gain/sensor/channel results and the actual sampled ramp trace',()=>{
    const baseline=errorExperiment(errorBaseline());expect(finite(baseline.limits.comparator)).toBe('1/2');expect(finite(errorExperiment({...errorBaseline(),gain:'8'}).limits.comparator)).toBe('1/4');
    const sensor=errorExperiment({...errorBaseline(),sensor:'2'});expect(finite(sensor.limits.comparator)).toBe('1/4');expect(sensor.limits.physical.kind).toBe('growth');if(sensor.limits.physical.kind==='growth')expect(sensor.limits.physical.polynomial.map(exactText)).toEqual(['1/8','1/2']);
    for(const point of baseline.run!.points.filter((_,i)=>i%37===0)){const expected=.5-.5*Math.exp(-point.t)*Math.cos(Math.sqrt(3)*point.t)+Math.exp(-point.t)*Math.sin(Math.sqrt(3)*point.t)/(2*Math.sqrt(3));expect(point.comparator).toBeCloseTo(expected,10);expect(point.output+point.physical).toBeCloseTo(point.input,12);}
    expect(finite(errorExperiment({...errorBaseline(),channel:'disturbance',order:0}).limits.physical)).toBe('-1');const noise=errorExperiment({...errorBaseline(),channel:'noise',order:0});expect(finite(noise.limits.comparator)).toBe('0');expect(finite(noise.limits.physical)).toBe('1');
  });
  it('retains full-loop stability separately from zero-source identities and a stable type-two design',()=>{
    const unstable=errorExperiment({...errorBaseline(),integrators:2});expect(unstable.model.stability.kind).toBe('unstable');expect(unstable.limits.comparator.kind).toBe('uncertified');
    const zero=errorExperiment({...errorBaseline(),integrators:2,amplitude:'0e-999'});expect(zero.model.stability.kind).toBe('unstable');expect(zero.limits.physical).toMatchObject({kind:'finite',reason:'zero-input'});expect(zero.run!.points.every(p=>p.output===0)).toBe(true);
    const stable=errorExperiment({...errorBaseline(),integrators:2,zeroEnabled:true,order:2});expect(stable.model.stability.kind).toBe('stable');expect(finite(stable.limits.physical)).toBe('1/2');
    expect(errorExperiment({...errorBaseline(),integrators:2,zeroEnabled:true,zero:'2'}).model.stability.kind).toBe('boundary');
  });
  it('caches selected-error and nearest-point inspection without rerunning any model or trace engine',()=>{
    const baseline=errorExperiment({...errorBaseline(),sensor:'2'}),run=vi.spyOn(original,'trace'),make=vi.spyOn(original,'makeModel');
    try{const physical=errorExperiment({...baseline.draft,error:'physical'},baseline);expect(physical.run).toBe(baseline.run);expect(physical.model).toBe(baseline.model);const sample=nearestErrorPoint(physical,1.234);expect(Math.abs(sample.point.t-1.234)).toBeLessThanOrEqual(physical.run!.interval/2);expect(sample.asymptote).toBeCloseTo(sample.point.t/2+1/8,12);expect(run).not.toHaveBeenCalled();expect(make).not.toHaveBeenCalled();
      errorExperiment({...physical.draft,horizon:5},physical);expect(run).toHaveBeenCalledOnce();expect(make).toHaveBeenCalledOnce();
    }finally{run.mockRestore();make.mockRestore();}
  });
  it('keeps the independently valid exact certificate when the numerical trace fails, without inventing cursor data',()=>{
    const run=vi.spyOn(original,'trace').mockImplementationOnce(()=>{throw Error('Transition could not converge');});
    try{const checked=errorExperiment(errorBaseline());expect(checked.traceError).toBe('Transition could not converge');expect(checked.run).toBeUndefined();expect(finite(checked.limits.comparator)).toBe('1/2');expect(checked.model.stability.kind).toBe('stable');expect(()=>inspectError(checked,0)).toThrow('No checked');}finally{run.mockRestore();}
  });
  it('preserves immutable previous data on original domain/underflow errors and uses the checked finite time window',()=>{
    const draft=errorBaseline(),checked=errorExperiment(draft);draft.gain='8';expect(checked.draft.gain).toBe('4');expect(Object.isFrozen(checked.run!.points[0])).toBe(true);
    for(const patch of[{gain:'51'},{pole:'.01'},{sensor:'0'},{zeroEnabled:true,zero:'.01'},{integrators:3},{amplitude:'1e-999'},{horizon:0}])expect(()=>errorExperiment({...checked.draft,...patch},checked)).toThrow();
    expect(finite(checked.limits.comparator)).toBe('1/2');expect(()=>nearestErrorPoint(checked,11)).toThrow('within the checked');expect(()=>inspectError(checked,.5)).toThrow('computed point');
  });
});
