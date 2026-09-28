import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import { createAset, deleteAset, listAset, type AsetDokumen } from '@/api/asetDokumen';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { DeleteAction } from '@/components/RowActions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLembagaAktif } from '@/lembagaAktif';
import { Upload } from '@/icons';

const TABLE_KEY = 'aset_dokumen';
const SEMUA = '__semua__';

/** Bentuk berkas yang boleh jadi logo, stempel, atau tanda tangan. */
const JENIS_BERKAS: { mime: string; label: string }[] = [
  { mime: 'image/png', label: 'PNG' },
  { mime: 'image/jpeg', label: 'JPEG' },
];

function ukuranReadable(byte: number): string {
  if (byte < 1024) {
    return `${byte} B`;
  }

  if (byte < 1024 * 1024) {
    return `${Math.round(byte / 1024)} KB`;
  }

  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Pustaka aset cetak: logo, stempel, dan tanda tangan yang dipakai medan
 * gambar pada template.
 *
 * Aset tidak diunggah lewat dialog di sini saja; desainer memakai daftar ini
 * untuk menunjuk aset pada setiap medan gambar.
 */
export default function AsetDokumenPage() {
  const { user } = useAuth();
  const { jenjang, pilihan } = useLembagaAktif();

  const [rows, setRows] = useState<AsetDokumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  const [saringJenjang, setSaringJenjang] = useState<string>(SEMUA);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [nama, setNama] = useState('');
  const [jenjangAset, setJenjangAset] = useState('');
  const [berkas, setBerkas] = useState<File | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galatDialog, setGalatDialog] = useState<string | null>(null);

  const bolehTambah = bisa(user, 'template_dokumen.ubah');
  const bolehHapus = bisa(user, 'template_dokumen.hapus');

  const muat = useCallback(async () => {
    setLoading(true);
    setGalat(null);
    try {
      const res = await listAset({
        q: cari.trim() || undefined,
        jenjang: saringJenjang === SEMUA ? undefined : (saringJenjang as string),
        per_page: 200,
      });
      setRows(res.data);
    } catch (e) {
      setGalat(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [cari, saringJenjang]);

  useEffect(() => {
    muat();
  }, [muat]);

  useEffect(() => {
    if (dialogOpen) {
      setNama('');
      setJenjangAset(jenjang ?? '');
      setBerkas(null);
      setGalatDialog(null);
    }
  }, [dialogOpen, jenjang]);

  const fields = useMemo<ExcelField[]>(
    () => [
      { key: 'nama', label: 'nama', width: 260, kind: 'static' },
      { key: 'jenjang', label: 'lembaga', width: 140, kind: 'static' },
      { key: 'dimensi', label: 'dimensi', width: 130, kind: 'static' },
      { key: 'ukuran', label: 'ukuran', width: 100, kind: 'static' },
      { key: 'dibuat', label: 'dibuat', width: 160, kind: 'static' },
    ],
    [],
  );

  const nilaiBaris = useCallback(
    (a: AsetDokumen): Record<string, string | null> => ({
      nama: a.nama,
      jenjang: a.jenjang ?? 'Semua lembaga',
      dimensi: `${a.lebar_px} × ${a.tinggi_px} px`,
      ukuran: ukuranReadable(a.ukuran_byte),
      dibuat: a.dibuat_pada ?? null,
    }),
    [],
  );

  const simpan = useCallback(async () => {
    if (nama.trim() === '') {
      setGalatDialog('Nama aset wajib diisi.');
      return;
    }

    if (berkas === null) {
      setGalatDialog('Pilih berkas gambar lebih dulu.');
      return;
    }

    setSibuk(true);
    setGalatDialog(null);
    try {
      await createAset({
        nama: nama.trim(),
        jenjang: jenjangAset || null,
        berkas,
      });
      toast.success('Aset berhasil diunggah.');
      setDialogOpen(false);
      await muat();
    } catch (e) {
      setGalatDialog(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  }, [berkas, jenjangAset, muat, nama]);

  const aksiBaris = useCallback(
    (a: AsetDokumen) => (
      <div className="flex items-center gap-0.5">
        {bolehHapus && (
          <DeleteAction
            id={`btn_hapus_aset_${a.id}`}
            title="Hapus aset?"
            description={`Aset "${a.nama}" akan dihapus permanen.`}
            onConfirm={async () => {
              try {
                await deleteAset(a.id);
                toast.success('Aset berhasil dihapus.');
                await muat();
              } catch (e) {
                // Aset yang masih dipakai medan menjawab 422 dengan alasan
                // kenapa tidak boleh dihapus, jadi pesannya diteruskan.
                toast.error(errorMessage(e));
              }
            }}
          />
        )}
      </div>
    ),
    [bolehHapus, muat],
  );

  return (
    <div className={PAGE_SHELL}>
      {galat && <ErrorNotice>{galat}</ErrorNotice>}

      <ExcelTable
        tableKey={TABLE_KEY}
        fields={fields}
        rows={rows}
        getValues={nilaiBaris}
        loading={loading}
        emptyText="Belum ada aset cetak."
        canEdit={false}
        onCommit={async () => {}}
        onSaved={muat}
        renderActions={aksiBaris}
        filter={
          <>
            <FilterField label="Cari" htmlFor="input_cari_aset">
              <Input
                id="input_cari_aset"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Nama aset"
                className="w-56"
              />
            </FilterField>

            <FilterField label="Lembaga" htmlFor="select_jenjang_aset">
              <Select value={saringJenjang} onValueChange={setSaringJenjang}>
                <SelectTrigger id="select_jenjang_aset" aria-label="Lembaga aset" size="sm" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEMUA}>Semua lembaga</SelectItem>
                  {pilihan.map((satu) => (
                    <SelectItem key={satu.jenjang} value={satu.jenjang}>
                      {satu.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </>
        }
        addButton={
          bolehTambah ? (
            <Button id="btn_unggah_aset" onClick={() => setDialogOpen(true)}>
              <Upload size={16} /> Aset
            </Button>
          ) : undefined
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unggah aset cetak</DialogTitle>
            <DialogDescription>
              Logo, stempel, atau tanda tangan. Aset ini dipilih sebagai medan gambar pada desainer template.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {galatDialog && <ErrorNotice>{galatDialog}</ErrorNotice>}

            <div>
              <FieldLabel htmlFor="input_nama_aset">Nama aset</FieldLabel>
              <Input
                id="input_nama_aset"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                maxLength={120}
                placeholder="Contoh: Stempel Madrasah"
              />
            </div>

            <div>
              <FieldLabel htmlFor="select_jenjang_aset_baru">Lembaga</FieldLabel>
              <Select value={jenjangAset} onValueChange={setJenjangAset}>
                <SelectTrigger id="select_jenjang_aset_baru" aria-label="Lembaga aset" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semua lembaga</SelectItem>
                  {pilihan.map((satu) => (
                    <SelectItem key={satu.jenjang} value={satu.jenjang}>
                      {satu.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Kosongkan bila aset boleh dipakai semua lembaga.</FieldDescription>
            </div>

            <div>
              <FieldLabel htmlFor="input_berkas_aset">Berkas gambar</FieldLabel>
              <Input
                id="input_berkas_aset"
                type="file"
                accept={JENIS_BERKAS.map((s) => s.mime).join(',')}
                onChange={(e) => setBerkas(e.target.files?.[0] ?? null)}
              />
              <FieldDescription>
                {JENIS_BERKAS.map((s) => s.label).join(' atau ')}, maksimal 4 MB. Latar transparan lebih bagus untuk
                stempel.
              </FieldDescription>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button id="btn_simpan_aset" onClick={simpan} disabled={sibuk}>
              <Upload size={16} /> {sibuk ? 'Mengunggah...' : 'Unggah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
