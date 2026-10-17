import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LabeledInput from '@/components/LabeledInput';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { DeleteAction } from '@/components/RowActions';
import { errorMessage } from '@/api/client';
import { hitungSlotBaru, menitDariJam } from '@/lib/jadwal';
import { Plus, Trash2 } from '@/icons';
import {
  buatTemplateJadwal, daftarTemplateJadwal, detailTemplateJadwal,
  hapusBarisTemplate, hapusTemplateJadwal, tambahBarisTemplate,
  terapkanTemplate, ubahBarisTemplate, ubahTemplateJadwal,
  type TemplateJadwal, type TemplateJadwalBaris, type TemplateJadwalDetail, type TerapkanHasil,
} from '@/api/kurikulum';

function validasiJam(v: string | null): string | null {
  if (v === null || v.trim() === '') return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim()) ? null : 'Format jam HH:MM.';
}

function validasiUrutan(v: string | null): string | null {
  if (v === null || v.trim() === '') return 'Jam ke- wajib diisi.';
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 99 ? null : 'Jam ke- harus bilangan bulat 1–99.';
}

export const FIELDS_KERANGKA: ExcelField[] = [
  { key: 'urutan_slot', label: 'Jam ke-', width: 90, kind: 'text', maxLength: 2, format: 'angka', required: true, validate: validasiUrutan },
  { key: 'nama_slot', label: 'Nama', width: 180, kind: 'text', maxLength: 50 },
  { key: 'jam_mulai', label: 'Mulai', width: 110, kind: 'text', maxLength: 5, validate: validasiJam },
  { key: 'jam_selesai', label: 'Selesai', width: 110, kind: 'text', maxLength: 5, validate: validasiJam },
  { key: 'is_istirahat', label: 'Istirahat', width: 100, kind: 'toggle', toggleTanpaEdit: true },
];

function nilaiKerangka(b: TemplateJadwalBaris): Record<string, string | null> {
  return {
    urutan_slot: String(b.urutan_slot),
    nama_slot: b.nama_slot ?? null,
    jam_mulai: b.jam_mulai ?? null,
    jam_selesai: b.jam_selesai ?? null,
    is_istirahat: b.is_istirahat ? 'ya' : 'tidak',
  };
}

/** Panel tab Template Jadwal: kerangka jam murni (tanpa mapel/pengampu). */
export default function PanelTemplate({ jenjang, canTambah, canUbah, canHapus, onTerapkan }: {
  jenjang: string; canTambah: boolean; canUbah: boolean; canHapus: boolean; onTerapkan: () => void;
}) {
  const [daftar, setDaftar] = useState<TemplateJadwal[]>([]);
  const [terpilih, setTerpilih] = useState<number | ''>('');
  const [detail, setDetail] = useState<TemplateJadwalDetail | null>(null);
  const [namaBaru, setNamaBaru] = useState('');
  const [jpl, setJpl] = useState('00:45');
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
    if (terpilih === '' || detail === null) return;
    const durasi = menitDariJam(jpl);
    if (durasi === null || durasi <= 0) {
      toast.error('Isi jeda 1 JPL dengan jam yang sah (lebih dari 00:00).');
      return;
    }
    const baru = hitungSlotBaru(
      detail.baris.map((b) => ({
        jam_mulai: b.jam_mulai,
        jam_selesai: b.jam_selesai,
        urutan: b.urutan_slot,
      })),
      durasi,
    );
    if (baru === null) {
      toast.error('Baris baru akan melewati pukul 23:59.');
      return;
    }
    try {
      await tambahBarisTemplate(Number(terpilih), {
        ...baru,
        nama_slot: isIstirahat ? 'Istirahat' : baru.nama_slot,
        is_istirahat: isIstirahat,
      });
      toast.success(isIstirahat ? 'Jeda istirahat ditambah.' : 'Jam ditambah.');
      await segarkan(terpilih);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const commitBaris = async (id: number | string, f: Record<string, string | null>) => {
    await ubahBarisTemplate(Number(id), {
      ...(f.urutan_slot !== undefined ? { urutan_slot: Number(f.urutan_slot) } : {}),
      ...(f.nama_slot !== undefined ? { nama_slot: (f.nama_slot ?? '').trim() || null } : {}),
      ...(f.jam_mulai !== undefined ? { jam_mulai: (f.jam_mulai ?? '').trim() || null } : {}),
      ...(f.jam_selesai !== undefined ? { jam_selesai: (f.jam_selesai ?? '').trim() || null } : {}),
      ...(f.is_istirahat !== undefined ? { is_istirahat: f.is_istirahat === 'ya' } : {}),
    });
  };

  const hapusBaris = async (b: TemplateJadwalBaris) => {
    try {
      await hapusBarisTemplate(b.id);
      toast.success('Jam dihapus.');
      await segarkan(terpilih);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const renderActions = (b: TemplateJadwalBaris) => (
    canHapus ? (
      <DeleteAction
        id={`btn_hapus_baris_template_${b.id}`}
        title="Hapus jam?"
        description={`Jam ke-${b.urutan_slot} akan dihapus dari kerangka.`}
        onConfirm={() => void hapusBaris(b)}
      />
    ) : null
  );

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
            {canTambah && (
              <>
                <LabeledInput
                  label="1 JPL"
                  htmlFor="input_jpl_template"
                  type="time"
                  value={jpl}
                  onChange={(e) => setJpl(e.target.value)}
                  lebarKotak={190}
                />
                <Button type="button" variant="outline" size="sm" id="btn_tambah_jam_template"
                  onClick={() => void tambahJam(false)}>
                  <Plus size={14} /> Tambah
                </Button>
                <Button type="button" variant="outline" size="sm" id="btn_tambah_istirahat_template"
                  onClick={() => void tambahJam(true)}>
                  <Plus size={14} /> Istirahat
                </Button>
              </>
            )}
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

          <div className="min-h-0 flex-1 p-3">
            <ExcelTable<TemplateJadwalBaris>
              tableKey="kurikulum_template_jadwal"
              sumberTabel="template_jadwal_baris"
              fields={FIELDS_KERANGKA}
              rows={detail.baris}
              getValues={nilaiKerangka}
              canEdit={canUbah}
              onCommit={commitBaris}
              onSaved={() => segarkan(terpilih)}
              renderActions={renderActions}
              hideCheckbox
              hidePreset
              aksiLangsung
              emptyText="Belum ada jam di kerangka ini — tambah lewat tombol di atas."
            />
          </div>

          <div className="shrink-0 border-t border-border px-3 py-2">
            <TerapkanKerangka
              jenjang={jenjang} canTambah={canTambah} aktif={detail.template.is_active}
              hasil={hasil} jalankanTerap={jalankanTerap} />
          </div>
        </>
      )}
    </div>
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
    <div>
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
