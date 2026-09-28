import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import { bisa } from '@/api/auth';
import {
  createTemplate,
  deleteTemplate,
  duplikatTemplate,
  listTemplate,
  type TemplateRingkas,
} from '@/api/templateDokumen';
import { useAuth } from '@/auth/AuthContext';
import ComboCari from '@/components/ComboCari';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ActionIcon, DeleteAction } from '@/components/RowActions';
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
import {
  DESKRIPSI_JENIS,
  KATEGORI_TEMPLATE,
  LABEL_JENIS,
  LABEL_KATEGORI,
  type JenisTemplate,
  type KategoriTemplate,
} from '@/lib/template/tipe';
import { Copy, FileCheck2, Pencil } from '@/icons';

const TABLE_KEY = 'template_dokumen';
const SEMUA = '__semua__';

export default function TemplateDokumenPage() {
  const { user } = useAuth();
  const { jenjang, pilihan } = useLembagaAktif();
  const navigate = useNavigate();

  const [rows, setRows] = useState<TemplateRingkas[]>([]);
  const [loading, setLoading] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  const [kategori, setKategori] = useState<string>(SEMUA);
  const [jenis, setJenis] = useState<string>(SEMUA);
  const [tambahOpen, setTambahOpen] = useState(false);

  const bolehTambah = bisa(user, 'template_dokumen.tambah');
  const bolehUbah = bisa(user, 'template_dokumen.ubah');
  const bolehHapus = bisa(user, 'template_dokumen.hapus');

  const muat = useCallback(async () => {
    setLoading(true);
    setGalat(null);
    try {
      const res = await listTemplate({
        q: cari.trim() || undefined,
        kategori: kategori === SEMUA ? undefined : (kategori as KategoriTemplate),
        jenis: jenis === SEMUA ? undefined : (jenis as JenisTemplate),
        jenjang: jenjang ?? undefined,
        per_page: 200,
      });
      setRows(res.data);
    } catch (e) {
      setGalat(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [cari, jenis, kategori, jenjang]);

  useEffect(() => {
    muat();
  }, [muat]);

  const fields = useMemo<ExcelField[]>(
    () => [
      { key: 'nama', label: 'nama', width: 240, kind: 'static' },
      { key: 'kode', label: 'kode', width: 180, kind: 'static' },
      { key: 'jenis', label: 'jenis', width: 130, kind: 'static' },
      { key: 'kategori', label: 'kategori', width: 120, kind: 'static' },
      { key: 'halaman', label: 'halaman', width: 90, kind: 'static' },
      { key: 'medan', label: 'medan', width: 80, kind: 'static' },
      { key: 'cakupan', label: 'Lembaga', width: 160, kind: 'static' },
      { key: 'berkas', label: 'Berkas PDF', width: 110, kind: 'static' },
      { key: 'aktif', label: 'aktif', width: 90, kind: 'static' },
    ],
    [],
  );

  const nilaiBaris = useCallback(
    (t: TemplateRingkas): Record<string, string | null> => ({
      nama: t.nama,
      kode: t.kode,
      jenis: LABEL_JENIS[t.jenis] ?? t.jenis,
      kategori: LABEL_KATEGORI[t.kategori] ?? t.kategori,
      halaman: String(t.jumlah_halaman),
      medan: String(t.jumlah_medan),
      cakupan: t.jenjang ?? 'Semua lembaga',
      berkas: t.punya_berkas ? 'Sudah' : 'Belum',
      aktif: t.aktif ? 'Ya' : 'Tidak',
    }),
    [],
  );

  const aksiBaris = useCallback(
    (t: TemplateRingkas) => (
      <div className="flex items-center gap-0.5">
        <ActionIcon
          id={`btn_susun_medan_${t.id}`}
          title="Susun medan isian"
          onClick={() => navigate(`/template-dokumen/${t.id}/medan`)}
        >
          <Pencil size={16} />
        </ActionIcon>
        {bolehUbah && (
          <ActionIcon
            id={`btn_isi_cetak_${t.id}`}
            title="Isi dan cetak"
            onClick={() => navigate(`/template-dokumen/${t.id}/isi`)}
          >
            <FileCheck2 size={16} />
          </ActionIcon>
        )}
        {bolehTambah && (
          <ActionIcon
            id={`btn_duplikat_template_${t.id}`}
            title="Duplikat"
            onClick={async () => {
              try {
                const salinan = await duplikatTemplate(t.id);
                toast.success(`Salinan "${salinan.nama}" dibuat.`);
                await muat();
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          >
            <Copy size={16} />
          </ActionIcon>
        )}
        {bolehHapus && (
          <DeleteAction
            id={`btn_hapus_template_${t.id}`}
            title="Hapus template?"
            description={`Template "${t.nama}" beserta berkas PDF-nya akan dihapus permanen.`}
            onConfirm={async () => {
              try {
                await deleteTemplate(t.id);
                toast.success('Template dihapus.');
                await muat();
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          />
        )}
      </div>
    ),
    [bolehHapus, bolehTambah, bolehUbah, muat, navigate],
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
        emptyText="Belum ada template cetak."
        canEdit={false}
        onCommit={async () => {}}
        onSaved={muat}
        renderActions={aksiBaris}
        filter={
          <>
            <FilterField label="Cari" htmlFor="input_cari_template">
              <Input
                id="input_cari_template"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Nama atau kode template"
                className="w-56"
              />
            </FilterField>
            <FilterField label="Jenis" htmlFor="select_jenis_template">
              <Select value={jenis} onValueChange={setJenis}>
                <SelectTrigger id="select_jenis_template" aria-label="Jenis template" size="sm" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEMUA}>Semua jenis</SelectItem>
                  <SelectItem value="pdf">{LABEL_JENIS.pdf}</SelectItem>
                  <SelectItem value="html">{LABEL_JENIS.html}</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Kategori" htmlFor="select_kategori_template">
              <Select value={kategori} onValueChange={setKategori}>
                <SelectTrigger id="select_kategori_template" aria-label="Kategori template" size="sm" className="w-44">
                  <SelectValue placeholder="Semua kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEMUA}>Semua kategori</SelectItem>
                  {KATEGORI_TEMPLATE.map((k) => (
                    <SelectItem key={k} value={k}>
                      {LABEL_KATEGORI[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </>
        }
        addButton={
          bolehTambah ? (
            <Button id="btn_buat_template" onClick={() => setTambahOpen(true)}>
              + Template
            </Button>
          ) : undefined
        }
      />

      <DialogSimpan
        open={tambahOpen}
        onOpenChange={setTambahOpen}
        jenjangBawaan={jenjang ?? ''}
        pilihanLembaga={pilihan}
        onSimpan={async (input) => {
          const dibuat = await createTemplate(input);
          setTambahOpen(false);
          await muat();

          // Template PDF eksternal butuh berkas sebelum medan bisa
          // diletakkan, jadi langsung ke editor. Template HTML tidak punya
          // berkas sama sekali dan dicetak lewat endpoint yang sama, jadi
          // sementara mendarat di Isi & Cetak sampai desainer tersedia.
          if (input.jenis === 'pdf') {
            toast.success('Template dibuat. Berikutnya unggah berkas PDF template.');
            navigate(`/template-dokumen/${dibuat.id}/medan`);
          } else {
            toast.success('Template dibuat. Susun tata letaknya di desainer.');
            navigate(`/template-dokumen/${dibuat.id}/isi`);
          }
        }}
      />

    </div>
  );
}

interface DialogSimpanProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jenjangBawaan: string;
  pilihanLembaga: { jenjang: string; nama: string }[];
  onSimpan: (input: {
    nama: string;
    kategori: KategoriTemplate;
    jenis: JenisTemplate;
    deskripsi: string | null;
    jenjang: string | null;
  }) => Promise<void>;
}

function DialogSimpan({ open, onOpenChange, jenjangBawaan, pilihanLembaga, onSimpan }: DialogSimpanProps) {
  const [nama, setNama] = useState('');
  const [jenis, setJenis] = useState<JenisTemplate>('pdf');
  const [kategori, setKategori] = useState<KategoriTemplate>('surat');
  const [deskripsi, setDeskripsi] = useState('');
  const [jenjang, setJenjang] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNama('');
      setJenis('pdf');
      setKategori('surat');
      setDeskripsi('');
      setJenjang(jenjangBawaan);
      setGalat(null);
    }
  }, [open, jenjangBawaan]);

  const simpan = async () => {
    if (nama.trim() === '') {
      setGalat('Nama template wajib diisi.');
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      await onSimpan({
        nama: nama.trim(),
        kategori,
        jenis,
        deskripsi: deskripsi.trim() || null,
        jenjang: jenjang || null,
      });
    } catch (e) {
      setGalat(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Template baru</DialogTitle>
          <DialogDescription>
            Nilai dari database ditambahkan kemudian di halaman penyusunan medan. Cara halaman cetak dibuat
            ditentukan oleh jenis template.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <FieldLabel htmlFor="input_nama_template">Nama template</FieldLabel>
            <Input
              id="input_nama_template"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={120}
              placeholder="Contoh: Surat Keterangan Santri"
            />
          </div>

          <div>
            <FieldLabel htmlFor="select_jenis_baru">Jenis halaman</FieldLabel>
            <Select value={jenis} onValueChange={(v) => setJenis(v as JenisTemplate)}>
              <SelectTrigger id="select_jenis_baru" aria-label="Jenis halaman template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">{LABEL_JENIS.pdf}</SelectItem>
                <SelectItem value="html">{LABEL_JENIS.html}</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">{DESKRIPSI_JENIS[jenis]}</p>
          </div>

          <div>
            <FieldLabel htmlFor="select_kategori_baru">Kategori</FieldLabel>
            <Select value={kategori} onValueChange={(v) => setKategori(v as KategoriTemplate)}>
              <SelectTrigger id="select_kategori_baru" aria-label="Kategori template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KATEGORI_TEMPLATE.map((k) => (
                  <SelectItem key={k} value={k}>
                    {LABEL_KATEGORI[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel htmlFor="select_lembaga_baru">Lembaga</FieldLabel>
            <ComboCari
              id="select_lembaga_baru"
              value={jenjang}
              onChange={setJenjang}
              options={[
                { value: '', label: 'Semua lembaga (global)' },
                ...pilihanLembaga.map((l) => ({ value: l.jenjang, label: `${l.jenjang} - ${l.nama}` })),
              ]}
              className="w-full"
            />
            <FieldDescription>
              Pilih Semua lembaga bila template boleh dipakai di seluruh pesantren.
            </FieldDescription>
          </div>

          <div>
            <FieldLabel htmlFor="input_deskripsi_template">Deskripsi</FieldLabel>
            <Input
              id="input_deskripsi_template"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              maxLength={1000}
              placeholder="Kegunaan template ini, misalnya untuk rapor kelas 7"
            />
          </div>

          {galat && <p className="text-sm text-destructive">{galat}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button id="btn_simpan_template_baru" onClick={simpan} disabled={sibuk}>
            {sibuk ? 'Menyimpan...' : 'Simpan template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
