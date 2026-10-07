import { useEffect, useMemo, useState } from 'react';
import { bisa } from '@/api/auth';
import { daftarTagihan, type TagihanRow } from '@/api/keuangan';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Batas halaman yang dikumpulkan (100 baris per halaman) saat menarik
 *  seluruh tagihan satu Santri — pagar agar tak ada perulangan tanpa ujung. */
const MAKS_HALAMAN = 10;
const PER_HALAMAN = 100;

/** Kelompok tagihan yang dibaca dari kolom status di tabel. */
type Kelompok = 'menunggak' | 'belum_aktif' | 'lunas';

/** Label kolom status untuk tiap kelompok. */
const LABEL_KELOMPOK: Record<Kelompok, string> = {
  menunggak: 'Menunggak',
  belum_aktif: 'Belum aktif',
  lunas: 'Lunas',
};

/** Urutan baris tabel: menunggak dulu, lalu lunas, lalu belum aktif. */
const URUTAN: Kelompok[] = ['menunggak', 'lunas', 'belum_aktif'];

/** Hari ini menurut waktu lokal (YYYY-MM-DD) — pembanding jatuh tempo. */
function hariIni(): string {
  return new Date().toLocaleDateString('sv-SE');
}

function rupiah(nilai: number): string {
  return 'Rp ' + nilai.toLocaleString('id');
}

/** Angka polos untuk sel tabel: dipisah ribuan, tanpa awalan "Rp". */
function angka(nilai: number): string {
  return nilai.toLocaleString('id');
}

/** Belum lunas DAN jatuh temponya sudah lewat. */
function lewatJatuhTempo(t: TagihanRow): boolean {
  return t.status !== 'lunas' && !!t.jatuh_tempo && t.jatuh_tempo.slice(0, 10) < hariIni();
}

/** Menunggak = belum lunas dan jatuh tempo sudah lewat; tagihan belum lunas
 *  yang tidak punya jatuh tempo ikut menunggak (tak ada alasan menundanya). */
function menunggak(t: TagihanRow): boolean {
  return t.status !== 'lunas' && (!t.jatuh_tempo || lewatJatuhTempo(t));
}

/** Kelompok satu baris tagihan — dipakai untuk kolom status & urutan baris. */
function klasifikasi(t: TagihanRow): Kelompok {
  if (t.status === 'lunas') return 'lunas';
  return menunggak(t) ? 'menunggak' : 'belum_aktif';
}

/** Bagian profil Santri: kartu ringkasan + satu tabel tagihan datar
 *  (jenis, periode, tagihan, dibayar, sisa, status). Baca-saja dan hanya
 *  dirender bila pengguna punya izin keuangan.lihat. */
