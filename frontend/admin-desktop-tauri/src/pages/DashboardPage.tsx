import { useEffect, useState } from 'react';
import { ringkasan, type Ringkasan } from '../api/master';
import { errorMessage } from '../api/client';
import { Skeleton } from '@/components/ui/skeleton';

const STATS: { key: keyof Pick<Ringkasan, 'lembaga' | 'pengguna' | 'tahun_ajaran_aktif' | 'kelas'>; label: string }[] = [
  { key: 'lembaga', label: 'Lembaga' },
  { key: 'pengguna', label: 'Pengguna' },
  { key: 'tahun_ajaran_aktif', label: 'Tahun ajaran aktif' },
  { key: 'kelas', label: 'Kelas' },
];

export default function DashboardPage() {
  const [data, setData] = useState<Ringkasan | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    ringkasan().then(setData).catch((e) => setErr(errorMessage(e)));
  }, []);

  if (err) {
    return (
      <div>
        <h1 id="title_dashboard" className="text-2xl font-bold">Ringkasan</h1>
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <h1 id="title_dashboard" className="text-2xl font-bold">Ringkasan</h1>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 id="title_dashboard" className="text-2xl font-bold">Ringkasan</h1>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.key} className="rounded-xl border bg-card p-4">
            <div className="text-[13px] text-muted-foreground">{s.label}</div>
            <div className="text-[28px] font-bold tabular-nums text-primary">{data[s.key]}</div>
          </div>
        ))}
      </div>
      <h2 className="mt-6 text-base font-semibold">Tahun aktif</h2>
      {data.tahun_aktif.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada tahun ajaran aktif.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {data.tahun_aktif.map((t) => (
            <li key={t.id} className="rounded-lg border bg-card px-4 py-2.5 text-sm">
              <b>{t.nama}</b> <span className="text-muted-foreground">— {t.lembaga?.nama ?? t.lembaga_id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
