import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarDays, Reset } from '@/icons';
import {
  hariIniIso, hariPertamaBulan, jumlahHari,
  NAMA_BULAN, NAMA_BULAN_SINGKAT, NAMA_HARI, NAMA_HARI_SINGKAT,
  pecahIso, rakitIso,
} from '@/lib/tanggal';
import { diDalamPanel, kelasPanel, KELAS_BORDER_SAMAR, KELAS_TOMBOL, OFFSET_RATA, OFFSET_SISI } from '@/components/panelMenempel';
import type { KonteksTipeInput } from '@/components/tipeInput';

/** Tombol kalender + DUA panel pemilih tanggal untuk tipe `tanggal` — pasangan
 *  `aksiKanan` dari `FORMAT_TANGGAL`, dengan tata letak seperti panel nominal
 *  (lihat `panelMenempel.ts`): panel ATAS untuk TAHUN & BULAN, panel BAWAH
 *  untuk TANGGAL.
 *
 *  Kotak tanggal SENGAJA bukan `input type="date"`: tampilan & popover
 *  pemilihnya milik webview (ikut locale, tak bisa distyle/dites), jadi
 *  formatnya tak bisa disamakan dengan sisa aplikasi. Di sini kotaknya teks
 *  ber-mask `dd/mm/yyyy` (`FORMAT_TANGGAL`) dan pemilihnya milik kita —
 *  nilainya TETAP ISO `YYYY-MM-DD`, sama seperti input native.
 *
 *  Semua tanggal dihitung dari komponen UTC-nya supaya tak bergeser karena zona
 *  waktu. */
