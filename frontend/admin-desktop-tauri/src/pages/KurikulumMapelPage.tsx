import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { referensiList } from '@/api/master';
import { Plus, FileUp } from '@/icons';
import LabeledCombobox from '@/components/LabeledCombobox';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { DeleteAction, EditAction } from '@/components/RowActions';
import ImportBertahapUmumDialog from '@/components/ImportBertahapUmumDialog';
import {
  buatMapel, daftarMapel, hapusMapel, ubahMapel,
  batalPotongMapel, importMapelPotong, unduhGalatMapel, unduhTemplateMapel,
  KOLOM_IMPORT_MAPEL,
  type KelompokMapel,
  type MataPelajaran,
} from '@/api/kurikulum';

const FIELDS: ExcelField[] = [
  {
    key: 'nama_mapel', label: 'Nama Mapel', width: 220, kind: 'text',
    maxLength: 100, required: true,
    validate: (v) => (!v || !v.trim() ? 'Nama mapel wajib diisi.' : null),
  },
  { key: 'kode_mapel', label: 'Kode', width: 130, kind: 'text', maxLength: 20 },
  { key: 'singkatan', label: 'Singkatan', width: 140, kind: 'text', maxLength: 50 },
  {
    key: 'kelompok', label: 'Kelompok', width: 140, kind: 'select',
    selectTanpaEdit: true,
    choices: [
      { value: 'formal', label: 'Formal' },
      { value: 'pesantren', label: 'Pesantren' },
    ],
  },
  { key: 'is_active', label: 'Aktif', width: 90, kind: 'toggle', toggleTanpaEdit: true },
];

function nilaiBaris(m: MataPelajaran): Record<string, string | null> {
  return {
    nama_mapel: m.nama_mapel,
    kode_mapel: m.kode_mapel,
    singkatan: m.singkatan,
    kelompok: m.kelompok,
    is_active: m.is_active ? 'ya' : 'tidak',
  };
}

/** Isi formulir mapel (dipakai dialog Tambah & Ubah). */
interface NilaiFormMapel {
  nama: string;
  kode: string;
  /** Singkatan tampilan (mis. 'Mat.'); opsional. */
  singkatan: string;
  kelompok: KelompokMapel;
  status: 'ya' | 'tidak';
}

const FORM_MAPEL_KOSONG: NilaiFormMapel = {
  nama: '', kode: '', singkatan: '', kelompok: 'formal', status: 'ya',
};

/** Dialog formulir mapel — SATU sumber untuk aksi "Tambah" (baris baru) dan
 *  aksi baris "Ubah". Bentuknya identik; yang berbeda hanya judul, awalan
 *  `id` elemen (snake_case, NFR-05), dan aksi simpannya. Simpan dikunci
 *  selama nama kosong supaya tak ada mapel tanpa nama tersimpan. */
