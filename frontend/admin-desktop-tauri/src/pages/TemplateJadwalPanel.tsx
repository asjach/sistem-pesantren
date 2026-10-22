import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LabeledInput from '@/components/LabeledInput';
import ExcelTabelV2 from '@/components/excelV2/ExcelTabelV2';
import type { ExcelField } from '@/components/excel/types';
import { DeleteAction } from '@/components/RowActions';
import { errorMessage } from '@/api/client';
import type { Kelas } from '@/api/master';
import { hitungSlotBaru, menitDariJam } from '@/lib/jadwal';
import { Plus, Trash2 } from '@/icons';
import {
  buatTemplateJadwal, daftarTemplateJadwal, detailTemplateJadwal,
  hapusBarisTemplate, hapusTemplateJadwal, tambahBarisTemplate,
  terapkanTemplate, ubahBarisTemplate, ubahTemplateJadwal,
  HARI_LABEL, JENIS_SLOT_OPTIONS,
  type JenisSlot,
  type TemplateJadwal, type TemplateJadwalBaris, type TemplateJadwalDetail, type TerapkanHasil,
} from '@/api/kurikulum';

const OPSI_HARI = [
  { value: '', label: 'Semua hari' },
  ...['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']
    .map((h) => ({ value: h, label: HARI_LABEL[h] ?? h })),
];

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
  { key: 'hari', label: 'Hari', width: 130, kind: 'select', selectTanpaEdit: true, choices: OPSI_HARI },
  { key: 'urutan_slot', label: 'Jam ke-', width: 90, kind: 'text', maxLength: 2, format: 'angka', required: true, validate: validasiUrutan },
  { key: 'nama_slot', label: 'Nama', width: 180, kind: 'text', maxLength: 50 },
  { key: 'jam_mulai', label: 'Mulai', width: 110, kind: 'text', maxLength: 5, validate: validasiJam },
  { key: 'jam_selesai', label: 'Selesai', width: 110, kind: 'text', maxLength: 5, validate: validasiJam },
  { key: 'jenis', label: 'Jenis', width: 150, kind: 'select', selectTanpaEdit: true, choices: JENIS_SLOT_OPTIONS },
];

function nilaiKerangka(b: TemplateJadwalBaris): Record<string, string | null> {
  return {
    hari: b.hari ?? '',
    urutan_slot: String(b.urutan_slot),
    nama_slot: b.nama_slot ?? null,
    jam_mulai: b.jam_mulai ?? null,
    jam_selesai: b.jam_selesai ?? null,
    jenis: b.jenis,
  };
}