export default function PopoverKalender({ htmlFor, nilai, setNilai }: KonteksTipeInput) {
  const [buka, setBuka] = useState(false);
  /** Bulan & tahun yang ditampilkan grid TANGGAL (panel bawah). */
  const [tampil, setTampil] = useState(() => bulanDari(nilai));
  /** Tahun pertama blok tahun di panel atas. */
  const [awalBlok, setAwalBlok] = useState(() => awalBlokUntuk(bulanDari(nilai).tahun));

  /* Nilai berubah (dari luar, atau hasil pilih di panel) → ikuti bulannya;
     blok tahun ikut bergeser HANYA bila tahunnya di luar blok, supaya daftar
     tahun tak melompat saat pengguna sedang menelusuri. */
  useEffect(() => {
    const p = pecahIso(nilai);
    if (p === null) return;
    setTampil({ tahun: p.tahun, bulan: p.bulan });
    setAwalBlok((awal) => (p.tahun < awal || p.tahun > awal + TAHUN_PER_BLOK - 1 ? awalBlokUntuk(p.tahun) : awal));
  }, [nilai]);

  /** Selalu dibuka pada bulan nilai terpilih (atau bulan ini), dengan tahun
   *  aktif di tengah baris paling bawah blok tahun. */
  const ubahBuka = (baru: boolean) => {
    setBuka(baru);
    if (!baru) return;
    const acuan = bulanDari(nilai);
    setTampil(acuan);
    setAwalBlok(awalBlokUntuk(acuan.tahun));
  };

  /** Pilih tanggal → tulis ISO ke pemanggil lalu tutup. */
  const pilih = (iso: string) => {
    setNilai(iso);
    setBuka(false);
  };

  const { tahun, bulan } = tampil;
  const hariIni = hariIniIso();
  const kini = pecahIso(hariIni);
  const dipilih = pecahIso(nilai);
  const nilaiIso = dipilih === null ? '' : rakitIso(dipilih.tahun, dipilih.bulan, dipilih.hari) ?? '';
  const akhirBlok = awalBlok + TAHUN_PER_BLOK - 1;
  /** Tahun acuan blok: tahun nilai terpilih, atau tahun ini. */
  const tahunAcuan = (dipilih ?? kini)?.tahun ?? tahun;

  /* DAFTAR TAHUN digeser dengan gulir mouse: satu gulungan = satu baris
     (`TAHUN_PER_BARIS` tahun), bukan satu blok 20 tahun seperti tombol ‹ ›
     yang dulu ada.

     Listener dipasang langsung pada elemen (bukan `onWheel` React) dengan
     `{ passive: false }` karena React memasang wheel secara PASIF — di dalam
     listener pasif `preventDefault` diabaikan browser, sementara di sini
     gulir halaman memang harus berhenti selama daftar tahun bergerak.

     Elemennya ditahan di STATE (bukan `useRef`) dan efek bergantung padanya:
     grid tahun baru muncul saat panel terbuka, dan itu terjadi lewat presence
     Radix yang bisa jadi SATU COMMIT di belakang state `buka` — dengan
     bergantung `buka`, listener sempat dipasang saat elemennya belum ada. */
  const [elTahun, setElTahun] = useState<HTMLDivElement | null>(null);
  const pasangRefTahun = useCallback((node: HTMLDivElement | null) => setElTahun(node), []);
  useEffect(() => {
    if (elTahun === null) return;
    const onGulir = (ev: WheelEvent) => {
      if (ev.deltaY === 0) return;
      ev.preventDefault();
      setAwalBlok((awal) => awal + Math.sign(ev.deltaY) * TAHUN_PER_BARIS);
    };
    elTahun.addEventListener('wheel', onGulir, { passive: false });
    return () => elTahun.removeEventListener('wheel', onGulir);
  }, [elTahun]);

  /* Paging tahun tanpa mouse (tombol ‹ › sudah dihapus): satu baris per
     PageUp/PageDown, Home = kembali ke tahun acuan. */
  const onKeyDownTahun = (e: KeyboardEvent<HTMLDivElement>) => {
    const geser = e.key === 'PageUp' ? -TAHUN_PER_BARIS : e.key === 'PageDown' ? TAHUN_PER_BARIS : 0;
    if (geser !== 0) {
      e.preventDefault();
      setAwalBlok((awal) => awal + geser);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setAwalBlok(awalBlokUntuk(tahunAcuan));
    }
  };

  return (
    <Popover open={buka} onOpenChange={ubahBuka}>
      <PopoverTrigger asChild>
        <Button
          id={htmlFor === undefined ? undefined : `btn_kalender_${htmlFor}`}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Pilih tanggal"
          title="Pilih tanggal"
          className="h-full rounded-none text-muted-foreground"
        >
          <CalendarDays className="size-4" />
        </Button>
      </PopoverTrigger>

      {/* Panel ATAS: tahun (2 baris × 5) + bulan (2 baris × 6). Tiap panel
          mencegah penutupan bila sasarannya panel sebelah — tanpa itu menekan
          tombol di satu panel menutup panel lainnya. */}
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
          {/* Rentang tahun yang tampil sekarang. Daftar tahunnya digeser dengan
              gulir mouse satu baris sekali (bukan seblok 20 tahun), jadi tak
              ada lagi tombol ‹ › di sini. */}
          <div className="pb-1 text-center text-xs font-medium tabular-nums">{awalBlok}–{akhirBlok}</div>

          <div
            ref={pasangRefTahun}
            role="group"
            aria-label={`Tahun ${awalBlok}–${akhirBlok}`}
            tabIndex={0}
            title="Gulir untuk memindahkan daftar tahun (PageUp/PageDown; Home = kembali ke tahun aktif)"
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
                  onClick={() => setTampil({ tahun: pilihan, bulan })}
                >
                  {pilihan}
                </Button>
              );
            })}
          </div>

          {/* Pembatas antara blok TAHUN & blok BULAN: tanpa ini kedua grid
              berimpit jadi satu blok (border-nya saling menindih) sehingga
              batas antara tahun dan bulan kabur. */}
          <hr className="my-1 shrink-0 border-t border-foreground/30" />

          <div role="group" aria-label={`Bulan ${tahun}`} className="grid grid-cols-6">
            {NAMA_BULAN_SINGKAT.map((nama, i) => {
              const iniDipilih = i + 1 === bulan;
              const iniBulanIni = tahun === kini?.tahun && i + 1 === kini?.bulan;
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
                  onClick={() => setTampil({ tahun, bulan: i + 1 })}
                >
                  {nama}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>

      {/* Panel BAWAH: grid tanggal bulan yang sedang tampil. */}
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
          <div role="group" aria-label={`Tanggal ${NAMA_BULAN[bulan - 1]} ${tahun}`} className="grid grid-cols-7 gap-1">
            {NAMA_HARI_SINGKAT.map((nama) => (
              <span key={nama} className="flex h-5 items-center justify-center text-[10px] text-muted-foreground">
                {nama}
              </span>
            ))}
            {/* Sel kosong sebelum tanggal 1 supaya kolomnya sejajar nama hari. */}
            {Array.from({ length: hariPertamaBulan(tahun, bulan) }, (_, i) => (
              <span key={`kosong_${i}`} aria-hidden="true" />
            ))}
            {Array.from({ length: jumlahHari(tahun, bulan) }, (_, i) => i + 1).map((hari) => {
              const iso = rakitIso(tahun, bulan, hari) ?? '';
              const iniDipilih = iso === nilaiIso;
              const namaHari = NAMA_HARI[new Date(Date.UTC(tahun, bulan - 1, hari)).getUTCDay()];
              return (
                <Button
                  key={iso}
                  type="button"
                  variant={iniDipilih ? 'default' : 'ghost'}
                  size="icon-sm"
                  className={cn('h-6 w-full tabular-nums', !iniDipilih && iso === hariIni && 'font-semibold text-primary')}
                  aria-label={`${hari} ${NAMA_BULAN[bulan - 1]} ${tahun}`}
                  aria-current={iso === hariIni ? 'date' : undefined}
                  aria-pressed={iniDipilih}
                  data-terpilih={iniDipilih ? 'ya' : undefined}
                  title={`${namaHari}, ${hari} ${NAMA_BULAN[bulan - 1]} ${tahun}`}
                  onClick={() => pilih(iso)}
                >
                  {hari}
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
              onClick={() => pilih(hariIni)}
            >
              Hari ini
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              aria-label="Kosongkan tanggal"
              title="Kosongkan tanggal"
              onClick={() => pilih('')}
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

const PANEL_ATAS = 'kalender_atas';
const PANEL_BAWAH = 'kalender_bawah';
const KELAS_PANEL = kelasPanel('pop-kalender');

/** Blok tahun panel atas: 4 baris × 5 tahun = 20 tahun. Tahun acuan (tahun
 *  aktif) duduk di TENGAH baris PALING BAWAH — 2 tahun sebelumnya di kiri, 2
 *  berikutnya di kanan — sedangkan tiga baris di atasnya memuat 15 tahun
 *  sebelumnya. */
const TAHUN_PER_BARIS = 5;
const BARIS_TAHUN = 4;
const TAHUN_PER_BLOK = TAHUN_PER_BARIS * BARIS_TAHUN;
/** Baris (0 = paling atas) yang memuat tahun acuan. */
const BARIS_ACUAN = BARIS_TAHUN - 1;

/** Tahun pertama blok bila `tahun` jadi acuan. */
const awalBlokUntuk = (tahun: number): number =>
  tahun - BARIS_ACUAN * TAHUN_PER_BARIS - (TAHUN_PER_BARIS - 1) / 2;

/** Bulan yang ditampilkan grid: bulan nilai terpilih, atau bulan hari ini. */
function bulanDari(iso: string): { tahun: number; bulan: number } {
  const p = pecahIso(iso) ?? pecahIso(hariIniIso());
  return p === null ? { tahun: 2000, bulan: 1 } : { tahun: p.tahun, bulan: p.bulan };
}
