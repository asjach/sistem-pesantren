import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ambilBerkas, errorMessage } from '@/api/client';
import {
  ambilKatalogNilai,
  ambilTemplate,
  unggahBerkasTemplate,
  updateTemplate,
} from '@/api/templateDokumen';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InspekturMedan from '@/components/template/InspekturMedan';
import LapisanMedan from '@/components/template/LapisanMedan';
import LembarPdf from '@/components/template/LembarPdf';
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
import { muatPdf, type DokumenPdf } from '@/lib/template/pdf';
import { mmKePx } from '@/lib/template/satuan';
import { Riwayat } from '@/lib/template/Riwayat';
import type { Kotak } from '@/lib/template/snap';
import { TIPE_MEDAN, type GayaMedan, type KatalogNilai, type Medan, type TipeMedan, type UkuranHalaman } from '@/lib/template/tipe';
import { ChevronLeft, Minus, Plus, Save, Undo2, ArrowRight } from '@/icons';

const LEBAR_KANVAS_PX = 760;

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;

export default function TemplateMedanPage() {
  const { id } = useParams();
  const templateId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const bolehUbah = bisa(user, 'template_dokumen.ubah');

  const [nama, setNama] = useState('');
  const [doc, setDoc] = useState<DokumenPdf | null>(null);
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
  // Status undo/redo disimpan di state supaya tombol ikut menggambar ulang.
  const [statusRiwayat, setStatusRiwayat] = useState({ undo: false, redo: false });

  const segarkanStatusRiwayat = useCallback(() => {
    setStatusRiwayat({ undo: riwayatRef.current.bisaUndo(), redo: riwayatRef.current.bisaRedo() });
  }, []);

  const ukuran: UkuranHalaman = doc?.ukuran[halaman - 1] ?? ukuranA4();
  const lebarPx = Math.round(mmKePx(ukuran.lebar_mm, zoom));

  const muat = useCallback(async () => {
    setSibuk(true);
    setGalat(null);

    try {
      const [template, katalogNilai] = await Promise.all([
        ambilTemplate(templateId),
        ambilKatalogNilai(),
      ]);

      setNama(template.nama);
      setKatalog(katalogNilai);

      const medanAwal = normalisasiDefinisi(template.definisi).medan;
      setMedan(medanAwal);
      riwayatRef.current.setAwal(medanAwal);
      segarkanStatusRiwayat();

      if (template.punya_berkas) {
        setDoc(await muatPdf(await ambilBerkas(`/admin/template-dokumen/${templateId}/berkas`)));
      } else {
        setDoc(null);
      }
    } catch (e) {
      setGalat(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (Number.isFinite(templateId)) {
      muat();
    }
  }, [muat, templateId]);

  useEffect(() => {
    const docAktif = doc;
    return () => {
      void docAktif?.tutup();
    };
  }, [doc]);

  /** Terapkan perubahan dan catat ke riwayat. */
  const terapkan = useCallback((berikutnya: Medan[], gabung: boolean, selesai: boolean) => {
    riwayatRef.current.catat('medan', berikutnya, gabung);
    setMedan(berikutnya);
    segarkanStatusRiwayat();
    if (selesai) {
      riwayatRef.current.tutupGabung();
    }
  }, [segarkanStatusRiwayat]);

  const ubahKotak = useCallback(
    (medanId: string, kotak: Partial<Kotak>, gabung: boolean, selesai: boolean) => {
      const berikut = pindahMedan(medan, medanId, kotak, ukuran);
      terapkan(berikut, gabung, selesai);
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

  const lepasKanvas = useCallback((e: React.DragEvent) => {
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
  }, [tambahMedan, zoom]);

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
      await updateTemplate(templateId, { nama, definisi: { versi: 1, medan } });
      toast.success('Medan template tersimpan.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMenyimpan(false);
    }
  }, [medan, nama, templateId]);

  const unggahBerkas = useCallback(
    async (berkas: File) => {
      try {
        await unggahBerkasTemplate(templateId, berkas);
        toast.success('Berkas template diunggah. Halaman dimuat ulang.');
        await muat();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [muat, templateId],
  );

  const terpilihMedan = useMemo(() => medan.find((m) => m.id === terpilih) ?? null, [medan, terpilih]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {galat && <ErrorNotice>{galat}</ErrorNotice>}

      <div className="flex flex-wrap items-end gap-2 border-b border-border p-2">
        <Button id="btn_kembali_daftar_template" variant="ghost" onClick={() => navigate('/template-dokumen')}>
          <ChevronLeft size={16} /> Daftar template
        </Button>

        <div className="min-w-48">
          <FieldLabel htmlFor="input_nama_template_medan">Nama template</FieldLabel>
          <Input id="input_nama_template_medan" value={nama} onChange={(e) => setNama(e.target.value)} maxLength={120} />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button id="btn_zoom_kecil" variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.1))}>
            <Minus size={16} />
          </Button>
          <span className="w-14 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button id="btn_zoom_besar" variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.1))}>
            <Plus size={16} />
          </Button>
        </div>

        <Button
          id="btn_undo_medan"
          variant="outline"
          size="sm"
          onClick={undo}
          disabled={!statusRiwayat.undo}
          title="Urungkan perubahan terakhir"
        >
          <Undo2 size={16} /> Urungkan
        </Button>
        <Button
          id="btn_redo_medan"
          variant="outline"
          size="sm"
          onClick={redo}
          disabled={!statusRiwayat.redo}
          title="Ulangi perubahan yang dibatalkan"
        >
          <ArrowRight size={16} /> Ulangi
        </Button>

        {bolehUbah && (
          <Button id="btn_simpan_medan" onClick={simpan} disabled={menyimpan}>
            <Save size={16} /> {menyimpan ? 'Menyimpan...' : 'Simpan'}
          </Button>
        )}
      </div>

      {doc && doc.jumlah > 1 && (
        <Tabs value={String(halaman)} onValueChange={(v) => setHalaman(Number(v))} className="px-2 pt-2">
          <TabsList>
            {Array.from({ length: doc.jumlah }, (_, i) => i + 1).map((n) => (
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
          {sibuk && <p className="p-4 text-sm text-muted-foreground">Memuat template...</p>}

          {!sibuk && !doc && (
            <div className="mx-auto mt-10 max-w-md rounded-lg border border-dashed border-border p-6 text-center">
              <p className="font-medium">Belum ada berkas PDF template</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Rancang halaman di Word, CorelDRAW, atau Canva lalu ekspor ke PDF. Unggah di sini, baru letakkan medan
                isian di atasnya.
              </p>
              {bolehUbah && (
                <div className="mt-4">
                  <FieldLabel htmlFor="input_berkas_template_pdf" className="text-left">
                    Berkas PDF (maksimal 20 MB)
                  </FieldLabel>
                  <Input
                    id="input_berkas_template_pdf"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const berkas = e.target.files?.[0];
                      if (berkas) void unggahBerkas(berkas);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {doc && (
            <div className="flex flex-col items-center gap-4">
              <div
                ref={kanvasRef}
                className="relative"
                style={{ width: lebarPx, height: Math.round((lebarPx * ukuran.tinggi_mm) / ukuran.lebar_mm) }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={lepasKanvas}
              >
                <LembarPdf doc={doc} nomor={halaman} lebarPx={lebarPx} />
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
                <div className="w-full max-w-md">
                  <FieldLabel htmlFor="input_ganti_berkas_pdf">Ganti berkas PDF template</FieldLabel>
                  <Input
                    id="input_ganti_berkas_pdf"
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const berkas = e.target.files?.[0];
                      if (berkas) void unggahBerkas(berkas);
                    }}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mengganti berkas mengubah jumlah halaman. Medan yang menunjuk halaman di luar jangkauan akan
                    ditolak saat disimpan.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border">
          <InspekturMedan
            medan={terpilihMedan}
            katalog={katalog}
            jumlahHalaman={doc?.jumlah ?? 1}
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
              setTerpilih(berikut.find((m) => m.id !== medanId && m.label.includes('salinan'))?.id ?? null);
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
