import { describe, expect, it } from 'vitest';
import { findModule, modules } from './catalog';

describe('module catalog', () => {
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
