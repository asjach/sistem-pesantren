import { describe, expect, it } from 'vitest';

import { nilaiBerlapis, sumberNilai } from './setelanGlobal';

describe('nilaiBerlapis', () => {
  it('perangkat menang atas server', () => {
    expect(nilaiBerlapis(28, 24)).toBe(24);
  });

  it('server dipakai saat perangkat belum diubah', () => {
    expect(nilaiBerlapis(28, null)).toBe(28);
  });

  it('null saat tak ada standar dan perangkat belum diubah', () => {

    expect(nilaiBerlapis(null, null)).toBeNull();
  });

  it('undefined diperlakukan sama dengan null', () => {
    expect(nilaiBerlapis(undefined, undefined)).toBeNull();
    expect(nilaiBerlapis(undefined, 24)).toBe(24);
    expect(nilaiBerlapis(28, undefined)).toBe(28);
  });

  it('nilai 0 tidak dianggap kosong', () => {
    expect(nilaiBerlapis(28, 0)).toBe(0);
  });
});

describe('sumberNilai', () => {
  it('melaporkan lapisan yang menang', () => {
    expect(sumberNilai(28, 24)).toBe('perangkat');
    expect(sumberNilai(28, null)).toBe('server');
    expect(sumberNilai(null, null)).toBe('bawaan');
  });
});
