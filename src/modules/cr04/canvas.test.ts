import{describe,expect,it,vi}from'vitest';
import{baseline}from'./model';
import{drawDiagram}from'./canvas';
import{positioned}from'./editor';
describe('structured diagram and caller-owned selection lifetime',()=>{
  it('paints positions without changing port connectivity and exposes keyboard selection',()=>{
    const graph=baseline(),life=new AbortController(),select=vi.fn(),nudge=vi.fn(),drawing=drawDiagram(graph,{id:'cr04-test',title:'Current diagram',signal:life.signal,select,nudge});
    const node=drawing.svg.querySelector('[data-node-id="g1"]')!;node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));expect(select).toHaveBeenCalledWith('g1');node.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));expect(nudge).toHaveBeenCalledWith('g1',80,0);
    const count=drawing.svg.querySelectorAll('.cr04-wire').length;drawing.paint(positioned(graph,'g1',520,270),'g1');expect(node.getAttribute('transform')).toBe('translate(520,270)');expect(drawing.svg.querySelectorAll('.cr04-wire')).toHaveLength(count);expect(graph.nodes.find(n=>n.id==='g1')!.x).toBe(420);
    life.abort();node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));expect(select).toHaveBeenCalledTimes(1);
  });
  it('marks the actual candidate changes, removed nodes and unconnected ports',()=>{
    const graph=baseline(),g={...graph,nodes:graph.nodes.map(n=>n.id==='g1'?{...n,inputs:[{...n.inputs[0],source:null}]}:n)},d=drawDiagram(g,{id:'cr04-readonly',title:'Candidate diagram',changed:['e2'],removed:['h2']});
    expect(d.svg.querySelector('.cr04-wire.unconnected')).not.toBeNull();expect(d.svg.querySelector('[data-node-id="e2"]')!.classList.contains('redefined')).toBe(true);expect(d.svg.querySelector('[data-node-id="h2"]')!.classList.contains('removed')).toBe(true);expect(d.svg.querySelector('[role="button"]')).toBeNull();expect(d.element.querySelector('[role="region"]')!.getAttribute('tabindex')).toBe('0');expect(d.svg.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});
