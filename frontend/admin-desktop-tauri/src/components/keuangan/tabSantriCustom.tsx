import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  buatGrupCustom, daftarGrupCustom, hapusAnggotaGrup, hapusGrupCustom,
  tambahAnggotaGrup, ubahGrupCustom, type GrupSantriCustom,
} from '../../api/grupCustom';
import { listSantri, type Santri } from '../../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { ActionIcon, DeleteAction } from '@/components/RowActions';
import { ErrorNotice } from '@/components/PageHeader';
import { bacaPerPageGlobal, tulisPerPageGlobal } from '@/hooks/usePager';
import type { PerPage } from '@/prefs';
import { Plus, Search, Users, X } from '@/icons';

const FIELDS_GRUP: ExcelField[] = [
  { key: 'nama', label: 'Grup', kind: 'text', required: true, width: 200 },
  { key: 'keterangan', label: 'Keterangan', kind: 'text', width: 280 },
  { key: 'jumlah', label: 'Anggota', kind: 'static', width: 80 },
];

const FIELDS_SANTRI: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static', width: 200 },
  { key: 'nisn', label: 'NISN', kind: 'static', width: 130 },
  { key: 'ayah', label: 'Ayah', kind: 'static', width: 150 },
];

/** Nilai grid tabel grup: jumlah dibaca dari panjang anggota. */
function nilaiGridGrup(g: GrupSantriCustom): Record<string, string | null> {
  return {
    nama: g.nama,
    keterangan: g.keterangan,
    jumlah: String(g.santri.length),
  };
}

/** Payload buat/ubah grup dari baris: nama wajib, duplikat ditolak server. */
function payloadGrup(baris: Partial<GrupSantriCustom>, f: Record<string, string | null>): { nama: string; keterangan: string | null } {
  const nama = (f.nama ?? baris.nama ?? '').trim();
  if (nama === '') throw new Error('Nama grup wajib diisi.');
  const keterangan = (f.keterangan ?? baris.keterangan ?? '').trim();
  return { nama, keterangan: keterangan === '' ? null : keterangan };
}

/** Tab Santri Custom: daftar grup bentukan manual + kelola anggotanya.
 *  Mandiri (mengambil datanya sendiri) karena tidak tergantung filter halaman;
 *  izin mengikuti pola tab lain (`keuangan.ubah` = edit, `keuangan.tambah` =
 *  baris input). Opsi "Custom" di dialog Buat Tagihan memakai grup-grup ini. */
