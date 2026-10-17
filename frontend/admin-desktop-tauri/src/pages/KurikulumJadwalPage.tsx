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
  buatJadwal, daftarJadwal, daftarSlot, daftarTemplateJadwal, hapusJadwal, terapkanTemplate,
  HARI_LABEL, JENIS_SLOT_LABEL,
  type JadwalBaris, type SlotJam, type TemplateJadwal, type TerapkanHasil,
} from '@/api/kurikulum';

/** Halaman Jadwal Pelajaran: matriks jadwal per kelas (hari × slot) + tab
 *  template mingguan & hari libur. Slot jam dibuat lewat Terapkan template. */
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
  const [slot, setSlot] = useState<SlotJam[]>([]);
  const [hari, setHari] = useState<string[]>([]);
  const [hariLibur, setHariLibur] = useState<string[]>([]);
  const [baris, setBaris] = useState<JadwalBaris[]>([]);
  const [pengampu, setPengampu] = useState<{ id: number; nama_mapel: string | null; guru: string | null }[]>([]);
  const [templateOpsi, setTemplateOpsi] = useState<TemplateJadwal[]>([]);
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [timpaKelas, setTimpaKelas] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [hasilKelas, setHasilKelas] = useState<TerapkanHasil | null>(null);
  const [err, setErr] = useState('');

  const muatSlot = useCallback(async () => {
    if (jenjang === null) { setSlot([]); return; }
    try { setSlot(await daftarSlot(jenjang)); }
    catch (e) { setErr(errorMessage(e)); }
  }, [jenjang]);

  const muatJadwal = useCallback(async () => {
    if (kelasId === '') { setBaris([]); setHari([]); setHariLibur([]); setPengampu([]); return; }
    try {
      const r = await daftarJadwal(Number(kelasId));
      setHari(r.hari); setHariLibur(r.hari_libur ?? []); setBaris(r.baris);
      setPengampu(r.pengampu ?? r.belum_terjadwal);
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

  useEffect(() => { void muatSlot(); }, [muatSlot]);
  useEffect(() => { void muatJadwal(); }, [muatJadwal]);

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
      if (mode === 'eksekusi') {
        await muatSlot();
        await muatJadwal();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTemplateBusy(false);
    }
  };

  /** Matriks: satu baris = satu slot, satu kolom = satu hari aktif. Pilihan
   *  dropdown tiap sel = SEMUA pengampu kelas, sehingga mapel yang sama bisa
   *  dipakai di beberapa slot (2 JP atau lebih). */
  const fieldsMatriks = useMemo<ExcelField[]>(() => {
    const peta = new Map<string, JadwalBaris>();
    for (const b of baris) peta.set(`${b.slot_jam_id}|${b.hari}`, b);
    const petaSlot = new Map(slot.map((s) => [s.id, s]));
    const pilihanUmum = pengampu.map((p) => ({
      value: String(p.id),
      label: `${p.nama_mapel ?? `#${p.id}`}${p.guru ? ` — ${p.guru}` : ''}`,
    }));

    return [
      { key: '__slot', label: 'Jam', width: 170, kind: 'static' },
      ...hari.map((h): ExcelField => ({
        key: h,
        label: HARI_LABEL[h] ?? h,
        width: 180,
        kind: 'select',
        selectTanpaEdit: true,
        // Baris istirahat/pembiasaan: sel menampilkan nama kegiatan dan tidak
        // bisa dibuka — waktu itu bukan waktu pelajaran.
        bolehSelect: (id) => petaSlot.get(Number(id))?.jenis === 'pelajaran',
        choicesForRow: (id) => {
          const s = petaSlot.get(Number(id));
          if (s !== undefined && s.jenis !== 'pelajaran') {
            return [{ value: '', label: s.nama_slot ?? JENIS_SLOT_LABEL[s.jenis] }];
          }
          const j = peta.get(`${Number(id)}|${h}`);
          // Mengganti nilai lama butuh tambah + hapus; tanpa hapus, hanya
          // nilai berjalan yang ditawarkan (sel tak menawarkan aksi mati).
          const opsi = canTambah && (j === undefined || canHapus) ? [...pilihanUmum] : [];
          if (canHapus) opsi.unshift({ value: '', label: '— kosong —' });
          if (j !== undefined && !opsi.some((o) => o.value === String(j.pengampu_mapel_id))) {
            opsi.unshift({
              value: String(j.pengampu_mapel_id),
              label: `${j.nama_mapel ?? '?'}${j.guru ? ` — ${j.guru}` : ''}`,
            });
          }
          return opsi;
        },
      })),
    ];
  }, [hari, baris, pengampu, canTambah, canHapus, slot]);

  const nilaiMatriks = useCallback((s: SlotJam) => {
    const v: Record<string, string | null> = {};
    const mulai = jamPendek(s.jam_mulai);
    const selesai = jamPendek(s.jam_selesai);
    v.__slot = `${s.nama_slot ?? `#${s.id}`}${mulai !== null && selesai !== null ? ` · ${mulai}–${selesai}` : ''}`;
    for (const h of hari) {
      const j = baris.find((b) => b.slot_jam_id === s.id && b.hari === h);
      v[h] = j ? String(j.pengampu_mapel_id) : null;
    }
    return v;
  }, [baris, hari]);

  const commitJadwal = useCallback(async (id: number | string, f: Record<string, string | null>) => {
    const slotId = Number(id);
    for (const [hariNama, raw] of Object.entries(f)) {
      if (hariNama === '__slot') continue;
      const lama = baris.find((b) => b.slot_jam_id === slotId && b.hari === hariNama) ?? null;
      const baru = raw === null || raw === '' ? null : Number(raw);
      const lamaId = lama?.pengampu_mapel_id ?? null;
      if (baru === lamaId) continue;

      if (baru === null) {
        if (!canHapus) throw new Error('Tidak punya izin menghapus jadwal.');
        if (lama !== null) await hapusJadwal(lama.id);
        continue;
      }

      if (!canTambah) throw new Error('Tidak punya izin menambah jadwal.');
      if (lama !== null) {
        if (!canHapus) throw new Error('Tidak punya izin mengubah jadwal.');
        await hapusJadwal(lama.id);
        try {
          await buatJadwal({ pengampu_mapel_id: baru, slot_jam_id: slotId, hari: hariNama });
        } catch (e) {
          // Gagal pindah → kembalikan jadwal lama agar sel tidak kehilangan data.
          try {
            await buatJadwal({
              pengampu_mapel_id: lama.pengampu_mapel_id,
              slot_jam_id: slotId,
              hari: hariNama,
            });
          } catch { /* galat asli yang dilaporkan */ }
          throw e;
        }
        continue;
      }

      await buatJadwal({ pengampu_mapel_id: baru, slot_jam_id: slotId, hari: hariNama });
    }
  }, [baris, canTambah, canHapus]);

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
            <ExcelTable<SlotJam>
              tableKey="kurikulum_jadwal"
              header={`Jadwal${kelasTerpilih ? ` · ${kelasTerpilih.nama_kelas}` : ''}`}
              fields={fieldsMatriks}
              rows={slot}
              getValues={nilaiMatriks}
              canEdit={canTambah || canHapus}
              onCommit={commitJadwal}
              onSaved={muatJadwal}
              renderActions={() => null}
              hideCheckbox
              hideActions
              emptyText={slot.length === 0
                ? 'Belum ada slot jam — terapkan template di tab Template Jadwal.'
                : 'Belum ada jadwal untuk kelas ini — pilih mapel pada sel hari.'}
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
            onTerapkan={() => { void muatSlot(); void muatJadwal(); }}
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
