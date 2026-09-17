import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import {
  createKamusKolom,
  deleteKamusKolom,
  listKamusKolom,
  skemaKolom,
  updateKamusKolom,
  type ArahUrut,
  type LabelKolom,
  type TabelSkema,
} from '../api/kamusLabel';
import { bersihkanCacheKamus } from '@/components/useKamusPeta';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { DeleteAction } from '@/components/RowActions';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const BAWAAN = '_bawaan';

const ALIGN_CHOICES = [
  { value: BAWAAN, label: '(tengah)' },
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

const FIELDS: ExcelField[] = [
  { key: 'kolom', label: 'kolom', width: 190, kind: 'static' },
  { key: 'label', label: 'label', width: 200, kind: 'text', maxLength: 100 },
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
  { key: 'arah', label: 'arah_bawaan', width: 120, kind: 'select', choices: ARAH_CHOICES },
  { key: 'tooltip', label: 'tooltip', width: 220, kind: 'text', maxLength: 200 },
  { key: 'format', label: 'format', width: 120, kind: 'select', choices: FORMAT_CHOICES },
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
    lebar: e?.lebar === null || e?.lebar === undefined ? '' : String(e.lebar),
    kunci: e?.kunci_lebar ? 'ya' : 'tidak',
    bisa: e && !e.bisa_urut ? 'tidak' : 'ya',
    arah: e?.arah_bawaan ?? BAWAAN,
    tooltip: e?.tooltip ?? '',
    format: e?.format ?? BAWAAN,
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
      bisa_urut: gab.bisa !== 'tidak',
      arah_bawaan: gab.arah && gab.arah !== BAWAAN ? (gab.arah as ArahUrut) : null,
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

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <FilterField label="Tabel" htmlFor="select_tabel_kamus">
          <Select value={tabel || '_pilih'} onValueChange={(v) => setTabel(v === '_pilih' ? '' : v)}>
            <SelectTrigger id="select_tabel_kamus" className="w-56">
              <SelectValue placeholder="Pilih tabel" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="_pilih">Pilih tabel…</SelectItem>
                {skema.map((s) => (
                  <SelectItem key={s.tabel} value={s.tabel}>{s.tabel}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FilterField>
        <p className="pb-2 text-xs text-muted-foreground">
          Atur sekali di sini — berlaku di SEMUA halaman yang menampilkan kolom itu.
        </p>
      </div>

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
        searchValue={cari}
        onSearchChange={setCari}
        onSearchSubmit={() => {}}
        searchPlaceholder="Cari kolom"
        searchIds={{ form: 'form_cari_kamus_kolom', input: 'input_cari_kamus_kolom', button: 'btn_cari_kamus_kolom' }}
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
        maxRows={16}
      />

      {!canTambah && !canUbah ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Hanya admin pesantren yang dapat mengubah kamus label.
        </p>
      ) : null}
    </div>
  );
}
