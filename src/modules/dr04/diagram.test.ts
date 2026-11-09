import {describe,expect,it} from 'vitest';
import {drawGraph} from './diagram';
import {baseline,disjoint,parsed} from './fixtures';

describe('direct graph selection presentation (no graph mathematics)',()=>{
  it('exposes the actual endpoint IDs and ordered selection as keyboard controls',()=>{
    const drawing=drawGraph(parsed(baseline()),['b3','b2'],['x','y'],'',true);
    expect(drawing.querySelector('svg')?.getAttribute('role')).toBe('group');
    const target=drawing.querySelector('[data-branch="b2"]')!;
    expect(target.getAttribute('role')).toBe('button');expect(target.getAttribute('tabindex')).toBe('0');
    expect(target.getAttribute('aria-pressed')).toBe('true');expect(target.getAttribute('aria-label')).toBe('Trace branch b2: e to x; selected position 2');
    expect(drawing.querySelector('[data-branch="b1"]')?.getAttribute('aria-pressed')).toBe('false');
  });
  it('keeps path geometry identical to the original drawing, including parallel and self loops',()=>{
    const n=parsed(disjoint());n.branches.push({...n.branches[0],id:'parallel'});
    const original=drawGraph(n,[],[],''),interactive=drawGraph(n,[],[],'',true);
    expect([...interactive.querySelectorAll('.dr04-edge')].map(e=>e.getAttribute('d'))).toEqual([...original.querySelectorAll('.dr04-edge')].map(e=>e.getAttribute('d')));
    expect(interactive.querySelector('svg')?.getAttribute('viewBox')).toBe(original.querySelector('svg')?.getAttribute('viewBox'));
    expect(interactive.querySelectorAll('[data-branch]')).toHaveLength(9);
  });
  it('provides at least a 44 CSS-pixel label target at the declared 800px inner drawing width',()=>{
    const drawing=drawGraph(parsed(disjoint()),[],[],'',true);
    for(const target of drawing.querySelectorAll('.dr04-label-hit')){
      expect(Number(target.getAttribute('width'))*800/920).toBeGreaterThanOrEqual(44);
      expect(Number(target.getAttribute('height'))*800/920).toBeGreaterThanOrEqual(44);
    }
    expect(drawing.tabIndex).toBe(0);expect(drawing.getAttribute('aria-label')).toContain('scroll horizontally');
  });
});
