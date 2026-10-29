import { describe, expect, it } from 'vitest';
import { libraryHref, moduleHref, parseRoute } from './router';

describe('hash routes', () => {
  it('starts in continuous systems and supports both domains and categories', () => {
    expect(parseRoute('')).toEqual({ kind: 'library', domain: 'continuous' });
    expect(parseRoute('#/discrete/design')).toEqual({ kind: 'library', domain: 'discrete', category: 'design' });
    expect(parseRoute('#/continuous/stability/')).toEqual({ kind: 'library', domain: 'continuous', category: 'stability' });
  });
  it('supports direct module links and rejects invalid routes', () => {
    expect(parseRoute('#/module/cr05')).toEqual({ kind: 'module', id: 'CR05' });
    for (const path of ['#/module/CR99', '#/discrete/missing', '#/other', '#/module/%20', '#/continuous/design/extra']) {
      expect(parseRoute(path)).toEqual({ kind: 'missing' });
    }
  });
  it('generates refreshable links without server rewrites', () => {
    expect(libraryHref('continuous', 'plots')).toBe('#/continuous/plots');
    expect(moduleHref('DD07')).toBe('#/module/DD07');
  });
});
