import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import LabeledInput from '@/components/LabeledInput';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { KELAS_LIST_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { DeleteAction } from '@/components/RowActions';
import { Plus } from '@/icons';
import { hitungSlotBaru, jamPendek, menitDariJam } from '@/lib/jadwal';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { listKelas, type Kelas } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import PanelTemplate, { FIELDS_KERANGKA } from './TemplateJadwalPanel';
import PanelHariLibur from './HariLiburPanel';
import {
  buatJadwal, buatSlot, daftarJadwal, daftarSlot, hapusJadwal, hapusSlot, ubahSlot,
  HARI_LABEL, JENIS_SLOT_LABEL, JENIS_SLOT_OPTIONS, type JadwalBaris, type JenisSlot, type SlotJam,
} from '@/api/kurikulum';

function validasiJam(v: string | null): string | null {
  if (v === null || v.trim() === '') return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim()) ? null : 'Format jam HH:MM.';
}

function validasiUrutan(v: string | null): string | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? null : 'Urutan harus bilangan bulat ≥ 0.';
}

const FIELDS_SLOT: ExcelField[] = [
  { key: 'nama_slot', label: 'Nama slot', width: 180, kind: 'text', maxLength: 50 },
  { key: 'jenis', label: 'Jenis', width: 130, kind: 'select', selectTanpaEdit: true, choices: JENIS_SLOT_OPTIONS },
  { key: 'jam_mulai', label: 'Mulai', width: 110, kind: 'text', maxLength: 5, validate: validasiJam },
  { key: 'jam_selesai', label: 'Selesai', width: 110, kind: 'text', maxLength: 5, validate: validasiJam },
  { key: 'urutan', label: 'Urutan', width: 90, kind: 'text', maxLength: 3, format: 'angka', validate: validasiUrutan },
];

