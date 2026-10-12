import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarRange, Reset } from '@/icons';
import { bulanIni, NAMA_BULAN, NAMA_BULAN_SINGKAT, pecahBulan, rakitBulan } from '@/lib/tanggal';
import { diDalamPanel, kelasPanel, KELAS_BORDER_SAMAR, KELAS_TOMBOL, OFFSET_RATA, OFFSET_SISI } from '@/components/panelMenempel';
import type { KonteksTipeInput } from '@/components/tipeInput';

/** Tombol bulan + DUA panel pemilih periode untuk tipe `bulan` — pasangan
 *  `aksiKanan` dari `FORMAT_BULAN`, dengan tata letak seperti panel kalender
 *  (lihat `panelMenempel.ts`): panel ATAS untuk TAHUN, panel BAWAH untuk NAMA
 *  BULAN (Jan–Des).
 *
 *  Kotak bulan SENGAJA bukan `input type="month"`: tampilan & popover
 *  pemilihnya milik webview (ikut locale, tak bisa distyle/dites), jadi
 *  formatnya tak bisa disamakan dengan sisa aplikasi. Di sini kotaknya teks
 *  ber-mask `mm/yyyy` (`FORMAT_BULAN`) dan pemilihnya milik kita — nilainya
 *  TETAP `YYYY-MM`, sama seperti input native.
 *
 *  Tahun yang dipilih di panel atas adalah ACUAN grid bulan di bawahnya, jadi
 *  keduanya selalu sinkron: menggeser daftar tahun (gulir mouse / PageUp /
 *  PageDown) berarti memilih tahun lain, bukan sekadar menggulir tampilan. */
