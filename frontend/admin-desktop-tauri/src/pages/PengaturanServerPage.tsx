import { useEffect, useState } from 'react';
import {
  DEFAULT_API_BASE_URL,
  errorMessage,
  getBaseUrl,
  isTauri,
  resetBaseUrl,
  setBaseUrl,
  api,
} from '../api/client';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RibbonSlot } from '@/components/RibbonSlot';
import { RibbonCmd, RibbonGroup } from '@/components/topbar/primitives';
import { RotateCcw, Server } from '@/icons';
import { toast } from 'sonner';

// Base URL backend bisa diganti runtime (lokal dulu, server belakangan)
// tanpa rebuild binary. Disimpan di plugin-store (desktop) / localStorage (web).
// Aksi server dipindah ke baris tools ribbon (RibbonSlot).
export default function PengaturanServerPage() {
  const [url, setUrl] = useState('');
  const [aktif, setAktif] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    getBaseUrl().then((b) => { setAktif(b); setUrl(b); }).catch((e) => setErr(errorMessage(e)));
  }, []);

  async function onUji() {
    setErr('');
    if (!url.trim()) {
      setErr('Alamat API wajib diisi.');
      return;
    }
    try {
      await setBaseUrl(url);
      const me = await api<{ name: string }>('/auth/me');
      setAktif(await getBaseUrl());
      toast.success(`Terhubung sebagai ${me.name}.`);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function onReset() {
    await resetBaseUrl();
    const b = await getBaseUrl();
    setAktif(b); setUrl(b);
    toast.success(`Kembali ke bawaan (${DEFAULT_API_BASE_URL}).`);
  }

  return (
    <div className="flex flex-col gap-6">
      <RibbonSlot label="Server">
        <RibbonGroup label="Server">
          <RibbonCmd id="btn_uji_server" icon={Server} label="Uji koneksi" onClick={() => void onUji()} />
          <RibbonCmd id="btn_reset_server" icon={RotateCcw} label="Kembalikan bawaan" onClick={() => void onReset()} />
        </RibbonGroup>
      </RibbonSlot>

      <p id="info_server" className="text-sm text-muted-foreground">
        Aktif: <b className="text-foreground">{aktif}</b> · Mode:{' '}
        <Badge variant="secondary">{isTauri() ? 'desktop' : 'web'}</Badge>
      </p>

      <section className="flex w-full max-w-none flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Server backend</h2>
        <p className="text-sm text-muted-foreground">Bawaan: {DEFAULT_API_BASE_URL}</p>
        {err && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>
        )}
        <form id="form_server" onSubmit={(e) => { e.preventDefault(); onUji(); }} className="flex flex-col gap-3">
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="input_base_url">Alamat API backend (tanpa garis miring akhir)</FieldLabel>
              <Input
                id="input_base_url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000/api"
                required
              />
            </Field>
          </FieldGroup>
        </form>
      </section>
    </div>
  );
}
