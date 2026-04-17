import { describe, it, expect } from 'vitest';
import { calculateCentroid, calculateDistance } from '../geolocation';

describe('calculateCentroid', () => {
  it('returns the same point for a single coordinate', () => {
    expect(calculateCentroid([{ lat: 10, lng: 20 }])).toEqual({ lat: 10, lng: 20 });
  });

  it('averages two symmetric points to the origin', () => {
    expect(calculateCentroid([{ lat: -5, lng: -10 }, { lat: 5, lng: 10 }])).toEqual({ lat: 0, lng: 0 });
  });

  it('correctly averages three points', () => {
    const result = calculateCentroid([
      { lat: 0, lng: 0 },
      { lat: 6, lng: 6 },
      { lat: 3, lng: 3 },
    ]);
    expect(result.lat).toBeCloseTo(3);
    expect(result.lng).toBeCloseTo(3);
  });

  it('handles real-world coordinates (Dallas area)', () => {
    // Three points around downtown Dallas
    const result = calculateCentroid([
      { lat: 32.780, lng: -96.800 },
      { lat: 32.760, lng: -96.800 },
      { lat: 32.770, lng: -96.780 },
    ]);
    expect(result.lat).toBeCloseTo(32.770, 5);
    expect(result.lng).toBeCloseTo(-96.793, 3);
  });

  it('handles negative coordinates', () => {
    const result = calculateCentroid([
      { lat: -33.87, lng: 151.21 },
      { lat: -33.93, lng: 151.23 },
    ]);
    expect(result.lat).toBeCloseTo(-33.9, 1);
    expect(result.lng).toBeCloseTo(151.22, 2);
  });
});

describe('calculateDistance', () => {
  it('returns 0 for the same point', () => {
    expect(calculateDistance(0, 0, 0, 0)).toBe(0);
    expect(calculateDistance(32.77, -96.80, 32.77, -96.80)).toBe(0);
  });

  it('is symmetric — distance A→B equals B→A', () => {
    const d1 = calculateDistance(32.7767, -96.797, 29.7604, -95.3698);
    const d2 = calculateDistance(29.7604, -95.3698, 32.7767, -96.797);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('returns a positive value for distinct points', () => {
    expect(calculateDistance(0, 0, 1, 1)).toBeGreaterThan(0);
  });

  it('approximates the Dallas–Houston distance (~362 km)', () => {
    const dist = calculateDistance(32.7767, -96.797, 29.7604, -95.3698);
    expect(dist).toBeGreaterThan(350);
    expect(dist).toBeLessThan(375);
  });

  it('approximates a short ~1 km distance', () => {
    // ~1 km north along a meridian at the equator
    const dist = calculateDistance(0, 0, 0.009, 0);
    expect(dist).toBeGreaterThan(0.9);
    expect(dist).toBeLessThan(1.1);
  });
});