export default function PopoverBulan({ htmlFor, nilai, setNilai }: KonteksTipeInput) {
  const [buka, setBuka] = useState(false);
  /** Tahun acuan grid bulan (panel bawah) sekaligus tahun bertanda terpilih. */
  const [tahun, setTahun] = useState(() => tahunDari(nilai));

  /* Nilai berubah (dari luar) → ikuti tahunnya, supaya panel selalu terbuka
     pada bulan yang sedang terpilih. Menggulir daftar tahun tak menulis nilai,
     jadi tak ada tarik-menarik dengan pilihan pengguna di dalam panel. */
  useEffect(() => {
    const b = pecahBulan(nilai);
    if (b !== null) setTahun(b.tahun);
  }, [nilai]);

  /** Selalu dibuka pada tahun nilai terpilih (atau tahun ini). */
  const ubahBuka = (baru: boolean) => {
    setBuka(baru);
    if (baru) setTahun(tahunDari(nilai));
  };

  /** Pilih satu bulan pada TAHUN yang sedang aktif → tulis `YYYY-MM` lalu tutup. */
  const pilih = (bulan: number) => {
    const hasil = rakitBulan(tahun, bulan);
    if (hasil === null) return;
    setNilai(hasil);
    setBuka(false);
  };

  /** "Bulan ini" = bulan berjalan pada TAHUNNYA SENDIRI — bukan bulan berjalan
   *  di tahun yang kebetulan sedang ditelusuri di panel atas. */
  const pilihBulanIni = () => {
    const b = pecahBulan(bulanIni());
    if (b === null) return;
    setTahun(b.tahun);
    setNilai(bulanIni());
    setBuka(false);
  };

  const awalBlok = batasAwalBlok(awalBlokUntuk(tahun));
  const akhirBlok = awalBlok + TAHUN_PER_BLOK - 1;
  const kini = pecahBulan(bulanIni());
  const dipilih = pecahBulan(nilai);

  /* DAFTAR TAHUN digeser dengan gulir mouse: satu gulungan = satu baris
     (`TAHUN_PER_BARIS` tahun). Karena tahun yang tampil memang pilihan yang
     berlaku, gulirannya langsung mengubah tahun — beda dengan kalender tanggal
     yang tahunnya hanya memindahkan grid hari.

     Listener dipasang langsung pada elemen (bukan `onWheel` React) dengan
     `{ passive: false }` karena React memasang wheel secara PASIF — di dalam
     listener pasif `preventDefault` diabaikan browser, sementara di sini gulir
     halaman memang harus berhenti selama daftar tahun bergerak.

     Elemennya ditahan di STATE (bukan `useRef`) dan efek bergantung padanya:
     grid tahun baru muncul saat panel terbuka lewat presence Radix yang bisa
     jadi SATU COMMIT di belakang state `buka` — dengan bergantung `buka`,
     listener sempat dipasang saat elemennya belum ada. */
  const [elTahun, setElTahun] = useState<HTMLDivElement | null>(null);
  const pasangRefTahun = useCallback((node: HTMLDivElement | null) => setElTahun(node), []);
  useEffect(() => {
    if (elTahun === null) return;
    const onGulir = (ev: WheelEvent) => {
      if (ev.deltaY === 0) return;
      ev.preventDefault();
      setTahun((t) => batasTahun(t + Math.sign(ev.deltaY) * TAHUN_PER_BARIS));
    };
    elTahun.addEventListener('wheel', onGulir, { passive: false });
    return () => elTahun.removeEventListener('wheel', onGulir);
  }, [elTahun]);

  /* Paging tahun tanpa mouse: satu baris per PageUp/PageDown, Home = kembali ke
     tahun nilai terpilih (atau tahun ini). */
  const onKeyDownTahun = (e: KeyboardEvent<HTMLDivElement>) => {
    const geser = e.key === 'PageUp' ? -TAHUN_PER_BARIS : e.key === 'PageDown' ? TAHUN_PER_BARIS : 0;
    if (geser !== 0) {
      e.preventDefault();
      setTahun((t) => batasTahun(t + geser));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setTahun(tahunDari(nilai));
    }
  };

  return (
    <Popover open={buka} onOpenChange={ubahBuka}>
      <PopoverTrigger asChild>
        <Button
          id={htmlFor === undefined ? undefined : `btn_bulan_${htmlFor}`}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Pilih bulan"
          title="Pilih bulan"
          className="h-full rounded-none text-muted-foreground"
        >
          <CalendarRange className="size-4" />
        </Button>
      </PopoverTrigger>

      {/* Panel ATAS: daftar TAHUN (2 baris × 5). Tiap panel mencegah penutupan
          bila sasarannya panel sebelah — tanpa itu menekan tombol di satu panel
          menutup panel lainnya. */}
      <PopoverContent
        data-panel={PANEL_ATAS}
        side="top"
        align="end"
        sideOffset={OFFSET_SISI}
        alignOffset={OFFSET_RATA}
        avoidCollisions={false}
        className={KELAS_PANEL}
        onInteractOutside={(e) => { if (diDalamPanel(e.target, PANEL_BAWAH)) e.preventDefault(); }}
      >
        <div className="flex flex-col">
          {/* Rentang tahun yang tampil sekarang; daftarnya digeser dengan gulir
              mouse satu baris sekali (atau PageUp/PageDown). */}
          <div className="pb-1 text-center text-xs font-medium tabular-nums">{awalBlok}–{akhirBlok}</div>

          <div
            ref={pasangRefTahun}
            role="group"
            aria-label={`Tahun ${awalBlok}–${akhirBlok}`}
            tabIndex={0}
            title="Gulir untuk memilih tahun lain (PageUp/PageDown; Home = tahun aktif)"
            onKeyDown={onKeyDownTahun}
            className="grid grid-cols-5"
          >
            {Array.from({ length: TAHUN_PER_BLOK }, (_, i) => awalBlok + i).map((pilihan) => {
              const iniDipilih = pilihan === tahun;
              return (
                <Button
                  key={pilihan}
                  type="button"
                  variant={iniDipilih ? 'default' : 'outline'}
                  size="sm"
                  className={cn(KELAS_TOMBOL, KELAS_BORDER_SAMAR, 'h-6 px-0 tabular-nums', !iniDipilih && pilihan === kini?.tahun && 'font-semibold text-primary')}
                  aria-pressed={iniDipilih}
                  data-terpilih={iniDipilih ? 'ya' : undefined}
                  title={pilihan === kini?.tahun ? `${pilihan} (tahun ini)` : String(pilihan)}
                  onClick={() => setTahun(pilihan)}
                >
                  {pilihan}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>

      {/* Panel BAWAH: nama bulan Jan–Des untuk tahun yang dipilih di atas. */}
      <PopoverContent
        data-panel={PANEL_BAWAH}
        side="bottom"
        align="end"
        sideOffset={OFFSET_SISI}
        alignOffset={OFFSET_RATA}
        avoidCollisions={false}
        className={KELAS_PANEL}
        onInteractOutside={(e) => { if (diDalamPanel(e.target, PANEL_ATAS)) e.preventDefault(); }}
      >
        <div className="flex flex-col gap-1">
          {/* Tahun ditulis di sini juga: grid bulan di bawah INI yang memakainya,
              dan tahunnya bisa jauh dari tahun berjalan saat pengguna menelusuri. */}
          <div className="pb-1 text-center text-xs font-medium tabular-nums">Bulan {tahun}</div>

          <div role="group" aria-label={`Bulan ${tahun}`} className="grid grid-cols-6">
            {NAMA_BULAN_SINGKAT.map((nama, i) => {
              const iniDipilih = dipilih !== null && dipilih.tahun === tahun && i + 1 === dipilih.bulan;
              const iniBulanIni = kini !== null && kini.tahun === tahun && i + 1 === kini.bulan;
              return (
                <Button
                  key={nama}
                  type="button"
                  variant={iniDipilih ? 'default' : 'outline'}
                  size="sm"
                  className={cn(KELAS_TOMBOL, KELAS_BORDER_SAMAR, 'h-6 px-0', !iniDipilih && iniBulanIni && 'font-semibold text-primary')}
                  aria-label={`${NAMA_BULAN[i]} ${tahun}`}
                  aria-pressed={iniDipilih}
                  data-terpilih={iniDipilih ? 'ya' : undefined}
                  title={`${NAMA_BULAN[i]} ${tahun}`}
                  onClick={() => pilih(i + 1)}
                >
                  {nama}
                </Button>
              );
            })}
          </div>

          <div className="mt-1 flex items-stretch gap-1 border-t border-foreground/30 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={pilihBulanIni}
            >
              Bulan ini
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              aria-label="Kosongkan bulan"
              title="Kosongkan bulan"
              onClick={() => {
                setNilai('');
                setBuka(false);
              }}
            >
              <Reset className="size-4" />
              Kosongkan
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const PANEL_ATAS = 'bulan_atas';
const PANEL_BAWAH = 'bulan_bawah';
const KELAS_PANEL = kelasPanel('pop-bulan');

/** Blok tahun panel atas: 2 baris × 5 tahun = 10 tahun. Tahun aktif duduk di
 *  TENGAH baris PALING BAWAH — 2 tahun sebelumnya di kiri, 2 berikutnya di
 *  kanan — sedangkan baris di atasnya memuat 5 tahun sebelumnya. */
const TAHUN_PER_BARIS = 5;
const BARIS_TAHUN = 2;
const TAHUN_PER_BLOK = TAHUN_PER_BARIS * BARIS_TAHUN;
/** Baris (0 = paling atas) yang memuat tahun acuan. */
const BARIS_ACUAN = BARIS_TAHUN - 1;

/** Tahun pertama blok bila `tahun` jadi acuan. */
const awalBlokUntuk = (tahun: number): number =>
  tahun - BARIS_ACUAN * TAHUN_PER_BARIS - (TAHUN_PER_BARIS - 1) / 2;

/** Batas tahun yang boleh dipilih lewat pemilih ini. */
const TAHUN_MIN = 1900;
const TAHUN_MAX = 2100;
/** Batas `awalBlok` supaya seluruh blok 10 tahun tetap dalam [1900, 2100]:
 *  `awalBlok >= 1900` dan `awalBlok + TAHUN_PER_BLOK - 1 <= 2100`. */
const AWAL_BLOK_MIN = TAHUN_MIN;
const AWAL_BLOK_MAX = TAHUN_MAX - TAHUN_PER_BLOK + 1;
const batasAwalBlok = (awal: number): number =>
  Math.min(Math.max(awal, AWAL_BLOK_MIN), AWAL_BLOK_MAX);

/** Jepit tahun terpilih ke rentang yang boleh dipilih. */
const batasTahun = (tahun: number): number => Math.min(Math.max(tahun, TAHUN_MIN), TAHUN_MAX);

/** Tahun acuan panel: tahun nilai terpilih, atau tahun ini. */
function tahunDari(iso: string): number {
  return pecahBulan(iso)?.tahun ?? pecahBulan(bulanIni())?.tahun ?? new Date().getFullYear();
}
