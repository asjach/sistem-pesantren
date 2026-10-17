import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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

/** Satu baris matriks = satu nomor JP. Slot tiap hari bisa berbeda (jumlah,
 *  jam, jenis), jadi frame disusun per hari lalu digabung per nomor JP. */
interface BarisMatriks {
  id: number;
  urutan: number;
  label: string;
  perHari: Record<string, SlotJadwal>;
}

function namaGuru(g: GuruAktif): string {
  return `${g.gelar_depan ? `${g.gelar_depan} ` : ''}${g.nama_lengkap}${g.gelar_belakang ? `, ${g.gelar_belakang}` : ''}`;
}

/** Halaman Jadwal Pelajaran: matriks jadwal per kelas (hari × JP) + tab
 *  template mingguan & hari libur. Klik sel membuka dialog Mapel + Guru;
 *  pengampu kelas mengikuti isi jadwal. */
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
  const [sel, setSel] = useState<{ row: BarisMatriks; hari: string } | null>(null);
  const [selMapel, setSelMapel] = useState<number | ''>('');
  const [selGuru, setSelGuru] = useState<number | ''>('');
  const [selBusy, setSelBusy] = useState(false);
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

  // Pilihan mapel & guru master untuk dialog pengisian jadwal.
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

  /** Frame kelas: slot hari-null berlaku semua hari; slot hari tertentu
   *  menimpa slot umum pada nomor JP yang sama. */
  const barisMatriks = useMemo<BarisMatriks[]>(() => {
    const perHari = new Map<string, Map<number, SlotJadwal>>();
    for (const h of hari) perHari.set(h, new Map());
    for (const s of slot) {
      if (s.hari === null) {
        for (const h of hari) perHari.get(h)?.set(s.urutan, s);
      } else {
        perHari.get(s.hari)?.set(s.urutan, s);
      }
    }
    const urutan = [...new Set([...perHari.values()].flatMap((m) => [...m.keys()]))]
      .sort((a, b) => a - b);

    return urutan.map((u) => {
      const perHariBaris: Record<string, SlotJadwal> = {};
      for (const h of hari) {
        const s = perHari.get(h)?.get(u);
        if (s !== undefined) perHariBaris[h] = s;
      }
      const slots = Object.values(perHariBaris);
      const nama = [...new Set(slots.map((s) => s.nama_slot ?? `JP ${u}`))];
      const jam = [...new Set(slots
        .map((s) => `${jamPendek(s.jam_mulai) ?? ''}–${jamPendek(s.jam_selesai) ?? ''}`)
        .filter((t) => t !== '–'))];
      return {
        id: u,
        urutan: u,
        label: `${nama.length === 1 ? nama[0] : `JP ${u}`}${jam.length === 1 ? ` · ${jam[0]}` : ''}`,
        perHari: perHariBaris,
      };
    });
  }, [slot, hari]);

  const petaBaris = useMemo(() => new Map(barisMatriks.map((r) => [r.id, r])), [barisMatriks]);
  const petaJadwal = useMemo(
    () => new Map(baris.map((b) => [`${b.slot_jam_id}|${b.hari}`, b])),
    [baris],
  );

  const bukaSel = useCallback((id: string | number, h: string) => {
    if (!canUbah) return;
    const row = petaBaris.get(Number(id));
    const s = row?.perHari[h];
    if (row === undefined || s === undefined || s.jenis !== 'pelajaran') return;
    const j = petaJadwal.get(`${s.id}|${h}`);
    setSel({ row, hari: h });
    setSelMapel(j?.mata_pelajaran_id ?? '');
    setSelGuru(j?.keaktifan_pegawai_id ?? '');
  }, [canUbah, petaBaris, petaJadwal]);

  const fieldsMatriks = useMemo<ExcelField[]>(() => [
    { key: '__slot', label: 'Jam', width: 170, kind: 'static' },
    ...hari.map((h): ExcelField => ({
      key: h,
      label: HARI_LABEL[h] ?? h,
      width: 180,
      kind: 'text',
      onCellClick: (id) => bukaSel(id, h),
    })),
  ], [hari, bukaSel]);

  const nilaiMatriks = useCallback((r: BarisMatriks) => {
    const v: Record<string, string | null> = { __slot: r.label };
    for (const h of hari) {
      const s = r.perHari[h];
      if (s === undefined) { v[h] = ''; continue; }
      if (s.jenis !== 'pelajaran') { v[h] = s.nama_slot ?? JENIS_SLOT_LABEL[s.jenis]; continue; }
      const j = petaJadwal.get(`${s.id}|${h}`);
      v[h] = j === undefined ? '' : `${j.nama_mapel ?? '?'}${j.guru ? ` — ${j.guru}` : ''}`;
    }
    return v;
  }, [hari, petaJadwal]);

  const selSlot = sel === null ? null : sel.row.perHari[sel.hari] ?? null;
  const selJadwal = selSlot === null ? null : petaJadwal.get(`${selSlot.id}|${sel!.hari}`) ?? null;
  const mapelDialog = [...mapelAktif];
  if (selMapel !== '' && !mapelDialog.some((m) => m.id === selMapel)) {
    mapelDialog.unshift({
      id: Number(selMapel),
      jenjang: jenjang ?? '',
      nama_mapel: selJadwal?.nama_mapel ?? `#${selMapel}`,
      kode_mapel: null,
      singkatan: null,
      kelompok: 'formal',
      is_active: true,
      kkm: null,
      urutan: 0,
    });
  }
  const guruDialog = [...guruAktif];
  if (selGuru !== '' && !guruDialog.some((g) => g.keaktifan_pegawai_id === selGuru)) {
    guruDialog.unshift({
      keaktifan_pegawai_id: Number(selGuru),
      pegawai_id: 0,
      nama_lengkap: selJadwal?.guru ?? `#${selGuru}`,
      nip: null,
      gelar_depan: null,
      gelar_belakang: null,
      jenis_kelamin: null,
    });
  }

  const simpanSel = async () => {
    if (sel === null || selSlot === null) return;
    setSelBusy(true);
    try {
      await simpanSelJadwal({
        kelas_id: Number(kelasId),
        slot_jam_id: selSlot.id,
        hari: sel.hari,
        mata_pelajaran_id: selMapel === '' ? null : Number(selMapel),
        keaktifan_pegawai_id: selGuru === '' ? null : Number(selGuru),
      });
      toast.success('Jadwal disimpan.');
      setSel(null);
      await muatJadwal();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSelBusy(false);
    }
  };

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
        { key: 'kurikulum_jadwal', judul: 'Jadwal', fields: fieldsMatriks },
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
            <ExcelTable<BarisMatriks>
              key={`matriks-${kelasId}-${slot.map((s) => s.id).join('-')}`}
              tableKey="kurikulum_jadwal"
              header={`Jadwal${kelasTerpilih ? ` · ${kelasTerpilih.nama_kelas}` : ''}`}
              fields={fieldsMatriks}
              rows={barisMatriks}
              getValues={nilaiMatriks}
              canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={() => null}
              hideCheckbox
              hideActions
              emptyText={barisMatriks.length === 0
                ? 'Belum ada kerangka JP — terapkan template di tab Template Jadwal.'
                : 'Belum ada jadwal untuk kelas ini.'}
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

      <Dialog open={sel !== null} onOpenChange={(o) => { if (!o && !selBusy) setSel(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Isi Jadwal</DialogTitle>
            <DialogDescription>
              {sel === null ? '' : `${HARI_LABEL[sel.hari] ?? sel.hari} · ${selSlot?.nama_slot ?? ''} (${selSlot ? `${jamPendek(selSlot.jam_mulai) ?? ''}–${jamPendek(selSlot.jam_selesai) ?? ''}` : ''})`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs" htmlFor="select_mapel_sel">
              Mapel
              <select
                id="select_mapel_sel"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={selMapel === '' ? '' : String(selMapel)}
                onChange={(e) => {
                  const v = e.target.value === '' ? '' : Number(e.target.value);
                  setSelMapel(v);
                  setSelGuru('');
                }}
              >
                <option value="">— kosong —</option>
                {mapelDialog.map((m) => <option key={m.id} value={m.id}>{m.nama_mapel}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs" htmlFor="select_guru_sel">
              Guru pengampu
              <select
                id="select_guru_sel"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={selGuru === '' ? '' : String(selGuru)}
                disabled={selMapel === ''}
                onChange={(e) => setSelGuru(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— tanpa guru —</option>
                {guruDialog.map((g) => (
                  <option key={g.keaktifan_pegawai_id} value={g.keaktifan_pegawai_id}>{namaGuru(g)}</option>
                ))}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={selBusy} onClick={() => setSel(null)}>
              Batal
            </Button>
            <Button type="button" variant="default" id="btn_simpan_sel_jadwal" disabled={selBusy}
              onClick={() => void simpanSel()}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
