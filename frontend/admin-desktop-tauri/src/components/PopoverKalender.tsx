import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarDays, ChevronLeft, ChevronRight, Reset } from '@/icons';
import {
  geserBulan, hariIniIso, hariPertamaBulan, jumlahHari,
  NAMA_BULAN, NAMA_BULAN_SINGKAT, NAMA_HARI, NAMA_HARI_SINGKAT,
  pecahIso, rakitIso,
} from '@/lib/tanggal';
import type { KonteksTipeInput } from '@/components/tipeInput';

/** Tombol kalender + popover pemilih tanggal (tahun | bulan | hari) untuk tipe
 *  `tanggal` — pasangan `aksiKanan` dari `FORMAT_TANGGAL`.
 *
 *  Kotak tanggal SENGAJA bukan `input type="date"`: tampilan & popover
 *  pemilihnya milik webview (ikut locale, tak bisa distyle/dites), jadi
 *  formatnya tak bisa disamakan dengan sisa aplikasi. Di sini kotaknya teks
 *  ber-mask `dd/mm/yyyy` (`FORMAT_TANGGAL`) dan pemilihnya milik kita —
 *  nilainya TETAP ISO `YYYY-MM-DD`, sama seperti input native.
 *
 *  Isi popover: grid hari dengan navigasi bulan, tampilan pilih bulan & tahun
 *  (klik judul bulan), plus "Hari ini" & "Kosongkan". Semua tanggal dihitung
 *  dari komponen UTC-nya supaya tak bergeser karena zona waktu. */
export default function PopoverKalender({ htmlFor, nilai, setNilai }: KonteksTipeInput) {
  const [buka, setBuka] = useState(false);
  /** Tampilan popover: grid hari, atau pemilih bulan+tahun. */
  const [lihat, setLihat] = useState<'hari' | 'bulan'>('hari');
  const [tampil, setTampil] = useState(() => bulanDari(nilai));

  /* Nilai berubah dari LUAR (mis. pemanggil mereset form) → ikuti bulannya. */
  useEffect(() => {
    if (pecahIso(nilai) !== null) setTampil(bulanDari(nilai));
  }, [nilai]);

  /** Selalu dibuka di grid hari, pada bulan nilai terpilih (atau bulan ini). */
  const ubahBuka = (baru: boolean) => {
    setBuka(baru);
    if (!baru) return;
    setLihat('hari');
    setTampil(bulanDari(nilai));
  };

  /** Pilih tanggal → tulis ISO ke pemanggil lalu tutup. */
  const pilih = (iso: string) => {
    setNilai(iso);
    setBuka(false);
  };

  const { tahun, bulan } = tampil;
  const hariIni = hariIniIso();
  const dipilih = pecahIso(nilai);
  const nilaiIso = dipilih === null ? '' : rakitIso(dipilih.tahun, dipilih.bulan, dipilih.hari) ?? '';

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

      {/* Geometri sama dengan panel nominal: tombolnya duduk 1px di dalam kotak
          (kotak ber-border), jadi `sideOffset: 0` menempelkan sisi panel tepat
          di garis border kotak dan `alignOffset: -1` meratakan tepi kanannya. */}
      <PopoverContent
        data-panel="kalender"
        side="bottom"
        align="end"
        sideOffset={0}
        alignOffset={-1}
        avoidCollisions={false}
        className="pop-kalender pointer-events-auto w-60 border-foreground/30 p-2"
      >
        {lihat === 'bulan' ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <TombolGeser arah="kiri" label="Tahun sebelumnya" onClick={() => setTampil({ tahun: tahun - 1, bulan })} />
              <span className="flex-1 text-center text-xs font-medium tabular-nums">{tahun}</span>
              <TombolGeser arah="kanan" label="Tahun berikutnya" onClick={() => setTampil({ tahun: tahun + 1, bulan })} />
            </div>
            <div role="group" aria-label={`Bulan tahun ${tahun}`} className="grid grid-cols-3 gap-1">
              {NAMA_BULAN.map((nama, i) => (
                <Button
                  key={nama}
                  type="button"
                  variant={i + 1 === bulan ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7"
                  aria-label={`${nama} ${tahun}`}
                  data-terpilih={i + 1 === bulan ? 'ya' : undefined}
                  onClick={() => { setTampil({ tahun, bulan: i + 1 }); setLihat('hari'); }}
                >
                  {NAMA_BULAN_SINGKAT[i]}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <TombolGeser arah="kiri" label="Bulan sebelumnya" onClick={() => setTampil(geserBulan(tahun, bulan, -1))} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1 font-medium"
                aria-label="Pilih bulan dan tahun"
                title="Pilih bulan dan tahun"
                onClick={() => setLihat('bulan')}
              >
                {NAMA_BULAN[bulan - 1]} {tahun}
              </Button>
              <TombolGeser arah="kanan" label="Bulan berikutnya" onClick={() => setTampil(geserBulan(tahun, bulan, 1))} />
            </div>

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
                    className={cn('h-7 w-full tabular-nums', !iniDipilih && iso === hariIni && 'font-semibold text-primary')}
                    aria-label={`${hari} ${NAMA_BULAN[bulan - 1]} ${tahun}`}
                    aria-current={iso === hariIni ? 'date' : undefined}
                    data-terpilih={iniDipilih ? 'ya' : undefined}
                    title={`${namaHari}, ${hari} ${NAMA_BULAN[bulan - 1]} ${tahun}`}
                    onClick={() => pilih(iso)}
                  >
                    {hari}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

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
      </PopoverContent>
    </Popover>
  );
}

/** Tombol navigasi ‹ › di header panel (satu langkah bulan atau tahun). */
function TombolGeser({ arah, label, onClick }: { arah: 'kiri' | 'kanan'; label: string; onClick: () => void }) {
  const Ikon = arah === 'kiri' ? ChevronLeft : ChevronRight;
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={onClick}>
      <Ikon className="size-4" />
    </Button>
  );
}

/** Bulan yang ditampilkan grid: bulan nilai terpilih, atau bulan hari ini. */
function bulanDari(iso: string): { tahun: number; bulan: number } {
  const p = pecahIso(iso) ?? pecahIso(hariIniIso());
  return p === null ? { tahun: 2000, bulan: 1 } : { tahun: p.tahun, bulan: p.bulan };
}