function DialogFormMapel({ open, onClose, judul, idPrefix, idSimpan, nilai, set, onSimpan }: {
  open: boolean;
  onClose: () => void;
  judul: string;
  /** Awalan id: `input_<prefix>_nama`, `select_<prefix>_kelompok`, … */
  idPrefix: string;
  idSimpan: string;
  nilai: NilaiFormMapel;
  /** Ubah sebagian field (patch) — state formulir dipegang halaman. */
  set: (p: Partial<NilaiFormMapel>) => void;
  onSimpan: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription className="sr-only">Formulir data mata pelajaran.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
          <FieldLabel htmlFor={`input_${idPrefix}_nama`}>Nama mapel</FieldLabel>
          <Input
            id={`input_${idPrefix}_nama`} value={nilai.nama} maxLength={100} required autoFocus
            onChange={(e) => set({ nama: e.target.value })}
          />
          <FieldLabel htmlFor={`input_${idPrefix}_kode`}>Kode (opsional)</FieldLabel>
          <Input
            id={`input_${idPrefix}_kode`} value={nilai.kode} maxLength={20}
            onChange={(e) => set({ kode: e.target.value })}
          />
          <FieldLabel htmlFor={`input_${idPrefix}_singkatan`}>Singkatan (opsional)</FieldLabel>
          <Input
            id={`input_${idPrefix}_singkatan`} value={nilai.singkatan} maxLength={50}
            onChange={(e) => set({ singkatan: e.target.value })} placeholder="Mat."
          />
          <FieldLabel htmlFor={`select_${idPrefix}_kelompok`}>Kelompok</FieldLabel>
          <Select value={nilai.kelompok} onValueChange={(v) => set({ kelompok: v as KelompokMapel })}>
            <SelectTrigger id={`select_${idPrefix}_kelompok`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="pesantren">Pesantren</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldLabel htmlFor={`select_${idPrefix}_status`}>Status</FieldLabel>
          <Select value={nilai.status} onValueChange={(v) => set({ status: v as 'ya' | 'tidak' })}>
            <SelectTrigger id={`select_${idPrefix}_status`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ya">Aktif</SelectItem>
                <SelectItem value="tidak">Tidak aktif</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button id={idSimpan} disabled={nilai.nama.trim() === ''} onClick={onSimpan}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Halaman Master Mapel: daftar mata pelajaran per jenjang (kelompok formal / pesantren). */
export default function KurikulumMapelPage() {
  const { jenjangs, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canTambah = bisa(user, 'kurikulum.tambah');
  const canUbah = bisa(user, 'kurikulum.ubah');
  const canHapus = bisa(user, 'kurikulum.hapus');

  const jenjang = targetTunggal(jenjangs);
  const [cari, setCari] = useState('');
  const [keaktifan, setKeaktifan] = useState<'aktif' | 'nonaktif' | 'semua'>('aktif');
  const [importOpen, setImportOpen] = useState(false);
  /** Baris yang sedang diubah lewat dialog aksi (bukan edit sel grid). */
  const [editRow, setEditRow] = useState<MataPelajaran | null>(null);
  const [formUbah, setFormUbah] = useState<NilaiFormMapel>(FORM_MAPEL_KOSONG);
  /** Dialog Tambah: "Tambah" membuka formulir dulu, baris dibuat setelah
   *  Simpan (tidak lagi menyisipkan "Mapel Baru" langsung ke tabel). */
  const [tambahOpen, setTambahOpen] = useState(false);
  const [formTambah, setFormTambah] = useState<NilaiFormMapel>(FORM_MAPEL_KOSONG);
  /** Saran nama dari kamus `ref_mapel` jenjang aktif (untuk tambah cepat). */
  const [saranMapel, setSaranMapel] = useState<string[]>([]);
  /** Teks input kotak "Dari kamus": dikosongkan tiap saran dipakai supaya
   *  kotak kembali ke placeholder — perilaku ComboCari yang digantikannya. */
  const [teksKamus, setTeksKamus] = useState('');

  const { rows, loading, err, load, lastPage, total, pager, onSaved } =
    useDaftarTabel<MataPelajaran>({
      tableKey: 'kurikulum_mapel',
      search: cari,
      ambil: async (a) => {
        if (jenjang === null) {
          return { data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 };
        }
        const data = await daftarMapel({ jenjang, q: a.search || undefined, keaktifan });
        return { data, current_page: 1, last_page: 1, per_page: a.perPage, total: data.length };
      },
      deps: [jenjang, keaktifan],
    });

  useEffect(() => {
    if (filterLoading || jenjang === null) { setSaranMapel([]); return; }
    let hidup = true;
    referensiList('mapel', jenjang)
      .then((r) => {
        if (!hidup) return;
        setSaranMapel([...new Set(r.map((x) => x.nama ?? '').filter((n) => n !== ''))]);
      })
      .catch(() => { if (hidup) setSaranMapel([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang]);

  /** "Tambah" membuka dialog dengan formulir KOSONG (setiap buka direset) —
   *  lingkupnya jenjang filter aktif, jadi belum ada nama yang ditebak mesin. */
  const bukaTambah = useCallback(() => {
    setFormTambah(FORM_MAPEL_KOSONG);
    setTambahOpen(true);
  }, []);

  /** Simpan dialog Tambah: buat mapel dari isi formulir, lalu muat ulang tabel.
   *  Dialog hanya ditutup bila BERHASIL — galat validasi (mis. nama sudah
   *  dipakai) tampil sebagai toast sementara isian tetap ada untuk diperbaiki. */
  const simpanTambah = useCallback(async () => {
    if (jenjang === null) return;
    try {
      await buatMapel({
        jenjang,
        nama_mapel: formTambah.nama.trim(),
        kelompok: formTambah.kelompok,
        kode_mapel: formTambah.kode.trim() === '' ? null : formTambah.kode.trim(),
        singkatan: formTambah.singkatan.trim() === '' ? null : formTambah.singkatan.trim(),
        is_active: formTambah.status === 'ya',
      });
      toast.success('Mapel ditambah.');
      setTambahOpen(false);
      pager.goFirst();
      await load(1);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [jenjang, formTambah, pager, load]);

  const tambahDariKamus = useCallback(async (nama: string) => {
    if (jenjang === null || nama === '') return;
    if (rows.some((r) => r.nama_mapel.toLowerCase() === nama.toLowerCase())) {
      toast.error(`Mapel "${nama}" sudah ada di ${jenjang}.`);
      return;
    }
    try {
      await buatMapel({ jenjang, nama_mapel: nama, kelompok: 'formal' });
      toast.success('Mapel ditambah.');
      pager.goFirst();
      await load(1);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [jenjang, rows, pager, load]);

  /** Isi dialog dari baris yang diklik (semua field diisi ulang, bukan
   *  ditumpuk — dialog boleh dibuka beruntun untuk baris berbeda). */
  const openEdit = useCallback((r: MataPelajaran) => {
    setEditRow(r);
    setFormUbah({
      nama: r.nama_mapel,
      kode: r.kode_mapel ?? '',
      singkatan: r.singkatan ?? '',
      kelompok: r.kelompok,
      status: r.is_active ? 'ya' : 'tidak',
    });
  }, []);

  /** Simpan dialog Ubah: kirim SEMUA field (payload PUT mapel bersifat
   *  parsial), lalu muat ulang tabel agar nilai sel grid ikut sinkron. */
  const simpanUbah = useCallback(async () => {
    if (editRow === null) return;
    try {
      await ubahMapel(editRow.id, {
        nama_mapel: formUbah.nama.trim(),
        kode_mapel: formUbah.kode.trim() === '' ? null : formUbah.kode.trim(),
        singkatan: formUbah.singkatan.trim() === '' ? null : formUbah.singkatan.trim(),
        kelompok: formUbah.kelompok,
        is_active: formUbah.status === 'ya',
      });
      toast.success('Mapel diubah.');
      setEditRow(null);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [editRow, formUbah, load]);

  const onHapus = useCallback(async (r: MataPelajaran) => {
    try {
      await hapusMapel(r.id);
      toast.success('Mapel dihapus.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [load]);

  async function commitBaris(id: number, f: Record<string, string | null>) {
    const baris = rows.find((r) => r.id === id);
    if (!baris) return;
    await ubahMapel(baris.id, {
      ...(f.nama_mapel !== undefined ? { nama_mapel: f.nama_mapel ?? '' } : {}),
      ...(f.kode_mapel !== undefined ? { kode_mapel: f.kode_mapel || null } : {}),
      ...(f.singkatan !== undefined ? { singkatan: f.singkatan || null } : {}),
      ...(f.kelompok !== undefined ? { kelompok: (f.kelompok ?? 'formal') as 'formal' | 'pesantren' } : {}),
      ...(f.is_active !== undefined ? { is_active: f.is_active === 'ya' } : {}),
    });
  }

  const renderActions = useCallback((r: MataPelajaran) => (
    <>
      {canUbah && (
        <EditAction id={`btn_ubah_mapel_${r.id}`} onClick={() => openEdit(r)} />
      )}
      {canHapus && (
        <DeleteAction
          id={`btn_hapus_mapel_${r.id}`}
          title="Hapus mapel?"
          description={`Mapel "${r.nama_mapel}" akan dihapus permanen.`}
          onConfirm={() => void onHapus(r)}
        />
      )}
    </>
  ), [canUbah, canHapus, openEdit, onHapus]);

  if (jenjang === null) {
    return (
      <div className={PAGE_SHELL}>
        <p className="p-4 text-xs text-muted-foreground">Pilih satu jenjang (lembaga) pada filter di atas.</p>
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tabel={[{ key: 'kurikulum_mapel', judul: 'Mapel', fields: FIELDS }]} />
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / kode / singkatan…" />
      <ExcelTable
        tableKey="kurikulum_mapel"
        sumberTabel="mata_pelajaran"
        fields={FIELDS}
        rows={rows}
        getValues={nilaiBaris}
        loading={loading}
        emptyText="Belum ada mata pelajaran untuk jenjang ini."
        canEdit={canUbah}
        onCommit={commitBaris}
        onSaved={onSaved}
        // Tombol aksi halaman tampil langsung di bilah (tanpa menu hamburger).
        addButtonLangsung
        /* Kotak "Dari kamus" = kontrol HALAMAN (bukan filter tabel), jadi
           ditaruh di `akhirToolbar` supaya SEBARIS dengan kontrol lain
           (Status / Urutkan / Kolom). Dulu ia anak `addButton` — blok tombol
           itu bukan flex, sehingga kotaknya menumpuk di ATAS tombol Import &
           Tambah. `LabeledCombobox` (bukan ComboCari) agar kotaknya punya
           label + pengaturan ukuran seperti kontrol toolbar lain. */
        akhirToolbar={
          canTambah && saranMapel.length > 0 ? (
            <LabeledCombobox label="Dari kamus" htmlFor="combo_tambah_mapel_kamus" bisaCari>
              <ComboboxRoot
                items={saranMapel}
                /* Nilai SELALU kosong: tiap pemilihan tetap memicu
                   `onValueChange` (memilih nama yang sama dua kali pun
                   terdeteksi) dan kotak tak menahan pilihan terakhir. */
                value=""
                /* Teks input dikendalikan agar bisa dikosongkan setelah mapel
                   ditambahkan, bukan meninggalkan nama yang baru dipakai. */
                inputValue={teksKamus}
                onInputValueChange={(v, d) => {
                  // Isian otomatis Base UI saat item ditekan diabaikan;
                  // pengosongan teks dikerjakan `onValueChange` di bawah.
                  if (d.reason !== 'item-press') setTeksKamus(v);
                }}
                onValueChange={(v) => {
                  if (typeof v !== 'string' || v === '') return;
                  setTeksKamus('');
                  void tambahDariKamus(v);
                }}
              >
                <ComboboxInput
                  id="combo_tambah_mapel_kamus"
                  aria-label="Tambah dari kamus"
                  placeholder="Cari nama mapel…"
                />
                <ComboboxTrigger aria-label="Buka saran kamus" />
                <ComboboxContent>
                  <ComboboxEmpty>Tidak ada saran.</ComboboxEmpty>
                  <ComboboxList>
                    {(n) => <ComboboxItem key={n} value={n}>{n}</ComboboxItem>}
                  </ComboboxList>
                </ComboboxContent>
              </ComboboxRoot>
            </LabeledCombobox>
          ) : undefined
        }
        tengah={<span className="text-xs text-muted-foreground">Lingkup <strong>{jenjang}</strong></span>}
        filter={
          <>
            <label className="text-xs text-muted-foreground" htmlFor="saring_aktif_mapel">Status</label>
            <select
              id="saring_aktif_mapel" className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              value={keaktifan}
              onChange={(e) => { setKeaktifan(e.target.value as typeof keaktifan); pager.goFirst(); }}
            >
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
              <option value="semua">Semua</option>
            </select>
          </>
        }
        addButton={
          <>
            {canTambah && (
              <Button type="button" variant="outline" size="sm" id="btn_buka_import_mapel"
                onClick={() => setImportOpen(true)}>
                <FileUp data-icon="inline-start" size={16} /> Import
              </Button>
            )}
            {/* Membuka DIALOG, bukan menyisipkan baris "Mapel Baru" langsung. */}
            <Button type="button" size="sm" id="btn_tambah_mapel" disabled={!canTambah}
              onClick={bukaTambah}>
              <Plus data-icon="inline-start" size={16} /> Tambah
            </Button>
          </>
        }
        renderActions={renderActions}
        pager={(
          <Pager
            page={pager.page}
            lastPage={lastPage}
            total={total}
            perPage={pager.perPage}
            onPage={(p) => { pager.setPage(p); load(p); }}
            onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
          />
        )}
      />
      <ImportBertahapUmumDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        config={{
          idPrefix: 'mapel',
          judul: 'Import mapel bertahap',
          deskripsi: 'Import mapel bertahap. Satu file boleh berisi banyak lembaga.',
          kolom: KOLOM_IMPORT_MAPEL,
          wajib: ['jenjang', 'nama_mapel', 'kelompok'],
          idTombol: {
            template: 'btn_unduh_template_mapel',
            periksa: 'btn_periksa_import_mapel',
            mulai: 'btn_import_mapel',
          },
          labelTemplate: 'Unduh template Excel mapel',
          unduhTemplate: unduhTemplateMapel,
          kirim: ({ sesi_id, mode, total, baris, terakhir }) =>
            importMapelPotong({
              ...(sesi_id === undefined ? {} : { sesi_id }),
              mode, ...(sesi_id === undefined ? { total } : {}), baris,
              ...(terakhir ? { terakhir } : {}),
            }),
          batal: batalPotongMapel,
          unduhGalat: unduhGalatMapel,
          onSelesai: () => {
            setImportOpen(false);
            pager.goFirst();
            void load(1);
          },
        }}
      />

      {/* Aksi "Tambah" & aksi baris "Ubah" memakai formulir dialog yang SAMA
          (`DialogFormMapel`). "Tambah" tidak lagi menyisipkan baris "Mapel
          Baru" ke tabel — baris dibuat setelah pengguna mengisi & menekan
          Simpan. Edit SEL tetap jalan di grid (endpoint-nya sama). */}
      <DialogFormMapel
        open={tambahOpen}
        onClose={() => setTambahOpen(false)}
        judul="Tambah mapel"
        idPrefix="tambah_mapel"
        idSimpan="btn_simpan_tambah_mapel"
        nilai={formTambah}
        set={(p) => setFormTambah((f) => ({ ...f, ...p }))}
        onSimpan={() => void simpanTambah()}
      />
      <DialogFormMapel
        open={editRow !== null}
        onClose={() => setEditRow(null)}
        judul="Ubah mapel"
        idPrefix="ubah_mapel"
        idSimpan="btn_simpan_ubah_mapel"
        nilai={formUbah}
        set={(p) => setFormUbah((f) => ({ ...f, ...p }))}
        onSimpan={() => void simpanUbah()}
      />
    </div>
  );
}
