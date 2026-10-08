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
import { listTahunAjaran, type TahunAjaran } from '@/api/master';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KELAS_LIST_TAB, KELAS_PANEL_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import DispensasiDialog from '@/components/keuangan/DispensasiDialog';
import { DispensasiTab, FIELDS_DISPENSASI } from '@/components/keuangan/tabKeuangan';
import { targetTunggal, useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';

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
      const [dispen, j, tas] = await Promise.all([
        daftarDispensasi({
          sort: uDispensasi.urut.length ? tokenUrut(uDispensasi.urut, uDispensasi.arahKolom) : undefined,
          arah: uDispensasi.urut.length ? uDispensasi.arah : undefined,
        }),
        daftarJenis({}),
        listTahunAjaran({ per_page: 100 }),
      ]);
      setDispensasi(dispen);
      setJenis(j);
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

  const taBawaan = targetTunggal(tahunAjaranNames) ?? daftarTA.find((x) => x.is_aktif)?.nama ?? '';

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman
        tampil={{ lembaga: false, tahun_ajaran: false, tingkat: false, kelas: false }}
        tabel={[
          { key: 'keuangan_dispensasi', judul: 'Daftar Dispensasi', fields: FIELDS_DISPENSASI },
        ]}
      />
      <Tabs value="daftar" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB}>
          <TabsTrigger value="daftar" id="keu_tab_daftar_dispensasi" className={KELAS_TRIGGER}>Daftar Dispensasi</TabsTrigger>
        </TabsList>
        <TabsContent value="daftar" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <DispensasiTab
            rows={dispensasi}
            loading={loading}
            sort={uDispensasi}
            onTambah={bukaTambahDispensasi}
            onEdit={bukaUbahDispensasi}
            onHapus={hapusDispensasiBaris}
          />
        </TabsContent>
      </Tabs>

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
