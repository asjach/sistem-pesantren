import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import {
  createKamusKolom,
  deleteKamusKolom,
  generasiLabel,
  listKamusKolom,
  skemaKolom,
  updateKamusKolom,
  type LabelKolom,
  type ModeLabel,
  type TabelSkema,
} from '../api/kamusLabel';
import { bersihkanCacheKamus } from '@/components/useKamusPeta';
import ComboCari from '@/components/ComboCari';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import MenuAksiToolbar from '@/components/MenuAksiToolbar';
import { DeleteAction } from '@/components/RowActions';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { TopBarSearch } from '@/components/TopBarSearch';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const BAWAAN = '_bawaan';

/** Glyph perataan: – bawaan, ← kiri, ↔ tengah, → kanan. */
const ALIGN_CHOICES = [
  { value: BAWAAN, label: '–' },
  { value: 'left', label: '←' },
  { value: 'center', label: '↔' },
  { value: 'right', label: '→' },
];
const FORMAT_CHOICES = [
  { value: BAWAAN, label: '(teks)' },
  { value: 'teks', label: 'TEKS' },
  { value: 'angka', label: 'ANGKA' },
  { value: 'tanggal', label: 'TANGGAL' },
  { value: 'ya_tidak', label: 'YA/TIDAK' },
];

/** Nama gaya tombol generate, dipakai di dialog konfirmasi. */
const MODE_LABEL: Record<ModeLabel, string> = {
  upper: 'UPPERCASE',
  proper: 'Proper Case',
  lower: 'lower case',
};

const FIELDS: ExcelField[] = [
  { key: 'kolom', label: 'kolom', width: 190, kind: 'static' },
  { key: 'label', label: 'label', width: 200, kind: 'text', maxLength: 100 },
  { key: 'align', label: 'align', width: 70, kind: 'select', choices: ALIGN_CHOICES },
  { key: 'tooltip', label: 'tooltip', width: 220, kind: 'text', maxLength: 200 },
  { key: 'format', label: 'format', width: 120, kind: 'select', choices: FORMAT_CHOICES },
  {
    key: 'lebar', label: 'lebar', width: 90, kind: 'text', maxLength: 3,
    validate: (v) => {
      if (v === null || v === undefined || v.trim() === '') return null;
      const n = Number(v);
      return Number.isInteger(n) && n >= 40 && n <= 600 ? null : 'Lebar 40–600 px.';
    },
  },
  { key: 'kunci', label: 'kunci_lebar', width: 90, kind: 'toggle' },
];

interface BarisKamus {
  id: string;
  kolom: string;
  entri: LabelKolom | null;
}

function barisValues(r: BarisKamus): Record<string, string | null> {
  const e = r.entri;
  return {
    kolom: r.kolom,
    label: e?.label ?? '',
    align: e?.align ?? BAWAAN,
    tooltip: e?.tooltip ?? '',
    format: e?.format ?? BAWAAN,
    lebar: e?.lebar === null || e?.lebar === undefined ? '' : String(e.lebar),
    kunci: e?.kunci_lebar ? 'ya' : 'tidak',
  };
}

/** Halaman Kamus Label: pilih tabel → grid berisi SATU BARIS PER KOLOM tabel
 *  itu; admin cukup mengisi label/perataan/lebar dll. Satu acuan untuk semua
 *  halaman yang menampilkan kolom tersebut (berbasis tabel database). */
