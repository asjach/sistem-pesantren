import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/api/client';
import { Plus, Save, Trash2, X } from '@/icons';
import {
  buatTemplateJadwal, daftarTemplateJadwal, detailTemplateJadwal,
  hapusBarisTemplate, hapusTemplateJadwal, tambahBarisTemplate,
  terapkanTemplate, ubahBarisTemplate, ubahTemplateJadwal,
  type TemplateJadwal, type TemplateJadwalDetail, type TerapkanHasil,
} from '@/api/kurikulum';

/** Panel tab Template Jadwal: kerangka jam murni (tanpa mapel/pengampu). */
export default function PanelTemplate({ jenjang, canTambah, canUbah, canHapus, onTerapkan }: {
  jenjang: string; canTambah: boolean; canUbah: boolean; canHapus: boolean; onTerapkan: () => void;
}) {
  const [daftar, setDaftar] = useState<TemplateJadwal[]>([]);
  const [terpilih, setTerpilih] = useState<number | ''>('');
  const [detail, setDetail] = useState<TemplateJadwalDetail | null>(null);
  const [namaBaru, setNamaBaru] = useState('');
  const [hasil, setHasil] = useState<TerapkanHasil | null>(null);

  const muatDaftar = useCallback(async () => {
    if (jenjang === '') return;
    try {
      const r = await daftarTemplateJadwal(jenjang);
      setDaftar(r);
      setTerpilih((v) => (r.some((t) => t.id === v) ? v : (r[0]?.id ?? '')));
    } catch (e) { toast.error(errorMessage(e)); }
  }, [jenjang]);

  const muatDetail = useCallback(async (id: number | '') => {
    if (id === '') { setDetail(null); setHasil(null); return; }
    try {
      setDetail(await detailTemplateJadwal(Number(id)));
      setHasil(null);
    } catch (e) { toast.error(errorMessage(e)); }
  }, []);

  useEffect(() => { void muatDaftar(); }, [muatDaftar]);
  useEffect(() => { void muatDetail(terpilih); }, [terpilih, muatDetail]);

  const segarkan = useCallback(async (id: number | '') => {
    await muatDaftar();
    await muatDetail(id);
  }, [muatDaftar, muatDetail]);

  const buat = async () => {
    if (namaBaru.trim() === '') { toast.error('Nama template wajib diisi.'); return; }
    try {
      const t = await buatTemplateJadwal({ jenjang, nama: namaBaru.trim() });
      toast.success('Template dibuat.');
      setNamaBaru('');
      await segarkan(t.id);
      setTerpilih(t.id);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const tambahJam = async (isIstirahat: boolean) => {
    if (terpilih === '') return;
    try {
      await tambahBarisTemplate(Number(terpilih), {
        nama_slot: isIstirahat ? 'Istirahat' : null,
        is_istirahat: isIstirahat,
      });
      toast.success(isIstirahat ? 'Jeda istirahat ditambah.' : 'Jam ditambah.');
      await segarkan(terpilih);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const jalankanTerap = async (mode: 'pratinjau' | 'eksekusi', timpa: boolean) => {
    if (terpilih === '') return;
    try {
      const r = await terapkanTemplate(Number(terpilih), { mode, timpa });
      setHasil(r);
      toast.success(r.pesan);
      if (mode === 'eksekusi') onTerapkan();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <label className="text-xs text-muted-foreground" htmlFor="select_template_jadwal">Template</label>
        <select
          id="select_template_jadwal"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={terpilih === '' ? '' : String(terpilih)}
          onChange={(e) => setTerpilih(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">— pilih template —</option>
          {daftar.map((t) => (
            <option key={t.id} value={t.id}>{t.nama}{t.is_active ? '' : ' (nonaktif)'} — {t.baris_count ?? 0} jam</option>
          ))}
        </select>
        {canTambah && (
          <span className="flex items-center gap-1">
            <Input
              className="h-8 w-44 text-xs" id="input_nama_template" placeholder="Mis. 8 JP + istirahat"
              value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)}
            />
            <Button type="button" variant="outline" size="sm" id="btn_buat_template" onClick={() => void buat()}>
              <Plus size={14} /> Buat
            </Button>
          </span>
        )}
      </div>

      {detail === null ? (
        <p className="p-4 text-xs text-muted-foreground">
          {daftar.length === 0
            ? 'Belum ada template untuk jenjang ini — buat lewat kolom nama di atas (mis. "8 JP + istirahat", "6 JP").'
            : 'Pilih template untuk menyusun kerangkanya.'}
        </p>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-xs font-medium">{detail.template.nama}</span>
            <span className="text-[11px] text-muted-foreground">
              Kerangka {jenjang}: {detail.baris.length} jam, berlaku semua hari aktif.
            </span>
            {canHapus && (
              <Button
                type="button" variant="ghost" size="sm" id="btn_hapus_template"
                onClick={() => {
                  if (terpilih === '') return;
                  if (!window.confirm(`Hapus template "${detail.template.nama}"?`)) return;
                  void hapusTemplateJadwal(Number(terpilih))
                    .then(() => { toast.success('Template dihapus.'); setTerpilih(''); void muatDaftar(); })
                    .catch((e) => toast.error(errorMessage(e)));
                }}
              >
                <Trash2 size={14} /> Hapus
              </Button>
            )}
            {canUbah && (
              <label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground" htmlFor="cek_template_aktif">
                <input
                  type="checkbox" id="cek_template_aktif" checked={detail.template.is_active}
                  onChange={(e) => {
                    if (terpilih === '') return;
                    void ubahTemplateJadwal(Number(terpilih), { is_active: e.target.checked })
                      .then(() => segarkan(terpilih))
                      .catch((err) => toast.error(errorMessage(err)));
                  }}
                />
                Aktif
              </label>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <table className="w-full max-w-2xl border-collapse text-xs" id="tabel_template_jadwal">
              <thead className="bg-muted/60">
                <tr>
                  <th className="border border-border px-2 py-1 text-left w-16">Jam ke-</th>
                  <th className="border border-border px-2 py-1 text-left">Nama</th>
                  <th className="border border-border px-2 py-1 w-24">Mulai</th>
                  <th className="border border-border px-2 py-1 w-24">Selesai</th>
                  <th className="border border-border px-2 py-1 w-24">Istirahat</th>
                  <th className="border border-border px-2 py-1 w-20">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {detail.baris.map((b) => (
                  <BarisKerangka key={b.id} barisId={b.id}
                    nama={b.nama_slot ?? ''} mulai={b.jam_mulai ?? ''} selesai={b.jam_selesai ?? ''}
                    urutan={b.urutan_slot} istirahat={b.is_istirahat}
                    canUbah={canUbah} canHapus={canHapus} terpilih={terpilih} segarkan={segarkan} />
                ))}
                {detail.baris.length === 0 && (
                  <tr><td colSpan={6} className="border border-border px-2 py-4 text-center text-muted-foreground">
                    Belum ada jam di kerangka ini — tambah lewat tombol di bawah.
                  </td></tr>
                )}
              </tbody>
            </table>

            {canTambah && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" id="btn_tambah_jam_template"
                  onClick={() => void tambahJam(false)}>
                  <Plus size={14} /> Tambah jam
                </Button>
                <Button type="button" variant="outline" size="sm" id="btn_tambah_istirahat_template"
                  onClick={() => void tambahJam(true)}>
                  <Plus size={14} /> Tambah istirahat
                </Button>
              </div>
            )}

            <TerapkanKerangka
              jenjang={jenjang} canTambah={canTambah} aktif={detail.template.is_active}
              hasil={hasil} jalankanTerap={jalankanTerap} />
          </div>
        </>
      )}
    </div>
  );
}

/** Satu baris jam kerangka dengan penyuntingan inline. */
function BarisKerangka({ barisId, nama, mulai, selesai, urutan, istirahat, canUbah, canHapus, terpilih, segarkan }: {
  barisId: number; nama: string; mulai: string; selesai: string; urutan: number; istirahat: boolean;
  canUbah: boolean; canHapus: boolean; terpilih: number | ''; segarkan: (id: number | '') => Promise<void>;
}) {
  const [namaBaru, setNamaBaru] = useState(nama);
  const [mulaiBaru, setMulaiBaru] = useState(mulai);
  const [selesaiBaru, setSelesaiBaru] = useState(selesai);
  const [urutanBaru, setUrutanBaru] = useState(String(urutan));
  const [istirahatBaru, setIstirahatBaru] = useState(istirahat);

  useEffect(() => {
    setNamaBaru(nama); setMulaiBaru(mulai); setSelesaiBaru(selesai);
    setUrutanBaru(String(urutan)); setIstirahatBaru(istirahat);
  }, [nama, mulai, selesai, urutan, istirahat]);

  const simpan = () => {
    // Kunci kontrak BE = `urutan_slot` (bukan `urutan`: dulu terkirim sebagai
    // field tak dikenal sehingga perubahan "Jam ke-" hilang tanpa galat).
    // Kosong = kirim tanpa kunci itu, agar aturan `sometimes|min:1` tak dilanggar.
    const urutan = Number(urutanBaru);
    void ubahBarisTemplate(barisId, {
      nama_slot: namaBaru || null,
      jam_mulai: mulaiBaru || null,
      jam_selesai: selesaiBaru || null,
      ...(Number.isInteger(urutan) && urutan >= 1 ? { urutan_slot: urutan } : {}),
      is_istirahat: istirahatBaru,
    })
      .then(() => { toast.success('Jam disimpan.'); void segarkan(terpilih); })
      .catch((e) => toast.error(errorMessage(e)));
  };

  return (
    <tr>
      <td className="border border-border px-1 py-0.5">
        <Input type="number" min={1} className="h-7 text-xs" aria-label="Jam ke-" disabled={!canUbah}
          value={urutanBaru} onChange={(e) => setUrutanBaru(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input className="h-7 text-xs" aria-label="Nama jam" disabled={!canUbah}
          value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input type="time" className="h-7 text-xs" aria-label="Jam mulai" disabled={!canUbah}
          value={mulaiBaru} onChange={(e) => setMulaiBaru(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <Input type="time" className="h-7 text-xs" aria-label="Jam selesai" disabled={!canUbah}
          value={selesaiBaru} onChange={(e) => setSelesaiBaru(e.target.value)} />
      </td>
      <td className="border border-border px-1 py-0.5 text-center">
        <input type="checkbox" aria-label="Istirahat" disabled={!canUbah}
          checked={istirahatBaru} onChange={(e) => setIstirahatBaru(e.target.checked)} />
      </td>
      <td className="border border-border px-1 py-0.5">
        <div className="flex justify-center gap-1">
          {canUbah && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Simpan jam" onClick={simpan}>
              <Save size={14} />
            </Button>
          )}
          {canHapus && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Hapus jam"
              onClick={() => void hapusBarisTemplate(barisId)
                .then(() => segarkan(terpilih))
                .catch((e) => toast.error(errorMessage(e)))}>
              <X size={12} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Panel terapkan kerangka → membuat slot jam nyata di jenjang itu. */
function TerapkanKerangka({ jenjang, canTambah, aktif, hasil, jalankanTerap }: {
  jenjang: string; canTambah: boolean; aktif: boolean; hasil: TerapkanHasil | null;
  jalankanTerap: (mode: 'pratinjau' | 'eksekusi', timpa: boolean) => Promise<void>;
}) {
  const [timpa, setTimpa] = useState(false);
  const bisaTerap = canTambah && aktif;

  return (
    <div className="mt-3 border-t border-border pt-2">
      <p className="text-xs font-medium">Terapkan ke slot jam {jenjang}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Membuat slot jam nyata dari kerangka ini. Jeda istirahat tidak dibuatkan slot.
        Pengisian mapel/guru tetap manual di tab Jadwal.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-muted-foreground" htmlFor="cek_timpa_slot">
          <input type="checkbox" id="cek_timpa_slot" checked={timpa} disabled={!bisaTerap}
            onChange={(e) => setTimpa(e.target.checked)} />
          Timpa slot yang sudah ada
        </label>
        {canTambah && (
          <>
            <Button type="button" variant="outline" size="sm" id="btn_pratinjau_template" disabled={!bisaTerap}
              onClick={() => void jalankanTerap('pratinjau', timpa)}>
              Pratinjau
            </Button>
            <Button type="button" variant="default" size="sm" id="btn_terapkan_template" disabled={!bisaTerap}
              onClick={() => void jalankanTerap('eksekusi', timpa)}>
              Terapkan
            </Button>
          </>
        )}
      </div>
      {!aktif && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Template nonaktif — centang <span className="font-medium">Aktif</span> di atas untuk menerapkannya.
        </p>
      )}
      {hasil !== null && (
        <div className="mt-2 text-xs">
          <p className="font-medium">{hasil.pesan}</p>
          {hasil.dilewati.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {hasil.dilewati.map((d, i) => (
                <li key={i}><span className="font-medium text-foreground">{d.sel}</span>: {d.alasan}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
