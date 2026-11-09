import{describe,expect,it}from'vitest';
import type{Point}from'./math';
import{clipTraceSegment,drawTrace,fitTrace,reduceTrace}from'./trace-plot';
const point=(t:number,value:number):Point=>({t,input:value,output:-value,comparator:value/2,physical:-value/2});
describe('sampled trace drawing preserves data and fixed-axis meaning',()=>{
  it('clips line intersections before pixel conversion, including opposite and subnormal scales',()=>{
    expect(clipTraceSegment({t:0,value:-2},{t:4,value:2},-1,1)).toEqual([{t:1,value:-1},{t:3,value:1}]);expect(clipTraceSegment({t:0,value:2},{t:1,value:3},-1,1)).toBeNull();
    const small=clipTraceSegment({t:0,value:-1e12},{t:1,value:1e12},-1e-300,1e-300)!;expect(small.flatMap(p=>[p.t,p.value]).every(Number.isFinite)).toBe(true);
  });
  it('preserves sampled peaks and endpoints when reducing the original trace',()=>{
    const points=Array.from({length:40001},(_,i)=>point(i/1000,i===12345?999:i===12346?-888:Math.sin(i/11))),reduced=reduceTrace(points,'input');
    expect(reduced[0]).toBe(points[0]);expect(reduced.at(-1)).toBe(points.at(-1));expect(reduced.some(p=>p.input===999)).toBe(true);expect(reduced.some(p=>p.input===-888)).toBe(true);expect(reduced.length).toBeLessThanOrEqual(2000);
  });
  it('updates only cached markers while fixed curves and source points remain intact',()=>{
    const points=Array.from({length:11},(_,i)=>point(i/10,i)),axes=fitTrace(points,['input','output'],1),plot=drawTrace(points,['input','output'],axes,307,'Active input and output'),curve=plot.svg.querySelector('[data-curve="input"]')!,d=curve.getAttribute('d');
    plot.update(7);expect(plot.selected).toBe(7);expect(plot.svg.querySelector('[data-curve="input"]')).toBe(curve);expect(curve.getAttribute('d')).toBe(d);expect(points[7].input).toBe(7);expect(plot.svg.getAttribute('viewBox')).toBe('0 0 307 250');
    const clipped=drawTrace(points,['input','output'],{end:1,low:-1e-300,high:1e-300},307,'Fixed tiny range');expect(clipped.svg.innerHTML).not.toMatch(/NaN|Infinity/);expect(clipped.svg.querySelectorAll('[data-bound]')).toHaveLength(2);expect(clipped.counts.input).toBe(10);
  });
});
