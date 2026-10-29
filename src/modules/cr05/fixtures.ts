import { parseGain } from './input';
import type { Net } from './mason';
export type DraftBranch = { id: string; from: string; to: string; value: string };
export type DraftNet = { label: string; note: string; nodes: string[]; source: string; target: string; branches: DraftBranch[] };
export function baseline(): DraftNet {
  return { label: 'Course nested loops', note: 'Repository course-audit topology: e=r−H1·y, x=G1·e−H2·y, y=G2·x. The two feedback loops share x and y. Original slide assets were not inspected in this contribution.', nodes: ['r', 'e', 'x', 'y'], source: 'r', target: 'y', branches: [
    { id: 'b1', from: 'r', to: 'e', value: '1' }, { id: 'b2', from: 'e', to: 'x', value: String.raw`\frac{1}{s+1}` }, { id: 'b3', from: 'x', to: 'y', value: String.raw`\frac{1}{s+2}` }, { id: 'b4', from: 'y', to: 'x', value: '-2' }, { id: 'b5', from: 'y', to: 'e', value: '-1' },
  ] };
}
export function disjoint(): DraftNet {
  return { label: 'Proposed: two paths and three disjoint self-loops', note: 'Synthetic verification fixture. A long path visits a,b,c; a direct path avoids all three loops, so their path cofactors differ.', nodes: ['r', 'a', 'b', 'c', 'y'], source: 'r', target: 'y', branches: [
    { id: 'b1', from: 'r', to: 'a', value: '1' }, { id: 'b2', from: 'a', to: 'b', value: '1' }, { id: 'b3', from: 'b', to: 'c', value: '1' }, { id: 'b4', from: 'c', to: 'y', value: '1' }, { id: 'b5', from: 'r', to: 'y', value: '2' }, { id: 'b6', from: 'a', to: 'a', value: String.raw`\frac12` }, { id: 'b7', from: 'b', to: 'b', value: String.raw`\frac13` }, { id: 'b8', from: 'c', to: 'c', value: String.raw`\frac14` },
  ] };
}
export function parsed(draft: DraftNet): Net { return { nodes: [...draft.nodes], source: draft.source, target: draft.target, branches: draft.branches.map(b => ({ id: b.id, from: b.from, to: b.to, gain: parseGain(b.value) })) }; }
