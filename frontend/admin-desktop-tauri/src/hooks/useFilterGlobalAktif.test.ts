import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { targetTunggal, useFilterGlobalAktif } from './useFilterGlobalAktif';

const state = vi.hoisted(() => ({
  lembaga: { jenjangs: ['MI', 'MD'], loading: false },
  tahun: { tahunAjaranNames: ['2025/2026', '2026/2027'], loading: false },
  semester: { semesters: ['1', '2'], loading: false },
  tingkat: { tingkat: ['1', '2'], loading: false },
  kelas: { kelas: ['1A', '1B'], loading: false },
  filter: { siap: true, mode: undefined as undefined | Record<string, 'single' | 'multiple'> },
}));

vi.mock('@/lembagaAktif', () => ({ useLembagaAktif: () => state.lembaga }));
vi.mock('@/tahunAjaranAktif', () => ({ useTahunAjaranAktif: () => state.tahun }));
vi.mock('@/semesterAktif', () => ({ useSemesterAktif: () => state.semester }));
vi.mock('@/tingkatAktif', () => ({ useTingkatAktif: () => state.tingkat }));
vi.mock('@/kelasAktif', () => ({ useKelasAktif: () => state.kelas }));
vi.mock('@/components/VisibilitasFilter', () => ({ useVisibilitasFilter: () => state.filter }));

beforeEach(() => {
  state.lembaga = { jenjangs: ['MI', 'MD'], loading: false };
  state.tahun = { tahunAjaranNames: ['2025/2026', '2026/2027'], loading: false };
  state.semester = { semesters: ['1', '2'], loading: false };
  state.tingkat = { tingkat: ['1', '2'], loading: false };
  state.kelas = { kelas: ['1A', '1B'], loading: false };
  state.filter = { siap: true, mode: undefined };
});

describe('useFilterGlobalAktif', () => {
  it('mode tunggal memakai nilai pertama tiap filter', () => {
    const { result } = renderHook(() => useFilterGlobalAktif());

    expect(result.current).toEqual({
      jenjangs: ['MI'],
      tahunAjaranNames: ['2025/2026'],
      semesters: ['1'],
      tingkat: ['1'],
      kelas: ['1A'],
      loading: false,
    });
  });

  it('mode multiple memakai seluruh nilai yang tersedia', () => {
    state.filter = { siap: true, mode: { lembaga: 'multiple', tahun_ajaran: 'multiple', semester: 'multiple', tingkat: 'multiple', kelas: 'multiple' } };

    const { result } = renderHook(() => useFilterGlobalAktif());

    expect(result.current.jenjangs).toEqual(['MI', 'MD']);
    expect(result.current.tahunAjaranNames).toEqual(['2025/2026', '2026/2027']);
    expect(result.current.semesters).toEqual(['1', '2']);
    expect(result.current.tingkat).toEqual(['1', '2']);
    expect(result.current.kelas).toEqual(['1A', '1B']);
  });

  it('loading menyala bila salah satu sumber atau visibilitas belum siap', () => {
    state.kelas = { kelas: [], loading: true };
    expect(renderHook(() => useFilterGlobalAktif()).result.current.loading).toBe(true);

    state.kelas = { kelas: [], loading: false };
    state.filter = { siap: false, mode: undefined };
    expect(renderHook(() => useFilterGlobalAktif()).result.current.loading).toBe(true);
  });

  it('targetTunggal hanya mengembalikan nilai saat tepat satu', () => {
    expect(targetTunggal([])).toBeNull();
    expect(targetTunggal(['MI'])).toBe('MI');
    expect(targetTunggal(['MI', 'MD'])).toBeNull();
  });
});
