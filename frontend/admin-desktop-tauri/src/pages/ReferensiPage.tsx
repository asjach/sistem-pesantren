import { useEffect, useState } from 'react';
import { referensiTypes, referensiList } from '../api/master';
import { errorMessage } from '../api/client';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReferensiPage() {
  const [types, setTypes] = useState<string[]>([]);
  const [tipe, setTipe] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    referensiTypes()
      .then((t) => { setTypes(t); if (t[0]) setTipe(t[0]); })
      .catch((e) => { setErr(errorMessage(e)); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!tipe) return;
    setLoading(true);
    referensiList(tipe)
      .then(setRows)
      .catch((e) => setErr(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [tipe]);

  return (
    <div>
      <h1 id="title_referensi" className="text-2xl font-bold">Referensi</h1>
      {err && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>
      )}
      <div className="mt-3 rounded-xl border bg-card p-4">
        <div className="grid max-w-xs gap-1.5">
          <Label htmlFor="select_tipe">Tipe kamus ({types.length || '…'})</Label>
          <Select value={tipe} onValueChange={setTipe}>
            <SelectTrigger id="select_tipe">
              <SelectValue placeholder="Pilih tipe" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {loading ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-28 rounded-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada entri.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {rows.slice(0, 50).map((r, i) => (
            <li key={i} className="rounded-full border bg-card px-3.5 py-1.5 text-[13px]">
              {String(r['nama'] ?? r['label'] ?? r['kode'] ?? JSON.stringify(r))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