export default function SantriCustomTab({ canEdit, canTambah }: {
  /** Gerbang izin `keuangan.ubah`: menyalakan mode Edit. */
  canEdit: boolean;
  /** Gerbang izin `keuangan.tambah`: menyalakan baris input grup baru. */
  canTambah: boolean;
}) {
  const [grup, setGrup] = useState<GrupSantriCustom[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  /** Grup yang anggotanya sedang dikelola (id). */
  const [grupAktifId, setGrupAktifId] = useState<number | null>(null);

  const [cari, setCari] = useState('');
  const [kandidat, setKandidat] = useState<Santri[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState<PerPage>(10);
  const [loadingKandidat, setLoadingKandidat] = useState(false);
  const [busy, setBusy] = useState(false);

  const grupAktif = grup.find((g) => g.id === grupAktifId) ?? null;
  const idAnggota = new Set(grupAktif?.santri.map((s) => s.id) ?? []);
  /** Kandidat yang belum jadi anggota (tanpa request ulang). */
  const kandidatTampil = kandidat.filter((s) => !idAnggota.has(s.id));

  const muatGrup = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const daftar = await daftarGrupCustom();
      setGrup(daftar);
      // Grup aktif yang terhapus ikut ditutup.
      setGrupAktifId((id) => (id !== null && daftar.some((g) => g.id === id) ? id : null));
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void muatGrup(); }, [muatGrup]);
  useEffect(() => { void bacaPerPageGlobal().then((pp) => setPerPage(pp)); }, []);

  const muatKandidat = useCallback(async (p: number, pp: number, q: string) => {
    setLoadingKandidat(true);
    try {
      const res = await listSantri({ q: q === '' ? undefined : q, page: p, per_page: pp });
      setKandidat(res.data);
      setPage(res.current_page ?? p);
      setLastPage(res.last_page ?? 1);
      setTotal(res.total ?? res.data.length);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoadingKandidat(false); }
  }, []);

  // Panel anggota dibuka / pencarian berubah → muat ulang (tahan 250ms).
  useEffect(() => {
    if (grupAktifId === null) return;
    setPage(1);
    const t = setTimeout(() => { void muatKandidat(1, perPage, cari); }, 250);
    return () => clearTimeout(t);
  }, [grupAktifId, cari, perPage, muatKandidat]);

  /** Tulis balik grup hasil respons (anggota berubah) ke kedua state. */
  const terapkanGrup = (g: GrupSantriCustom) => {
    setGrup((lama) => lama.map((x) => (x.id === g.id ? g : x)));
  };

  const tambahAnggota = async (ids: number[]) => {
    if (grupAktif === null || ids.length === 0) return;
    setBusy(true);
    try {
      terapkanGrup(await tambahAnggotaGrup(grupAktif.id, ids));
      toast.success(`${ids.length} santri masuk grup.`);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const keluarkanAnggota = async (ids: number[]) => {
    if (grupAktif === null || ids.length === 0) return;
    setBusy(true);
    try {
      for (const id of ids) terapkanGrup(await hapusAnggotaGrup(grupAktif.id, id));
      toast.success(`${ids.length} santri keluar dari grup.`);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const hapusGrup = async (g: GrupSantriCustom) => {
    try {
      await hapusGrupCustom(g.id);
      toast.success('Grup dihapus.');
      await muatGrup();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  /** Grup baru langsung tampil tanpa muat ulang (respons memuat anggotanya). */
  const terapkanGrupBaru = (g: GrupSantriCustom) => {
    setGrup((lama) => [...lama, g]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {err !== '' && <ErrorNotice>{err}</ErrorNotice>}
      <div className="flex min-h-0 flex-1 flex-col">
        <ExcelTable<GrupSantriCustom & { id: number }>
          tableKey="keuangan_grup_custom"
          header={(
            <span id="judul_grup_custom" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
              Grup Santri Custom ({grup.length})
            </span>
          )}
          fields={FIELDS_GRUP}
          rows={grup}
          getValues={nilaiGridGrup}
          loading={loading}
          emptyText="Belum ada grup. Buat grup untuk peserta ekskul, binaan khusus, dan sejenisnya."
          canEdit={canEdit}
          onCommit={async (id, f) => {
            const baris = grup.find((g) => g.id === id);
            if (!baris) return;
            terapkanGrup(await ubahGrupCustom(id, payloadGrup(baris, f)));
          }}
          onSaved={() => {}}
          onCreateRow={canTambah ? async (f) => { terapkanGrupBaru(await buatGrupCustom(payloadGrup({}, f))); } : undefined}
          renderActions={(g) => (
            <>
              <ActionIcon
                id={`btn_grup_custom_anggota_${g.id}`}
                title={`Kelola anggota ${g.nama}`}
                aria-label={`Kelola anggota ${g.nama}`}
                onClick={() => setGrupAktifId(g.id)}
              >
                <Users size={16} />
              </ActionIcon>
              <DeleteAction
                id={`btn_grup_custom_hapus_${g.id}`}
                title={`Hapus grup ${g.nama}?`}
                description="Grup dihapus permanen beserta keanggotaannya (tagihan yang sudah dibuat tidak ikut terhapus)."
                onConfirm={() => hapusGrup(g)}
              />
            </>
          )}
          hideCheckbox
        />
      </div>

      {grupAktif !== null && (
        <div className="flex min-h-0 flex-[1.2] flex-col gap-1 border-t pt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Users size={14} className="text-muted-foreground" />
              Anggota {grupAktif.nama} ({grupAktif.santri.length})
            </p>
            <Button
              id="btn_grup_custom_tutup_anggota" type="button" variant="ghost" size="icon-xs"
              onClick={() => setGrupAktifId(null)}
              aria-label={`Tutup kelola anggota ${grupAktif.nama}`}
              title="Tutup panel anggota"
              className="shrink-0 text-muted-foreground"
            >
              <X size={14} />
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Cari santri untuk dimasukkan ke grup:</p>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="inp_grup_custom_cari" placeholder="Cari nama / NISN…"
                className="h-[26px] w-64 pl-8" value={cari}
                onChange={(e) => setCari(e.target.value)}
              />
            </div>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
            <div className="flex min-h-0 flex-col">
              <ExcelTable<Santri>
                tableKey="grup_custom_kandidat"
                fields={FIELDS_SANTRI}
                rows={kandidatTampil}
                getValues={(r) => ({ nama: r.nama_lengkap, nisn: r.nisn ?? null, ayah: r.ayah_nama ?? null })}
                loading={loadingKandidat}
                emptyText="Tidak ada santri (yang belum jadi anggota)."
                canEdit={false}
                onCommit={async () => {}}
                onSaved={() => {}}
                aksiLangsung
                renderActions={(r) => (
                  <ActionIcon id={`btn_grup_custom_tambah_${r.id}`} title={`Masukkan ${r.nama_lengkap}`} onClick={() => tambahAnggota([r.id])}>
                    <Plus size={16} />
                  </ActionIcon>
                )}
                renderBulkActions={(checked, clear) => checked.length === 0 ? null : (
                  <Button id="btn_grup_custom_tambah_banyak" size="sm" disabled={busy} onClick={() => { tambahAnggota(checked.map((r) => r.id)); clear(); }}>
                    <Plus data-icon="inline-start" size={14} /> Masukkan ({checked.length})
                  </Button>
                )}
                pager={<Pager page={page} lastPage={lastPage} total={total} perPage={perPage} onPage={(p) => void muatKandidat(p, perPage, cari)} onPerPage={(pp) => setPerPage(tulisPerPageGlobal(pp))} />}
              />
            </div>
            <div className="flex min-h-0 flex-col">
              <ExcelTable<{ id: number; nama_lengkap: string }>
                tableKey="grup_custom_anggota"
                fields={FIELDS_SANTRI}
                rows={grupAktif.santri}
                getValues={(r) => ({ nama: r.nama_lengkap, nisn: null, ayah: null })}
                emptyText="Belum ada anggota — masukkan dari daftar kiri."
                canEdit={false}
                onCommit={async () => {}}
                onSaved={() => {}}
                aksiLangsung
                renderActions={(r) => (
                  <ActionIcon id={`btn_grup_custom_keluarkan_${r.id}`} title={`Keluarkan ${r.nama_lengkap}`} onClick={() => keluarkanAnggota([r.id])}>
                    <X size={16} />
                  </ActionIcon>
                )}
                renderBulkActions={(checked, clear) => checked.length === 0 ? null : (
                  <Button id="btn_grup_custom_keluarkan_banyak" size="sm" disabled={busy} onClick={() => { keluarkanAnggota(checked.map((r) => r.id)); clear(); }}>
                    <X data-icon="inline-start" size={14} /> Keluarkan ({checked.length})
                  </Button>
                )}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