export default function TagihanSantriPanel({ santri, jangkar }: {
  santri: { id: number; nama_lengkap: string };
  /** Id jangkar supaya chip lompat profil bisa menggulir ke bagian ini. */
  jangkar?: string;
}) {
  const { user } = useAuth();
  const bolehLihat = bisa(user, 'keuangan.lihat');

  const [baris, setBaris] = useState<TagihanRow[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [gagal, setGagal] = useState(false);
  /** Pemicu muat ulang setelah pengambilan gagal. */
  const [ulang, setUlang] = useState(0);

  useEffect(() => {
    if (!bolehLihat) return;
    let batal = false;
    setMemuat(true);
    setGagal(false);

    void (async () => {
      try {
        const kumpul: TagihanRow[] = [];
        for (let halaman = 1; halaman <= MAKS_HALAMAN; halaman += 1) {
          const res = await daftarTagihan({
            santri_id: santri.id,
            page: String(halaman),
            per_page: String(PER_HALAMAN),
          });
          kumpul.push(...res.data);
          if (halaman >= (res.last_page ?? 1)) break;
        }
        if (!batal) setBaris(kumpul);
      } catch {
        if (!batal) {
          setBaris([]);
          setGagal(true);
        }
      } finally {
        if (!batal) setMemuat(false);
      }
    })();

    return () => {
      batal = true;
    };
  }, [bolehLihat, santri.id, ulang]);

  /** Ringkasan dihitung dari seluruh baris yang terkumpul. */
  const ringkas = useMemo(() => {
    let total = 0;
    let terbayar = 0;
    let tunggakan = 0;
    for (const t of baris) {
      total += t.nominal;
      terbayar += t.terbayar;
      if (t.status !== 'lunas') tunggakan += Math.max(t.nominal - t.terbayar, 0);
    }
    return { total, terbayar, tunggakan, jumlah: baris.length };
  }, [baris]);

  /** Baris diurutkan per kelompok (sort stabil: urutan API dipertahankan). */
  const barisUrut = useMemo(
    () => [...baris].sort((a, b) => URUTAN.indexOf(klasifikasi(a)) - URUTAN.indexOf(klasifikasi(b))),
    [baris],
  );

  if (!bolehLihat) return null;

  const kartu = [
    { label: 'Jumlah tagihan', nilai: String(ringkas.jumlah), bahaya: false },
    { label: 'Total tagihan', nilai: rupiah(ringkas.total), bahaya: false },
    { label: 'Sudah dibayar', nilai: rupiah(ringkas.terbayar), bahaya: false },
    { label: 'Tunggakan', nilai: rupiah(ringkas.tunggakan), bahaya: ringkas.tunggakan > 0 },
  ];

  return (
    <section id={jangkar} data-part="tagihan_santri" className="space-y-2">
      <h3 className="text-xs font-medium">
        Tagihan <span className="font-normal text-muted-foreground">({ringkas.jumlah})</span>
      </h3>

      {memuat ? (
        <p className="text-xs text-muted-foreground">Memuat tagihan…</p>
      ) : gagal ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Gagal memuat tagihan santri ini.</p>
          <Button
            id="btn_tagihan_santri_ulang"
            size="sm"
            variant="outline"
            onClick={() => setUlang((n) => n + 1)}
          >
            Muat ulang
          </Button>
        </div>
      ) : baris.length === 0 ? (
        <p className="text-xs text-muted-foreground">Belum ada tagihan untuk santri ini.</p>
      ) : (
        <>
          <dl data-part="ringkasan_tagihan" className="grid gap-1.5 sm:grid-cols-4">
            {kartu.map((k) => (
              <div key={k.label} className="rounded border px-2 py-1.5">
                <dt className="text-[11px] text-muted-foreground">{k.label}</dt>
                <dd className={cn('font-medium tabular-nums', k.bahaya && 'text-destructive')}>{k.nilai}</dd>
              </div>
            ))}
          </dl>

          <div className="max-h-96 overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/40">
                <tr>
                  <th className="p-1.5 text-left">Jenis</th>
                  <th className="p-1.5 text-left">Periode</th>
                  <th className="p-1.5 text-right">Tagihan</th>
                  <th className="p-1.5 text-right">Dibayar</th>
                  <th className="p-1.5 text-right">Sisa</th>
                  <th className="p-1.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {barisUrut.map((t) => {
                  const kelompok = klasifikasi(t);
                  return (
                    <tr key={t.id} className="border-t" data-part="baris_tagihan" data-kelompok={kelompok}>
                      <td className="p-1.5">{t.jenis?.nama ?? '—'}</td>
                      <td className="p-1.5">{t.periode ?? '—'}</td>
                      <td className="p-1.5 text-right tabular-nums">{angka(t.nominal)}</td>
                      <td className="p-1.5 text-right tabular-nums">{angka(t.terbayar)}</td>
                      <td className="p-1.5 text-right tabular-nums">{angka(Math.max(t.nominal - t.terbayar, 0))}</td>
                      <td className={cn('p-1.5', kelompok === 'menunggak' ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                        {LABEL_KELOMPOK[kelompok]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
