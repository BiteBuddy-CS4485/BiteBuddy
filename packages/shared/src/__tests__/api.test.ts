import { describe, it, expect } from 'vitest';
import { CUISINE_CATEGORIES } from '../api';

describe('CUISINE_CATEGORIES', () => {
  it('has "all" as the first entry', () => {
    expect(CUISINE_CATEGORIES[0].key).toBe('all');
  });

  it('every category has a non-empty key, label, and googlePlacesTypes array', () => {
    for (const cat of CUISINE_CATEGORIES) {
      expect(typeof cat.key).toBe('string');
      expect(cat.key.length).toBeGreaterThan(0);

      expect(typeof cat.label).toBe('string');
      expect(cat.label.length).toBeGreaterThan(0);

      expect(Array.isArray(cat.googlePlacesTypes)).toBe(true);
      expect(cat.googlePlacesTypes.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate keys', () => {
    const keys = CUISINE_CATEGORIES.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no duplicate labels', () => {
    const labels = CUISINE_CATEGORIES.map(c => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('contains the expected common cuisine keys', () => {
    const keys = new Set(CUISINE_CATEGORIES.map(c => c.key));
    for (const expected of ['italian', 'mexican', 'japanese', 'chinese', 'american'] as const) {
      expect(keys.has(expected)).toBe(true);
    }
  });

  it('"all" category maps to the generic "restaurant" type', () => {
    const all = CUISINE_CATEGORIES.find(c => c.key === 'all')!;
    expect(all.googlePlacesTypes).toContain('restaurant');
  });
});