/** Halaman Jadwal Pelajaran: slot jam per jenjang + matriks jadwal per kelas
 *  (hari × slot) + tab template jadwal generik. Menjaga bentrok kelas &
 *  bentrok guru. */
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
  const [belum, setBelum] = useState<{ id: number; nama_mapel: string | null }[]>([]);
  const [jpl, setJpl] = useState('00:45');
  const [err, setErr] = useState('');

  const muatSlot = useCallback(async () => {
    if (jenjang === null) { setSlot([]); return; }
    try { setSlot(await daftarSlot(jenjang)); }
    catch (e) { setErr(errorMessage(e)); }
  }, [jenjang]);

  const muatJadwal = useCallback(async () => {
    if (kelasId === '') { setBaris([]); setHari([]); setHariLibur([]); setBelum([]); return; }
    try {
      const r = await daftarJadwal(Number(kelasId));
      setHari(r.hari); setHariLibur(r.hari_libur ?? []); setBaris(r.baris); setBelum(r.belum_terjadwal);
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

  const nilaiSlot = useCallback((s: SlotJam) => ({
    nama_slot: s.nama_slot ?? null,
    jenis: s.jenis,
    jam_mulai: jamPendek(s.jam_mulai),
    jam_selesai: jamPendek(s.jam_selesai),
    urutan: String(s.urutan),
  }), []);

  const commitSlot = useCallback(async (id: number | string, f: Record<string, string | null>) => {
    await ubahSlot(Number(id), {
      ...(f.nama_slot !== undefined ? { nama_slot: (f.nama_slot ?? '').trim() || null } : {}),
      ...(f.jenis !== undefined ? { jenis: (f.jenis ?? 'pelajaran') as JenisSlot } : {}),
      ...(f.jam_mulai !== undefined ? { jam_mulai: (f.jam_mulai ?? '').trim() || null } : {}),
      ...(f.jam_selesai !== undefined ? { jam_selesai: (f.jam_selesai ?? '').trim() || null } : {}),
      ...(f.urutan !== undefined ? { urutan: Number(f.urutan) || 0 } : {}),
    });
  }, []);

  const simpanSlotSelesai = useCallback(async () => {
    await muatSlot();
    await muatJadwal();
  }, [muatSlot, muatJadwal]);

  /** Tambah slot setelah slot berjam terakhir: mulai = jam selesainya,
   *  selesai = mulai + jeda 1 JPL dari input. */
  const tambahSlot = useCallback(async () => {
    if (jenjang === null) return;
    const durasi = menitDariJam(jpl);
    if (durasi === null || durasi <= 0) {
      toast.error('Isi jeda 1 JPL dengan jam yang sah (lebih dari 00:00).');
      return;
    }
    const baru = hitungSlotBaru(slot, durasi);
    if (baru === null) {
      toast.error('Slot baru akan melewati pukul 23:59.');
      return;
    }
    try {
      await buatSlot({ jenjang, ...baru });
      toast.success('Slot ditambah.');
      await simpanSlotSelesai();
    } catch (e) { toast.error(errorMessage(e)); }
  }, [jenjang, jpl, slot, simpanSlotSelesai]);

  const hapusSlotBaru = useCallback(async (s: SlotJam) => {
    try {
      await hapusSlot(s.id);
      toast.success('Slot dihapus.');
      await simpanSlotSelesai();
    } catch (e) { toast.error(errorMessage(e)); }
  }, [simpanSlotSelesai]);

  const renderActionsSlot = useCallback((s: SlotJam) => (
    canHapus ? (
      <DeleteAction
        id={`btn_hapus_slot_${s.id}`}
        title="Hapus slot jam?"
        description={`Slot "${s.nama_slot ?? `#${s.id}`}" akan dihapus.`}
        onConfirm={() => void hapusSlotBaru(s)}
      />
    ) : null
  ), [canHapus, hapusSlotBaru]);

  /** Matriks: satu baris = satu slot, satu kolom = satu hari aktif. Pilihan
   *  dropdown tiap sel = mapel yang belum terjadwal + nilai sel itu sendiri. */
  const fieldsMatriks = useMemo<ExcelField[]>(() => {
    const peta = new Map<string, JadwalBaris>();
    for (const b of baris) peta.set(`${b.slot_jam_id}|${b.hari}`, b);
    const petaSlot = new Map(slot.map((s) => [s.id, s]));
    const pilihanUmum = belum.map((b) => ({ value: String(b.id), label: b.nama_mapel ?? `#${b.id}` }));

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
  }, [hari, baris, belum, canTambah, canHapus, slot]);

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
        { key: 'kurikulum_jadwal_slot', judul: 'Slot jam', fields: FIELDS_SLOT },
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
          <ExcelTable<SlotJam>
            tableKey="kurikulum_jadwal_slot"
            sumberTabel="slot_jam_pelajaran"
            header="Slot jam"
            fields={FIELDS_SLOT}
            rows={slot}
            getValues={nilaiSlot}
            canEdit={canUbah}
            onCommit={commitSlot}
            onSaved={simpanSlotSelesai}
            renderActions={renderActionsSlot}
            addButton={canTambah ? (
              <div className="flex items-center gap-2">
                <LabeledInput
                  label="1 JPL"
                  htmlFor="input_jpl_slot"
                  type="time"
                  value={jpl}
                  onChange={(e) => setJpl(e.target.value)}
                  lebarKotak={190}
                />
                <Button type="button" size="sm" id="btn_tambah_slot" onClick={() => void tambahSlot()}>
                  <Plus data-icon="inline-start" size={14} /> Tambah
                </Button>
              </div>
            ) : undefined}
            addButtonLangsung
            maxRows={6}
            hideCheckbox
            emptyText="Belum ada slot jam untuk jenjang ini."
          />

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border py-2">
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
            {belum.length === 0 && baris.length > 0 && (
              <span className="text-xs text-muted-foreground">Semua pengampu kelas ini sudah terjadwal.</span>
            )}
          </div>

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
                ? 'Buat slot jam terlebih dahulu di tabel atas.'
                : 'Belum ada jadwal untuk kelas ini — pilih mapel pada sel hari.'}
            />
          )}
        </TabsContent>

        <TabsContent value="template" className="flex min-h-0 flex-1 flex-col gap-0">
          <PanelTemplate
            jenjang={jenjang}
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
