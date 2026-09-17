import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import {
  createKamusKolom,
  deleteKamusKolom,
  hapusUrutBawaan,
  listKamusKolom,
  listUrutBawaan,
  simpanUrutBawaan,
  skemaKolom,
  updateKamusKolom,
  type ArahUrut,
  type LabelKolom,
  type TabelSkema,
  type UrutBawaan,
} from '../api/kamusLabel';
import { bersihkanCacheKamus } from '@/components/useKamusPeta';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { DeleteAction } from '@/components/RowActions';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';

const BAWAAN = '_bawaan';

const ALIGN_CHOICES = [
  { value: BAWAAN, label: '(bawaan)' },
  { value: 'left', label: 'KIRI' },
  { value: 'center', label: 'TENGAH' },
  { value: 'right', label: 'KANAN' },
];
const YA_TIDAK = [
  { value: 'ya', label: 'YA' },
  { value: 'tidak', label: 'TIDAK' },
];
const ARAH_CHOICES = [
  { value: BAWAAN, label: '(naik)' },
  { value: 'naik', label: 'NAIK' },
  { value: 'turun', label: 'TURUN' },
];
const FORMAT_CHOICES = [
  { value: BAWAAN, label: '(teks)' },
  { value: 'teks', label: 'TEKS' },
  { value: 'angka', label: 'ANGKA' },
  { value: 'tanggal', label: 'TANGGAL' },
  { value: 'ya_tidak', label: 'YA/TIDAK' },
];

const TAIL_FIELDS: ExcelField[] = [
  { key: 'label', label: 'label', width: 180, kind: 'text', maxLength: 100 },
  { key: 'align', label: 'align', width: 110, kind: 'select', choices: ALIGN_CHOICES },
  {
    key: 'lebar', label: 'lebar', width: 90, kind: 'text', maxLength: 3,
    validate: (v) => {
      if (v === null || v === undefined || v.trim() === '') return null;
      const n = Number(v);
      return Number.isInteger(n) && n >= 40 && n <= 600 ? null : 'Lebar 40–600 px.';
    },
  },
  { key: 'kunci', label: 'kunci_lebar', width: 100, kind: 'select', choices: YA_TIDAK },
  { key: 'bisa', label: 'bisa_urut', width: 100, kind: 'select', choices: YA_TIDAK },
  { key: 'arah', label: 'arah_bawaan', width: 110, kind: 'select', choices: ARAH_CHOICES },
  { key: 'tooltip', label: 'tooltip', width: 200, kind: 'text', maxLength: 200 },
  { key: 'format', label: 'format', width: 120, kind: 'select', choices: FORMAT_CHOICES },
];

const URUT_FIELDS: ExcelField[] = [
  { key: 'endpoint', label: 'endpoint', width: 230, kind: 'text', maxLength: 120, required: true },
  {
    key: 'kunci', label: 'kunci (kode dipisah koma, maks 3)', width: 300, kind: 'text', maxLength: 200,
    validate: (v) => {
      if (!v || v.trim() === '') return null;
      const n = v.split(',').map((s) => s.trim()).filter(Boolean).length;
      return n <= 3 ? null : 'Maksimal 3 kunci.';
    },
  },
  { key: 'arah', label: 'arah', width: 110, kind: 'select', choices: ARAH_CHOICES },
];

/** Endpoint urut yang tersedia (dari docs backend-detail §8). */
const ENDPOINT_TERSEDIA = [
  'admin/santri',
  'admin/kelas',
  'admin/lembaga',
  'admin/users',
  'admin/tahun-ajaran',
  'admin/riwayat-belajar',
  'admin/mutasi-keluar',
  'admin/alumni',
  'admin/pengajuan-biodata',
  'psb/antrean-daftar-ulang',
  'admin/lembaga-santri',
];