/** Panel tab Template Jadwal: pola mingguan tanpa mapel/guru. */
export default function PanelTemplate({ jenjang, ta, kelasOpsi, kelasId, canTambah, canUbah, canHapus, onTerapkan }: {
  jenjang: string; ta: string; kelasOpsi: Kelas[]; kelasId: number | '';
  canTambah: boolean; canUbah: boolean; canHapus: boolean; onTerapkan: () => void;
}) {
  const [daftar, setDaftar] = useState<TemplateJadwal[]>([]);
  const [terpilih, setTerpilih] = useState<number | ''>('');
  const [detail, setDetail] = useState<TemplateJadwalDetail | null>(null);
  const [namaBaru, setNamaBaru] = useState('');
  const [lingkup, setLingkup] = useState<'jenjang' | 'tingkat' | 'kelas'>('jenjang');
  const [tingkatScope, setTingkatScope] = useState('');
  const [kelasScope, setKelasScope] = useState('');
  const [jpl, setJpl] = useState('00:45');
  const [hariBaru, setHariBaru] = useState('');
  const [hasil, setHasil] = useState<TerapkanHasil | null>(null);

  const tingkatOpsi = useMemo(
    () => [...new Set(kelasOpsi.map((k) => k.tingkat).filter((t): t is string => t !== null))].sort(),
    [kelasOpsi],
  );

  useEffect(() => {
    setTingkatScope((v) => (tingkatOpsi.includes(v) ? v : (tingkatOpsi[0] ?? '')));
  }, [tingkatOpsi]);

  useEffect(() => {
    setKelasScope((v) => (
      kelasOpsi.some((k) => String(k.id) === v) ? v : (kelasOpsi[0] ? String(kelasOpsi[0].id) : '')
    ));
  }, [kelasOpsi]);

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
    if (lingkup === 'tingkat' && tingkatScope === '') { toast.error('Pilih tingkat dulu.'); return; }
    if (lingkup === 'kelas' && kelasScope === '') { toast.error('Pilih kelas dulu.'); return; }
    try {
      const t = await buatTemplateJadwal({
        jenjang,
        nama: namaBaru.trim(),
        ...(lingkup === 'tingkat' ? { tingkat: tingkatScope } : {}),
        ...(lingkup === 'kelas' ? { kelas_id: Number(kelasScope) } : {}),
      });
      toast.success('Template dibuat.');
      setNamaBaru('');
      await segarkan(t.id);
      setTerpilih(t.id);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const tambahJam = async (jenis: JenisSlot) => {
    if (terpilih === '' || detail === null) return;
    const durasi = menitDariJam(jpl);
    if (durasi === null || durasi <= 0) {
      toast.error('Isi jeda 1 JPL dengan jam yang sah (lebih dari 00:00).');
      return;
    }

    const sumber = hariBaru === ''
      ? detail.baris
      : detail.baris.filter((b) => b.hari === null || b.hari === hariBaru);
    const baru = hitungSlotBaru(
      sumber.map((b) => ({
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
        hari: hariBaru || null,
        nama_slot: jenis === 'pelajaran'
          ? baru.nama_slot
          : jenis === 'istirahat' ? 'Istirahat' : 'Pembiasaan',
        jenis,
      });
      toast.success(jenis === 'pelajaran' ? 'Jam ditambah.'
        : jenis === 'istirahat' ? 'Jeda istirahat ditambah.' : 'Kegiatan pembiasaan ditambah.');
      await segarkan(terpilih);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const commitBaris = async (id: number | string, f: Record<string, string | null>) => {
    await ubahBarisTemplate(Number(id), {
      ...(f.hari !== undefined ? { hari: (f.hari ?? '') || null } : {}),
      ...(f.urutan_slot !== undefined ? { urutan_slot: Number(f.urutan_slot) } : {}),
      ...(f.nama_slot !== undefined ? { nama_slot: (f.nama_slot ?? '').trim() || null } : {}),
      ...(f.jam_mulai !== undefined ? { jam_mulai: (f.jam_mulai ?? '').trim() || null } : {}),
      ...(f.jam_selesai !== undefined ? { jam_selesai: (f.jam_selesai ?? '').trim() || null } : {}),
      ...(f.jenis !== undefined ? { jenis: (f.jenis ?? 'pelajaran') as JenisSlot } : {}),
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

  const jalankanTerap = async (
    mode: 'pratinjau' | 'eksekusi', timpa: boolean,
    sasaran: 'kelas' | 'tingkat' | 'jenjang', sasaranId: string,
  ) => {
    if (terpilih === '') return;
    try {
      const r = await terapkanTemplate(Number(terpilih), {
        sasaran, sasaran_id: sasaranId, tahun_ajaran: ta, mode, timpa,
      });
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
          {daftar.map((t) => {
            const lingkupTeks = t.kelas_id !== null
              ? (kelasOpsi.find((k) => k.id === t.kelas_id)?.nama_kelas ?? `Kelas #${t.kelas_id}`)
              : t.tingkat !== null ? `Tingkat ${t.tingkat}` : 'Jenjang';
            return (
              <option key={t.id} value={t.id}>
                {t.nama} · {lingkupTeks}{t.is_active ? '' : ' (nonaktif)'} — {t.baris_count ?? 0} baris
              </option>
            );
          })}
        </select>
        {canTambah && (
          <span className="flex flex-wrap items-center gap-1">
            <select
              id="select_lingkup_template"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              value={lingkup}
              onChange={(e) => setLingkup(e.target.value as 'jenjang' | 'tingkat' | 'kelas')}
            >
              <option value="jenjang">Jenjang</option>
              <option value="tingkat">Tingkat</option>
              <option value="kelas">Kelas</option>
            </select>
            {lingkup === 'tingkat' && (
              <select
                id="select_tingkat_template"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={tingkatScope}
                onChange={(e) => setTingkatScope(e.target.value)}
              >
                {tingkatOpsi.map((t) => <option key={t} value={t}>Tingkat {t}</option>)}
              </select>
            )}
            {lingkup === 'kelas' && (
              <select
                id="select_kelas_template"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={kelasScope}
                onChange={(e) => setKelasScope(e.target.value)}
              >
                {kelasOpsi.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
              </select>
            )}
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
              Pola {jenjang}: {detail.baris.length} baris mingguan.
            </span>
            {canTambah && (
              <>
                <label className="text-xs text-muted-foreground" htmlFor="select_hari_template">Hari</label>
                <select
                  id="select_hari_template"
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                  value={hariBaru}
                  onChange={(e) => setHariBaru(e.target.value)}
                >
                  {OPSI_HARI.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <LabeledInput
                  label="1 JPL"
                  htmlFor="input_jpl_template"
                  type="time"
                  value={jpl}
                  onChange={(e) => setJpl(e.target.value)}
                  lebarKotak={190}
                />
                <Button type="button" variant="outline" size="sm" id="btn_tambah_jam_template"
                  onClick={() => void tambahJam('pelajaran')}>
                  <Plus size={14} /> Tambah
                </Button>
                <Button type="button" variant="outline" size="sm" id="btn_tambah_istirahat_template"
                  onClick={() => void tambahJam('istirahat')}>
                  <Plus size={14} /> Istirahat
                </Button>
                <Button type="button" variant="outline" size="sm" id="btn_tambah_pembiasaan_template"
                  onClick={() => void tambahJam('pembiasaan')}>
                  <Plus size={14} /> Pembiasaan
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
            <ExcelTabelV2<TemplateJadwalBaris>
              tableKey="kurikulum_template_jadwal"
              fields={FIELDS_KERANGKA}
              rows={detail.baris}
              getValues={nilaiKerangka}
              canEdit={canUbah}
              onCommit={commitBaris}
              onSaved={() => segarkan(terpilih)}
              // Preset kolom V2 sudah menentukan kolom yang tampil.
              onApplyPreset={() => {}}
              renderActions={renderActions}
              hideCheckbox
              hidePreset
              emptyText="Belum ada jam di kerangka ini — tambah lewat tombol di atas."
            />
          </div>

          <div className="shrink-0 border-t border-border px-3 py-2">
            <TerapkanKerangka
              jenjang={jenjang} kelasOpsi={kelasOpsi} kelasId={kelasId}
              canTambah={canTambah} aktif={detail.template.is_active}
              hasil={hasil} jalankanTerap={jalankanTerap} />
          </div>
        </>
      )}
    </div>
  );
}

/** Panel terapkan template → generate jadwal sasaran kelas/tingkat/jenjang. */
function TerapkanKerangka({ jenjang, kelasOpsi, kelasId, canTambah, aktif, hasil, jalankanTerap }: {
  jenjang: string; kelasOpsi: Kelas[]; kelasId: number | '';
  canTambah: boolean; aktif: boolean; hasil: TerapkanHasil | null;
  jalankanTerap: (
    mode: 'pratinjau' | 'eksekusi', timpa: boolean,
    sasaran: 'kelas' | 'tingkat' | 'jenjang', sasaranId: string,
  ) => Promise<void>;
}) {
  const [timpa, setTimpa] = useState(false);
  const [sasaran, setSasaran] = useState<'kelas' | 'tingkat' | 'jenjang'>('kelas');
  const [sasaranId, setSasaranId] = useState(kelasId !== '' ? String(kelasId) : '');
  const tingkatOpsi = useMemo(
    () => [...new Set(kelasOpsi.map((k) => k.tingkat).filter((t): t is string => t !== null))].sort(),
    [kelasOpsi],
  );
  const tingkatKelasAktif = kelasOpsi.find((k) => k.id === kelasId)?.tingkat ?? null;
  const kelasIdSebelumnya = useRef<number | ''>(kelasId);

  useEffect(() => {
    if (kelasIdSebelumnya.current === kelasId) return;
    kelasIdSebelumnya.current = kelasId;
    if (kelasId === '') return;
    if (sasaran === 'kelas') setSasaranId(String(kelasId));
    else if (sasaran === 'tingkat' && tingkatKelasAktif !== null) setSasaranId(tingkatKelasAktif);
  }, [kelasId, sasaran, tingkatKelasAktif]);

  useEffect(() => {
    const valid = sasaran === 'kelas'
      ? kelasOpsi.some((k) => String(k.id) === sasaranId)
      : sasaran === 'tingkat' ? tingkatOpsi.includes(sasaranId) : sasaranId === jenjang;
    if (valid) return;
    setSasaranId(sasaran === 'kelas'
      ? (kelasId !== '' ? String(kelasId) : (kelasOpsi[0] ? String(kelasOpsi[0].id) : ''))
      : sasaran === 'tingkat' ? (tingkatKelasAktif ?? tingkatOpsi[0] ?? '') : jenjang);
  }, [sasaran, kelasOpsi, tingkatOpsi, jenjang, sasaranId, kelasId, tingkatKelasAktif]);

  const bisaTerap = canTambah && aktif && sasaranId !== '';
  const idSasaran = sasaran === 'jenjang' ? jenjang : sasaranId;

  return (
    <div>
      <p className="text-xs font-medium">Terapkan template ke jadwal</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Membuat kerangka JP kosong per kelas; isi mapel + guru manual di tab Jadwal.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="select_sasaran_template">Sasaran</label>
        <select
          id="select_sasaran_template"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={sasaran}
          onChange={(e) => setSasaran(e.target.value as 'kelas' | 'tingkat' | 'jenjang')}
        >
          <option value="kelas">Kelas</option>
          <option value="tingkat">Tingkat</option>
          <option value="jenjang">Jenjang</option>
        </select>
        {sasaran === 'kelas' && (
          <select
            id="select_sasaran_kelas"
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            value={sasaranId}
            onChange={(e) => setSasaranId(e.target.value)}
          >
            {kelasOpsi.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        )}
        {sasaran === 'tingkat' && (
          <select
            id="select_sasaran_tingkat"
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            value={sasaranId}
            onChange={(e) => setSasaranId(e.target.value)}
          >
            {tingkatOpsi.map((t) => <option key={t} value={t}>Tingkat {t}</option>)}
          </select>
        )}
        {sasaran === 'jenjang' && <span className="text-xs font-medium">{jenjang}</span>}
        <label className="flex items-center gap-1 text-xs text-muted-foreground" htmlFor="cek_timpa_jadwal">
          <input type="checkbox" id="cek_timpa_jadwal" checked={timpa} disabled={!bisaTerap}
            onChange={(e) => setTimpa(e.target.checked)} />
          Timpa jadwal kelas + ganti kerangka
        </label>
        {canTambah && (
          <>
            <Button type="button" variant="outline" size="sm" id="btn_pratinjau_template" disabled={!bisaTerap}
              onClick={() => void jalankanTerap('pratinjau', timpa, sasaran, idSasaran)}>
              Pratinjau
            </Button>
            <Button type="button" variant="default" size="sm" id="btn_terapkan_template" disabled={!bisaTerap}
              onClick={() => void jalankanTerap('eksekusi', timpa, sasaran, idSasaran)}>
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
