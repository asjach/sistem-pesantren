import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/api/client';
import {
  hapusToolbarPreset,
  muatToolbarPreset,
  simpanToolbarPreset,
} from '@/api/toolbarPreset';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { EVENT_TOOLBAR_BERUBAH, KONTROL_TOOLBAR, bacaVisToolbar, type VisToolbar } from './jenis';

/** Tab Kontrol dialog Kelola tabel: tampil/sembunyikan kontrol toolbar
 *  generik per tabel — GLOBAL untuk seluruh lembaga, khusus super_admin.
 *  Bukan dihapus: kontrol yang disembunyikan tetap ada, hanya tak dirender. */
export default function TabKontrol({ tableKey, onTutup }: { tableKey: string; onTutup: () => void }) {
  const { user } = useAuth();
  const bolehUbah = (user?.roles ?? []).some((r) => r.name === 'super_admin');

  const [vis, setVis] = useState<VisToolbar>({ cari: true, info: true, urut: true, kolom: true, filter: true });
  const [busy, setBusy] = useState(false);

  const muat = useCallback(async () => {
    try {
      const res = await muatToolbarPreset(tableKey);
      setVis(bacaVisToolbar(res.data.visibilitas));
    } catch {
      setVis({ cari: true, info: true, urut: true, kolom: true, filter: true });
    }
  }, [tableKey]);

  useEffect(() => {
    void muat();
  }, [muat]);

  function kabariBerubah() {
    window.dispatchEvent(new CustomEvent(EVENT_TOOLBAR_BERUBAH, { detail: { tableKey } }));
  }

  async function simpan() {
    if (!bolehUbah) return;
    setBusy(true);
    try {
      const res = await simpanToolbarPreset(tableKey, { ...vis });
      toast.success(res.pesan);
      kabariBerubah();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function kembalikan() {
    if (!bolehUbah) return;
    setBusy(true);
    try {
      const res = await hapusToolbarPreset(tableKey);
      setVis({ cari: true, info: true, urut: true, kolom: true, filter: true });
      toast.success(res.pesan);
      kabariBerubah();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Kontrol toolbar generik tabel ini — global untuk seluruh lembaga, khusus super_admin.
        Kontrol yang dimatikan disembunyikan (bukan dihapus). Tombol aksi dan aksi bulk
        tidak termasuk di sini karena alur halaman bergantung padanya.
      </p>
      <p className="rounded-md border border-amber-500/40 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
        Awas: menyembunyikan “Filter halaman” dapat mengunci alur yang bergantung padanya
        (mis. pilihan kelas tujuan di Riwayat Belajar).
      </p>
      {!bolehUbah ? (
        <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
          Hanya super_admin yang dapat mengubah visibilitas kontrol.
        </p>
      ) : null}
      <div className="flex flex-col gap-1 overflow-auto rounded-md border p-1">
        {KONTROL_TOOLBAR.map(({ kunci, label, ket }) => (
          <label
            key={kunci}
            htmlFor={`switch_toolbar_${tableKey}_${kunci}`}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40"
          >
            <Switch
              id={`switch_toolbar_${tableKey}_${kunci}`}
              checked={vis[kunci]}
              disabled={!bolehUbah || busy}
              onCheckedChange={(c) => setVis((v) => ({ ...v, [kunci]: !!c }))}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{label}</span>
              <span className="block truncate text-xs text-muted-foreground" title={ket}>{ket}</span>
            </span>
          </label>
        ))}
      </div>

      <DialogFooter className="mt-auto gap-2 sm:justify-between">
        <Button
          type="button"
          variant="outline"
          id={`btn_toolbar_bawaan_${tableKey}`}
          disabled={!bolehUbah || busy}
          onClick={() => void kembalikan()}
        >
          Kembalikan bawaan
        </Button>
        <span className="flex gap-2">
          <Button type="button" variant="outline" onClick={onTutup}>Tutup</Button>
          <Button
            type="button"
            id={`btn_toolbar_simpan_${tableKey}`}
            disabled={!bolehUbah || busy}
            onClick={() => void simpan()}
          >
            {busy ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </span>
      </DialogFooter>
    </div>
  );
}
