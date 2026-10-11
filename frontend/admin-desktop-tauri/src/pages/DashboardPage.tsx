import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  ringkasan,
  type Ringkasan,
  type StatistikTingkat,
} from '../api/master';
import { errorMessage } from '../api/client';
import { useLembagaAktif } from '../lembagaAktif';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorNotice } from '@/components/PageHeader';
import { TAHAP_PSB } from '@/components/psb/bersama';

/* ---------- Format angka (id-ID) ---------- */

function angka(nilai: number): string {
  return nilai.toLocaleString('id-ID');
}

function rupiah(nilai: number): string {
  return 'Rp ' + nilai.toLocaleString('id-ID');
}

function persen(bagian: number, total: number): string {
  if (total <= 0) {
    return '0%';
  }
  return new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 1 })
    .format(bagian / total);
}

function rentang(mulai: string | null, selesai: string | null): string {
  if (mulai === null && selesai === null) {
    return 'rentang tanggal belum diisi';
  }
  return (mulai ?? '—') + ' – ' + (selesai ?? '—');
}

/* Isian netral untuk baris proporsi — aksen sengaja dipakai di SATU tempat
   saja (garis pokok di bawah angka utama), sisanya tinta & garis rambut. */
const ISIAN = 'color-mix(in srgb, var(--foreground) 38%, transparent)';
const ISIAN_LEMBUT = 'color-mix(in srgb, var(--foreground) 20%, transparent)';
const GARIS = 'color-mix(in srgb, var(--foreground) 14%, transparent)';

/* ---------- Komponen buku induk ---------- */

/** Lencana hitung ala badge Gr8r (abu netral). */
function LencanaHitung({ anak }: { anak: ReactNode }) {
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center rounded-sm px-[7px] text-[11px] font-medium tabular-nums"
      style={{ background: 'var(--surface-3)', color: 'var(--muted-foreground)' }}
    >
      {anak}
    </span>
  );
}

/** Seksi = kartu Gr8r (permukaan + bayangan kartu + radius 10). */
function Seksi({
  judul,
  keterangan,
  children,
}: {
  judul: string;
  keterangan?: string;
  children: ReactNode;
}) {
  return (
    <Card className="mb-6 min-w-0 break-inside-avoid p-4">
      <div
        className="flex items-center justify-between gap-3 pb-2.5"
        style={{ borderBottom: '1px solid var(--divider)' }}
      >
        <h2 className="text-xs font-semibold">{judul}</h2>
        {keterangan ? <LencanaHitung anak={keterangan} /> : null}
      </div>
      <div className="pt-3">{children}</div>
    </Card>
  );
}

/** Baris ledger: label, angka rata kanan, garis isian proporsional. */
function BarisLedger({
  label,
  nilai,
  maks,
  warna,
  satuanPanjang,
}: {
  label: string;
  nilai: number;
  maks: number;
  warna?: string;
  /** Nilai sudah berupa teks (mis. "dari 107"), tidak dihitung sebagai angka. */
  satuanPanjang?: boolean;
}) {
  const lebar = maks > 0 ? Math.min(100, Math.max(0, (nilai / maks) * 100)) : 0;
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">{label}</span>
        <span className="shrink-0 text-xs font-semibold tabular-nums">
          {satuanPanjang ? String(nilai) : angka(nilai)}
        </span>
      </div>
      <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
        <div className="h-full rounded-full" style={{ width: lebar + '%', background: warna ?? ISIAN }} />
      </div>
    </div>
  );
}

/** Baris akun: label + nilai, dipisah garis tipis (tanpa bar proporsi). */
function BarisAkun({
  label,
  nilai,
  ket,
  bahaya,
}: {
  label: string;
  nilai: string;
  ket?: string;
  bahaya?: boolean;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 py-2"
      style={{ borderBottom: '1px solid ' + GARIS }}
    >
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('shrink-0 text-xs font-semibold tabular-nums', bahaya && 'text-destructive')}>
        {nilai}
        {ket ? <span className="ml-2 font-normal text-muted-foreground">{ket}</span> : null}
      </span>
    </div>
  );
}

