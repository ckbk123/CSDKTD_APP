import { describe, expect, it } from 'vitest';
import { filterModules, findModule, modules, relatedModules } from './catalog';

describe('module catalog', () => {
  it('finds the same root-locus concepts with punctuation, course synonyms and explicit scope', () => {
    const ids = (query: string) => filterModules('continuous', undefined, query).map(item => item.id);
    expect(ids('root locus')).toEqual(['CD02', 'CD03', 'CD04', 'CP06', 'CS05']);
    expect(ids('ROOT–LOCUS')).toEqual(ids('root locus'));
    expect(ids('rlocus')).toEqual(ids('root locus'));
    expect(ids('quỹ đạo nghiệm số')).toEqual(ids('root locus'));
    expect(filterModules('continuous', 'plots', 'root locus').map(item => item.id)).toEqual(['CP06']);
    expect(filterModules(undefined, undefined, 'root locus').map(item => item.id)).toEqual(['CD02', 'CD03', 'CD04', 'CP06', 'CS05', 'DD02', 'DP04', 'DS04']);
  });

  it('provides real, unique related routes for every tool without requiring shared exercise state', () => {
    for (const module of modules) {
      const related = relatedModules(module.id);
      expect(related.length).toBeGreaterThan(0);
      expect(related.length).toBeLessThanOrEqual(4);
      expect(new Set(related.map(item => item.id)).size).toBe(related.length);
      expect(related.every(item => item.id !== module.id && findModule(item.id) === item)).toBe(true);
    }
    expect(relatedModules('missing')).toEqual([]);
    expect(relatedModules('CP06').map(item => item.id)).toEqual(['CS05', 'CD02', 'DP04', 'DS04']);
  });

  it('discovers all 56 unique exercise routes with populated metadata', () => {
    expect(modules).toHaveLength(56);
    expect(new Set(modules.map((module) => module.id)).size).toBe(56);

    for (const module of modules) {
      expect(module.id).toMatch(/^[CD][RPSFD]\d{2}$/);
      expect(module.title.trim().length).toBeGreaterThan(0);
      expect(module.description.trim().length).toBeGreaterThan(0);
      expect(module.defaultExample.trim().length).toBeGreaterThan(0);
      expect(module.load).toBeTypeOf('function');
      expect(findModule(module.id)).toBe(module);
    }
    expect(findModule('missing-module')).toBeUndefined();
    expect(findModule('')).toBeUndefined();
  });

  it('places every exercise in its intended domain and topic', () => {
    const expected = {
      continuous: { representation: 6, plots: 6, stability: 5, performance: 5, design: 9 },
      discrete: { representation: 5, plots: 4, stability: 5, performance: 4, design: 7 },
    } as const;
    const categoriesByCode = {
      R: 'representation', P: 'plots', S: 'stability', F: 'performance', D: 'design',
    } as const;

    for (const [domain, categories] of Object.entries(expected)) {
      const inDomain = modules.filter((module) => module.domain === domain);
      expect(inDomain).toHaveLength(domain === 'continuous' ? 31 : 25);
      for (const [category, count] of Object.entries(categories)) {
        expect(inDomain.filter((module) => module.category === category)).toHaveLength(count);
      }
    }
    for (const module of modules) {
      expect(module.domain).toBe(module.id.startsWith('C') ? 'continuous' : 'discrete');
      const categoryCode = module.id[1] as keyof typeof categoriesByCode;
      expect(module.category).toBe(categoriesByCode[categoryCode]);
    }
  });

  it('loads each workspace through its public mount contract', async () => {
    // Feature behavior belongs in each module's tests. The catalog only checks
    // the lazy-loaded entry point, so adding real controls does not change this test.
    for (const module of modules) {
      const workspace = await module.load();
      expect(workspace.mount).toBeTypeOf('function');
    }
  });
});
