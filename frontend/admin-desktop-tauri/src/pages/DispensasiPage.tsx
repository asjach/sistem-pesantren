import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/client';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import {
  daftarDispensasi,
  daftarJenis,
  hapusDispensasi,
  type Dispensasi,
  type JenisTagihan,
} from '@/api/keuangan';
import { listLembaga, listTahunAjaran, type Lembaga, type TahunAjaran } from '@/api/master';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import DispensasiDialog from '@/components/keuangan/DispensasiDialog';
import { DispensasiTab, FIELDS_DISPENSASI } from '@/components/keuangan/tabKeuangan';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';

function useUrutTabel() {
  const [urut, setUrut] = useState<string[]>([]);
  const [arah, setArah] = useState<'naik' | 'turun'>('naik');
  const [arahKolom, setArahKolom] = useState<PetaArahKolom | undefined>(undefined);
  const terapkan = useCallback((nilai: string[], a: 'naik' | 'turun', peta?: PetaArahKolom) => {
    const p = nilai.length > 0 ? peta : undefined;
    setUrut(nilai);
    setArah(a);
    setArahKolom(p);
  }, []);
  return { urut, arah, arahKolom, terapkan };
}

export default function DispensasiPage() {
  const [dispensasi, setDispensasi] = useState<Dispensasi[]>([]);
  const [jenis, setJenis] = useState<JenisTagihan[]>([]);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [daftarTA, setDaftarTA] = useState<TahunAjaran[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const uDispensasi = useUrutTabel();
  const { tahunAjaranNames } = useFilterGlobalAktif();

  const [dispensasiOpen, setDispensasiOpen] = useState(false);
  const [editDispensasi, setEditDispensasi] = useState<Dispensasi | null>(null);

  const load = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const [dispen, j, l, tas] = await Promise.all([
        daftarDispensasi({
          sort: uDispensasi.urut.length ? tokenUrut(uDispensasi.urut, uDispensasi.arahKolom) : undefined,
          arah: uDispensasi.urut.length ? uDispensasi.arah : undefined,
        }),
        daftarJenis({}),
        listLembaga({ per_page: 100 }),
        listTahunAjaran({ per_page: 100 }),
      ]);
      setDispensasi(dispen);
      setJenis(j);
      setLembagas(l.data);
      setDaftarTA(tas.data);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [uDispensasi.urut, uDispensasi.arah, uDispensasi.arahKolom]);

  useEffect(() => {
    void load();
  }, [load]);

  const bukaTambahDispensasi = useCallback(() => {
    setEditDispensasi(null);
    setDispensasiOpen(true);
  }, []);

  const bukaUbahDispensasi = useCallback((d: Dispensasi) => {
    setEditDispensasi(d);
    setDispensasiOpen(true);
  }, []);

  const hapusDispensasiBaris = useCallback((r: Dispensasi) => {
    void (async () => {
      try {
        await hapusDispensasi(r.id);
        toast.success('Dispensasi dihapus.');
        await load();
      } catch (e2) {
        toast.error(errorMessage(e2));
      }
    })();
  }, [load]);

  const taBawaan = tahunAjaranNames.find((x) => x) ?? daftarTA.find((x) => x.is_aktif)?.nama ?? '';

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman
        tampil={{ lembaga: false, tahun_ajaran: false, tingkat: false, kelas: false }}
        tabel={[
          { key: 'keuangan_dispensasi', judul: 'Dispensasi', fields: FIELDS_DISPENSASI },
        ]}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <DispensasiTab
          rows={dispensasi}
          loading={loading}
          sort={uDispensasi}
          onTambah={bukaTambahDispensasi}
          onEdit={bukaUbahDispensasi}
          onHapus={hapusDispensasiBaris}
        />
      </div>

      <DispensasiDialog
        open={dispensasiOpen}
        onOpenChange={setDispensasiOpen}
        editing={editDispensasi}
        jenis={jenis}
        daftarTA={daftarTA}
        taBawaan={taBawaan}
        onSaved={load}
      />
    </div>
  );
}
