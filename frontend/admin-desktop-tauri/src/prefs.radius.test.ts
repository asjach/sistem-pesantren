import { describe, expect, it } from 'vitest';

import { normalkanRadius, RADIUS_DEFAULT, RADIUS_MAX, RADIUS_MIN } from './prefs';

describe('normalkanRadius', () => {
  it('bawaan 0 untuk kosong/tak dikenal', () => {
    expect(normalkanRadius(null)).toBe(RADIUS_DEFAULT);
    expect(normalkanRadius(undefined)).toBe(RADIUS_DEFAULT);
    expect(normalkanRadius('')).toBe(RADIUS_DEFAULT);
    expect(normalkanRadius('tak-terbaca')).toBe(RADIUS_DEFAULT);
    expect(normalkanRadius(NaN)).toBe(RADIUS_DEFAULT);
  });

  it('menerima angka & string angka', () => {
    expect(normalkanRadius(0)).toBe(0);
    expect(normalkanRadius(8)).toBe(8);
    expect(normalkanRadius('4')).toBe(4);
  });

  it('membulatkan & menjepit 0–16', () => {
    expect(normalkanRadius(4.6)).toBe(5);
    expect(normalkanRadius(-3)).toBe(RADIUS_MIN);
    expect(normalkanRadius(99)).toBe(RADIUS_MAX);
  });
});
