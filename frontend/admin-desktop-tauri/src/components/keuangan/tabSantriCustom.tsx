import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  buatGrupCustom, daftarGrupCustom, hapusAnggotaGrup, hapusGrupCustom,
  tambahAnggotaGrup, ubahGrupCustom, type AnggotaGrupCustom, type GrupSantriCustom,
} from '../../api/grupCustom';
import { listKelas } from '../../api/master';
import { listSantri, type Santri } from '../../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { ActionIcon, DeleteAction } from '@/components/RowActions';
import { ErrorNotice } from '@/components/PageHeader';
import { targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { bacaPerPageGlobal, tulisPerPageGlobal } from '@/hooks/usePager';
import type { PerPage } from '@/prefs';
import { Plus, Search, Users, X } from '@/icons';

const FIELDS_GRUP: ExcelField[] = [
  { key: 'nama', label: 'Grup', kind: 'text', required: true, width: 180 },
  { key: 'keterangan', label: 'Keterangan', kind: 'text', width: 200 },
  { key: 'jenjang', label: 'Lembaga', kind: 'static', width: 90 },
  { key: 'tahun_ajaran', label: 'TA', kind: 'static', width: 120 },
  { key: 'status', label: 'Status', kind: 'toggle', width: 80 },
];

const FIELDS_SANTRI: ExcelField[] = [
  { key: 'nama_lengkap', label: 'Nama Lengkap', kind: 'static', width: 200 },
  { key: 'nis', label: 'NIS', kind: 'static', width: 110 },
  { key: 'jk', label: 'JK', kind: 'static', width: 60 },
  { key: 'jenjang', label: 'Jenjang', kind: 'static', width: 90 },
];

const FIELDS_PIVOT: ExcelField[] = [
  { key: 'nama_lengkap', label: 'Nama Lengkap', kind: 'static', width: 200 },
  { key: 'nis', label: 'NIS', kind: 'static', width: 110 },
  { key: 'jk', label: 'JK', kind: 'static', width: 60 },
  { key: 'kelas', label: 'Kelas', kind: 'static', width: 100 },
  { key: 'jenjang', label: 'Jenjang', kind: 'static', width: 90 },
];

/** NIS tampil: NIS lokal lebih dulu (cermin kolom NIS Daftar Kelas). */
function nisTampil(s: Santri): string | null {
  const daftar = [...new Set((s.lembaga_aktif ?? []).map((l) => l.nis_lokal).filter((n): n is string => n !== null && n !== ''))];
  return daftar.length > 0 ? daftar.join(', ') : null;
}

/** Jenjang tampil: gabungan unik keanggotaan aktif. */
function jenjangTampil(s: Santri): string | null {
  const unik = [...new Set((s.lembaga_aktif ?? []).map((l) => l.jenjang).filter(Boolean))];
  return unik.length > 0 ? unik.join(', ') : null;
}

/** Tab Santri Custom: grup bentukan manual (kiri: tabel grup + daftar santri,
 *  kanan: pivot anggota grup terpilih). Filter Lembaga/TA/Semester MENGIKUTI
 *  topBar; Tingkat/Kelas memakai rail global (prop `rail`, sama seperti
 *  halaman santri); Cari tetap lokal di toolbar tabel. Izin mengikuti pola
 *  tab lain (`keuangan.ubah` = edit, `keuangan.tambah` = baris input). */
export default function SantriCustomTab({ canEdit, canTambah, jenjangs, tahunAjaranNames, semesters, tingkat, kelas }: {
  /** Gerbang izin `keuangan.ubah`: menyalakan mode Edit + toggle Status. */
  canEdit: boolean;
  /** Gerbang izin `keuangan.tambah`: menyalakan baris input grup baru. */
  canTambah: boolean;
  /** Filter topBar: lembaga + tahun ajaran + semester aktif. */
  jenjangs: readonly string[];
  tahunAjaranNames: readonly string[];
  semesters: readonly string[];
  /** Rail global: tingkat + kelas aktif (nama). */
  tingkat: readonly string[];
  kelas: readonly string[];
}) {
  const [grup, setGrup] = useState<GrupSantriCustom[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  /** Grup yang anggotanya tampil di panel kanan (id). */
  const [grupAktifId, setGrupAktifId] = useState<number | null>(null);
  /** Lebar panel kiri (px); gagang di tengah bisa menggesernya. */
  const [lebarKiri, setLebarKiri] = useState(500);
  const geserRef = useRef<{ x: number; w: number } | null>(null);
  /** Tinggi bagian atas kiri (tabel grup, px); bawaan 320, bisa digeser. */
  const [tinggiAtas, setTinggiAtas] = useState<number>(320);
  const atasRef = useRef<HTMLDivElement | null>(null);
  const geserVertikalRef = useRef<{ y: number; h: number } | null>(null);

  /** Pencarian lokal daftar santri (toolbar tabel). */
  const [cari, setCari] = useState('');

  /** Opsi kelas lingkup topBar (untuk rail global + petakan nama → id). */
  const [kelasOpsi, setKelasOpsi] = useState<{ id: number; nama_kelas: string; tingkat: string | null }[]>([]);

  const [kandidat, setKandidat] = useState<Santri[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState<PerPage>(10);
  const [loadingKandidat, setLoadingKandidat] = useState(false);
  const [busy, setBusy] = useState(false);

  const grupAktif = grup.find((g) => g.id === grupAktifId) ?? null;
  const idAnggota = new Set((grupAktif?.santri ?? []).map((s) => s.id));
  /** Kandidat yang belum jadi anggota (tanpa request ulang). */
  const kandidatTampil = kandidat.filter((s) => !idAnggota.has(s.id));
  /** Nama kelas rail → id (endpoint minta id). */
  const kelasIds = useMemo(
    () => kelasOpsi.filter((k) => kelas.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelas],
  );

  const muatGrup = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const daftar = await daftarGrupCustom({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames });
      setGrup(daftar);
      // Grup aktif yang tersaring keluar ikut ditutup.
      setGrupAktifId((id) => (id !== null && daftar.some((g) => g.id === id) ? id : null));
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [jenjangs, tahunAjaranNames]);

  useEffect(() => { void muatGrup(); }, [muatGrup]);
  useEffect(() => { void bacaPerPageGlobal().then((pp) => setPerPage(pp)); }, []);

  // Opsi kelas mengikuti lingkup topBar (pemetaan nama rail → id).
  useEffect(() => {
    let hidup = true;
    void (async () => {
      try {
        const res = await listKelas({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames, per_page: 100 });
        if (hidup) setKelasOpsi(res.data);
      } catch (e) { if (hidup) setErr(errorMessage(e)); }
    })();
    return () => { hidup = false; };
  }, [jenjangs, tahunAjaranNames]);

  const muatKandidat = useCallback(async (p: number, pp: number, q: string) => {
    setLoadingKandidat(true);
    try {
      const res = await listSantri({
        jenjang: jenjangs,
        tahun_ajaran: tahunAjaranNames,
        semester: semesters,
        tingkat,
        kelas_id: kelasIds,
        q: q === '' ? undefined : q,
        page: p, per_page: pp,
      });
      setKandidat(res.data);
      setPage(res.current_page);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoadingKandidat(false); }
  }, [jenjangs, tahunAjaranNames, semesters, tingkat, kelasIds]);

  // Lingkup topBar / pencarian berubah → muat ulang dari halaman 1 (tahan 250ms).
  useEffect(() => {
    setPage(1);
    const t = setTimeout(() => { void muatKandidat(1, perPage, cari); }, 250);
    return () => clearTimeout(t);
  }, [cari, perPage, muatKandidat]);

  const tambahAnggota = async (ids: number[]) => {
    if (grupAktif === null || ids.length === 0) return;
    setBusy(true);
    try {
      await tambahAnggotaGrup(grupAktif.id, ids);
      toast.success(`${ids.length} santri masuk grup ${grupAktif.nama}.`);
      await muatGrup();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const keluarkanAnggota = async (ids: number[]) => {
    if (grupAktif === null || ids.length === 0) return;
    setBusy(true);
    try {
      for (const id of ids) await hapusAnggotaGrup(grupAktif.id, id);
      toast.success(`${ids.length} santri keluar dari grup ${grupAktif.nama}.`);
      await muatGrup();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const hapusGrup = async (g: GrupSantriCustom) => {
    try {
      await hapusGrupCustom(g.id);
      toast.success('Grup dihapus.');
      await muatGrup();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  /** Payload buat/ubah grup: nama wajib; lingkup mengikuti topBar (grup baru)
   *  atau baris (ubah); duplikat ditolak server. */
  const payloadGrup = (
    baris: Partial<GrupSantriCustom>,
    f: Record<string, string | null>,
  ): { nama: string; keterangan: string | null; jenjang: string | null; tahun_ajaran: string | null; is_active: boolean } => {
    const nama = (f.nama ?? baris.nama ?? '').trim();
    if (nama === '') throw new Error('Nama grup wajib diisi.');
    const keterangan = (f.keterangan ?? baris.keterangan ?? '').trim();
    return {
      nama,
      keterangan: keterangan === '' ? null : keterangan,
      jenjang: baris.jenjang ?? targetTunggal(jenjangs),
      tahun_ajaran: baris.tahun_ajaran ?? targetTunggal(tahunAjaranNames),
      is_active: f.status !== undefined ? f.status === 'ya' : (baris.is_active ?? true),
    };
  };

  const mulaiGeser = (e: React.PointerEvent) => {
    geserRef.current = { x: e.clientX, w: lebarKiri };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const selamaGeser = (e: React.PointerEvent) => {
    const awal = geserRef.current;
    if (awal === null) return;
    setLebarKiri(Math.min(800, Math.max(320, Math.round(awal.w + (e.clientX - awal.x)))));
  };
  const selesaiGeser = () => { geserRef.current = null; };
  const mulaiGeserVertikal = (e: React.PointerEvent) => {
    const h = atasRef.current?.getBoundingClientRect().height ?? 300;
    geserVertikalRef.current = { y: e.clientY, h };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const selamaGeserVertikal = (e: React.PointerEvent) => {
    const awal = geserVertikalRef.current;
    if (awal === null) return;
    setTinggiAtas(Math.min(900, Math.max(200, Math.round(awal.h + (e.clientY - awal.y)))));
  };
  const selesaiGeserVertikal = () => { geserVertikalRef.current = null; };

  return (
    <div className="flex min-h-0 flex-1">
      {/* Kiri (bawaan 500px, bisa digeser): tabel grup + daftar santri. */}
      <div style={{ width: lebarKiri }} className="flex min-h-0 shrink-0 flex-col gap-2">
        <div
          ref={atasRef}
          style={{ height: tinggiAtas }}
          className="flex min-h-0 shrink-0 flex-col gap-2"
        >
        <div className="flex min-h-0 flex-1 flex-col">
          <ExcelTable<GrupSantriCustom & { id: number }>
            tableKey="keuangan_grup_custom"
            hidePreset
            header={(
              <span id="judul_grup_custom" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
                Grup Santri Custom ({grup.length})
              </span>
            )}
            fields={FIELDS_GRUP}
            rows={grup}
            getValues={(g) => ({
              nama: g.nama,
              keterangan: g.keterangan,
              jenjang: g.jenjang,
              tahun_ajaran: g.tahun_ajaran,
              status: g.is_active ? 'ya' : 'tidak',
            })}
            loading={loading}
            emptyText="Belum ada grup pada lingkup ini. Buat grup untuk peserta ekskul, binaan khusus, dan sejenisnya."
            canEdit={canEdit}
            onCommit={async (id, f) => {
              const baris = grup.find((g) => g.id === id);
              if (!baris) return;
              await ubahGrupCustom(id, payloadGrup(baris, f));
              await muatGrup();
            }}
            onSaved={() => {}}
            onCreateRow={canTambah ? async (f) => {
              await buatGrupCustom(payloadGrup({}, f));
              await muatGrup();
            } : undefined}
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
        </div>
        {/* Gagang geser tinggi tabel grup vs daftar santri. */}
        <div
          id="gagang_tabel_grup_custom"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Atur tinggi tabel grup dan daftar santri"
          className="h-1.5 shrink-0 cursor-row-resize hover:bg-accent"
          onPointerDown={mulaiGeserVertikal}
          onPointerMove={selamaGeserVertikal}
          onPointerUp={selesaiGeserVertikal}
          onPointerCancel={selesaiGeserVertikal}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="relative min-w-0 flex-1 self-end">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="inp_grup_custom_cari" aria-label="Cari santri" placeholder="Cari nama / NIS…"
            className="h-[26px] w-full pl-8" value={cari}
            onChange={(e) => setCari(e.target.value)}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <ExcelTable<Santri>
            tableKey="grup_custom_kandidat"
            rail
            header={(
              <span id="judul_sc_santri" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
                Daftar Santri ({total})
              </span>
            )}
            fields={FIELDS_SANTRI}
            rows={kandidatTampil}
            getValues={(r) => ({ nama_lengkap: r.nama_lengkap, nis: nisTampil(r), jk: r.jk, jenjang: jenjangTampil(r) })}
            loading={loadingKandidat}
            emptyText={grupAktif === null
              ? 'Pilih grup dulu (ikon orang), lalu masukkan santri dari daftar ini.'
              : 'Tidak ada santri (yang belum jadi anggota).'}
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            aksiLangsung
            renderActions={grupAktif === null ? () => null : (r) => (
              <ActionIcon id={`btn_grup_custom_tambah_${r.id}`} title={`Masukkan ${r.nama_lengkap} ke ${grupAktif.nama}`} onClick={() => tambahAnggota([r.id])}>
                <Plus size={16} />
              </ActionIcon>
            )}
            renderBulkActions={grupAktif === null ? undefined : (checked, clear) => checked.length === 0 ? null : (
              <Button id="btn_grup_custom_tambah_banyak" size="sm" disabled={busy} onClick={() => { tambahAnggota(checked.map((r) => r.id)); clear(); }}>
                <Plus data-icon="inline-start" size={14} /> Masukkan ({checked.length})
              </Button>
            )}
            pager={<Pager page={page} lastPage={lastPage} total={total} perPage={perPage} onPage={(p) => void muatKandidat(p, perPage, cari)} onPerPage={(pp) => setPerPage(tulisPerPageGlobal(pp))} />}
          />
        </div>
        </div>
      </div>

      {/* Gagang geser antar panel. */}
      <div
        id="gagang_santri_custom"
        role="separator"
        aria-orientation="vertical"
        aria-label="Atur lebar panel kiri"
        className="w-1.5 shrink-0 cursor-col-resize self-stretch hover:bg-accent"
        onPointerDown={mulaiGeser}
        onPointerMove={selamaGeser}
        onPointerUp={selesaiGeser}
        onPointerCancel={selesaiGeser}
      />

      {/* Kanan: pivot anggota grup terpilih. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {err !== '' && <ErrorNotice>{err}</ErrorNotice>}
        {grupAktif === null ? (
          <p className="grid flex-1 place-items-center text-sm text-muted-foreground">
            Pilih grup di tabel kiri (ikon orang) untuk melihat anggotanya.
          </p>
        ) : (
          <ExcelTable<AnggotaGrupCustom>
            tableKey="grup_custom_anggota"
            header={(
              <span id="judul_sc_anggota" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
                Anggota {grupAktif.nama} ({grupAktif.santri.length})
              </span>
            )}
            fields={FIELDS_PIVOT}
            rows={grupAktif.santri}
            getValues={(r) => ({ nama_lengkap: r.nama_lengkap, nis: r.nis, jk: r.jk, kelas: r.kelas, jenjang: r.jenjang })}
            emptyText="Belum ada anggota — masukkan dari daftar santri di kiri."
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
        )}
      </div>
    </div>
  );
}
