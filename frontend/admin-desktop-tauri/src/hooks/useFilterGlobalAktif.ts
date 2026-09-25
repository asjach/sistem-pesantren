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

  return useMemo(() => {
    const efektif = (values: readonly string[], key: 'lembaga' | 'tahun_ajaran' | 'semester' | 'tingkat' | 'kelas') => (
      mode?.[key] === 'multiple' ? values : values.slice(0, 1)
    );
    return {
      jenjangs: efektif(jenjangs, 'lembaga'),
      tahunAjaranNames: efektif(tahunAjaranNames, 'tahun_ajaran'),
      semesters: efektif(semesters, 'semester'),
      tingkat: efektif(tingkat, 'tingkat'),
      kelas: efektif(kelas, 'kelas'),
      loading,
    };
  }, [jenjangs, tahunAjaranNames, semesters, tingkat, kelas, loading, mode?.lembaga, mode?.tahun_ajaran, mode?.semester, mode?.tingkat, mode?.kelas]);
}

export function targetTunggal(values: readonly string[]): string | null {
  return values.length === 1 ? values[0] : null;
}
