import { validateDiagram, type Diagram, type Node as DiagramNode } from './model';
const ns='http://www.w3.org/2000/svg';
const svgElement=<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>,text?:string)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;};
export interface CanvasOptions {
  title:string;id:string;selected?:string;focus?:readonly string[];changed?:readonly string[];removed?:readonly string[];added?:readonly string[];
  signal?:AbortSignal;select?:(id:string)=>void;nudge?:(id:string,dx:number,dy:number)=>void;startDrag?:(id:string,event:PointerEvent,group:SVGGElement)=>void;
}
export interface Drawing { readonly element:HTMLElement;readonly svg:SVGSVGElement;paint:(graph:Diagram,selected?:string)=>void }
const radius=(n:DiagramNode)=>n.kind==='sum'?Math.max(27,n.inputs.length*9):n.kind==='junction'?9:0;
const halfWidth=(n:DiagramNode)=>n.kind==='block'?70:n.kind==='sum'||n.kind==='junction'?radius(n):35;
const input=(n:DiagramNode,i:number)=>{const dy=n.kind==='sum'?(i-(n.inputs.length-1)/2)*16:0;return{x:n.x-(n.kind==='sum'?Math.sqrt(radius(n)**2-dy**2):halfWidth(n)),y:n.y+dy};};

/** Layout is schematic; explicit port sources alone determine connectivity. */
export function drawDiagram(graph:Diagram,options:CanvasOptions):Drawing {
  validateDiagram(graph,false);
  const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=options.title;figure.append(caption);
  const region=document.createElement('div');region.className='cr04-canvas-scroll';region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label',`${options.title}; scroll horizontally if needed`);figure.append(region);
  const interactive=!!options.select&&!!options.signal,svg=svgElement('svg',{viewBox:'-90 -60 1680 1020',preserveAspectRatio:'none',role:interactive?'group':'img','aria-label':`${options.title}: blocks, signed input ports and explicit junctions; crossings do not connect.`});region.append(svg);
  const defs=svgElement('defs',{}),marker=svgElement('marker',{id:options.id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto'});marker.append(svgElement('path',{d:'M0,0 L10,5 L0,10 Z',fill:'context-stroke'}));defs.append(marker);svg.append(defs);
  const wires:{owner:string;index:number;path:SVGPathElement;question:SVGTextElement}[]=[],groups=new Map<string,SVGGElement>();
  for(const n of graph.nodes)for(let i=0;i<n.inputs.length;i++){
    const path=svgElement('path',{'marker-end':`url(#${options.id})`,fill:'none'}),question=svgElement('text',{'class':'cr04-missing'},'?');svg.append(path,question);wires.push({owner:n.id,index:i,path,question});
  }
  for(const n of graph.nodes){
    const group=svgElement('g',{'data-node-id':n.id});groups.set(n.id,group);svg.append(group);
    const title=svgElement('title',{},`${n.label}: ${n.kind}`);group.append(title);
    if(interactive&&n.kind==='junction')group.append(svgElement('circle',{cx:0,cy:0,r:30,fill:'transparent',stroke:'none','pointer-events':'all'}));
    if(n.kind==='block')group.append(svgElement('rect',{x:-70,y:-30,width:140,height:60,rx:5,'class':'cr04-shape'}));
    else if(n.kind==='sum'||n.kind==='junction')group.append(svgElement('circle',{cx:0,cy:0,r:radius(n),'class':'cr04-shape'}));
    else group.append(svgElement('rect',{x:-35,y:-21,width:70,height:42,rx:n.kind==='source'?20:5,'class':'cr04-shape'}));
    if(n.kind==='sum')group.append(svgElement('text',{x:8,y:9,'text-anchor':'middle','class':'cr04-sigma'},'Σ'));
    const label=svgElement('text',{x:0,y:n.kind==='sum'||n.kind==='junction'?-radius(n)-14:7,'text-anchor':'middle','class':'cr04-node-name'},n.label);group.append(label);
    for(let i=0;i<n.inputs.length;i++){const p=input({...n,x:0,y:0},i);group.append(svgElement('circle',{cx:p.x,cy:p.y,r:3.8,'class':'cr04-port'}));if(n.kind==='sum')group.append(svgElement('text',{x:p.x+12,y:p.y+5,'text-anchor':'middle','class':'cr04-port-sign'},n.inputs[i].sign<0?'−':'+'));}
    if(n.kind!=='junction'&&graph.nodes.some(other=>other.inputs.some(p=>p.source===n.id)))group.append(svgElement('circle',{cx:halfWidth(n),cy:0,r:3.8,'class':'cr04-takeoff'}));
    if(interactive){group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label',`Select ${n.label}, ${n.kind}`);
      group.addEventListener('click',()=>options.select!(n.id),{signal:options.signal});
      group.addEventListener('pointerdown',event=>options.startDrag?.(n.id,event,group),{signal:options.signal});
      group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();options.select!(n.id);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const step=event.shiftKey?80:20;options.nudge?.(n.id,event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0);}},{signal:options.signal});
    }
  }
  const paint=(current:Diagram,selected=options.selected??'')=>{
    const byId=new Map(current.nodes.map(n=>[n.id,n]));
    for(const [id,group]of groups){const n=byId.get(id)!;group.setAttribute('transform',`translate(${n.x},${n.y})`);group.setAttribute('class',`cr04-node ${n.kind}${interactive?' interactive':''}${selected===id?' selected':''}${options.focus?.includes(id)?' motif':''}${options.changed?.includes(id)?' redefined':''}${options.removed?.includes(id)?' removed':''}${options.added?.includes(id)?' added':''}`);if(interactive)group.setAttribute('aria-pressed',String(selected===id));}
    for(const wire of wires){const owner=byId.get(wire.owner)!,port=owner.inputs[wire.index],end=input(owner,wire.index),source=port.source?byId.get(port.source):undefined;
      const start=source?{x:source.x+halfWidth(source)+4,y:source.y}:{x:end.x-110,y:end.y};
      wire.path.setAttribute('d',`M${start.x},${start.y} C${start.x+70},${start.y} ${end.x-76},${end.y} ${end.x-6},${end.y}`);
      wire.path.setAttribute('class',`cr04-wire${source?'':' unconnected'}${selected===owner.id||selected===port.source?' selected':''}`);
      wire.question.setAttribute('x',String(start.x-15));wire.question.setAttribute('y',String(start.y+6));wire.question.setAttribute('visibility',source?'hidden':'visible');
    }
  };
  paint(graph);return{element:figure,svg,paint};
}
