import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KELAS_LIST_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { listKelas, type Kelas } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { Plus, Save, Trash2, X } from '@/icons';
import PanelTemplate from './TemplateJadwalPanel';
import PanelHariLibur from './HariLiburPanel';
import {
  buatJadwal, buatSlot, daftarJadwal, daftarSlot, hapusJadwal, hapusSlot, ubahSlot,
  HARI_LABEL, type JadwalBaris, type SlotJam,
} from '@/api/kurikulum';

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
  /** Sel yang sedang diisi: kunci `slotId|hari` → pengampu_mapel_id terpilih. */
  const [selAktif, setSelAktif] = useState<string | null>(null);
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

  const jalankan = useCallback(async (kerja: () => Promise<unknown>, sukses: string) => {
    try { await kerja(); toast.success(sukses); await muatJadwal(); }
    catch (e) { toast.error(errorMessage(e)); }
  }, [muatJadwal]);

  const pasang = useCallback(async (slotId: number, hariNama: string, pengampuId: number) => {
    try {
      await buatJadwal({ pengampu_mapel_id: pengampuId, slot_jam_id: slotId, hari: hariNama });
      toast.success('Jadwal disimpan.');
      setSelAktif(null);
      await muatJadwal();
    } catch (e) { toast.error(errorMessage(e)); }
  }, [muatJadwal]);

  if (!siap) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) dan satu tahun ajaran pada filter di atas.</p>
      </div>
    );
  }

  const selUntuk = (slotId: number, hariNama: string) =>
    baris.find((b) => b.slot_jam_id === slotId && b.hari === hariNama) ?? null;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          <TabsTrigger value="jadwal" id="tab_jadwal_pelajaran" className={KELAS_TRIGGER}>Jadwal</TabsTrigger>
          <TabsTrigger value="template" id="tab_template_jadwal" className={KELAS_TRIGGER}>Template Jadwal</TabsTrigger>
          <TabsTrigger value="libur" id="tab_hari_libur" className={KELAS_TRIGGER}>Hari Libur</TabsTrigger>
        </TabsList>
        <TabsContent value="jadwal" className="flex min-h-0 flex-1 flex-col gap-0">

      {/* Slot jam */}
      <div className="shrink-0 border-b border-border">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-xs font-medium">Slot jam · {jenjang}</span>
          <div className="ml-auto">
            {canTambah && (
              <Button type="button" variant="outline" size="sm" id="btn_tambah_slot"
                onClick={() => void jalankan(
                  () => buatSlot({ jenjang, nama_slot: 'Jam baru', jam_mulai: '07:00', jam_selesai: '07:45', urutan: slot.length + 1 }),
                  'Slot ditambah.',
                )
                .then(muatSlot)}>
                <Plus size={14} /> Tambah slot
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-40 overflow-auto px-3 pb-2">
          <table className="w-full max-w-2xl border-collapse text-xs" id="tabel_slot_jam">
            <thead className="bg-muted/60">
              <tr>
                <th className="border border-border px-2 py-1 text-left">Nama slot</th>
                <th className="border border-border px-2 py-1 w-28">Mulai</th>
                <th className="border border-border px-2 py-1 w-28">Selesai</th>
                <th className="border border-border px-2 py-1 w-16">Urutan</th>
                <th className="border border-border px-2 py-1 w-20">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {slot.map((s) => (
                <BarisSlot key={s.id} s={s} canUbah={canUbah} canHapus={canHapus}
                  onSimpan={(kerja, sukses) => void jalankan(kerja, sukses).then(muatSlot)} />
              ))}
              {slot.length === 0 && (
                <tr><td colSpan={5} className="border border-border px-2 py-4 text-center text-muted-foreground">
                  Belum ada slot jam untuk jenjang ini.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Jadwal per kelas */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
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

      {kelasId === '' || hari.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">
          {kelasId === '' ? 'Pilih kelas untuk mengatur jadwal.' : 'Buat slot jam terlebih dahulu (panel di atas).'}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <table className="w-full border-collapse text-xs" id="tabel_jadwal">
            <thead className="bg-muted/60">
              <tr>
                <th className="border border-border px-2 py-1 w-32 text-left">Jam</th>
                {hari.map((h) => (
                  <th key={h} className="border border-border px-2 py-1 text-left">{HARI_LABEL[h] ?? h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slot.map((s) => (
                <tr key={s.id}>
                  <td className="border border-border px-2 py-1">
                    <span className="font-medium">{s.nama_slot ?? `#${s.id}`}</span>
                    {s.jam_mulai && s.jam_selesai && (
                      <span className="block text-[10px] text-muted-foreground">{s.jam_mulai}–{s.jam_selesai}</span>
                    )}
                  </td>
                  {hari.map((h) => {
                    const j = selUntuk(s.id, h);
                    const kunci = `${s.id}|${h}`;
                    if (j !== null && j !== undefined) {
                      return (
                        <td key={h} className="border border-border px-1 py-0.5">
                          <div className="flex items-center gap-1">
                            <span className="min-w-0 flex-1 truncate" title={`${j.nama_mapel ?? ''} — ${j.guru ?? ''}`}>
                              {j.nama_mapel ?? '?'}
                              {j.guru && <span className="block text-[10px] text-muted-foreground">{j.guru}</span>}
                            </span>
                            {canHapus && (
                              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Hapus jadwal ${h} ${s.nama_slot ?? ''}`}
                                onClick={() => void jalankan(() => hapusJadwal(j.id), 'Jadwal dihapus.')}>
                                <X size={12} />
                              </Button>
                            )}
                          </div>
                        </td>
                      );
                    }
                    if (selAktif === kunci) {
                      return (
                        <td key={h} className="border border-border px-1 py-0.5">
                          <select
                            className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs"
                            aria-label={`Pilih pelajaran ${h} ${s.nama_slot ?? ''}`}
                            value=""
                            onChange={(e) => {
                              if (e.target.value !== '') void pasang(s.id, h, Number(e.target.value));
                            }}
                          >
                            <option value="">— pilih mapel —</option>
                            {belum.map((b) => (
                              <option key={b.id} value={b.id}>{b.nama_mapel ?? `#${b.id}`}</option>
                            ))}
                          </select>
                          <button type="button" className="mt-0.5 text-[10px] text-muted-foreground underline"
                            onClick={() => setSelAktif(null)}>batal</button>
                        </td>
                      );
                    }
                    return (
                      <td key={h} className="border border-border px-1 py-0.5 text-center">
                        {canTambah && belum.length > 0 && (
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Isi jadwal ${h} ${s.nama_slot ?? ''}`}
                            onClick={() => setSelAktif(kunci)}>
                            <Plus size={12} />
                          </Button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </TabsContent>
        <TabsContent value="template" className="flex min-h-0 flex-1 flex-col gap-0">
          <PanelTemplate
            jenjang={jenjang ?? ''}
            canTambah={canTambah}
            canUbah={canUbah}
            canHapus={canHapus}
            onTerapkan={() => { void muatSlot(); void muatJadwal(); }}
          />
        </TabsContent>
        <TabsContent value="libur" className="flex min-h-0 flex-1 flex-col gap-0">
          <PanelHariLibur
            jenjang={jenjang ?? ''}
            canUbah={canUbah}
            onSimpan={() => { void muatJadwal(); }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Baris slot jam dengan penyuntingan inline. */
function BarisSlot({ s, canUbah, canHapus, onSimpan }: {
  s: SlotJam; canUbah: boolean; canHapus: boolean;
  onSimpan: (kerja: () => Promise<unknown>, sukses: string) => void;
}) {
  const [nama, setNama] = useState(s.nama_slot ?? '');
  const [mulai, setMulai] = useState(s.jam_mulai ?? '');
  const [selesai, setSelesai] = useState(s.jam_selesai ?? '');
  const [urutan, setUrutan] = useState(String(s.urutan));

  useEffect(() => {
    setNama(s.nama_slot ?? ''); setMulai(s.jam_mulai ?? '');
    setSelesai(s.jam_selesai ?? ''); setUrutan(String(s.urutan));
  }, [s]);

  return (
    <tr>
      <td className="border border-border px-1 py-0.5">
        <Input className="h-7 text-xs" aria-label="Nama slot" disabled={!canUbah} value={nama} onChange={(e) => setNama(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input type="time" className="h-7 text-xs" aria-label="Jam mulai" disabled={!canUbah} value={mulai} onChange={(e) => setMulai(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input type="time" className="h-7 text-xs" aria-label="Jam selesai" disabled={!canUbah} value={selesai} onChange={(e) => setSelesai(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input type="number" min={0} className="h-7 text-xs" aria-label="Urutan slot" disabled={!canUbah} value={urutan} onChange={(e) => setUrutan(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <div className="flex justify-center gap-1">
          {canUbah && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Simpan slot"
              onClick={() => onSimpan(
                () => ubahSlot(s.id, {
                  nama_slot: nama || null,
                  jam_mulai: mulai || null,
                  jam_selesai: selesai || null,
                  urutan: Number(urutan) || 0,
                }),
                'Slot disimpan.',
              )}>
              <Save size={14} />
            </Button>
          )}
          {canHapus && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus slot"
              onClick={() => onSimpan(() => hapusSlot(s.id), 'Slot dihapus.')}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
