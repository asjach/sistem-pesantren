import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/client';
import {
  hapusDesainKartu, simpanDesainKartu, simpanPengaturanKartu,
  type BarisPesertaKegiatanEvaluatif, type DesainKartuResp, type ElemenKartuPeserta,
  type FieldKartuPeserta, type GayaLatarKartu, type KegiatanEvaluatif, type TemplateBawaanKartu,
} from '@/api/penilaian';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlignCenter, AlignLeft, AlignRight, ImageUp, Plus, Save, Trash2, X } from '@/icons';
import { cn } from '@/lib/utils';
import {
  DESAIN_BAWAAN_KARTU, KATALOG_DATA_KARTU,
  buatElemenDataKartu, buatElemenFotoKartu, buatElemenTeksKartu,
  desainDariServer, idElemenKartu, pilihDesainKartu, salinDesainKartu,
  ubahUkuranElemenKartu, type DesainKartuPeserta, type KonteksKartuPeserta,
} from '@/lib/desainKartuPeserta';
import KartuPeserta from './KartuPeserta';
import { useLatarDesain } from './useLatarDesain';

const PESERTA_CONTOH: BarisPesertaKegiatanEvaluatif = {
  santri_id: 0, nama: 'Nama Peserta', jk: 'L', foto_url: null, nis_lokal: '0000',
  kelas_id: null, kelas: 'Kelas', tingkat: '1', no_absen: null,
  nomor_peserta: 'Nomor peserta', sumber_nomor: null,
};

const GAYA_LATAR: readonly { nilai: GayaLatarKartu; label: string }[] = [
  { nilai: 'klasik', label: 'Klasik' },
  { nilai: 'modern', label: 'Modern' },
  { nilai: 'bersih', label: 'Bersih' },
  { nilai: 'foto', label: 'Foto penuh' },
];

interface Props {
  kegiatanEvaluatifId: number;
  kegiatanEvaluatif: KegiatanEvaluatif;
  semester: string;
  lembaga: string;
  pesertaContoh: BarisPesertaKegiatanEvaluatif | null;
  foto: Record<number, string>;
  muatan: DesainKartuResp | null;
  canUbah: boolean;
  onMuatUlang: () => Promise<void>;
}

