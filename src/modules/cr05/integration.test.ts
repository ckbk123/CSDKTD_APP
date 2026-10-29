import { describe, expect, it } from 'vitest';
import { Work, constant, same } from './algebra';
import { parseGain } from './input';
import { analyze, numericCheck, type Net } from './mason';

describe('CR05 independent Mason integration fixtures',()=>{
  it('retains two disjoint self-loops and distinct path cofactors',()=>{
    const net:Net={nodes:['R','A','B','Y'],source:'R',target:'Y',branches:[['rA','R','A','2'],['aY','A','Y','3'],['rB','R','B','5'],['bY','B','Y','7'],['aa','A','A','-.5'],['bb','B','B','.25']].map(([id,from,to,value])=>({id,from,to,gain:parseGain(value)}))};
    const result=analyze(net);expect(result.paths).toHaveLength(2);expect(result.loops).toHaveLength(2);expect(result.sets.filter(s=>s.loops.length===2)).toHaveLength(1);
    expect(same(result.delta,constant(9n,8n),new Work())).toBe(true);
    expect(same(result.transfer,constant(152n,3n),new Work())).toBe(true); // A=4/3, B=20/3, Y=3A+7B
    const path=result.paths.findIndex(p=>p.edges.includes('aY'));expect(same(result.cofactors[path],constant(3n,4n),new Work())).toBe(true);
    net.branches.push({id:'ab',from:'A',to:'B',gain:constant(1n)});const changed=analyze(net);expect(changed.paths).toHaveLength(3);expect(same(changed.transfer,constant(568n,9n),new Work())).toBe(true);
  });
  it('matches a hand-solved dynamic feedback equation and refuses an original branch pole',()=>{
    const net:Net={nodes:['R','A','Y'],source:'R',target:'Y',branches:[{id:'r',from:'R',to:'A',gain:constant(1n)},{id:'g',from:'A',to:'Y',gain:parseGain('1/(s+1)')},{id:'h',from:'Y',to:'A',gain:constant(-2n)}]};
    const result=analyze(net), point=numericCheck(net,result,{re:2,im:3}); // (s+1)Y=R-2Y
    expect(point.direct.re).toBeCloseTo(5/34,13);expect(point.direct.im).toBeCloseTo(-3/34,13);expect(point.difference).toBeLessThan(1e-13);
    expect(()=>numericCheck(net,result,{re:-1,im:0})).toThrow(/pole|singular/);
  });
  it.each([String.raw`\frac1\;2`,String.raw`\frac\,12`,'\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left(\left[2\right\;\right)}`])('preflights malformed argument %s',s=>expect(()=>parseGain(s)).toThrow(/blank space cannot fill a box/));
  it('keeps supported trailing spacing inside fraction boxes and normal products',()=>{
    expect(same(parseGain(String.raw`\frac{1\;}{2}`),constant(1n,2n),new Work())).toBe(true);
    expect(same(parseGain('2/(s+1)'),parseGain(String.raw`\frac2{s+1}`),new Work())).toBe(true);
  });
});
