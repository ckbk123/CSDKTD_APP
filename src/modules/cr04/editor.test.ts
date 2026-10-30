import{describe,expect,it}from'vitest';
import{ONE,equalTF,q,tf}from'./algebra';
import{baseline,solveDiagram}from'./model';
import{addNode,checkEditable,deleteNode,editNode,fixture,History,nextPortId,positioned,unchanged}from'./editor';
import{operations,previewOperation}from'./operations';
describe('caller-owned block editor and bounded undo',()=>{
  it('retains both independently known channels through position changes and undo',()=>{
    const original=baseline(),history=new History(original),moved=positioned(original,'g1',520,270);history.commit(moved);
    const answer=solveDiagram(history.graph);expect(equalTF(answer.reference,tf([q(1)],[q(5),q(5),q(1)]))).toBe(true);expect(equalTF(answer.disturbance,tf([q(1),q(1)],[q(5),q(5),q(1)]))).toBe(true);
    expect(original.nodes.find(n=>n.id==='g1')!.x).toBe(420);expect(history.undo()).toBe(original);expect(history.undo()).toBeNull();
  });
  it('bounds history without sharing state between visits',()=>{
    const a=new History(baseline(),2),b=new History(baseline());for(const x of[500,600,700])a.commit(positioned(a.graph,'g1',x,220));expect(a.count).toBe(2);a.undo();expect(a.graph.nodes.find(n=>n.id==='g1')!.x).toBe(600);a.undo();expect(a.graph.nodes.find(n=>n.id==='g1')!.x).toBe(500);expect(b.count).toBe(0);expect(b.graph.nodes.find(n=>n.id==='g1')!.x).toBe(420);a.clear();expect(a.count).toBe(0);
  });
  it('creates an explicitly unconnected node and preserves dangling ports after deletion',()=>{
    const {graph,id}=addNode(baseline(),'block');expect(graph.nodes.find(n=>n.id===id)!.inputs[0].source).toBeNull();expect(()=>solveDiagram(graph)).toThrow(/Connect every/);
    const deleted=deleteNode(baseline(),'g1');expect(deleted.nodes.find(n=>n.id==='e2')!.inputs[0].source).toBeNull();expect(()=>solveDiagram(deleted)).toThrow(/Connect every/);expect(()=>deleteNode(baseline(),'y')).toThrow(/retained/);
  });
  it('checks labels, input positions, node limits and preserved channel identities',()=>{
    const graph=baseline(),g=graph.nodes.find(n=>n.id==='g1')!;expect(unchanged(g,{...g})).toBe(true);expect(unchanged(g,{...g,gain:ONE})).toBe(false);
    expect(()=>editNode(graph,'g1',{...g,label:'H2'})).toThrow(/distinct/);expect(()=>positioned(graph,'g1',NaN,220)).toThrow(/positions/);expect(()=>positioned(graph,'g1',1500,220)).toThrow(/positions/);
    let next=graph;for(let i=0;i<4;i++)next=addNode(next,'junction').graph;expect(()=>addNode(next,'sum')).toThrow(/twelve/);
    const p=nextPortId(graph,[]);expect(nextPortId(graph,[{id:p,source:null,sign:1}])).not.toBe(p);expect(()=>checkEditable({...graph,nextSerial:100001})).toThrow(/identity/);
  });
  it('independently verifies new series/parallel fixtures and all local channels',()=>{
    const series=fixture('series'),a=solveDiagram(series);expect(equalTF(a.reference,tf([q(1)],[q(2),q(3),q(1)]))).toBe(true);expect(equalTF(a.disturbance,tf([q(0)]))).toBe(true);
    const parallel=fixture('parallel'),b=solveDiagram(parallel);expect(equalTF(b.reference,tf([q(1)],[q(2),q(3),q(1)]))).toBe(true);expect(equalTF(b.disturbance,ONE)).toBe(true);
    for(const graph of[series,parallel]){const op=operations(graph).find(o=>o.kind===(graph===series?'series':'parallel'))!;expect(previewOperation(op).correct).toBe(true);}
  });
});
