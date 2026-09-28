import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import { bisa } from '@/api/auth';
import { ambilKatalogNilai, ambilTemplate, updateTemplate } from '@/api/templateDokumen';
import { useAuth } from '@/auth/AuthContext';
import { ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InspekturMedan from '@/components/template/InspekturMedan';
import LapisanMedan from '@/components/template/LapisanMedan';
import LembarHtml from '@/components/template/LembarHtml';
import PaletMedan from '@/components/template/PaletMedan';
import {
  duplikatMedan,
  gantiMedan,
  hapusMedan,
  medanBaru,
  normalisasiDefinisi,
  pindahMedan,
  ubahGaya,
  ukuranA4,
} from '@/lib/template/medan';
import { Riwayat } from '@/lib/template/Riwayat';
import type { Kotak } from '@/lib/template/snap';
import { mmKePx } from '@/lib/template/satuan';
import {
  TIPE_MEDAN,
  type GayaMedan,
  type KatalogNilai,
  type KategoriTemplate,
  type Medan,
  type TipeMedan,
  type UkuranHalaman,
} from '@/lib/template/tipe';
import { ArrowRight, ChevronLeft, Minus, Plus, Save, Undo2 } from '@/icons';

const LEBAR_KANVAS_PX = 760;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const MAKS_HALAMAN = 50;

const UKURAN_TERSEDIA: { label: string; lebar_mm: number; tinggi_mm: number }[] = [
  { label: 'A4 tegak (210 × 297 mm)', lebar_mm: 210, tinggi_mm: 297 },
  { label: 'A4 mendatar (297 × 210 mm)', lebar_mm: 297, tinggi_mm: 210 },
  { label: 'A5 tegak (148 × 210 mm)', lebar_mm: 148, tinggi_mm: 210 },
  { label: 'F4 tegak (210 × 330 mm)', lebar_mm: 210, tinggi_mm: 330 },
];

/**
 * Desainer untuk template jenis 'html': halaman digambar sendiri di kanvas,
 * tanpa berkas PDF. Koordinat, snapping, dan inspectorsama dengan editor PDF
 * eksternal supaya tidak ada dua cara menghitung posisi di aplikasi ini.
 */
export default function TemplateHtmlPage() {
  const { id } = useParams();
  const templateId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const bolehUbah = bisa(user, 'template_dokumen.ubah');

  const [nama, setNama] = useState('');
  const [kategori, setKategori] = useState<KategoriTemplate>('surat');
  const [jumlahHalaman, setJumlahHalaman] = useState(1);
  const [ukuran, setUkuran] = useState<UkuranHalaman>(ukuranA4());
  const [katalog, setKatalog] = useState<KatalogNilai | null>(null);
  const [medan, setMedan] = useState<Medan[]>([]);
  const [halaman, setHalaman] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [terpilih, setTerpilih] = useState<string | null>(null);
  const [garis, setGaris] = useState<{ x: number[]; y: number[] } | null>(null);
  const [seret, setSeret] = useState<TipeMedan | null>(null);
  const [sibuk, setSibuk] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const riwayatRef = useRef<Riwayat<Medan[]>>(new Riwayat<Medan[]>([]));
  const kanvasRef = useRef<HTMLDivElement>(null);
  const [statusRiwayat, setStatusRiwayat] = useState({ undo: false, redo: false });

  const segarkanStatusRiwayat = useCallback(() => {
    setStatusRiwayat({ undo: riwayatRef.current.bisaUndo(), redo: riwayatRef.current.bisaRedo() });
  }, []);

  const muat = useCallback(async () => {
    setSibuk(true);
    setGalat(null);

    try {
      const [template, katalogNilai] = await Promise.all([ambilTemplate(templateId), ambilKatalogNilai()]);

      if (template.jenis !== 'html') {
        setGalat('Template ini memakai PDF eksternal. Susun medannya dari daftar template.');
        return;
      }

      setNama(template.nama);
      setKategori(template.kategori);
      setJumlahHalaman(Math.max(1, template.jumlah_halaman));
      setUkuran(template.halaman[0] ?? ukuranA4());
      setKatalog(katalogNilai);

      const medanAwal = normalisasiDefinisi(template.definisi).medan;
      setMedan(medanAwal);
      riwayatRef.current.setAwal(medanAwal);
      segarkanStatusRiwayat();
    } catch (e) {
      setGalat(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  }, [segarkanStatusRiwayat, templateId]);

  useEffect(() => {
    if (Number.isFinite(templateId)) {
      void muat();
    }
  }, [muat, templateId]);

  const lebarPx = useMemo(() => Math.round(mmKePx(ukuran.lebar_mm, zoom)), [ukuran.lebar_mm, zoom]);
  const tinggiPx = Math.round((lebarPx * ukuran.tinggi_mm) / ukuran.lebar_mm);
  const terpilihMedan = useMemo(() => medan.find((m) => m.id === terpilih) ?? null, [medan, terpilih]);

  const terapkan = useCallback(
    (berikutnya: Medan[], gabung: boolean, selesai: boolean) => {
      riwayatRef.current.catat('medan', berikutnya, gabung);
      setMedan(berikutnya);
      segarkanStatusRiwayat();
      if (selesai) {
        riwayatRef.current.tutupGabung();
      }
    },
    [segarkanStatusRiwayat],
  );

  const ubahKotak = useCallback(
    (medanId: string, kotak: Partial<Kotak>, gabung: boolean, selesai: boolean) => {
      terapkan(pindahMedan(medan, medanId, kotak, ukuran), gabung, selesai);
    },
    [medan, terapkan, ukuran],
  );

  const tambahMedan = useCallback(
    (tipe: TipeMedan, posisi: Kotak | null) => {
      const baru = medanBaru(tipe, halaman, posisi, medan);
      setMedan((sekarang) => {
        const berikut = [...sekarang, baru];
        riwayatRef.current.catat('tambah', berikut, false);
        return berikut;
      });
      segarkanStatusRiwayat();
      setTerpilih(baru.id);
    },
    [halaman, medan, segarkanStatusRiwayat],
  );

  const mulaiSeretPalet = useCallback((tipe: TipeMedan, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', tipe);
    e.dataTransfer.effectAllowed = 'copy';
    setSeret(tipe);
  }, []);

  const lepasKanvas = useCallback(
    (e: React.DragEvent) => {
      const tipe = e.dataTransfer.getData('text/plain') as TipeMedan;
      setSeret(null);

      if (!TIPE_MEDAN.includes(tipe)) {
        return;
      }

      const kotakKanvas = kanvasRef.current?.getBoundingClientRect();
      if (!kotakKanvas) {
        return;
      }

      // Geseran pointer sudah dalam piksel layar; dikembalikan ke milimeter.
      const skala = mmKePx(1, zoom);
      tambahMedan(tipe, {
        x: (e.clientX - kotakKanvas.left) / skala,
        y: (e.clientY - kotakKanvas.top) / skala,
        w: 0,
        h: 0,
      });
    },
    [tambahMedan, zoom],
  );

  const undo = useCallback(() => {
    setMedan(riwayatRef.current.undo());
    segarkanStatusRiwayat();
  }, [segarkanStatusRiwayat]);

  const redo = useCallback(() => {
    setMedan(riwayatRef.current.redo());
    segarkanStatusRiwayat();
  }, [segarkanStatusRiwayat]);

  const simpan = useCallback(async () => {
    setMenyimpan(true);
    try {
      await updateTemplate(templateId, {
        nama,
        kategori,
        jumlah_halaman: jumlahHalaman,
        halaman: [ukuran],
        definisi: { versi: 1, medan },
      });
      toast.success('Desainer tersimpan.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMenyimpan(false);
    }
  }, [jumlahHalaman, kategori, medan, nama, templateId, ukuran]);

  const ubahJumlahHalaman = useCallback((baru: number) => {
    const jumlah = Math.min(MAKS_HALAMAN, Math.max(1, Math.round(baru) || 1));
    setJumlahHalaman(jumlah);
    setHalaman((sekarang) => Math.min(sekarang, jumlah));
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {galat && <ErrorNotice>{galat}</ErrorNotice>}

      <div className="flex flex-wrap items-end gap-2 border-b border-border p-2">
        <Button id="btn_kembali_daftar_template_html" variant="ghost" onClick={() => navigate('/template-dokumen')}>
          <ChevronLeft size={16} /> Daftar template
        </Button>

        <div className="min-w-48">
          <FieldLabel htmlFor="input_nama_template_html">Nama template</FieldLabel>
          <Input
            id="input_nama_template_html"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="w-56">
          <FieldLabel htmlFor="select_ukuran_halaman_html">Ukuran halaman</FieldLabel>
          <Select
            value={`${ukuran.lebar_mm}x${ukuran.tinggi_mm}`}
            onValueChange={(v) => {
              const ditemukan = UKURAN_TERSEDIA.find((satu) => `${satu.lebar_mm}x${satu.tinggi_mm}` === v);
              if (ditemukan) {
                setUkuran({ lebar_mm: ditemukan.lebar_mm, tinggi_mm: ditemukan.tinggi_mm });
              }
            }}
          >
            <SelectTrigger id="select_ukuran_halaman_html" aria-label="Ukuran halaman template" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UKURAN_TERSEDIA.map((satu) => (
                <SelectItem key={`${satu.lebar_mm}x${satu.tinggi_mm}`} value={`${satu.lebar_mm}x${satu.tinggi_mm}`}>
                  {satu.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-28">
          <FieldLabel htmlFor="input_jumlah_halaman_html">Jumlah halaman</FieldLabel>
          <Input
            id="input_jumlah_halaman_html"
            type="number"
            min={1}
            max={MAKS_HALAMAN}
            value={jumlahHalaman}
            onChange={(e) => ubahJumlahHalaman(Number(e.target.value))}
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            id="btn_zoom_kecil_html"
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.1))}
          >
            <Minus size={16} />
          </Button>
          <span className="w-14 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button
            id="btn_zoom_besar_html"
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.1))}
          >
            <Plus size={16} />
          </Button>
        </div>

        <Button id="btn_undo_html" variant="outline" size="sm" onClick={undo} disabled={!statusRiwayat.undo}>
          <Undo2 size={16} /> Urungkan
        </Button>
        <Button id="btn_redo_html" variant="outline" size="sm" onClick={redo} disabled={!statusRiwayat.redo}>
          <ArrowRight size={16} /> Ulangi
        </Button>

        {bolehUbah && (
          <Button id="btn_simpan_html" onClick={simpan} disabled={menyimpan}>
            <Save size={16} /> {menyimpan ? 'Menyimpan...' : 'Simpan'}
          </Button>
        )}
      </div>

      {jumlahHalaman > 1 && (
        <Tabs value={String(halaman)} onValueChange={(v) => setHalaman(Number(v))} className="px-2 pt-2">
          <TabsList>
            {Array.from({ length: jumlahHalaman }, (_, i) => i + 1).map((n) => (
              <TabsTrigger key={n} value={String(n)}>
                Halaman {n}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-border">
          <p className="px-2 pt-2 text-xs font-medium text-muted-foreground">Jenis medan</p>
          <PaletMedan
            seret={seret}
            onSeretMulai={mulaiSeretPalet}
            onSeretSelesai={() => setSeret(null)}
            onTambah={(tipe) => tambahMedan(tipe, null)}
          />
        </aside>

        <main className="min-w-0 flex-1 overflow-auto bg-muted/30 p-4">
          {sibuk ? (
            <p className="p-4 text-sm text-muted-foreground">Memuat template...</p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div
                ref={kanvasRef}
                className="relative"
                style={{ width: lebarPx, height: tinggiPx }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={lepasKanvas}
              >
                <LembarHtml
                  ukuran={ukuran}
                  lebarPx={lebarPx}
                  zoom={zoom}
                  className="absolute inset-0 shadow-sm ring-1 ring-border"
                />
                <LapisanMedan
                  medan={medan}
                  halaman={halaman}
                  ukuran={ukuran}
                  lebarPx={lebarPx}
                  zoom={zoom}
                  terpilih={terpilih}
                  onPilih={setTerpilih}
                  onKotak={ubahKotak}
                  onGaris={setGaris}
                  modeBaca={!bolehUbah}
                />

                {garis &&
                  garis.x.map((x) => (
                    <span
                      key={`gx-${x}`}
                      className="pointer-events-none absolute w-px bg-accent-foreground"
                      style={{ left: mmKePx(x, zoom), top: 0, height: '100%' }}
                    />
                  ))}
                {garis?.y.map((y) => (
                  <span
                    key={`gy-${y}`}
                    className="pointer-events-none absolute h-px bg-accent-foreground"
                    style={{ top: mmKePx(y, zoom), left: 0, width: '100%' }}
                  />
                ))}
              </div>

              {bolehUbah && (
                <p className="max-w-md text-center text-xs text-muted-foreground">
                  Guide setiap 10 milimeter hanya sebagai pengukur dan tidak ikut tercetak. Motif kop surat, garis, dan
                  tabel digambar sebagai medan gambar maupun baris berulang.
                </p>
              )}
            </div>
          )}
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border">
          <InspekturMedan
            medan={terpilihMedan}
            katalog={katalog}
            jumlahHalaman={jumlahHalaman}
            modeBaca={!bolehUbah}
            onUbah={(medanId, ubah) => terapkan(gantiMedan(medan, medanId, ubah), false, true)}
            onUbahGaya={(medanId, gaya: Partial<GayaMedan>) => terapkan(ubahGaya(medan, medanId, gaya), false, true)}
            onHapus={(medanId) => {
              setTerpilih(null);
              terapkan(hapusMedan(medan, medanId), false, true);
            }}
            onDuplikat={(medanId) => {
              const berikut = duplikatMedan(medan, medanId);
              terapkan(berikut, false, true);
            }}
          />

          <Separator />
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Seret kotak ke tepi halaman atau tepi kotak lain untuk menempel. Tahan Shift sementara mengubah ukuran
            untuk menjaga rasio.
          </p>
        </aside>
      </div>
    </div>
  );
}
