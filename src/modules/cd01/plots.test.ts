import{afterEach,expect,it,vi}from'vitest';
import{signalPlot}from'./plots';
afterEach(()=>vi.restoreAllMocks());
it('moves a nearest-sample cursor without changing or interpolating the original signal data',()=>{
  const times=[0,.5,1],series=[{name:'Output',values:[0,.25,1],style:'pid-current'}],before=JSON.stringify(series),p=signalPlot('Output',times,series,0),path=p.element.querySelector('path')!.getAttribute('d');
  p.select(1);expect(p.element.querySelector('path')!.getAttribute('d')).toBe(path);expect(Number(p.element.querySelector('.pid-marker')!.getAttribute('cx'))).toBe(300);expect(JSON.stringify(series)).toBe(before);
  vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,width:600}as DOMRect);expect(p.fromEvent(300)).toBe(1);expect(p.fromEvent(590)).toBe(2);expect(p.element.querySelectorAll('svg text')).toHaveLength(0);expect(p.element.querySelectorAll('.pid-y-axis span')).toHaveLength(3);
});
it('keeps fixed vertical axes and explicitly reports requirement guides outside that view',()=>{
  const p=signalPlot('Effort',[0,1],[{name:'Selected',values:[24,2],style:'pid-current'}],0,{low:0,high:30},[{value:100,label:'effort limit'}]);
  expect(p.element.textContent).toContain('Outside this fixed view: effort limit');expect(p.element.querySelector('.pid-guide')).toBeNull();expect([...p.element.querySelectorAll('.pid-y-axis span')].map(n=>n.textContent)).toEqual(['30','15','0']);
});