export default function KartuPesertaDesainTab({
  kegiatanEvaluatifId, kegiatanEvaluatif, semester, lembaga, pesertaContoh, foto, muatan, canUbah, onMuatUlang,
}: Props) {
  const [desain, setDesain] = useState<DesainKartuPeserta | null>(null);
  const [lebarMm, setLebarMm] = useState(85.6);
  const [tinggiMm, setTinggiMm] = useState(53.98);
  const [nama, setNama] = useState('');
  const [fieldBaru, setFieldBaru] = useState<FieldKartuPeserta>('nama');
  const [terpilih, setTerpilih] = useState<string | null>(null);
  const [latarFile, setLatarFile] = useState<File | null>(null);
  const [hapusLatar, setHapusLatar] = useState(false);
  const [versiLatar, setVersiLatar] = useState(0);
  const [zoom, setZoom] = useState(1.5);
  const [menyimpan, setMenyimpan] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const kunciSinkron = useRef('');

  useEffect(() => {
    if (!muatan) return;
    const kunci = `${kegiatanEvaluatifId}:${muatan.pengaturan.desain_id ?? 'bawaan'}:${muatan.pengaturan.template_bawaan}:${muatan.desain.length}`;
    if (kunciSinkron.current === kunci) return;
    kunciSinkron.current = kunci;

    const pilihan = pilihDesainKartu(muatan.desain, muatan.pengaturan);
    setDesain(salinDesainKartu(pilihan));
    setNama(pilihan.sumber === 'pengguna' ? pilihan.nama : '');
    setLebarMm(muatan.pengaturan.lebar_mm);
    setTinggiMm(muatan.pengaturan.tinggi_mm);
    setTerpilih(null);
    setLatarFile(null);
    setHapusLatar(false);
  }, [muatan, kegiatanEvaluatifId]);

  const latarServer = useLatarDesain(desain, versiLatar);
  const [latarPratinjau, setLatarPratinjau] = useState<string | null>(null);

  useEffect(() => {
    if (!latarFile) {
      setLatarPratinjau(null);
      return;
    }
    const url = URL.createObjectURL(latarFile);
    setLatarPratinjau(url);
    return () => URL.revokeObjectURL(url);
  }, [latarFile]);

  const latarTampil = latarPratinjau ?? (hapusLatar ? null : latarServer);

  const daftarDesain = useMemo(
    () => [...DESAIN_BAWAAN_KARTU, ...(muatan?.desain.map(desainDariServer) ?? [])],
    [muatan],
  );

  const elemenTerpilih = desain?.elemen.find((item) => item.id === terpilih) ?? null;
  const adaFoto = desain?.elemen.some((item) => item.tipe === 'foto') ?? false;
  const konteks: KonteksKartuPeserta = {
    peserta: pesertaContoh ?? PESERTA_CONTOH,
    kegiatanEvaluatif,
    semester,
    lembaga,
  };

  const pilihDesain = (pilihan: DesainKartuPeserta) => {
    setDesain(salinDesainKartu(pilihan));
    setNama(pilihan.sumber === 'pengguna' ? pilihan.nama : '');
    setTerpilih(null);
    setLatarFile(null);
    setHapusLatar(false);
  };

  const ubahElemen = (id: string, ubah: (elemen: ElemenKartuPeserta) => ElemenKartuPeserta) => {
    setDesain((saatIni) => saatIni === null ? null : {
      ...saatIni,
      elemen: saatIni.elemen.map((item) => item.id === id ? ubah(item) : item),
    });
  };

  const ubahElemenTerpilih = (ubah: (elemen: ElemenKartuPeserta) => ElemenKartuPeserta) => {
    if (terpilih === null) return;
    ubahElemen(terpilih, ubah);
  };

  const tambahData = (field: FieldKartuPeserta) => {
    if (!desain) return;
    const baru = {
      ...buatElemenDataKartu(field, desain.elemen.length),
      id: idElemenKartu(`data_${field}`, desain.elemen),
    };
    setDesain({ ...desain, elemen: [...desain.elemen, baru] });
    setTerpilih(baru.id);
  };

  const tambahTeks = () => {
    if (!desain) return;
    const baru = {
      ...buatElemenTeksKartu(desain.elemen.length),
      id: idElemenKartu(`teks_${desain.elemen.length}`, desain.elemen),
    };
    setDesain({ ...desain, elemen: [...desain.elemen, baru] });
    setTerpilih(baru.id);
  };

  const tambahFoto = () => {
    if (!desain || adaFoto) return;
    const baru = { ...buatElemenFotoKartu(), id: idElemenKartu('foto', desain.elemen) };
    setDesain({ ...desain, elemen: [...desain.elemen, baru] });
    setTerpilih(baru.id);
  };

  const hapusElemen = () => {
    if (!desain || terpilih === null) return;
    setDesain({ ...desain, elemen: desain.elemen.filter((item) => item.id !== terpilih) });
    setTerpilih(null);
  };

  const simpanDesain = async () => {
    if (!desain || !canUbah) return;
    if (nama.trim() === '') {
      toast.error('Isi nama desain terlebih dahulu.');
      return;
    }
    setMenyimpan(true);
    try {
      const hasil = await simpanDesainKartu({
        kegiatan_evaluatif_id: kegiatanEvaluatifId,
        id: desain.sumber === 'pengguna' ? Number(desain.id) : undefined,
        nama: nama.trim(),
        warna_latar: desain.warna_latar,
        gaya_latar: desain.gaya_latar,
        elemen: desain.elemen,
        latar: latarFile,
        hapus_latar: hapusLatar && latarFile === null,
      });
      await simpanPengaturanKartu({
        kegiatan_evaluatif_id: kegiatanEvaluatifId,
        desain_id: hasil.desain.id,
        template_bawaan: null,
        lebar_mm: lebarMm,
        tinggi_mm: tinggiMm,
      });
      toast.success(hasil.pesan);
      setDesain(desainDariServer(hasil.desain));
      setNama(hasil.desain.nama);
      setLatarFile(null);
      setHapusLatar(false);
      setVersiLatar((nilai) => nilai + 1);
      await onMuatUlang();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMenyimpan(false);
    }
  };

  const simpanUkuran = async () => {
    if (!desain || !canUbah) return;
    setMenyimpan(true);
    try {
      const pengguna = desain.sumber === 'pengguna';
      const hasil = await simpanPengaturanKartu({
        kegiatan_evaluatif_id: kegiatanEvaluatifId,
        desain_id: pengguna ? Number(desain.id) : null,
        template_bawaan: pengguna || desain.gaya_latar === 'foto'
          ? null
          : desain.gaya_latar as TemplateBawaanKartu,
        lebar_mm: lebarMm,
        tinggi_mm: tinggiMm,
      });
      toast.success(hasil.pesan);
      await onMuatUlang();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMenyimpan(false);
    }
  };

  const hapus = async () => {
    if (!desain || desain.sumber !== 'pengguna') return;
    setMenyimpan(true);
    try {
      const hasil = await hapusDesainKartu(Number(desain.id));
      toast.success(hasil.pesan);
      setKonfirmasiHapus(false);
      await onMuatUlang();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMenyimpan(false);
    }
  };

  if (!muatan || !desain) {
    return <p className="text-xs text-muted-foreground">Memuat desain kartu…</p>;
  }

  const skalaDasar = 4;
  const skala = skalaDasar * zoom;
  const nonaktif = !canUbah || menyimpan;

  return (
    <div className="grid gap-3 xl:grid-cols-[250px_minmax(0,1fr)_280px]">
      <aside className="flex flex-col gap-3">
        <section className="border border-border p-2">
          <h3 className="mb-2 text-xs font-semibold">Pilihan desain</h3>
          <div className="flex max-h-64 flex-col gap-1 overflow-auto">
            {daftarDesain.map((item) => (
              <button
                key={String(item.id)}
                type="button"
                id={`btn_pilih_desain_${String(item.id).replace(/[^a-z0-9]+/gi, '_')}`}
                className={cn(
                  'flex w-full items-start justify-between gap-2 border border-border px-2 py-1.5 text-left text-xs hover:bg-muted/50',
                  desain.id === item.id && 'border-primary bg-primary/10',
                )}
                onClick={() => pilihDesain(item)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.nama}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {item.sumber === 'bawaan' ? 'Bawaan' : 'Milik lembaga'}
                  </span>
                </span>
                {desain.id === item.id && <span className="text-[10px] font-semibold text-primary">Aktif</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2 border border-border p-2">
          <h3 className="text-xs font-semibold">Desain</h3>
          <label className="text-[11px] text-muted-foreground" htmlFor="input_nama_desain_kartu">Nama desain</label>
          <Input
            id="input_nama_desain_kartu"
            className="h-8 text-xs"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama desain"
            disabled={nonaktif}
          />

          <h3 className="mt-1 text-xs font-semibold">Ukuran kartu</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground" htmlFor="input_lebar_kartu_mm">Lebar (mm)</label>
              <Input
                id="input_lebar_kartu_mm"
                type="number"
                min={40}
                max={150}
                step={0.5}
                className="h-8 text-xs"
                value={lebarMm}
                onChange={(e) => setLebarMm(angkaMasuk(e.target.value, lebarMm))}
                disabled={nonaktif}
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground" htmlFor="input_tinggi_kartu_mm">Tinggi (mm)</label>
              <Input
                id="input_tinggi_kartu_mm"
                type="number"
                min={25}
                max={210}
                step={0.5}
                className="h-8 text-xs"
                value={tinggiMm}
                onChange={(e) => setTinggiMm(angkaMasuk(e.target.value, tinggiMm))}
                disabled={nonaktif}
              />
            </div>
          </div>

          <h3 className="mt-1 text-xs font-semibold">Latar</h3>
          <div className="flex items-center gap-2">
            <input
              id="input_warna_latar_kartu"
              type="color"
              aria-label="Warna latar kartu"
              className="h-8 w-12 border border-input bg-transparent p-0.5"
              value={desain.warna_latar}
              onChange={(e) => setDesain({ ...desain, warna_latar: e.target.value })}
              disabled={nonaktif}
            />
            <select
              id="select_gaya_latar_kartu"
              aria-label="Gaya latar kartu"
              className="h-8 flex-1 border border-input bg-transparent px-2 text-xs"
              value={desain.gaya_latar}
              onChange={(e) => setDesain({ ...desain, gaya_latar: e.target.value as GayaLatarKartu })}
              disabled={nonaktif}
            >
              {GAYA_LATAR.map((item) => <option key={item.nilai} value={item.nilai}>{item.label}</option>)}
            </select>
          </div>
          <label
            htmlFor="input_gambar_latar_kartu"
            className={cn(
              'flex h-8 cursor-pointer items-center justify-center gap-1 border border-input text-xs hover:bg-muted/50',
              nonaktif && 'pointer-events-none opacity-50',
            )}
          >
            <ImageUp size={14} /> Unggah gambar
          </label>
          <input
            id="input_gambar_latar_kartu"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={nonaktif}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setLatarFile(file);
              if (file) setHapusLatar(false);
              e.target.value = '';
            }}
          />
          {(desain.latar_ada || latarFile !== null) && !hapusLatar && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              id="btn_hapus_latar_kartu"
              className="h-8 text-xs"
              onClick={() => {
                setLatarFile(null);
                setHapusLatar(true);
              }}
              disabled={nonaktif}
            >
              <X data-icon="inline-start" size={14} /> Hapus gambar latar
            </Button>
          )}

          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              id="btn_simpan_desain_kartu"
              className="h-8 text-xs"
              onClick={() => void simpanDesain()}
              disabled={nonaktif}
            >
              <Save data-icon="inline-start" size={14} /> Simpan desain
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              id="btn_simpan_ukuran_kartu"
              className="h-8 text-xs"
              onClick={() => void simpanUkuran()}
              disabled={nonaktif}
            >
              Simpan ukuran
            </Button>
          </div>
          {desain.sumber === 'pengguna' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              id="btn_hapus_desain_kartu"
              className="h-8 text-xs text-destructive"
              onClick={() => setKonfirmasiHapus(true)}
              disabled={nonaktif}
            >
              <Trash2 data-icon="inline-start" size={14} /> Hapus desain
            </Button>
          )}
        </section>
      </aside>

      <section className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold">Bidang desain</h3>
          <select
            id="select_zoom_desain_kartu"
            aria-label="Zoom bidang desain"
            className="h-8 border border-input bg-transparent px-2 text-xs"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value={1}>100%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
        </div>
        <div className="overflow-auto border border-border bg-muted/40 p-6">
          <div className="mx-auto" style={{ width: lebarMm * skala, height: tinggiMm * skala }}>
            <div
              style={{
                width: lebarMm * skalaDasar,
                height: tinggiMm * skalaDasar,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
            >
              <KartuPeserta
                desain={desain}
                konteks={konteks}
                lebarMm={lebarMm}
                tinggiMm={tinggiMm}
                skala={skalaDasar}
                fotoUrl={pesertaContoh ? foto[pesertaContoh.santri_id] ?? null : null}
                latarUrl={latarTampil}
                interaktif={canUbah}
                terpilih={terpilih}
                onPilih={canUbah ? setTerpilih : undefined}
                onUbah={canUbah ? ubahElemen : undefined}
              />
            </div>
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-3">
        <section className="flex flex-col gap-2 border border-border p-2">
          <h3 className="text-xs font-semibold">Tambah elemen</h3>
          <div className="flex items-end gap-1">
            <div className="min-w-0 flex-1">
              <label className="text-[11px] text-muted-foreground" htmlFor="select_tambah_data_kartu">Data</label>
              <select
                id="select_tambah_data_kartu"
                className="h-8 w-full border border-input bg-transparent px-2 text-xs"
                value={fieldBaru}
                onChange={(e) => setFieldBaru(e.target.value as FieldKartuPeserta)}
                disabled={nonaktif}
              >
                {KATALOG_DATA_KARTU.map((item) => <option key={item.field} value={item.field}>{item.label}</option>)}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              id="btn_tambah_data_kartu"
              aria-label="Tambah elemen data"
              title="Tambah elemen data"
              disabled={nonaktif}
              onClick={() => tambahData(fieldBaru)}
            >
              <Plus size={15} />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" id="btn_tambah_teks_kartu" className="h-8 flex-1 text-xs" disabled={nonaktif} onClick={tambahTeks}>
              <Plus data-icon="inline-start" size={14} /> Teks
            </Button>
            <Button type="button" variant="outline" size="sm" id="btn_tambah_foto_kartu" className="h-8 flex-1 text-xs" disabled={nonaktif || adaFoto} onClick={tambahFoto}>
              <Plus data-icon="inline-start" size={14} /> Foto
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2 border border-border p-2">
          <h3 className="text-xs font-semibold">Elemen terpilih</h3>
          {elemenTerpilih === null ? (
            <p className="text-[11px] text-muted-foreground">Pilih elemen pada bidang desain.</p>
          ) : (
            <>
              {elemenTerpilih.tipe === 'data' && (
                <div>
                  <label className="text-[11px] text-muted-foreground" htmlFor="select_field_elemen_kartu">Data</label>
                  <select
                    id="select_field_elemen_kartu"
                    className="h-8 w-full border border-input bg-transparent px-2 text-xs"
                    value={elemenTerpilih.field ?? 'nama'}
                    onChange={(e) => ubahElemenTerpilih((item) => ({ ...item, field: e.target.value as FieldKartuPeserta }))}
                    disabled={nonaktif}
                  >
                    {KATALOG_DATA_KARTU.map((item) => <option key={item.field} value={item.field}>{item.label}</option>)}
                  </select>
                </div>
              )}
              {elemenTerpilih.tipe === 'teks' && (
                <div>
                  <label className="text-[11px] text-muted-foreground" htmlFor="input_teks_elemen_kartu">Teks</label>
                  <Input
                    id="input_teks_elemen_kartu"
                    className="h-8 text-xs"
                    value={elemenTerpilih.teks ?? ''}
                    onChange={(e) => ubahElemenTerpilih((item) => ({ ...item, teks: e.target.value }))}
                    disabled={nonaktif}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground" htmlFor="input_ukuran_font_kartu">Ukuran font</label>
                  <Input
                    id="input_ukuran_font_kartu"
                    type="number"
                    min={6}
                    max={48}
                    className="h-8 text-xs"
                    value={elemenTerpilih.ukuran_font}
                    onChange={(e) => ubahElemenTerpilih((item) => ({
                      ...item, ukuran_font: Math.max(6, Math.min(48, angkaMasuk(e.target.value, item.ukuran_font))),
                    }))}
                    disabled={nonaktif}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground" htmlFor="input_warna_elemen_kartu">Warna</label>
                  <input
                    id="input_warna_elemen_kartu"
                    type="color"
                    aria-label="Warna elemen"
                    className="h-8 w-full border border-input bg-transparent p-0.5"
                    value={elemenTerpilih.warna}
                    onChange={(e) => ubahElemenTerpilih((item) => ({ ...item, warna: e.target.value }))}
                    disabled={nonaktif}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <input
                    id="input_tebal_elemen_kartu"
                    type="checkbox"
                    checked={elemenTerpilih.tebal}
                    onChange={(e) => ubahElemenTerpilih((item) => ({ ...item, tebal: e.target.checked }))}
                    disabled={nonaktif}
                  />
                  Tebal
                </label>
                <div className="ml-auto flex gap-1">
                  {([
                    ['left', AlignLeft, 'Kiri'],
                    ['center', AlignCenter, 'Tengah'],
                    ['right', AlignRight, 'Kanan'],
                  ] as const).map(([rata, Ikon, label]) => (
                    <Button
                      key={rata}
                      type="button"
                      variant={elemenTerpilih.rata === rata ? 'default' : 'outline'}
                      size="icon"
                      id={`btn_rata_${rata}_elemen_kartu`}
                      aria-label={`Rata ${label}`}
                      title={`Rata ${label}`}
                      disabled={nonaktif}
                      onClick={() => ubahElemenTerpilih((item) => ({ ...item, rata }))}
                    >
                      <Ikon size={14} />
                    </Button>
                  ))}
                </div>
              </div>

              <h4 className="mt-1 text-[11px] font-semibold">Posisi &amp; ukuran (%)</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground" htmlFor="input_x_elemen_kartu">X</label>
                  <Input id="input_x_elemen_kartu" type="number" min={0} max={95} className="h-8 text-xs"
                    value={bulat(elemenTerpilih.x)}
                    onChange={(e) => ubahElemenTerpilih((item) => ({
                      ...item, x: Math.max(0, Math.min(100 - item.lebar, angkaMasuk(e.target.value, item.x))),
                    }))}
                    disabled={nonaktif} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground" htmlFor="input_y_elemen_kartu">Y</label>
                  <Input id="input_y_elemen_kartu" type="number" min={0} max={95} className="h-8 text-xs"
                    value={bulat(elemenTerpilih.y)}
                    onChange={(e) => ubahElemenTerpilih((item) => ({
                      ...item, y: Math.max(0, Math.min(100 - item.tinggi, angkaMasuk(e.target.value, item.y))),
                    }))}
                    disabled={nonaktif} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground" htmlFor="input_lebar_elemen_kartu">Lebar</label>
                  <Input id="input_lebar_elemen_kartu" type="number" min={5} max={100} className="h-8 text-xs"
                    value={bulat(elemenTerpilih.lebar)}
                    onChange={(e) => ubahElemenTerpilih((item) => ubahUkuranElemenKartu(item, angkaMasuk(e.target.value, item.lebar), item.tinggi))}
                    disabled={nonaktif} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground" htmlFor="input_tinggi_elemen_kartu">Tinggi</label>
                  <Input id="input_tinggi_elemen_kartu" type="number" min={5} max={100} className="h-8 text-xs"
                    value={bulat(elemenTerpilih.tinggi)}
                    onChange={(e) => ubahElemenTerpilih((item) => ubahUkuranElemenKartu(item, item.lebar, angkaMasuk(e.target.value, item.tinggi)))}
                    disabled={nonaktif} />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                id="btn_hapus_elemen_kartu"
                className="h-8 text-xs text-destructive"
                onClick={hapusElemen}
                disabled={nonaktif}
              >
                <Trash2 data-icon="inline-start" size={14} /> Hapus elemen
              </Button>
            </>
          )}
        </section>

      </aside>

      <AlertDialog open={konfirmasiHapus} onOpenChange={setKonfirmasiHapus}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus desain kartu ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Desain akan dihapus dari lembaga. Kegiatan Evaluatif yang memakainya kembali ke desain Klasik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction id="btn_konfirmasi_hapus_desain_kartu" onClick={() => void hapus()}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function angkaMasuk(nilai: string, cadangan: number): number {
  const angka = Number(nilai);
  return Number.isFinite(angka) ? angka : cadangan;
}

function bulat(nilai: number): number {
  return Math.round(nilai * 10) / 10;
}
