import { ONE, equalTF, latexTF, q, tf, type TF } from './algebra';
import { baseline, validateDiagram, type Diagram, type Node, type Port } from './model';

export function gainText(gain:TF):string {
  const text=latexTF(gain);if(text.length>600)throw new Error('This block gain exceeds the 600-character editor/display limit. Use simpler coefficients or a smaller local reduction.');return text;
}
export function checkEditable(graph:Diagram):void {
  validateDiagram(graph,false);
  if(!Number.isSafeInteger(graph.nextSerial)||graph.nextSerial<1||graph.nextSerial>100000)throw new Error('The visit has exhausted its node identity range. Reset the example.');
  const labels=graph.nodes.map(n=>n.label.toLowerCase());if(new Set(labels).size!==labels.length)throw new Error('Use distinct visible node labels. Rename the colliding node before applying this change.');
  graph.nodes.filter(n=>n.kind==='block').forEach(n=>gainText(n.gain));
}
export function editNode(graph:Diagram,id:string,patch:Pick<Node,'label'|'gain'|'x'|'y'|'inputs'>,newPorts=false):Diagram {
  const node=graph.nodes.find(n=>n.id===id);if(!node)throw new Error('Select an existing node.');
  if(['r','d','y'].includes(id)&&patch.label!==node.label)throw new Error('Keep the reference, disturbance and retained output labels.');
  const next={nodes:graph.nodes.map(n=>n.id===id?{...n,...patch}:n),nextSerial:graph.nextSerial+(newPorts?1:0)};checkEditable(next);return next;
}
export function positioned(graph:Diagram,id:string,x:number,y:number):Diagram {
  const next={...graph,nodes:graph.nodes.map(n=>n.id===id?{...n,x,y}:n)};checkEditable(next);return next;
}
export function addNode(graph:Diagram,kind:'block'|'sum'|'junction'):{graph:Diagram;id:string} {
  if(!['block','sum','junction'].includes(kind))throw new Error('Add a block, summer or explicit junction.');
  let serial=graph.nextSerial;while(graph.nodes.some(n=>n.id===`n${serial}`||n.label.toLowerCase()===`n${serial}`))serial++;
  if(serial>99999)throw new Error('Reset the example to start a new identity range.');
  const slots=[120,300,480,660,820].flatMap(y=>[120,350,580,810,1040,1270].map(x=>({x,y}))),position=slots.find(p=>graph.nodes.every(n=>Math.abs(n.x-p.x)>170||Math.abs(n.y-p.y)>110))??{x:120,y:820};
  const id=`n${serial}`,node:Node={id,label:`N${serial}`,kind,gain:ONE,inputs:[{id:`pn${serial}`,source:null,sign:1}],...position};
  const next={nodes:[...graph.nodes,node],nextSerial:serial+1};checkEditable(next);return{graph:next,id};
}
export function deleteNode(graph:Diagram,id:string):Diagram {
  if(['r','d','y'].includes(id))throw new Error('Keep r, d and the retained output Y.');
  if(!graph.nodes.some(n=>n.id===id))throw new Error('Select an existing node.');
  const next={...graph,nodes:graph.nodes.filter(n=>n.id!==id).map(n=>({...n,inputs:n.inputs.map(p=>p.source===id?{...p,source:null}:p)}))};checkEditable(next);return next;
}
export function nextPortId(graph:Diagram,draft:readonly Port[]):string {
  const used=new Set([...graph.nodes.flatMap(n=>n.inputs.map(p=>p.id)),...draft.map(p=>p.id)]);let i=1;while(used.has(`u${graph.nextSerial}p${i}`))i++;return`u${graph.nextSerial}p${i}`;
}
export function unchanged(a:Node,b:Node):boolean {
  return a.id===b.id&&a.label===b.label&&a.kind===b.kind&&a.x===b.x&&a.y===b.y&&equalTF(a.gain,b.gain)&&a.inputs.length===b.inputs.length&&a.inputs.every((p,i)=>p.id===b.inputs[i].id&&p.source===b.inputs[i].source&&p.sign===b.inputs[i].sign);
}
/** Caller-owned bounded history; diagrams are treated as immutable snapshots. */
export class History {
  private past:Diagram[]=[];
  private current:Diagram;
  constructor(graph:Diagram,private readonly limit=40){if(!Number.isInteger(limit)||limit<1||limit>40)throw new Error('History supports 1–40 snapshots.');checkEditable(graph);this.current=graph;}
  get graph(){return this.current;}
  get count(){return this.past.length;}
  commit(graph:Diagram){checkEditable(graph);this.past.push(this.current);if(this.past.length>this.limit)this.past.shift();this.current=graph;}
  undo():Diagram|null{const graph=this.past.pop();if(!graph)return null;this.current=graph;return graph;}
  clear(){this.past=[];}
}
export function fixture(kind:'nested'|'changed'|'series'|'parallel'):Diagram {
  if(kind==='nested'||kind==='changed')return baseline(kind==='changed'?3:2);
  const base=baseline(),sources=base.nodes.filter(n=>n.kind==='source'),output=base.nodes.find(n=>n.id==='y')!;
  const block=(id:string,pole:number,from:string,x:number,y:number):Node=>({id,label:id.toUpperCase(),kind:'block',gain:tf([q(1)],[q(pole),q(1)]),inputs:[{id:`p${id}`,source:from,sign:1}],x,y});
  const a=block('a',1,'r',400,220),b=block('b',2,kind==='series'?'a':'r',650,kind==='series'?220:400);
  if(kind==='series')return{nextSerial:10,nodes:[...sources,a,b,{...output,inputs:[{id:'py',source:'b',sign:1}]}]};
  const sum:Node={id:'s1',label:'S1',kind:'sum',gain:ONE,inputs:[{id:'psa',source:'a',sign:1},{id:'psb',source:'b',sign:-1},{id:'psd',source:'d',sign:1}],x:920,y:300};
  return{nextSerial:10,nodes:[...sources,a,b,sum,{...output,inputs:[{id:'py',source:'s1',sign:1}]}]};
}
