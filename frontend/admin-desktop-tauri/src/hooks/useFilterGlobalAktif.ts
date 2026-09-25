import { useMemo } from 'react';
import { useKelasAktif } from '@/kelasAktif';
import { useLembagaAktif } from '@/lembagaAktif';
import { useSemesterAktif } from '@/semesterAktif';
import { useTahunAjaranAktif } from '@/tahunAjaranAktif';
import { useTingkatAktif } from '@/tingkatAktif';
import { useVisibilitasFilter } from '@/components/VisibilitasFilter';

export interface FilterGlobalAktif {
  jenjangs: readonly string[];
  tahunAjaranNames: readonly string[];
  semesters: readonly string[];
  tingkat: readonly string[];
  kelas: readonly string[];
  loading: boolean;
}

export function useFilterGlobalAktif(): FilterGlobalAktif {
  const { jenjangs, loading: loadingLembaga } = useLembagaAktif();
  const { tahunAjaranNames, loading: loadingTahunAjaran } = useTahunAjaranAktif();
  const { semesters, loading: loadingSemester } = useSemesterAktif();
  const { tingkat, loading: loadingTingkat } = useTingkatAktif();
  const { kelas, loading: loadingKelas } = useKelasAktif();
  const filter = useVisibilitasFilter();
  const loading = loadingLembaga || loadingTahunAjaran || loadingSemester || loadingTingkat || loadingKelas || !filter?.siap;
  const mode = filter?.mode;

  const jenjangsEfektif = useMemo(
    () => mode?.lembaga === 'multiple' ? jenjangs : jenjangs.slice(0, 1),
    [jenjangs, mode?.lembaga],
  );
  const tahunAjaranEfektif = useMemo(
    () => mode?.tahun_ajaran === 'multiple' ? tahunAjaranNames : tahunAjaranNames.slice(0, 1),
    [tahunAjaranNames, mode?.tahun_ajaran],
  );
  const semesterEfektif = useMemo(
    () => mode?.semester === 'multiple' ? semesters : semesters.slice(0, 1),
    [semesters, mode?.semester],
  );
  const tingkatEfektif = useMemo(
    () => mode?.tingkat === 'multiple' ? tingkat : tingkat.slice(0, 1),
    [tingkat, mode?.tingkat],
  );
  const kelasEfektif = useMemo(
    () => mode?.kelas === 'multiple' ? kelas : kelas.slice(0, 1),
    [kelas, mode?.kelas],
  );

  return useMemo(() => ({
    jenjangs: jenjangsEfektif,
    tahunAjaranNames: tahunAjaranEfektif,
    semesters: semesterEfektif,
    tingkat: tingkatEfektif,
    kelas: kelasEfektif,
    loading,
  }), [jenjangsEfektif, tahunAjaranEfektif, semesterEfektif, tingkatEfektif, kelasEfektif, loading]);
}

export function targetTunggal(values: readonly string[]): string | null {
  return values.length === 1 ? values[0] : null;
}
