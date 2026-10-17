import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { KELAS_LIST_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { jamPendek } from '@/lib/jadwal';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { listKelas, type Kelas } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import PanelTemplate, { FIELDS_KERANGKA } from './TemplateJadwalPanel';
import PanelHariLibur from './HariLiburPanel';
import {
  daftarGuruAktif, daftarJadwal, daftarMapel, daftarTemplateJadwal, simpanSelJadwal, terapkanTemplate,
  HARI_LABEL, JENIS_SLOT_LABEL,
  type GuruAktif, type JadwalBaris, type MataPelajaran, type SlotJadwal,
  type TemplateJadwal, type TerapkanHasil,
} from '@/api/kurikulum';

/** Satu baris daftar jadwal = satu sel frame (hari × JP). */
interface BarisJadwal {
  id: string;
  slot: SlotJadwal;
  hari: string;
  mapelId: number | null;
  mapelNama: string | null;
  guruId: number | null;
  guruNama: string | null;
}

function namaGuru(g: GuruAktif): string {
  return `${g.gelar_depan ? `${g.gelar_depan} ` : ''}${g.nama_lengkap}${g.gelar_belakang ? `, ${g.gelar_belakang}` : ''}`;
}

/** Halaman Jadwal Pelajaran: daftar JP per hari untuk kelas terpilih + tab
 *  template mingguan & hari libur. Mapel & guru diisi di jadwal; pengampu
 *  kelas dibuat/diperbarui dari pilihan itu. */
export default function KurikulumJadwalPage() {
  const [tab, setTab] = useState('jadwal');
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canTambah = bisa(user, 'kurikulum.tambah');
  const canUbah = bisa(user, 'kurikulum.ubah');
  const canHapus = bisa(user, 'kurikulum.hapus');

  const jenjang = targetTunggal(jenjangs);
  const ta = targetTunggal(tahunAjaranNames);
  const siap = jenjang !== null && ta !== null;

  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [kelasId, setKelasId] = useState<number | ''>('');
  const [slot, setSlot] = useState<SlotJadwal[]>([]);
  const [hari, setHari] = useState<string[]>([]);
  const [hariLibur, setHariLibur] = useState<string[]>([]);
  const [baris, setBaris] = useState<JadwalBaris[]>([]);
  const [mapelAktif, setMapelAktif] = useState<MataPelajaran[]>([]);
  const [guruAktif, setGuruAktif] = useState<GuruAktif[]>([]);
  const [templateOpsi, setTemplateOpsi] = useState<TemplateJadwal[]>([]);
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [timpaKelas, setTimpaKelas] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [hasilKelas, setHasilKelas] = useState<TerapkanHasil | null>(null);
  const [err, setErr] = useState('');

  const muatJadwal = useCallback(async () => {
    if (kelasId === '') { setSlot([]); setBaris([]); setHari([]); setHariLibur([]); return; }
    try {
      const r = await daftarJadwal(Number(kelasId));
      setSlot(r.slot); setHari(r.hari); setHariLibur(r.hari_libur ?? []); setBaris(r.baris);
    } catch (e) { setErr(errorMessage(e)); }
  }, [kelasId]);

  useEffect(() => {
    if (filterLoading || jenjang === null || ta === null) { setKelasOpsi([]); setKelasId(''); return; }
    let hidup = true;
    listKelas({ jenjang, tahun_ajaran: ta, per_page: 1000 })
      .then((k) => {
        if (!hidup) return;
        setKelasOpsi(k.data);
        setKelasId((v) => (k.data.some((x) => x.id === v) ? v : (k.data[0]?.id ?? '')));
      })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, ta]);

  useEffect(() => { void muatJadwal(); }, [muatJadwal]);

  // Pilihan mapel & guru master untuk pengisian jadwal (bukan dari pengampu).
  useEffect(() => {
    if (jenjang === null || ta === null) { setMapelAktif([]); setGuruAktif([]); return; }
    let hidup = true;
    Promise.all([
      daftarMapel({ jenjang, keaktifan: 'aktif' }),
      daftarGuruAktif({ jenjang, tahun_ajaran: ta }),
    ]).then(([mapel, guru]) => {
      if (!hidup) return;
      setMapelAktif(mapel);
      setGuruAktif(guru);
    }).catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [jenjang, ta]);

  // Daftar template untuk tombol Terapkan di tab Jadwal; muat ulang setiap
  // kembali ke tab ini agar template baru dari tab Template langsung tampil.
  useEffect(() => {
    if (tab !== 'jadwal' || jenjang === null) return;
    let hidup = true;
    daftarTemplateJadwal(jenjang)
      .then((r) => { if (hidup) setTemplateOpsi(r); })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [tab, jenjang]);

  const templateSesuai = useMemo(() => {
    const tingkat = kelasOpsi.find((k) => k.id === kelasId)?.tingkat ?? null;
    return templateOpsi.filter((t) => (
      (t.kelas_id === null || t.kelas_id === kelasId)
      && (t.tingkat === null || t.tingkat === tingkat)
    ));
  }, [templateOpsi, kelasOpsi, kelasId]);

  useEffect(() => {
    setTemplateId((v) => {
      if (templateSesuai.some((t) => t.id === v)) return v;
      return templateSesuai.find((t) => t.is_active)?.id ?? templateSesuai[0]?.id ?? '';
    });
  }, [templateSesuai]);

  useEffect(() => { setHasilKelas(null); }, [kelasId, templateId]);

  const templateTerpilih = templateSesuai.find((t) => t.id === templateId) ?? null;
  const bisaTerapKelas = canTambah && templateTerpilih !== null
    && templateTerpilih.is_active && kelasId !== '' && !templateBusy;

  const jalankanTemplateKelas = async (mode: 'pratinjau' | 'eksekusi') => {
    if (templateTerpilih === null || kelasId === '') return;
    setTemplateBusy(true);
    try {
      const r = await terapkanTemplate(templateTerpilih.id, {
        sasaran: 'kelas',
        sasaran_id: String(kelasId),
        tahun_ajaran: ta,
        mode,
        timpa: timpaKelas,
      });
      setHasilKelas(r);
      toast.success(r.pesan);
      if (mode === 'eksekusi') await muatJadwal();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTemplateBusy(false);
    }
  };

  /** Baris daftar = tiap slot frame × hari aktif (slot hari-null dipecah ke
   *  semua hari). Isi jadwal per sel diambil dari `baris`. */
  const barisJadwal = useMemo<BarisJadwal[]>(() => {
    const peta = new Map(baris.map((b) => [`${b.slot_jam_id}|${b.hari}`, b]));
    const urutanHari = new Map(hari.map((h, i) => [h, i]));
    const hasil: BarisJadwal[] = [];
    for (const s of slot) {
      const days = s.hari === null ? hari : (hari.includes(s.hari) ? [s.hari] : []);
      for (const h of days) {
        const j = peta.get(`${s.id}|${h}`);
        hasil.push({
          id: `${s.id}|${h}`,
          slot: s,
          hari: h,
          mapelId: j?.mata_pelajaran_id ?? null,
          mapelNama: j?.nama_mapel ?? null,
          guruId: j?.keaktifan_pegawai_id ?? null,
          guruNama: j?.guru ?? null,
        });
      }
    }
    return hasil.sort((a, b) => (
      (urutanHari.get(a.hari) ?? 99) - (urutanHari.get(b.hari) ?? 99)
      || a.slot.urutan - b.slot.urutan
    ));
  }, [slot, hari, baris]);

  const petaBaris = useMemo(() => new Map(barisJadwal.map((r) => [r.id, r])), [barisJadwal]);

  const fieldsJadwal = useMemo<ExcelField[]>(() => [
    { key: 'hari', label: 'Hari', width: 90, kind: 'static' },
    { key: 'jp', label: 'JP', width: 60, kind: 'static' },
    { key: 'jam', label: 'Jam', width: 120, kind: 'static' },
    { key: 'jenis', label: 'Jenis', width: 110, kind: 'static' },
    {
      key: 'mapel', label: 'Mapel', width: 220, kind: 'select', selectTanpaEdit: true,
      bolehSelect: (id) => petaBaris.get(String(id))?.slot.jenis === 'pelajaran',
      choicesForRow: (id) => {
        const row = petaBaris.get(String(id));
        if (row === undefined || row.slot.jenis !== 'pelajaran') return [{ value: '', label: '—' }];
        const opsi = mapelAktif.map((m) => ({ value: String(m.id), label: m.nama_mapel }));
        if (row.mapelId !== null && !opsi.some((o) => o.value === String(row.mapelId))) {
          opsi.unshift({ value: String(row.mapelId), label: row.mapelNama ?? `#${row.mapelId}` });
        }
        return [{ value: '', label: '— kosong —' }, ...opsi];
      },
    },
    {
      key: 'guru', label: 'Guru', width: 220, kind: 'select', selectTanpaEdit: true,
      bolehSelect: (id) => {
        const row = petaBaris.get(String(id));
        return row?.slot.jenis === 'pelajaran' && row.mapelId !== null;
      },
      choicesForRow: (id) => {
        const row = petaBaris.get(String(id));
        if (row === undefined || row.slot.jenis !== 'pelajaran' || row.mapelId === null) {
          return [{ value: '', label: '—' }];
        }
        const opsi = guruAktif.map((g) => ({ value: String(g.keaktifan_pegawai_id), label: namaGuru(g) }));
        if (row.guruId !== null && !opsi.some((o) => o.value === String(row.guruId))) {
          opsi.unshift({ value: String(row.guruId), label: row.guruNama ?? `#${row.guruId}` });
        }
        return [{ value: '', label: '— tanpa guru —' }, ...opsi];
      },
    },
  ], [petaBaris, mapelAktif, guruAktif]);

  const nilaiJadwal = useCallback((r: BarisJadwal) => ({
    hari: HARI_LABEL[r.hari] ?? r.hari,
    jp: String(r.slot.urutan),
    jam: `${jamPendek(r.slot.jam_mulai) ?? ''}–${jamPendek(r.slot.jam_selesai) ?? ''}`,
    jenis: JENIS_SLOT_LABEL[r.slot.jenis],
    mapel: r.mapelId === null ? '' : String(r.mapelId),
    guru: r.guruId === null ? '' : String(r.guruId),
  }), []);

  const commitSel = useCallback(async (id: string | number, f: Record<string, string | null>) => {
    const row = petaBaris.get(String(id));
    if (row === undefined || row.slot.jenis !== 'pelajaran') return;

    const mapelBaru = f.mapel !== undefined
      ? (f.mapel === null || f.mapel === '' ? null : Number(f.mapel))
      : row.mapelId;
    // Ganti mapel = guru lama tidak ikut pindah; pilih guru baru (boleh kosong).
    const guruBaru = f.mapel !== undefined
      ? (f.guru === undefined || f.guru === null || f.guru === '' ? null : Number(f.guru))
      : (f.guru !== undefined
        ? (f.guru === null || f.guru === '' ? null : Number(f.guru))
        : row.guruId);
    if (mapelBaru === row.mapelId && guruBaru === row.guruId) return;

    await simpanSelJadwal({
      kelas_id: Number(kelasId),
      slot_jam_id: row.slot.id,
      hari: row.hari,
      mata_pelajaran_id: mapelBaru,
      keaktifan_pegawai_id: guruBaru,
    });
  }, [petaBaris, kelasId]);

  if (!siap) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) dan satu tahun ajaran pada filter di atas.</p>
      </div>
    );
  }

  const kelasTerpilih = kelasOpsi.find((k) => k.id === kelasId) ?? null;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tabel={[
        { key: 'kurikulum_jadwal', judul: 'Jadwal', fields: fieldsJadwal },
        { key: 'kurikulum_template_jadwal', judul: 'Kerangka jam', fields: FIELDS_KERANGKA },
      ]} />
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          <TabsTrigger value="jadwal" id="tab_jadwal_pelajaran" className={KELAS_TRIGGER}>Jadwal</TabsTrigger>
          <TabsTrigger value="template" id="tab_template_jadwal" className={KELAS_TRIGGER}>Template Jadwal</TabsTrigger>
          <TabsTrigger value="libur" id="tab_hari_libur" className={KELAS_TRIGGER}>Hari Libur</TabsTrigger>
        </TabsList>

        <TabsContent value="jadwal" className="flex min-h-0 flex-1 flex-col gap-0 p-3">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border pb-2">
            <label className="text-xs text-muted-foreground" htmlFor="select_kelas_jadwal">Kelas</label>
            <select
              id="select_kelas_jadwal"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              value={kelasId === '' ? '' : String(kelasId)}
              onChange={(e) => setKelasId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">— pilih kelas —</option>
              {kelasOpsi.map((k) => (
                <option key={k.id} value={k.id}>{k.nama_kelas} (tingkat {k.tingkat ?? '-'})</option>
              ))}
            </select>
            {hariLibur.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Libur: {hariLibur.map((h) => HARI_LABEL[h] ?? h).join(', ')}
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground" htmlFor="select_template_kelas">Template</label>
              <select
                id="select_template_kelas"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={templateId === '' ? '' : String(templateId)}
                onChange={(e) => setTemplateId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">
                  {templateSesuai.length === 0 ? '— tidak ada template —' : '— pilih template —'}
                </option>
                {templateSesuai.map((t) => (
                  <option key={t.id} value={t.id}>{t.nama}{t.is_active ? '' : ' (nonaktif)'}</option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs text-muted-foreground" htmlFor="cek_timpa_kelas">
                <input
                  type="checkbox" id="cek_timpa_kelas" checked={timpaKelas}
                  onChange={(e) => setTimpaKelas(e.target.checked)}
                />
                Timpa
              </label>
              {canTambah && (
                <>
                  <Button type="button" variant="outline" size="sm" id="btn_pratinjau_template_kelas"
                    disabled={!bisaTerapKelas}
                    onClick={() => void jalankanTemplateKelas('pratinjau')}>
                    Pratinjau
                  </Button>
                  <Button type="button" variant="default" size="sm" id="btn_terapkan_template_kelas"
                    disabled={!bisaTerapKelas}
                    onClick={() => void jalankanTemplateKelas('eksekusi')}>
                    Terapkan
                  </Button>
                </>
              )}
            </div>
          </div>

          {hasilKelas !== null && hasilKelas.dilewati.length > 0 && (
            <div className="shrink-0 border-b border-border py-1 text-[11px] text-muted-foreground">
              <ul className="list-disc pl-5">
                {hasilKelas.dilewati.map((d, i) => (
                  <li key={i}><span className="font-medium text-foreground">{d.sel}</span>: {d.alasan}</li>
                ))}
              </ul>
            </div>
          )}

          {kelasId === '' ? (
            <p className="p-4 text-xs text-muted-foreground">Pilih kelas untuk mengatur jadwal.</p>
          ) : hari.length === 0 ? (
            <div className="min-h-0 flex-1" />
          ) : (
            <ExcelTable<BarisJadwal>
              key={`jadwal-${kelasId}-${slot.map((s) => s.id).join('-')}`}
              tableKey="kurikulum_jadwal"
              header={`Jadwal${kelasTerpilih ? ` · ${kelasTerpilih.nama_kelas}` : ''}`}
              fields={fieldsJadwal}
              rows={barisJadwal}
              getValues={nilaiJadwal}
              canEdit={canUbah}
              onCommit={commitSel}
              onSaved={muatJadwal}
              renderActions={() => null}
              hideCheckbox
              hideActions
              emptyText={slot.length === 0
                ? 'Belum ada kerangka JP — terapkan template di tab Template Jadwal.'
                : 'Belum ada JP untuk kelas ini.'}
            />
          )}
        </TabsContent>

        <TabsContent value="template" className="flex min-h-0 flex-1 flex-col gap-0">
          <PanelTemplate
            jenjang={jenjang}
            ta={ta}
            kelasOpsi={kelasOpsi}
            kelasId={kelasId}
            canTambah={canTambah}
            canUbah={canUbah}
            canHapus={canHapus}
            onTerapkan={() => { void muatJadwal(); }}
          />
        </TabsContent>

        <TabsContent value="libur" className="flex min-h-0 flex-1 flex-col gap-0">
          <PanelHariLibur
            jenjang={jenjang}
            canUbah={canUbah}
            onSimpan={() => { void muatJadwal(); }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
