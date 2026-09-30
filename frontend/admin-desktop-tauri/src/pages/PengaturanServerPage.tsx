import { useEffect, useState } from 'react';
import {
  DEFAULT_API_BASE_URL,
  errorMessage,
  getBaseUrl,
  isTauri,
  prefGet,
  prefSet,
  resetBaseUrl,
  setBaseUrl,
  api,
} from '../api/client';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RibbonSlot } from '@/components/RibbonSlot';
import { RibbonCmd, RibbonGroup } from '@/components/topbar/primitives';
import { RotateCcw, Server } from '@/icons';
import { toast } from 'sonner';
import { PREF_FOLDER_ARSIP, PREF_FOLDER_ARSIP_TEST, PREF_MODE_DOKUMEN, ROOT_ARSIP_DOKUMEN, ROOT_ARSIP_TEST } from '@/lib/arsipDokumen';

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

  // ----- Arsip dokumen perangkat ini (mode + folder root) -----
  const desktop = isTauri();
  const [modeDokumen, setModeDokumen] = useState<'server' | 'lokal' | 'test'>('server');
  const [folderArsip, setFolderArsip] = useState('');
  const [folderArsipTest, setFolderArsipTest] = useState('');
  const [prefSiap, setPrefSiap] = useState(false);
  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const [m, f, ft] = await Promise.all([prefGet(PREF_MODE_DOKUMEN), prefGet(PREF_FOLDER_ARSIP), prefGet(PREF_FOLDER_ARSIP_TEST)]);
        if (!hidup) return;
        if (m === 'server' || m === 'lokal' || m === 'test') setModeDokumen(m);
        if (typeof f === 'string') setFolderArsip(f);
        if (typeof ft === 'string') setFolderArsipTest(ft);
      } catch {
        /* abaikan */
      }
      if (hidup) setPrefSiap(true);
    })();
    return () => { hidup = false; };
  }, []);
  useEffect(() => {
    if (!prefSiap) return;
    prefSet(PREF_MODE_DOKUMEN, modeDokumen).catch(() => {});
  }, [prefSiap, modeDokumen]);
  useEffect(() => {
    if (!prefSiap) return;
    prefSet(PREF_FOLDER_ARSIP, folderArsip).catch(() => {});
  }, [prefSiap, folderArsip]);
  useEffect(() => {
    if (!prefSiap) return;
    prefSet(PREF_FOLDER_ARSIP_TEST, folderArsipTest).catch(() => {});
  }, [prefSiap, folderArsipTest]);

  async function onPilihFolder(uji = false) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const dipilih = await open({ multiple: false, directory: true });
      if (typeof dipilih === 'string' && dipilih !== '') {
        if (uji) setFolderArsipTest(dipilih);
        else setFolderArsip(dipilih);
        toast.success('Folder arsip diubah.');
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
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

      <section className="flex w-full max-w-none flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Arsip dokumen perangkat ini</h2>
        <p className="text-sm text-muted-foreground">
          Mode Server menyimpan berkas ke server; mode Lokal menyimpan berkas ke drive perangkat ini;
          mode Test seperti Lokal tetapi ke folder uji (tanpa folder sudah).
          Bisa diganti kapan saja; hanya memengaruhi simpanan berikutnya.
        </p>
        <div id="radio_mode_dokumen" role="radiogroup" aria-label="Mode penyimpanan dokumen" className="flex flex-wrap gap-2">
          {([
            ['server', 'Server'],
            ['lokal', 'Lokal'],
            ['test', 'Test'],
          ] as const).map(([nilai, label]) => (
            <label
              key={nilai}
              htmlFor={`radio_mode_dokumen_${nilai}`}
              title={nilai !== 'server' && !desktop ? 'Hanya tersedia di aplikasi desktop' : undefined}
              className={`inline-flex h-6 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-0 text-xs has-checked:border-primary has-checked:bg-accent has-checked:font-semibold${nilai !== 'server' && !desktop ? ' cursor-not-allowed opacity-50' : ''}`}
            >
              <input
                type="radio"
                id={`radio_mode_dokumen_${nilai}`}
                name="mode_dokumen"
                value={nilai}
                checked={modeDokumen === nilai}
                disabled={nilai !== 'server' && !desktop}
                onChange={() => setModeDokumen(nilai)}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={folderArsip || undefined}>
            Folder arsip: {folderArsip !== '' ? folderArsip : `Documents/${ROOT_ARSIP_DOKUMEN} (bawaan)`}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" disabled={!desktop} onClick={() => void onPilihFolder()}>
                Ubah…
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{desktop ? 'Pilih folder arsip' : 'Hanya tersedia di aplikasi desktop'}</p></TooltipContent>
          </Tooltip>
          {folderArsip !== '' && (
            <Button variant="ghost" size="sm" onClick={() => setFolderArsip('')}>
              Bawaan
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={folderArsipTest || undefined}>
            Folder uji: {folderArsipTest !== '' ? folderArsipTest : `Documents/${ROOT_ARSIP_TEST} (bawaan)`}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" disabled={!desktop} onClick={() => void onPilihFolder(true)}>
                Ubah…
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{desktop ? 'Pilih folder uji' : 'Hanya tersedia di aplikasi desktop'}</p></TooltipContent>
          </Tooltip>
          {folderArsipTest !== '' && (
            <Button variant="ghost" size="sm" onClick={() => setFolderArsipTest('')}>
              Bawaan
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