function kolomValues(r: LabelKolom): Record<string, string | null> {
  return {
    tabel: r.tabel,
    kolom: r.kolom,
    label: r.label,
    align: r.align ?? BAWAAN,
    lebar: r.lebar === null || r.lebar === undefined ? '' : String(r.lebar),
    kunci: r.kunci_lebar ? 'ya' : 'tidak',
    bisa: r.bisa_urut ? 'ya' : 'tidak',
    arah: r.arah_bawaan ?? BAWAAN,
    tooltip: r.tooltip,
    format: r.format ?? BAWAAN,
  };
}

export default function KamusLabelPage() {
  const { user } = useAuth();
  const canTambah = bisa(user, 'kamus_label.tambah');
  const canUbah = bisa(user, 'kamus_label.ubah');
  const canHapus = bisa(user, 'kamus_label.hapus');

  const [rows, setRows] = useState<LabelKolom[]>([]);
  const [urut, setUrut] = useState<UrutBawaan[]>([]);
  const [skema, setSkema] = useState<TabelSkema[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const muat = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const [k, u, s] = await Promise.all([listKamusKolom(), listUrutBawaan(), skemaKolom()]);
      setRows(k.data);
      setUrut(u.data);
      setSkema(s.data);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  /** Pilihan tabel + kolom otomatis dari skema database (tanpa ketik manual). */
  const tabelOpsi = useMemo(
    () => skema.map((s) => ({ value: s.tabel, label: s.tabel })),
    [skema],
  );
  const kolomUntuk = useCallback(
    (tabel?: string | null) => {
      const t = skema.find((s) => s.tabel === tabel);
      if (!t) return [];
      return t.kolom.map((k) => ({ value: k, label: k }));
    },
    [skema],
  );
  const kolomSemua = useMemo(() => {
    const set = new Set<string>();
    for (const s of skema) for (const k of s.kolom) set.add(k);
    return [...set].sort().map((k) => ({ value: k, label: k }));
  }, [skema]);
  const fields = useMemo<ExcelField[]>(() => [
    {
      key: 'tabel', label: 'tabel', width: 190, kind: 'select', required: true,
      choices: tabelOpsi, inputChoices: tabelOpsi,
    },
    {
      key: 'kolom', label: 'kolom', width: 190, kind: 'select', required: true,
      choices: kolomSemua,
      inputChoices: (draft) => kolomUntuk(draft.tabel),
    },
    ...TAIL_FIELDS,
  ], [tabelOpsi, kolomSemua, kolomUntuk]);

  async function commitKolom(id: number, f: Record<string, string | null>) {
    const lama = rows.find((r) => r.id === id);
    if (!lama) return;
    const gab = { ...kolomValues(lama), ...f };
    const arah = gab.arah === BAWAAN ? null : (gab.arah as ArahUrut);
    await updateKamusKolom(id, {
      tabel: gab.tabel ?? lama.tabel,
      kolom: gab.kolom ?? lama.kolom,
      label: gab.label?.trim() ? gab.label.trim() : null,
      align: gab.align === BAWAAN ? null : (gab.align as LabelKolom['align']),
      lebar: gab.lebar ? Number(gab.lebar) : null,
      kunci_lebar: gab.kunci === 'ya',
      bisa_urut: gab.bisa !== 'tidak',
      arah_bawaan: arah,
      tooltip: gab.tooltip?.trim() ? gab.tooltip.trim() : null,
      format: gab.format === BAWAAN ? null : gab.format,
    });
    bersihkanCacheKamus();
    await muat();
  }

  async function tambahKolom(f: Record<string, string | null>) {
    const tabel = (f.tabel ?? '').trim();
    const kolom = (f.kolom ?? '').trim();
    if (!tabel || !kolom) {
      toast.error('Tabel dan kolom wajib diisi.');
      return;
    }
    await createKamusKolom({
      tabel,
      kolom,
      label: f.label?.trim() ? f.label.trim() : null,
      align: f.align && f.align !== BAWAAN ? (f.align as LabelKolom['align']) : null,
      lebar: f.lebar ? Number(f.lebar) : null,
      kunci_lebar: f.kunci === 'ya',
      bisa_urut: f.bisa !== 'tidak',
      arah_bawaan: f.arah && f.arah !== BAWAAN ? (f.arah as ArahUrut) : null,
      tooltip: f.tooltip?.trim() ? f.tooltip.trim() : null,
      format: f.format && f.format !== BAWAAN ? f.format : null,
    });
    bersihkanCacheKamus();
    await muat();
  }

  async function hapusKolom(id: number) {
    try {
      await deleteKamusKolom(id);
      bersihkanCacheKamus();
      toast.success('Kolom kamus dihapus.');
      await muat();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const urutRows = ENDPOINT_TERSEDIA;
  const rowsUrut = [
    ...urutRows.map((endpoint, i) => {
      const db = urut.find((u) => u.endpoint === endpoint);
      return {
        id: db?.id ?? -(i + 1),
        endpoint,
        kunci: (db?.kunci ?? []).join(', '),
        arah: db?.arah ?? 'naik',
        adaDiDb: !!db,
      };
    }),
    ...urut
      .filter((u) => !urutRows.includes(u.endpoint))
      .map((u) => ({
        id: u.id,
        endpoint: u.endpoint,
        kunci: u.kunci.join(', '),
        arah: u.arah,
        adaDiDb: true,
      })),
  ];

  async function commitUrut(id: number, f: Record<string, string | null>) {
    const row = rowsUrut.find((r) => r.id === id);
    if (!row) return;
    const endpoint = (f.endpoint ?? row.endpoint).trim();
    if (!endpoint) {
      toast.error('Endpoint wajib diisi.');
      return;
    }
    const kunci = (f.kunci ?? row.kunci).split(',').map((s) => s.trim()).filter(Boolean);
    await simpanUrutBawaan({ endpoint, kunci, arah: (f.arah ?? row.arah) as ArahUrut });
    await muat();
  }

  async function hapusUrut(id: number) {
    try {
      await hapusUrutBawaan(id);
      toast.success('Urut bawaan dihapus.');
      await muat();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <p className="mb-2 text-xs text-muted-foreground">
        Kamus kolom berlaku untuk SEMUA halaman yang menampilkan kolom itu (satu acuan).
        Daftar tabel dan kolom diambil otomatis dari database. Kosongkan sebuah isian
        untuk memakai bawaan (perangkat/AutoFit).
      </p>

      <h2 className="mb-1 mt-2 text-sm font-medium">Kamus kolom (nama header, perataan, lebar, kontrol urut)</h2>
      <ExcelTable
        tableKey="kamus_label_kolom"
        fields={fields}
        rows={rows}
        getValues={kolomValues}
        loading={loading}
        emptyText="Belum ada kolom di kamus."
        canEdit={canUbah}
        onCommit={commitKolom}
        onSaved={() => {}}
        onCreateRow={canTambah ? tambahKolom : undefined}
        renderActions={(r) => (
          canHapus ? (
            <DeleteAction
              id={`btn_hapus_kamus_${r.id}`}
              title="Hapus kolom kamus?"
              description={`Aturan untuk ${r.tabel}.${r.kolom} akan dihapus.`}
              onConfirm={() => void hapusKolom(r.id)}
            />
          ) : null
        )}
        renderBulkActions={() => null}
        maxRows={14}
      />

      <h2 className="mb-1 mt-4 text-sm font-medium">Urut bawaan per endpoint daftar</h2>
      <ExcelTable
        tableKey="kamus_label_urut"
        fields={URUT_FIELDS}
        rows={rowsUrut}
        getValues={(r) => ({ endpoint: r.endpoint, kunci: r.kunci, arah: r.arah })}
        canEdit={canUbah}
        onCommit={commitUrut}
        onSaved={() => {}}
        renderActions={(r) => (
          canHapus && r.adaDiDb ? (
            <DeleteAction
              id={`btn_hapus_urut_${r.id}`}
              title="Hapus urut bawaan?"
              description={`Endpoint ${r.endpoint} kembali memakai bawaan sistem.`}
              onConfirm={() => void hapusUrut(r.id)}
            />
          ) : null
        )}
        renderBulkActions={() => null}
        maxRows={14}
      />
    </div>
  );
}
