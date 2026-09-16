import { useEffect, useState } from 'react';
import { ringkasan, type Ringkasan } from '../api/master';
import { errorMessage } from '../api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { ErrorNotice } from '@/components/PageHeader';
import { BookOpen, CalendarCheck, Landmark, Users, type Ikon } from '@/icons';

const STATS: {
  key: keyof Pick<Ringkasan, 'lembaga' | 'pengguna' | 'tahun_ajaran_aktif' | 'kelas'>;
  label: string;
  icon: Ikon;
}[] = [
  { key: 'lembaga', label: 'Lembaga', icon: Landmark },
  { key: 'pengguna', label: 'Pengguna', icon: Users },
  { key: 'tahun_ajaran_aktif', label: 'Tahun ajaran aktif', icon: CalendarCheck },
  { key: 'kelas', label: 'Kelas', icon: BookOpen },
];

export default function DashboardPage() {
  const [data, setData] = useState<Ringkasan | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    ringkasan()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setErr(errorMessage(e)); });
    return () => { alive = false; };
  }, []);

  if (err) {
    return (
      <div>
        <ErrorNotice>{err}</ErrorNotice>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                <Icon size={20} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] text-muted-foreground">{s.label}</div>
                <div className="text-[26px] font-bold leading-tight tabular-nums">{data[s.key]}</div>
              </div>
            </div>
          );
        })}
      </div>
      <h2 className="mt-6 mb-2 text-base font-semibold">Tahun aktif</h2>
      {data.tahun_aktif.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada tahun ajaran aktif.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.tahun_aktif.map((t) => (
            <li key={t.id}>
              <Item variant="outline" size="sm" className="bg-card">
                <ItemMedia
                  variant="icon"
                  className="grid size-8 place-items-center rounded-md bg-accent text-accent-foreground"
                >
                  <CalendarCheck size={16} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{t.nama}</ItemTitle>
                  <ItemDescription>{t.lembaga?.nama ?? (t.lembaga_id ? String(t.lembaga_id) : 'Semua lembaga')}</ItemDescription>
                </ItemContent>
              </Item>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
