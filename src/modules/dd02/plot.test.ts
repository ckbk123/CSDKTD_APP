import{describe,expect,it}from'vitest';
import{clip,plot,unitCircle}from'./plot';
describe('unit-circle and clipped locus display',()=>{
  it('preserves the actual circle in a narrow +1 view',()=>{const points=unitCircle({x:1,y:0,half:1e-4});expect(points).toHaveLength(161);for(const p of points)expect(Math.abs(p.x*p.x+p.y*p.y-1)).toBeLessThan(1e-14);expect(points.some(p=>p.x===1&&p.y===0)).toBe(true);});
  it('does not bridge unresolved root-locus samples',()=>{const e=plot('Locus',[{points:[{x:0,y:0},null,{x:.5,y:.5}],color:'purple'}],[]);const paths=[...e.querySelectorAll('path')];expect(paths.at(-1)!.getAttribute('d')).toBe('');expect(e.querySelector('svg')!.getAttribute('aria-label')).toBe('Locus');});
  it('clips each segment and labels narrow +1 views with an explicit coordinate offset',()=>{expect(clip({x:-2,y:0},{x:2,y:0},-1,1,-1,1)).toEqual([{x:-1,y:0},{x:1,y:0}]);for(const half of[.002,1e-6]){const e=plot('Zoom',[],[{x:1,y:0,shape:'pole'},{x:.999,y:0,shape:'zero'},{x:1,y:.0001,shape:'target'}],{x:1,y:0,half});expect(e.innerHTML).not.toMatch(/NaN|Infinity/);expect(e.textContent).toContain('Re(z)−1, dimensionless');expect(e.textContent).not.toMatch(/0\.99999/);}});
});
