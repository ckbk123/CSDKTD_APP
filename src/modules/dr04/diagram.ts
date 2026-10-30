import type { Net } from './mason';

/** Schematic geometry only; graph connectivity comes exclusively from endpoints. */
export function drawGraph(net: Net, edges: string[], nodes: string[], chosenNode: string): HTMLElement {
  const wrap = document.createElement('div'); wrap.className = 'dr04-scroll';
  wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Discrete signal-flow graph; scroll horizontally if needed');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 920 430'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Signal-flow graph; branch IDs identify the same signed block connections below. Use the branch and signal buttons to select.');
  const others = net.nodes.filter(n => n !== net.source && n !== net.target);
  const positions = new Map<string, { x: number; y: number }>([[net.source, { x: 70, y: 220 }], [net.target, { x: 850, y: 220 }]]);
  others.forEach((name, i) => positions.set(name, { x: 220 + i * (480 / Math.max(1, others.length - 1)), y: others.length < 3 ? 220 : i % 2 ? 280 : 150 }));
  const incident = (id: string) => { const b = net.branches.find(e => e.id === id)!; return chosenNode && (b.from === chosenNode || b.to === chosenNode); };
  let top = 0, bottom = 430;
  svg.innerHTML = '<defs><marker id="dr04-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>';
  net.branches.forEach((branch, index) => {
    const a = positions.get(branch.from)!, b = positions.get(branch.to)!, path = document.createElementNS(svg.namespaceURI, 'path'), text = document.createElementNS(svg.namespaceURI, 'text');
    let shape: string, tx: number, ty: number;
    const parallel = net.branches.slice(0, index).filter(e => e.from === branch.from && e.to === branch.to).length;
    if (branch.from === branch.to) { shape = `M ${a.x - 13} ${a.y - 14} C ${a.x - 95} ${a.y - 110 - parallel * 25}, ${a.x + 95} ${a.y - 110 - parallel * 25}, ${a.x + 13} ${a.y - 14}`; tx = a.x; ty = a.y - 90 - parallel * 20; top = Math.min(top, a.y - 140 - parallel * 25); }
    else {
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), ux = dx / distance, uy = dy / distance;
      const backward = dx < 0, bend = backward ? (index % 2 ? -135 : 135) : parallel ? 75 * parallel : 0;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 + bend;
      top = Math.min(top, cy - 30); bottom = Math.max(bottom, cy + 30);
      shape = `M ${a.x + 23 * ux} ${a.y + 23 * uy} Q ${cx} ${cy} ${b.x - 25 * ux} ${b.y - 25 * uy}`;
      tx = (a.x + b.x) / 2; ty = (a.y + b.y) / 2 + bend / 2 - 10;
    }
    const active = edges.includes(branch.id) || incident(branch.id);
    path.setAttribute('d', shape); path.setAttribute('class', active ? 'dr04-edge chosen' : 'dr04-edge'); path.setAttribute('marker-end', 'url(#dr04-arrow)');
    text.setAttribute('x', String(tx)); text.setAttribute('y', String(ty)); text.textContent = branch.id; text.setAttribute('class', active ? 'dr04-edge-label chosen' : 'dr04-edge-label');
    svg.append(path, text);
  });
  svg.setAttribute('viewBox', `0 ${top} 920 ${bottom - top}`);
  net.nodes.forEach(name => {
    const p = positions.get(name)!, circle = document.createElementNS(svg.namespaceURI, 'circle'), text = document.createElementNS(svg.namespaceURI, 'text');
    circle.setAttribute('cx', String(p.x)); circle.setAttribute('cy', String(p.y)); circle.setAttribute('r', '22'); circle.setAttribute('class', nodes.includes(name) || name === chosenNode ? 'dr04-node chosen' : 'dr04-node');
    text.setAttribute('x', String(p.x)); text.setAttribute('y', String(p.y + 5)); text.textContent = name; text.setAttribute('class', 'dr04-node-label'); svg.append(circle, text);
  });
  wrap.append(svg); return wrap;
}
