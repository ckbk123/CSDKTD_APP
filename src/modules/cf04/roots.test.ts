import { describe,it,expect } from 'vitest';
import { parseRational,rat,mul } from './algebra';
import { positiveRoots } from './roots';
const solve=(entries:string[])=>positiveRoots(entries.map(s=>parseRational(s,1e6)));
describe('exact positive-root counts with independently expanded fixtures',()=>{
  it.each([
    [['-6','11','-6','1'],[1,2,3]],
    [['-2','5','-4','1'],[1,2]],
    [['6','11','6','1'],[]],
    [['3','-1','-3','1'],[1,3]],
    [['2','-11','15'],[1/3,.4]],
    [['0','-1','1'],[1]],
    [['0','0','1'],[]],
    [['1.000000001','-2','1'],[]],
  ])('counts and isolates %s',(entries,expected)=>{
    const roots=solve(entries as string[]);expect(roots.count).toBe(expected.length);expect(roots.values).toHaveLength(expected.length);
    expected.forEach((x,i)=>expect(roots.values[i]).toBeCloseTo(x as number,10));
  });
  it('preserves counts under negative scaling and repeated-root removal',()=>{
    const coefficients=['-2','5','-4','1'].map(s=>mul(parseRational(s),rat(-1000000000000n)));
    const r=positiveRoots(coefficients);expect(r.count).toBe(2);expect(r.values[0]).toBeCloseTo(1,10);expect(r.values[1]).toBeCloseTo(2,10);
  });
  it('separates two close roots instead of using a sign-change sweep',()=>{
    const r=solve(['1.000000001','-2.000000001','1']);expect(r.count).toBe(2);expect(r.values[0]).toBeCloseTo(1,11);expect(r.values[1]).toBeCloseTo(1.000000001,11);
    expect(()=>solve(['1.000000000001','-2.000000000001','1'])).toThrow('too close');
  });
  it('keeps very small positive roots and excludes DC',()=>{
    const r=positiveRoots([rat(-1n,10000000000000000n),rat(1n)]);expect(r.count).toBe(1);expect(Math.abs(r.values[0]/1e-16-1)).toBeLessThan(1e-12);
  });
  it('reports unsupported degree and continuum rather than made-up isolated roots',()=>{
    expect(()=>solve(['0'])).toThrow('continuum');expect(()=>solve(['1','0','0','0','1'])).toThrow('degree');expect(solve(['3']).count).toBe(0);
  });
});
