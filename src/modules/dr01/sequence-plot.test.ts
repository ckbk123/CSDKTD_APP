import{describe,expect,it}from'vitest';
import{sequenceBaseline,sequenceTrial}from'./exploration';
import{drawSequence,fitSequence,sequenceGeometry}from'./sequence-plot';
describe('bounded responsive sequence geometry',()=>{
  it('maps sample indices linearly at actual phone width and keeps a 44px onset target',()=>{
    const trial=sequenceTrial(sequenceBaseline()),axes=fitSequence(trial),plot=drawSequence(trial,3,axes,307),g=plot.geometry;
    expect(g.width).toBe(307);expect(g.x(2)-g.x(1)).toBeCloseTo(g.x(15)-g.x(14),12);expect(g.sample(g.x(12)+7,{left:7,width:307})).toBeCloseTo(12,12);
    const target=plot.svg.querySelector('.dr01-onset-target')!;expect(target.getAttribute('width')).toBe('44');expect(target.getAttribute('height')).toBe('44');
    const slider=plot.svg.querySelector('[data-onset]')!;expect(slider.getAttribute('role')).toBe('slider');expect(slider.getAttribute('aria-valuenow')).toBe('0');expect(slider.getAttribute('aria-valuemin')).toBe('0');expect(slider.getAttribute('aria-valuemax')).toBe('12');
    expect(plot.svg.querySelectorAll('.dr01-stem')).toHaveLength(16);expect(plot.svg.querySelectorAll('.dr01-zero')).toHaveLength(16);expect(plot.svg.querySelector('[data-onset]')?.getAttribute('tabindex')).toBe('0');
  });
  it('marks fixed-axis truncation explicitly and Fit includes every checked sample',()=>{
    const baseline=sequenceTrial(sequenceBaseline()),large=sequenceTrial({...sequenceBaseline(),gain:100});
    const fixed=drawSequence(large,0,fitSequence(baseline),375);expect(fixed.clipped).toBeGreaterThan(0);expect(fixed.svg.querySelectorAll('path.dr01-dot').length).toBe(fixed.clipped);
    const fitted=drawSequence(large,0,fitSequence(large),375);expect(fitted.clipped).toBe(0);expect(fitted.svg.querySelectorAll('circle.dr01-dot')).toHaveLength(16);
  });
  it('marks both boundaries when selected-history and zero-history samples exceed opposite fixed bounds',()=>{
    const axes=fitSequence(sequenceTrial(sequenceBaseline())),trial=sequenceTrial({...sequenceBaseline(),gain:100,history1:-1e6}),plot=drawSequence(trial,0,axes,375);
    expect(plot.svg.querySelector('[data-clipped="high"]')).not.toBeNull();expect(plot.svg.querySelector('[data-clipped="low"]')).not.toBeNull();expect(plot.clipped).toBeGreaterThan(0);
    expect(plot.svg.querySelectorAll('path.dr01-dot').length).toBeGreaterThan(plot.clipped);
  });
  it('keeps unseen delayed onsets visible without inventing future computed stems',()=>{
    const trial=sequenceTrial({...sequenceBaseline(),count:4,delay:12}),axes=fitSequence(trial),plot=drawSequence(trial,0,axes,307);
    expect(axes.last).toBe(15);expect(plot.svg.querySelectorAll('.dr01-stem')).toHaveLength(4);expect(Number(plot.svg.querySelector('.dr01-onset-target')?.getAttribute('x'))+44).toBeLessThan(307);
    expect(()=>sequenceGeometry(307,axes).sample(0,{left:0,width:0})).toThrow('measurable');
  });
});
