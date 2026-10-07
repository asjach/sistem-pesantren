import { useEffect, useState, type ReactNode } from 'react';
import {
  ringkasan,
  type Ringkasan,
  type StatistikLembaga,
  type StatistikTingkat,
} from '../api/master';
import { errorMessage } from '../api/client';
import { useLembagaAktif } from '../lembagaAktif';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorNotice } from '@/components/PageHeader';
import { TAHAP_PSB } from '@/components/psb/bersama';
import {
  BookOpen,
  CalendarCheck,
  GraduationCap,
  Landmark,
  UserCheck,
  Users,
  Wallet,
  type Ikon,
} from '@/icons';

/* ---------- Format angka (id-ID) ---------- */

function angka(nilai: number): string {
  return nilai.toLocaleString('id-ID');
}

/** Rupiah ringkas untuk kartu KPI (mis. "Rp 204 jt"). */
function rupiahRingkas(nilai: number): string {
  const ringkas = new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(nilai);
  return 'Rp ' + ringkas;
}

/** Rupiah penuh untuk rincian. */
function rupiah(nilai: number): string {
  return 'Rp ' + nilai.toLocaleString('id-ID');
}

/** Persentase bagian terhadap total (mis. "0,1%"). */
function persen(bagian: number, total: number): string {
  if (total <= 0) {
    return '0%';
  }
  return new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 1 })
    .format(bagian / total);
}

/** Rentang tanggal ringkas untuk kartu tahun ajaran aktif. */
function rentang(mulai: string | null, selesai: string | null): string {
  if (mulai === null && selesai === null) {
    return 'Rentang tanggal belum diisi';
  }
  return (mulai ?? '—') + ' s/d ' + (selesai ?? '—');
}

/* ---------- Komponen visual kecil ---------- */

/** Kartu seksi seragam: judul + keterangan + isi. */
function Kartu({
  judul,
  keterangan,
  className,
  children,
}: {
  judul: string;
  keterangan?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('flex flex-col rounded-xl border bg-card', className)}>
      <header className="flex items-baseline justify-between gap-2 border-b px-3.5 py-2.5">
        <h2 className="text-xs font-semibold tracking-tight">{judul}</h2>
        {keterangan ? <span className="text-[11px] text-muted-foreground">{keterangan}</span> : null}
      </header>
      <div className="flex-1 p-3.5">{children}</div>
    </section>
  );
}

interface ItemKpi {
  key: string;
  label: string;
  nilai: string;
  sub: string;
  icon: Ikon;
  warna: string;
}

function KartuKpi({ item }: { item: ItemKpi }) {
  const Icon = item.icon;
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-3.5">
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: item.warna }} />
      <div className="flex items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg"
          style={{
            background: 'color-mix(in srgb, ' + item.warna + ' 14%, var(--background))',
            color: item.warna,
          }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[11px] text-muted-foreground">{item.label}</div>
          <div className="truncate text-lg font-bold leading-tight tabular-nums">{item.nilai}</div>
          <div className="truncate text-[10px] text-muted-foreground">{item.sub}</div>
        </div>
      </div>
    </div>
  );
}

/** Satu baris bilah horizontal: label, angka, lalu bilah proporsional. */
function BarisBilah({
  label,
  nilai,
  maks,
  warna,
}: {
  label: string;
  nilai: number;
  maks: number;
  warna: string;
}) {
  const lebar = maks > 0 ? Math.max(2, Math.round((nilai / maks) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums">{angka(nilai)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: String(lebar) + '%', background: warna }}
        />
      </div>
    </div>
  );
}

/** Daftar hitungan per lembaga dengan skala bersama. */
function DaftarLembaga({ data, warna }: { data: StatistikLembaga[]; warna: string }) {
  const maks = Math.max(1, ...data.map((d) => d.jumlah));
  if (data.length === 0) {
    return <p className="text-[11px] text-muted-foreground">Tidak ada lembaga pada lingkup ini.</p>;
  }
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <BarisBilah
          key={d.jenjang}
          label={d.nama + ' · ' + d.jenjang}
          nilai={d.jumlah}
          maks={maks}
          warna={warna}
        />
      ))}
    </div>
  );
}

