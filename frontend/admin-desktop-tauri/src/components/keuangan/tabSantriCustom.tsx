import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { Switch } from '@/components/ui/switch';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { TopBarSearch } from '@/components/TopBarSearch';
import LabeledInput from '@/components/LabeledInput';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ActionIcon, DeleteAction, EditAction } from '@/components/RowActions';
import { ErrorNotice } from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import { targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { bacaPerPageGlobal, tulisPerPageGlobal } from '@/hooks/usePager';
import type { PerPage } from '@/prefs';
import { ArrowRight, Plus, X } from '@/icons';

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

/** NIS tampil: NIS lokal lebih dulu (cermin kolom NIS Daftar Kelas). Dipakai
 *  juga halaman Dispensasi untuk daftar santrinya. */
export function nisTampil(s: Santri): string | null {
  const daftar = [...new Set((s.lembaga_aktif ?? []).map((l) => l.nis_lokal).filter((n): n is string => n !== null && n !== ''))];
  return daftar.length > 0 ? daftar.join(', ') : null;
}

/** Jenjang tampil: gabungan unik keanggotaan aktif. */
export function jenjangTampil(s: Santri): string | null {
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

  /** Pencarian topBar: berlaku untuk tabel grup DAN daftar santri. */
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
  /** Popover Buat Grup + isiannya (pengganti baris input tabel). */
  const [popGrup, setPopGrup] = useState(false);
  const [baruNama, setBaruNama] = useState('');
  const [baruKet, setBaruKet] = useState('');
  const [baruErr, setBaruErr] = useState('');
  const [baruBusy, setBaruBusy] = useState(false);
  /** Baris grup yang sedang diubah + draft isiannya. */
  const [editId, setEditId] = useState<number | null>(null);
  const [ubahNama, setUbahNama] = useState('');
  const [ubahKet, setUbahKet] = useState('');

  const grupAktif = grup.find((g) => g.id === grupAktifId) ?? null;
  /** Grup tersaring pencarian (nama/keterangan); santri memakai `q` server. */
  const grupTampil = grup.filter((g) => {
    const q = cari.trim().toLowerCase();
    return q === ''
      || g.nama.toLowerCase().includes(q)
      || (g.keterangan ?? '').toLowerCase().includes(q);
  });
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

      setGrupAktifId((id) => (id !== null && daftar.some((g) => g.id === id) ? id : null));
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [jenjangs, tahunAjaranNames]);

  useEffect(() => { void muatGrup(); }, [muatGrup]);
  useEffect(() => { void bacaPerPageGlobal().then((pp) => setPerPage(pp)); }, []);

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

  /** Lingkup grup baru (ditampilkan di popover, mengikuti topBar). */
  const lingkupBaru = `${targetTunggal(jenjangs) ?? 'Semua lembaga'} · ${targetTunggal(tahunAjaranNames) ?? 'Semua TA'}`;

  /** Buka popover: isian di-reset (kosong = belum diisi). */
  const resetFormGrup = () => {
    setBaruNama('');
    setBaruKet('');
    setBaruErr('');
  };

  /** Simpan grup baru dari popover → muat ulang daftar. */
  const simpanGrupBaru = async (e: FormEvent) => {
    e.preventDefault();
    const nama = baruNama.trim();
    if (nama === '') { setBaruErr('Nama grup wajib diisi.'); return; }
    const keterangan = baruKet.trim();
    setBaruErr('');
    setBaruBusy(true);
    try {
      await buatGrupCustom({
        nama,
        keterangan: keterangan === '' ? null : keterangan,
        jenjang: targetTunggal(jenjangs),
        tahun_ajaran: targetTunggal(tahunAjaranNames),
      });
      toast.success('Grup dibuat.');
      setPopGrup(false);
      await muatGrup();
    } catch (e2) { setBaruErr(errorMessage(e2)); } finally { setBaruBusy(false); }
  };

  /** Mulai ubah baris: draft diisi dari baris. */
  const mulaiUbah = (g: GrupSantriCustom) => {
    setEditId(g.id);
    setUbahNama(g.nama);
    setUbahKet(g.keterangan ?? '');
  };

  /** Simpan ubahan baris (nama wajib; lingkup & status ikut baris). */
  const simpanUbah = async () => {
    const baris = grup.find((g) => g.id === editId);
    if (!baris) return;
    const nama = ubahNama.trim();
    if (nama === '') { toast.error('Nama grup wajib diisi.'); return; }
    const keterangan = ubahKet.trim();
    try {
      await ubahGrupCustom(baris.id, {
        nama,
        keterangan: keterangan === '' ? null : keterangan,
        jenjang: baris.jenjang,
        tahun_ajaran: baris.tahun_ajaran,
        is_active: baris.is_active,
      });
      toast.success('Grup diubah.');
      setEditId(null);
      await muatGrup();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  /** Alih status langsung dari baris. */
  const ubahStatus = async (g: GrupSantriCustom, v: boolean) => {
    try {
      await ubahGrupCustom(g.id, {
        nama: g.nama,
        keterangan: g.keterangan,
        jenjang: g.jenjang,
        tahun_ajaran: g.tahun_ajaran,
        is_active: v,
      });
      await muatGrup();
    } catch (e) { toast.error(errorMessage(e)); }
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
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari grup / nama / NIS…" />

      <div style={{ width: lebarKiri }} className="flex min-h-0 shrink-0 flex-col gap-2">
        <div
          ref={atasRef}
          style={{ height: tinggiAtas }}
          className="flex min-h-0 shrink-0 flex-col gap-2"
        >
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span id="judul_grup_custom" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
              Grup Santri Custom ({grupTampil.length}{cari.trim() !== '' ? ` dari ${grup.length}` : ''})
            </span>
            {canTambah ? (
              <Popover
                open={popGrup}
                onOpenChange={(o) => { if (baruBusy) return; if (o) resetFormGrup(); setPopGrup(o); }}
              >
                <PopoverTrigger asChild>
                  <Button id="btn_grup_custom_tambah" type="button" size="sm" className="gap-1.5 px-3 text-xs font-medium">
                    <Plus size={14} /> Grup Santri
                  </Button>
                </PopoverTrigger>
                <PopoverContent id="pop_grup_custom_baru" align="end" className="pointer-events-auto w-72 p-3">
                  <form onSubmit={(e) => void simpanGrupBaru(e)} className="flex flex-col gap-2">
                    <p className="text-sm font-semibold">Grup Baru</p>
                    <p className="text-xs text-muted-foreground">Lingkup: {lingkupBaru}</p>
                    {baruErr !== '' && <p role="alert" className="text-xs text-destructive">{baruErr}</p>}
                    <LabeledInput
                      label="Nama"
                      htmlFor="inp_grup_custom_nama"
                      value={baruNama}
                      onChange={(e) => setBaruNama(e.target.value)}
                      placeholder="mis. Ekskul Matematika"
                    />
                    <LabeledInput
                      label="Keterangan"
                      htmlFor="inp_grup_custom_keterangan"
                      value={baruKet}
                      onChange={(e) => setBaruKet(e.target.value)}
                      placeholder="opsional"
                    />
                    <Button id="btn_grup_custom_simpan" type="submit" size="sm" className="h-[26px]" disabled={baruBusy}>
                      {baruBusy ? 'Menyimpan…' : 'Simpan Grup'}
                    </Button>
                  </form>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr className="text-left">
                  <th className="px-2 py-1 font-medium">Grup</th>
                  <th className="px-2 py-1 font-medium">Keterangan</th>
                  <th className="px-2 py-1 font-medium">Lembaga</th>
                  <th className="px-2 py-1 font-medium">TA</th>
                  <th className="px-2 py-1 font-medium">Status</th>
                  <th className="px-2 py-1"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-2 py-1 text-center text-muted-foreground">Memuat…</td></tr>
                ) : grupTampil.length === 0 ? (
                  <tr><td colSpan={6} className="px-2 py-1 text-center text-muted-foreground">Belum ada grup pada lingkup ini. Buat grup untuk peserta ekskul, binaan khusus, dan sejenisnya.</td></tr>
                ) : grupTampil.map((g) => {
                  const aktif = g.id === grupAktifId;
                  const sedangUbah = g.id === editId;
                  return (
                    <tr
                      key={g.id}
                      id={`row_grup_custom_${g.id}`}
                      onClick={() => setGrupAktifId(g.id)}
                      title="Klik untuk memilih"
                      aria-selected={aktif}
                      className={cn(
                        'cursor-pointer border-t',
                        aktif ? 'bg-accent font-medium' : 'hover:bg-muted/60',
                      )}
                    >
                      {sedangUbah ? (
                        <>
                          <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                            <Input id="inp_grup_custom_ubah_nama" aria-label="Nama grup" className="h-[26px]" value={ubahNama} onChange={(e) => setUbahNama(e.target.value)} />
                          </td>
                          <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                            <Input id="inp_grup_custom_ubah_keterangan" aria-label="Keterangan grup" className="h-[26px]" value={ubahKet} onChange={(e) => setUbahKet(e.target.value)} />
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">{g.jenjang ?? '—'}</td>
                          <td className="px-2 py-1 text-muted-foreground">{g.tahun_ajaran ?? '—'}</td>
                          <td className="px-2 py-1 text-muted-foreground">{g.is_active ? 'Aktif' : 'Nonaktif'}</td>
                          <td className="px-2 py-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <Button id="btn_grup_custom_ubah_simpan" type="button" size="sm" className="h-[26px]" onClick={() => simpanUbah()}>Simpan</Button>
                            <ActionIcon id="btn_grup_custom_ubah_batal" title="Batalkan ubahan" onClick={() => setEditId(null)}>
                              <X size={16} />
                            </ActionIcon>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1">{g.nama}</td>
                          <td className="px-2 py-1 text-muted-foreground">{g.keterangan ?? '—'}</td>
                          <td className="px-2 py-1 text-muted-foreground">{g.jenjang ?? '—'}</td>
                          <td className="px-2 py-1 text-muted-foreground">{g.tahun_ajaran ?? '—'}</td>
                          <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              id={`sw_grup_custom_status_${g.id}`}
                              size="2xs"
                              checked={g.is_active}
                              onCheckedChange={(v) => ubahStatus(g, v)}
                              disabled={!canEdit}
                              aria-label={`Status ${g.nama}`}
                            />
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <EditAction id={`btn_grup_custom_ubah_${g.id}`} onClick={() => mulaiUbah(g)} />
                            <DeleteAction
                              id={`btn_grup_custom_hapus_${g.id}`}
                              title={`Hapus grup ${g.nama}?`}
                              description="Grup dihapus permanen beserta keanggotaannya (tagihan yang sudah dibuat tidak ikut terhapus)."
                              onConfirm={() => hapusGrup(g)}
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>

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
                <ArrowRight size={16} />
              </ActionIcon>
            )}
            renderBulkActions={grupAktif === null ? undefined : (checked, clear) => checked.length === 0 ? null : (
              <Button id="btn_grup_custom_tambah_banyak" size="sm" disabled={busy} onClick={() => { tambahAnggota(checked.map((r) => r.id)); clear(); }}>
                <ArrowRight data-icon="inline-start" size={14} /> Masukkan ({checked.length})
              </Button>
            )}
            pager={<Pager page={page} lastPage={lastPage} total={total} perPage={perPage} onPage={(p) => void muatKandidat(p, perPage, cari)} onPerPage={(pp) => setPerPage(tulisPerPageGlobal(pp))} />}
          />
        </div>
        </div>
      </div>

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