export default function KamusLabelPage() {
  const { user } = useAuth();
  const canTambah = bisa(user, 'kamus_label.tambah');
  const canUbah = bisa(user, 'kamus_label.ubah');
  const canHapus = bisa(user, 'kamus_label.hapus');

  const [skema, setSkema] = useState<TabelSkema[]>([]);
  const [tabel, setTabel] = useState('');
  const [rows, setRows] = useState<BarisKamus[]>([]);
  const [cari, setCari] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  /** Mode label yang menunggu konfirmasi timpa; null = dialog tertutup. */
  const [modeTunggu, setModeTunggu] = useState<ModeLabel | null>(null);
  const [sedangGenerasi, setSedangGenerasi] = useState(false);
  /** id entri yang baru dibuat (agar edit sel berikutnya memakai PUT). */
  const idBaruRef = useRef(new Map<string, number>());

  const muatSkema = useCallback(async () => {
    try {
      const res = await skemaKolom();
      setSkema(res.data);
      setTabel((cur) => {
        if (cur) return cur;
        return res.data.find((s) => s.tabel === 'santri')?.tabel ?? res.data[0]?.tabel ?? '';
      });
    } catch (e) {
      setErr(errorMessage(e));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void muatSkema();
  }, [muatSkema]);

  const muatRows = useCallback(async (namaTabel: string) => {
    if (!namaTabel) {
      setRows([]);
      setLoading(false);
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const res = await listKamusKolom({ tabel: namaTabel });
      const entri = new Map(res.data.map((k) => [k.kolom, k]));
      const skemaTabel = skema.find((s) => s.tabel === namaTabel);
      setRows((skemaTabel?.kolom ?? []).map((k) => ({ id: k, kolom: k, entri: entri.get(k) ?? null })));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [skema]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    setCari('');
    idBaruRef.current.clear();
    void muatRows(tabel);
  }, [tabel, muatRows]);

  const barisTampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return q === '' ? rows : rows.filter((r) => r.kolom.toLowerCase().includes(q));
  }, [rows, cari]);

  const totalKolom = useMemo(() => skema.reduce((n, s) => n + s.kolom.length, 0), [skema]);
  const bolehGenerate = canTambah && canUbah && !sedangGenerasi;

  /** Simpan satu baris (auto-save per sel): POST bila entri belum ada, PUT bila sudah. */
  async function commitBaris(id: string | number, f: Record<string, string | null>) {
    const baris = rowsRef.current.find((r) => r.kolom === id);
    if (!baris) return;
    const gab = { ...barisValues(baris), ...f };
    const payload = {
      tabel,
      kolom: baris.kolom,
      label: gab.label?.trim() ? gab.label.trim() : null,
      align: gab.align && gab.align !== BAWAAN ? (gab.align as LabelKolom['align']) : null,
      lebar: gab.lebar ? Number(gab.lebar) : null,
      kunci_lebar: gab.kunci === 'ya',
      tooltip: gab.tooltip?.trim() ? gab.tooltip.trim() : null,
      format: gab.format && gab.format !== BAWAAN ? gab.format : null,
    };
    const idAda = baris.entri?.id ?? idBaruRef.current.get(baris.kolom);
    if (idAda) {
      await updateKamusKolom(idAda, payload);
    } else {
      const res = await createKamusKolom(payload);
      idBaruRef.current.set(baris.kolom, res.data.id);
    }
    bersihkanCacheKamus();
  }

  async function resetBaris(r: BarisKamus) {
    const id = r.entri?.id ?? idBaruRef.current.get(r.kolom);
    if (!id) return;
    try {
      await deleteKamusKolom(id);
      idBaruRef.current.delete(r.kolom);
      bersihkanCacheKamus();
      toast.success('Kembali ke tampilan bawaan.');
      await muatRows(tabel);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  /** Jalankan generasi label untuk mode yang sudah dikonfirmasi. */
  async function prosesGenerasi() {
    const mode = modeTunggu;
    if (!mode || sedangGenerasi) return;
    setSedangGenerasi(true);
    try {
      const res = await generasiLabel(mode);
      bersihkanCacheKamus();
      await muatRows(tabel);
      toast.success(`${res.data.jumlah} label kolom diperbarui.`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSedangGenerasi(false);
      setModeTunggu(null);
    }
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari kolom…" />
      <ExcelTable
        tableKey="kamus_label_kolom"
        fields={FIELDS}
        rows={barisTampil}
        getValues={barisValues}
        loading={loading}
        emptyText={tabel ? 'Tabel ini tidak punya kolom.' : 'Pilih tabel dulu.'}
        canEdit={canUbah}
        onCommit={commitBaris}
        onSaved={() => void muatRows(tabel)}
        awalanToolbar={
          <FilterField label="Tabel" htmlFor="select_tabel_kamus">
            <ComboCari
              id="select_tabel_kamus"
              inputId="input_cari_tabel_kamus"
              className="w-56"
              value={tabel}
              onChange={setTabel}
              placeholder="Pilih tabel…"
              kosongText="Tidak ada tabel cocok."
              options={skema.map((s) => ({ value: s.tabel, label: s.tabel }))}
            />
          </FilterField>
        }
        akhirToolbar={
          <MenuAksiToolbar triggerId="btn_aksi_kamus_label" label="Generate">
            <Button
              id="btn_label_upper"
              title="Isi label semua kolom dengan huruf kapital (underscore → spasi)"
              disabled={!bolehGenerate}
              onClick={() => setModeTunggu('upper')}
            >
              UPPERCASE
            </Button>
            <Button
              id="btn_label_proper"
              title="Isi label semua kolom dengan huruf awal kapital (underscore → spasi)"
              disabled={!bolehGenerate}
              onClick={() => setModeTunggu('proper')}
            >
              Proper Case
            </Button>
            <Button
              id="btn_label_lower"
              title="Isi label semua kolom dengan huruf kecil (underscore → spasi)"
              disabled={!bolehGenerate}
              onClick={() => setModeTunggu('lower')}
            >
              lower case
            </Button>
          </MenuAksiToolbar>
        }
        renderActions={(r) => (
          canHapus && (r.entri || idBaruRef.current.has(r.kolom)) ? (
            <DeleteAction
              id={`btn_reset_kamus_${r.kolom}`}
              title="Kembalikan ke bawaan?"
              description={`Aturan untuk ${tabel}.${r.kolom} dihapus; kolom kembali memakai tampilan bawaan.`}
              onConfirm={() => void resetBaris(r)}
            />
          ) : null
        )}
        hidePreset
      />

      {!canTambah && !canUbah ? (
        <p className="mt-2 shrink-0 text-xs text-muted-foreground">
          Hanya admin pesantren yang dapat mengubah kamus label.
        </p>
      ) : null}

      <AlertDialog
        open={modeTunggu !== null}
        onOpenChange={(o) => {
          if (!o) setModeTunggu(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buat label otomatis?</AlertDialogTitle>
            <AlertDialogDescription>
              Label untuk SEMUA kolom di {skema.length} tabel ({totalKolom} kolom) akan ditulis ulang
              dari nama kolom dengan gaya {modeTunggu ? MODE_LABEL[modeTunggu] : ''}, underscore jadi
              spasi. Kolom teknis (id, *_id, *_at, dst.) dilewati. Label yang sudah ada akan DITIMPA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={sedangGenerasi} onClick={() => void prosesGenerasi()}>
              {sedangGenerasi ? 'Memproses…' : 'Lanjut'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