/** Bilah komposisi bertumpuk (mis. L/P) + legenda. */
function BilahKomposisi({
  bagian,
}: {
  bagian: { label: string; nilai: number; warna: string }[];
}) {
  const total = bagian.reduce((jumlah, b) => jumlah + b.nilai, 0);
  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
        {bagian.map((b) => (
          <div
            key={b.label}
            style={{
              width: total > 0 ? String((b.nilai / total) * 100) + '%' : '0%',
              background: b.warna,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {bagian.map((b) => (
          <span key={b.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-[2px]" style={{ background: b.warna }} />
            {b.label}
            <span className="font-semibold tabular-nums text-foreground">{angka(b.nilai)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Diagram batang tegak sebaran tingkat per jenjang (TA aktif). */
function GrafikTingkat({ data }: { data: StatistikTingkat[] }) {
  if (data.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Belum ada sebaran tingkat pada tahun ajaran aktif.
      </p>
    );
  }
  const jenjang = Array.from(new Set(data.map((d) => d.jenjang)));
  const maks = Math.max(1, ...data.map((d) => d.jumlah));
  const warna: Record<string, string> = { MI: 'var(--accent)', MD: 'var(--info)' };
  return (
    <div className="space-y-4">
      {jenjang.map((j) => (
        <div key={j} className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground">{j}</div>
          <div className="flex items-end gap-1.5">
            {data.filter((d) => d.jenjang === j).map((d) => (
              <div
                key={j + '-' + (d.tingkat ?? '')}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                title={j + ' tingkat ' + (d.tingkat ?? '-') + ': ' + angka(d.jumlah)}
              >
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {angka(d.jumlah)}
                </span>
                <div className="flex h-16 w-full items-end overflow-hidden rounded-sm bg-secondary/60">
                  <div
                    className="w-full rounded-t-[3px]"
                    style={{
                      height: String(Math.max(4, Math.round((d.jumlah / maks) * 100))) + '%',
                      background: warna[j] ?? 'var(--accent)',
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{d.tingkat ?? '-'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Diagram batang tegak tren alumni per tahun ajaran. */
function GrafikTren({ data }: { data: { tahun_ajaran: string; jumlah: number }[] }) {
  const maks = Math.max(1, ...data.map((d) => d.jumlah));
  return (
    <div className="flex items-end gap-1">
      {data.map((d) => (
        <div
          key={d.tahun_ajaran}
          className="flex min-w-0 flex-1 flex-col items-center gap-1"
          title={d.tahun_ajaran + ': ' + angka(d.jumlah)}
        >
          <div className="flex h-12 w-full items-end overflow-hidden rounded-sm bg-secondary/60">
            <div
              className="w-full rounded-t-[3px]"
              style={{
                height: String(Math.max(6, Math.round((d.jumlah / maks) * 100))) + '%',
                background: 'var(--accent)',
              }}
            />
          </div>
          <span className="w-full truncate text-center text-[9px] text-muted-foreground">
            {d.tahun_ajaran.slice(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Antrean PSB per tahap (menggabungkan status sesuai TAHAP_PSB). */
function DaftarTahap({ data }: { data: { id: string; label: string; jumlah: number }[] }) {
  const maks = Math.max(1, ...data.map((d) => d.jumlah));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <BarisBilah key={d.id} label={d.label} nilai={d.jumlah} maks={maks} warna="var(--accent)" />
      ))}
    </div>
  );
}

function PenandaKonteks({ icon: Icon, label, nilai }: { icon: Ikon; label: string; nilai: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={14} />
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{nilai}</span>
    </span>
  );
}

function SubJudul({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </div>
  );
}

function RingkasNilai({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="rounded-lg border bg-background/40 px-2.5 py-2">
      <div className="truncate text-[10px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold tabular-nums">{nilai}</div>
    </div>
  );
}

function BarisNilai({ label, nilai, bahaya }: { label: string; nilai: string; bahaya?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', bahaya && 'text-destructive')}>{nilai}</span>
    </div>
  );
}

function Pil({ label, nilai, warna }: { label: string; nilai: number; warna: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px]"
      style={{ borderColor: 'color-mix(in srgb, ' + warna + ' 40%, var(--border))' }}
    >
      <span className="size-1.5 rounded-full" style={{ background: warna }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{angka(nilai)}</span>
    </span>
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
      <div className="p-3">
        <ErrorNotice>{err}</ErrorNotice>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[74px] rounded-xl" />)}
        <Skeleton className="h-64 rounded-xl sm:col-span-2 xl:col-span-3" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { santri, pegawai, keuangan, siklus, psb } = data;

  const kpi: ItemKpi[] = [];
  if (santri) {
    kpi.push({
      key: 'santri',
      label: 'Santri aktif',
      nilai: angka(santri.total),
      sub: angka(santri.baru_ta_aktif) + ' santri baru TA ini',
      icon: GraduationCap,
      warna: 'var(--accent)',
    });
  }
  if (pegawai) {
    kpi.push({
      key: 'pegawai',
      label: 'PTK aktif',
      nilai: angka(pegawai.aktif),
      sub: 'dari ' + angka(pegawai.total) + ' PTK terdaftar',
      icon: Users,
      warna: 'var(--info)',
    });
  }
  if (keuangan) {
    kpi.push({
      key: 'tunggakan',
      label: 'Tunggakan',
      nilai: rupiahRingkas(keuangan.tunggakan),
      sub: 'dari ' + angka(keuangan.jumlah_tagihan) + ' tagihan',
      icon: Wallet,
      warna: 'var(--destructive)',
    });
  }
  kpi.push({
    key: 'kelas',
    label: 'Kelas TA aktif',
    nilai: angka(data.kelas_aktif),
    sub: 'dari ' + angka(data.kelas) + ' kelas terdaftar',
    icon: BookOpen,
    warna: 'var(--warning)',
  });

  const tahunAktif = data.tahun_aktif[0]?.nama ?? 'Belum diatur';

  const perTahapPsb = TAHAP_PSB.map((tahap) => ({
    id: tahap.id,
    label: tahap.label,
    jumlah: tahap.statuses.reduce(
      (jumlah, status) => jumlah + (psb?.per_status[status] ?? 0),
      0,
    ),
  }));

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Baris konteks: data acuan yang selalu tersedia. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
        <PenandaKonteks icon={Landmark} label="Lembaga" nilai={angka(data.lembaga)} />
        <PenandaKonteks icon={Users} label="Pengguna" nilai={angka(data.pengguna)} />
        <PenandaKonteks icon={BookOpen} label="Kelas" nilai={angka(data.kelas)} />
        <PenandaKonteks icon={CalendarCheck} label="Tahun ajaran aktif" nilai={tahunAktif} />
      </div>

      {/* KPI utama. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpi.map((item) => <KartuKpi key={item.key} item={item} />)}
      </div>

      {santri || keuangan ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {santri ? (
            <Kartu
              judul="Santri aktif"
              keterangan={angka(santri.total) + ' santri · ' + angka(santri.baru_ta_aktif) + ' baru'}
              className="lg:col-span-2"
            >
              <div className="space-y-5">
                <BilahKomposisi
                  bagian={[
                    { label: 'Laki-laki', nilai: santri.laki_laki, warna: 'var(--accent)' },
                    { label: 'Perempuan', nilai: santri.perempuan, warna: 'var(--info)' },
                  ]}
                />
                <div className="grid grid-cols-2 gap-3">
                  <RingkasNilai label="Asrama" nilai={angka(santri.asrama)} />
                  <RingkasNilai label="Non-asrama" nilai={angka(santri.non_asrama)} />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <SubJudul>Per lembaga</SubJudul>
                    <DaftarLembaga data={santri.per_lembaga} warna="var(--accent)" />
                  </div>
                  <div className="space-y-2">
                    <SubJudul>Per tingkat · TA aktif</SubJudul>
                    <GrafikTingkat data={santri.per_tingkat} />
                  </div>
                </div>
              </div>
            </Kartu>
          ) : null}

          {keuangan ? (
            <Kartu judul="Keuangan" keterangan={angka(keuangan.jumlah_tagihan) + ' tagihan'}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">Penerimaan</span>
                    <span className="text-xs font-semibold tabular-nums">
                      {persen(keuangan.terbayar, keuangan.nominal)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: persen(keuangan.terbayar, keuangan.nominal),
                        background: 'var(--success)',
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {rupiah(keuangan.terbayar)} dari {rupiah(keuangan.nominal)}
                  </div>
                </div>
                <div className="grid gap-2">
                  <BarisNilai label="Total tertagih" nilai={rupiah(keuangan.nominal)} />
                  <BarisNilai label="Sudah dibayar" nilai={rupiah(keuangan.terbayar)} />
                  <BarisNilai label="Tunggakan" nilai={rupiah(keuangan.tunggakan)} bahaya />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pil label="Lunas" nilai={keuangan.lunas} warna="var(--success)" />
                  <Pil label="Belum" nilai={keuangan.belum} warna="var(--destructive)" />
                  <Pil label="Sebagian" nilai={keuangan.sebagian} warna="var(--warning)" />
                </div>
              </div>
            </Kartu>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {pegawai ? (
          <Kartu
            judul="PTK"
            keterangan={angka(pegawai.aktif) + ' aktif · ' + angka(pegawai.total) + ' terdaftar'}
          >
            <div className="space-y-4">
              <BilahKomposisi
                bagian={[
                  { label: 'Aktif', nilai: pegawai.aktif, warna: 'var(--info)' },
                  {
                    label: 'Tidak aktif',
                    nilai: Math.max(0, pegawai.total - pegawai.aktif),
                    warna: 'var(--muted-foreground)',
                  },
                ]}
              />
              <div className="space-y-2">
                <SubJudul>Per lembaga · TA aktif</SubJudul>
                <DaftarLembaga data={pegawai.per_lembaga} warna="var(--info)" />
              </div>
            </div>
          </Kartu>
        ) : null}

        {siklus ? (
          <Kartu judul="Siklus santri" keterangan={'alumni ' + angka(siklus.alumni)}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <RingkasNilai label="Alumni" nilai={angka(siklus.alumni)} />
                <RingkasNilai label="Mutasi keluar" nilai={angka(siklus.mutasi)} />
                <RingkasNilai label={'Alumni · TA ' + tahunAktif} nilai={angka(siklus.alumni_ta_aktif)} />
                <RingkasNilai label={'Mutasi · TA ' + tahunAktif} nilai={angka(siklus.mutasi_ta_aktif)} />
              </div>
              {siklus.alumni_per_ta.length > 0 ? (
                <div className="space-y-2">
                  <SubJudul>Tren alumni per tahun ajaran</SubJudul>
                  <GrafikTren data={siklus.alumni_per_ta} />
                </div>
              ) : null}
            </div>
          </Kartu>
        ) : null}

        {psb ? (
          <Kartu judul="Antrean PSB" keterangan={angka(psb.total) + ' calon'}>
            {psb.total === 0 ? (
              <div className="flex h-full min-h-24 items-center gap-3 rounded-lg border border-dashed px-3 py-6 text-[11px] text-muted-foreground">
                <UserCheck size={20} />
                Belum ada calon santri pada lingkup ini.
              </div>
            ) : (
              <DaftarTahap data={perTahapPsb} />
            )}
          </Kartu>
        ) : null}
      </div>

      {data.tahun_aktif.length > 0 ? (
        <Kartu judul="Tahun ajaran aktif">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.tahun_aktif.map((t) => (
              <li
                key={t.nama}
                className="flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2"
              >
                <CalendarCheck size={16} style={{ color: 'var(--accent-readable)' }} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold">{t.nama}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {rentang(t.tanggal_mulai, t.tanggal_selesai)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}
    </div>
  );
}