/** Komposisi satu batang tersegmen + legenda (mis. putra/putri). */
function Komposisi({
  bagian,
}: {
  bagian: { label: string; nilai: number; warna?: string }[];
}) {
  const total = bagian.reduce((jumlah, b) => jumlah + b.nilai, 0);
  return (
    <div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
        {bagian.map((b) => (
          <div
            key={b.label}
            style={{
              width: total > 0 ? String((b.nilai / total) * 100) + '%' : '0%',
              background: b.warna ?? ISIAN,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {bagian.map((b) => (
          <span key={b.label} className="inline-flex items-baseline gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block size-2 translate-y-px" style={{ background: b.warna ?? ISIAN }} />
            {b.label}
            <span className="font-semibold tabular-nums text-foreground">{angka(b.nilai)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Sebaran tingkat sebagai tabel rekap ringkas, bukan bagan batang. */
function TabelTingkat({ data }: { data: StatistikTingkat[] }) {
  if (data.length === 0) {
    return <EmptyState className="py-4" title="Belum ada sebaran tingkat" />;
  }
  const tingkat = Array.from(new Set(data.map((d) => d.tingkat ?? '—'))).sort((a, b) =>
    a.localeCompare(b, 'id', { numeric: true }),
  );
  const jenjang = Array.from(new Set(data.map((d) => d.jenjang)));
  const peta = new Map(data.map((d) => [d.jenjang + '|' + (d.tingkat ?? '—'), d.jumlah]));
  return (
    <div
      className="grid gap-x-3 gap-y-1 text-[11px]"
      style={{ gridTemplateColumns: 'minmax(2.25rem,auto) repeat(' + tingkat.length + ', minmax(0,1fr))' }}
    >
      <span />
      {tingkat.map((t) => (
        <span key={t} className="text-right text-muted-foreground tabular-nums">{t}</span>
      ))}
      {jenjang.map((j) => (
        <Fragment key={j}>
          <span className="text-muted-foreground">{j}</span>
          {tingkat.map((t) => (
            <span key={t} className="text-right font-medium tabular-nums">
              {angka(peta.get(j + '|' + t) ?? 0)}
            </span>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

/** Alumni per tahun ajaran sebagai deret garis tipis. */
function DeretAlumni({ data }: { data: { tahun_ajaran: string; jumlah: number }[] }) {
  const maks = Math.max(1, ...data.map((d) => d.jumlah));
  return (
    <div>
      <div className="flex h-10 items-end gap-1.5">
        {data.map((d) => (
          <div key={d.tahun_ajaran} className="flex h-full min-w-0 flex-1 items-end" title={d.tahun_ajaran + ': ' + angka(d.jumlah)}>
            <div
              className="w-full rounded-sm"
              style={{ height: String(Math.max(6, Math.round((d.jumlah / maks) * 100))) + '%', background: ISIAN }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[9px] text-muted-foreground">
        {data.map((d) => (
          <span key={d.tahun_ajaran} className="min-w-0 flex-1 truncate text-center tabular-nums">
            {d.tahun_ajaran.slice(2)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { jenjang } = useLembagaAktif();
  const [data, setData] = useState<Ringkasan | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr('');
    ringkasan(jenjang ?? undefined)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setErr(errorMessage(e)); });
    return () => { alive = false; };
  }, [jenjang]);

  if (err) {
    return (
      <div className="p-5">
        <ErrorNotice>{err}</ErrorNotice>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[1160px] px-6 py-7">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-16 w-52" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const { santri, pegawai, keuangan, siklus, psb } = data;
  const tahunAktif = data.tahun_aktif[0]?.nama ?? '';
  const labelTa = tahunAktif || 'TA aktif';

  const hero = santri
    ? {
        label: tahunAktif ? 'Santri aktif, ' + tahunAktif : 'Santri aktif',
        nilai: angka(santri.total),
        keterangan:
          angka(santri.baru_ta_aktif) + ' baru tahun ini, ' +
          angka(santri.laki_laki) + ' putra, ' +
          angka(santri.perempuan) + ' putri',
      }
    : {
        label: 'Lembaga terdaftar',
        nilai: angka(data.lembaga),
        keterangan: tahunAktif ? 'tahun ajaran aktif ' + tahunAktif : 'tahun ajaran belum diatur',
      };

  const konteks: { label: string; nilai: string }[] = [
    { label: 'Lembaga', nilai: angka(data.lembaga) },
    { label: 'Pengguna', nilai: angka(data.pengguna) },
    ...(pegawai ? [{ label: 'PTK aktif', nilai: angka(pegawai.aktif) }] : []),
    { label: 'Kelas TA aktif', nilai: angka(data.kelas_aktif) },
  ];

  const maksLembaga = santri ? Math.max(1, ...santri.per_lembaga.map((d) => d.jumlah)) : 1;
  const maksPegawai = pegawai ? Math.max(1, ...pegawai.per_lembaga.map((d) => d.jumlah)) : 1;
  const perTahapPsb = TAHAP_PSB.map((tahap) => ({
    id: tahap.id,
    label: tahap.label,
    jumlah: tahap.statuses.reduce((jumlah, status) => jumlah + (psb?.per_status[status] ?? 0), 0),
  }));
  const maksPsb = Math.max(1, ...perTahapPsb.map((d) => d.jumlah));

  return (
    <div className="mx-auto w-full max-w-[1160px] px-6 py-7">
      {/* Angka pokok: satu-satunya tempat aksen dipakai. */}
      <Card className="rounded-lg p-6">
        <p className="text-[11px] text-muted-foreground">{hero.label}</p>
        <p
          id="dashboard_angka_pokok"
          className="mt-1 font-display text-6xl font-semibold leading-[0.9] tracking-[-0.03em] tabular-nums sm:text-7xl"
        >
          {hero.nilai}
        </p>
        <div className="mt-3 h-px w-16" style={{ background: 'var(--accent)' }} />
        <p className="mt-3 text-[11px] text-muted-foreground">{hero.keterangan}</p>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {konteks.map((k) => (
            <div
              key={k.label}
              className="min-w-0 rounded-lg border p-3"
              style={{ borderColor: 'var(--divider)', background: 'var(--background)' }}
            >
              <dt className="text-[11px] text-muted-foreground">{k.label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{k.nilai}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Kartu-kartu ringkasan ala Gr8r dalam dua kolom. */}
      <div className="gap-6 pt-8 lg:columns-2">
        {santri ? (
          <Seksi judul="Santri" keterangan={angka(santri.total) + ' aktif'}>
            <Komposisi
              bagian={[
                { label: 'Putra', nilai: santri.laki_laki },
                { label: 'Putri', nilai: santri.perempuan, warna: ISIAN_LEMBUT },
              ]}
            />
            <div className="mt-3 grid grid-cols-2 gap-x-8 pt-1" style={{ borderTop: '1px solid ' + GARIS }}>
              <BarisLedger label="Asrama" nilai={santri.asrama} maks={santri.total} />
              <BarisLedger label="Non-asrama" nilai={santri.non_asrama} maks={santri.total} />
            </div>
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid ' + GARIS }}>
              <p className="mb-1 text-[11px] text-muted-foreground">Per lembaga</p>
              {santri.per_lembaga.map((l) => (
                <BarisLedger
                  key={l.jenjang}
                  label={l.nama + ' (' + l.jenjang + ')'}
                  nilai={l.jumlah}
                  maks={maksLembaga}
                />
              ))}
            </div>
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid ' + GARIS }}>
              <p className="mb-2 text-[11px] text-muted-foreground">Per tingkat, {labelTa}</p>
              <TabelTingkat data={santri.per_tingkat} />
            </div>
          </Seksi>
        ) : null}

        {keuangan ? (
          <Seksi judul="Keuangan" keterangan={angka(keuangan.jumlah_tagihan) + ' tagihan'}>
            <BarisAkun label="Tertagih" nilai={rupiah(keuangan.nominal)} />
            <BarisAkun
              label="Sudah dibayar"
              nilai={rupiah(keuangan.terbayar)}
              ket={persen(keuangan.terbayar, keuangan.nominal)}
            />
            <BarisAkun label="Tunggakan" nilai={rupiah(keuangan.tunggakan)} bahaya />
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid ' + GARIS }}>
              <Komposisi
                bagian={[
                  { label: 'Lunas', nilai: keuangan.lunas, warna: 'color-mix(in srgb, var(--success) 70%, transparent)' },
                  { label: 'Belum', nilai: keuangan.belum, warna: 'color-mix(in srgb, var(--destructive) 65%, transparent)' },
                  { label: 'Sebagian', nilai: keuangan.sebagian, warna: 'color-mix(in srgb, var(--warning) 75%, transparent)' },
                ]}
              />
            </div>
          </Seksi>
        ) : null}

        {pegawai ? (
          <Seksi judul="PTK" keterangan={angka(pegawai.aktif) + ' aktif dari ' + angka(pegawai.total)}>
            <BarisLedger label="Aktif" nilai={pegawai.aktif} maks={Math.max(1, pegawai.total)} />
            <BarisLedger
              label="Tidak aktif"
              nilai={Math.max(0, pegawai.total - pegawai.aktif)}
              maks={Math.max(1, pegawai.total)}
            />
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid ' + GARIS }}>
              <p className="mb-1 text-[11px] text-muted-foreground">Per lembaga, {labelTa}</p>
              {pegawai.per_lembaga.map((l) => (
                <BarisLedger
                  key={l.jenjang}
                  label={l.nama + ' (' + l.jenjang + ')'}
                  nilai={l.jumlah}
                  maks={maksPegawai}
                />
              ))}
            </div>
          </Seksi>
        ) : null}

        {siklus ? (
          <Seksi judul="Siklus santri" keterangan={'alumni ' + angka(siklus.alumni)}>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <dt className="text-[11px] text-muted-foreground">Alumni</dt>
                <dd className="text-sm font-semibold tabular-nums">{angka(siklus.alumni)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Mutasi keluar</dt>
                <dd className="text-sm font-semibold tabular-nums">{angka(siklus.mutasi)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Alumni {labelTa}</dt>
                <dd className="text-sm font-semibold tabular-nums">{angka(siklus.alumni_ta_aktif)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Mutasi {labelTa}</dt>
                <dd className="text-sm font-semibold tabular-nums">{angka(siklus.mutasi_ta_aktif)}</dd>
              </div>
            </dl>
            {siklus.alumni_per_ta.length > 0 ? (
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid ' + GARIS }}>
                <p className="mb-2 text-[11px] text-muted-foreground">Alumni per tahun ajaran</p>
                <DeretAlumni data={siklus.alumni_per_ta} />
              </div>
            ) : null}
          </Seksi>
        ) : null}

        {psb ? (
          <Seksi judul="Antrean PSB" keterangan={angka(psb.total) + ' calon'}>
            {psb.total === 0 ? (
              <EmptyState className="py-4" title="Belum ada calon pada lingkup ini" />
            ) : (
              perTahapPsb.map((t) => (
                <BarisLedger key={t.id} label={t.label} nilai={t.jumlah} maks={maksPsb} />
              ))
            )}
          </Seksi>
        ) : null}
      </div>

      {data.tahun_aktif.length > 0 ? (
        <footer
          className="mt-10 pt-3 text-[11px] text-muted-foreground"
          style={{ borderTop: '1px solid ' + GARIS }}
        >
          Tahun ajaran aktif{' '}
          {data.tahun_aktif.map((t, i) => (
            <Fragment key={t.nama}>
              {i > 0 ? ', ' : ''}
              <span className="font-medium text-foreground">{t.nama}</span>
              {t.tanggal_mulai || t.tanggal_selesai ? (
                <span> ({rentang(t.tanggal_mulai, t.tanggal_selesai)})</span>
              ) : null}
            </Fragment>
          ))}
        </footer>
      ) : null}
    </div>
  );
}
