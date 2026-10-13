import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  buatGrupCustom, daftarGrupCustom, hapusAnggotaGrup, hapusGrupCustom,
  tambahAnggotaGrup, ubahGrupCustom, type AnggotaGrupCustom, type GrupSantriCustom,
} from '../../api/grupCustom';
import { listKelas, listLembaga, listTahunAjaran } from '../../api/master';
import { listSantri, type Santri } from '../../api/santri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { ActionIcon, DeleteAction } from '@/components/RowActions';
import { ErrorNotice } from '@/components/PageHeader';
import LabeledCombobox from '@/components/LabeledCombobox';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import { bacaPerPageGlobal, tulisPerPageGlobal } from '@/hooks/usePager';
import type { PerPage } from '@/prefs';
import { Plus, Search, Users, X } from '@/icons';

const FIELDS_GRUP: ExcelField[] = [
  { key: 'nama', label: 'Grup', kind: 'text', required: true, width: 180 },
  { key: 'keterangan', label: 'Keterangan', kind: 'text', width: 200 },
  { key: 'jenjang', label: 'Lembaga', kind: 'static', inputKind: 'select', width: 90 },
  { key: 'tahun_ajaran', label: 'TA', kind: 'static', inputKind: 'select', width: 110 },
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

interface Opsi { label: string; nilai: string }

/** Combobox filter ringkas (label + daftar opsi ber-nilai string). */
function Pilihan({ id, label, opsi, nilai, onPilih, placeholder }: {
  id: string; label: string; opsi: Opsi[]; nilai: string;
  onPilih: (nilai: string) => void; placeholder?: string;
}) {
  return (
    <LabeledCombobox label={label} htmlFor={id} tinggi={26} kelolaLebar={false} className="min-w-0 flex-1">
      <ComboboxRoot
        items={opsi}
        itemToStringLabel={(o) => o.label}
        isItemEqualToValue={(a, b) => a.nilai === b.nilai}
        value={opsi.find((o) => o.nilai === nilai) ?? null}
        onValueChange={(o) => { if (o !== null) onPilih(o.nilai); }}
      >
        <ComboboxInput id={id} aria-label={label} placeholder={placeholder ?? `Pilih ${label.toLowerCase()}…`} />
        <ComboboxTrigger aria-label={`Buka daftar ${label.toLowerCase()}`} />
        <ComboboxContent>
          <ComboboxEmpty>Belum ada pilihan.</ComboboxEmpty>
          <ComboboxList>
            {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxRoot>
    </LabeledCombobox>
  );
}

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

const OPSI_SEMESTER: Opsi[] = [
  { label: 'Semua semester', nilai: '' },
  { label: 'Ganjil (1)', nilai: '1' },
  { label: 'Genap (2)', nilai: '2' },
];

/** Tab Santri Custom: grup bentukan manual (kiri: tabel grup + daftar santri,
 *  kanan: pivot anggota grup terpilih). Mandiri (datanya sendiri) karena tidak
 *  tergantung filter halaman; izin mengikuti pola tab lain (`keuangan.ubah` =
 *  edit, `keuangan.tambah` = baris input). */
export default function SantriCustomTab({ canEdit, canTambah }: {
  /** Gerbang izin `keuangan.ubah`: menyalakan mode Edit + toggle Status. */
  canEdit: boolean;
  /** Gerbang izin `keuangan.tambah`: menyalakan baris input grup baru. */
  canTambah: boolean;
}) {
  const [grup, setGrup] = useState<GrupSantriCustom[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  /** Grup yang anggotanya tampil di panel kanan (id). */
  const [grupAktifId, setGrupAktifId] = useState<number | null>(null);
  /** Lebar panel kiri (px); gagang di tengah bisa menggesernya. */
  const [lebarKiri, setLebarKiri] = useState(500);
  const geserRef = useRef<{ x: number; w: number } | null>(null);

  /** Filter tabel grup. */
  const [fJenjang, setFJenjang] = useState('');
  const [fTA, setFTA] = useState('');
  /** Filter daftar santri. */
  const [sJenjang, setSJenjang] = useState('');
  const [sTA, setSTA] = useState('');
  const [sSemester, setSSemester] = useState('');
  const [sTingkat, setSTingkat] = useState('');
  const [sKelas, setSKelas] = useState('');
  const [cari, setCari] = useState('');

  const [lembagaOpsi, setLembagaOpsi] = useState<Opsi[]>([]);
  const [taOpsi, setTaOpsi] = useState<Opsi[]>([]);
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

  const tingkatOpsi: Opsi[] = [
    { label: 'Semua tingkat', nilai: '' },
    ...[...new Set(kelasOpsi.map((k) => k.tingkat).filter((t): t is string => t !== null && t !== ''))]
      .sort().map((t) => ({ label: `Tingkat ${t}`, nilai: t })),
  ];
  const opsiKelas: Opsi[] = [
    { label: 'Semua kelas', nilai: '' },
    ...kelasOpsi
      .filter((k) => sTingkat === '' || k.tingkat === sTingkat)
      .map((k) => ({ label: k.nama_kelas, nilai: String(k.id) })),
  ];

  // Opsi master (lembaga, TA) sekali saat tab dibuka.
  useEffect(() => {
    let hidup = true;
    void (async () => {
      try {
        const [lem, tas] = await Promise.all([
          listLembaga({ per_page: 100 }),
          listTahunAjaran({ per_page: 100 }),
        ]);
        if (!hidup) return;
        setLembagaOpsi([
          { label: 'Semua lembaga', nilai: '' },
          ...lem.data.map((l) => ({ label: `${l.jenjang} — ${l.nama}`, nilai: l.jenjang })),
        ]);
        setTaOpsi([
          { label: 'Semua tahun ajaran', nilai: '' },
          ...tas.data.map((t) => ({ label: t.nama, nilai: t.nama })),
        ]);
      } catch (e) { if (hidup) setErr(errorMessage(e)); }
    })();
    return () => { hidup = false; };
  }, []);

  const muatGrup = useCallback(async (jenjang: string, ta: string) => {
    setErr('');
    setLoading(true);
    try {
      const daftar = await daftarGrupCustom({
        jenjang: jenjang === '' ? undefined : jenjang,
        tahun_ajaran: ta === '' ? undefined : ta,
      });
      setGrup(daftar);
      setGrupAktifId((id) => (id !== null && daftar.some((g) => g.id === id) ? id : null));
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void muatGrup(fJenjang, fTA); }, [muatGrup, fJenjang, fTA]);
  useEffect(() => { void bacaPerPageGlobal().then((pp) => setPerPage(pp)); }, []);

  // Opsi kelas mengikuti filter jenjang + TA santri.
  useEffect(() => {
    let hidup = true;
    setSKelas('');
    void (async () => {
      try {
        const res = await listKelas({
          jenjang: sJenjang === '' ? undefined : sJenjang,
          tahun_ajaran: sTA === '' ? undefined : sTA,
          per_page: 100,
        });
        if (hidup) setKelasOpsi(res.data);
      } catch (e) { if (hidup) setErr(errorMessage(e)); }
    })();
    return () => { hidup = false; };
  }, [sJenjang, sTA]);

  const muatKandidat = useCallback(async (
    p: number, pp: number, f: { jenjang: string; ta: string; semester: string; tingkat: string; kelas: string; q: string },
  ) => {
    setLoadingKandidat(true);
    try {
      const res = await listSantri({
        jenjang: f.jenjang === '' ? undefined : f.jenjang,
        tahun_ajaran: f.ta === '' ? undefined : f.ta,
        semester: f.semester === '' ? undefined : f.semester,
        tingkat: f.tingkat === '' ? undefined : f.tingkat,
        kelas_id: f.kelas === '' ? undefined : Number(f.kelas),
        q: f.q === '' ? undefined : f.q,
        page: p, per_page: pp,
      });
      setKandidat(res.data);
      setPage(res.current_page);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoadingKandidat(false); }
  }, []);

  // Filter/pencarian santri berubah → muat ulang dari halaman 1 (tahan 250ms).
  useEffect(() => {
    setPage(1);
    const t = setTimeout(() => {
      void muatKandidat(1, perPage, { jenjang: sJenjang, ta: sTA, semester: sSemester, tingkat: sTingkat, kelas: sKelas, q: cari });
    }, 250);
    return () => clearTimeout(t);
  }, [sJenjang, sTA, sSemester, sTingkat, sKelas, cari, perPage, muatKandidat]);

  const tambahAnggota = async (ids: number[]) => {
    if (grupAktif === null || ids.length === 0) return;
    setBusy(true);
    try {
      await tambahAnggotaGrup(grupAktif.id, ids);
      toast.success(`${ids.length} santri masuk grup ${grupAktif.nama}.`);
      await muatGrup(fJenjang, fTA);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const keluarkanAnggota = async (ids: number[]) => {
    if (grupAktif === null || ids.length === 0) return;
    setBusy(true);
    try {
      for (const id of ids) await hapusAnggotaGrup(grupAktif.id, id);
      toast.success(`${ids.length} santri keluar dari grup ${grupAktif.nama}.`);
      await muatGrup(fJenjang, fTA);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const hapusGrup = async (g: GrupSantriCustom) => {
    try {
      await hapusGrupCustom(g.id);
      toast.success('Grup dihapus.');
      await muatGrup(fJenjang, fTA);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  /** Payload buat/ubah grup: nama wajib; lingkup mengikuti filter (buat) atau
   *  baris (ubah); duplikat ditolak server. */
  const payloadGrup = (
    baris: Partial<GrupSantriCustom>,
    f: Record<string, string | null>,
    lingkupBawaan: { jenjang: string | null; tahun_ajaran: string | null },
  ): { nama: string; keterangan: string | null; jenjang: string | null; tahun_ajaran: string | null; is_active: boolean } => {
    const nama = (f.nama ?? baris.nama ?? '').trim();
    if (nama === '') throw new Error('Nama grup wajib diisi.');
    const keterangan = (f.keterangan ?? baris.keterangan ?? '').trim();
    return {
      nama,
      keterangan: keterangan === '' ? null : keterangan,
      jenjang: f.jenjang ?? baris.jenjang ?? lingkupBawaan.jenjang,
      tahun_ajaran: f.tahun_ajaran ?? baris.tahun_ajaran ?? lingkupBawaan.tahun_ajaran,
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

  return (
    <div className="flex min-h-0 flex-1">
      {/* Kiri (bawaan 500px, bisa digeser): tabel grup + daftar santri. */}
      <div style={{ width: lebarKiri }} className="flex min-h-0 shrink-0 flex-col gap-2">
        <div className="flex gap-1">
          <Pilihan id="sel_grup_custom_lembaga" label="Lembaga" opsi={lembagaOpsi} nilai={fJenjang} onPilih={setFJenjang} />
          <Pilihan id="sel_grup_custom_ta" label="Tahun Ajaran" opsi={taOpsi} nilai={fTA} onPilih={setFTA} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <ExcelTable<GrupSantriCustom & { id: number }>
            tableKey="keuangan_grup_custom"
            header={(
              <span id="judul_grup_custom" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
                Grup Santri Custom ({grup.length})
              </span>
            )}
            fields={fieldsGrup(lembagaOpsi, taOpsi)}
            rows={grup}
            getValues={(g) => ({
              nama: g.nama,
              keterangan: g.keterangan,
              jenjang: g.jenjang,
              tahun_ajaran: g.tahun_ajaran,
              status: g.is_active ? 'ya' : 'tidak',
            })}
            loading={loading}
            emptyText="Belum ada grup. Buat grup untuk peserta ekskul, binaan khusus, dan sejenisnya."
            canEdit={canEdit}
            onCommit={async (id, f) => {
              const baris = grup.find((g) => g.id === id);
              if (!baris) return;
              await ubahGrupCustom(id, payloadGrup(baris, f, { jenjang: null, tahun_ajaran: null }));
              await muatGrup(fJenjang, fTA);
            }}
            onSaved={() => {}}
            onCreateRow={canTambah ? async (f) => {
              await buatGrupCustom(payloadGrup(
                {}, f,
                { jenjang: fJenjang === '' ? null : fJenjang, tahun_ajaran: fTA === '' ? null : fTA },
              ));
              await muatGrup(fJenjang, fTA);
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
        <div className="grid grid-cols-3 gap-1">
          <Pilihan id="sel_sc_lembaga" label="Lembaga" opsi={lembagaOpsi} nilai={sJenjang} onPilih={setSJenjang} />
          <Pilihan id="sel_sc_ta" label="Tahun Ajaran" opsi={taOpsi} nilai={sTA} onPilih={setSTA} />
          <Pilihan id="sel_sc_semester" label="Semester" opsi={OPSI_SEMESTER} nilai={sSemester} onPilih={setSSemester} />
          <Pilihan id="sel_sc_tingkat" label="Tingkat" opsi={tingkatOpsi} nilai={sTingkat} onPilih={setSTingkat} />
          <Pilihan id="sel_sc_kelas" label="Kelas" opsi={opsiKelas} nilai={sKelas} onPilih={setSKelas} />
          <div className="relative min-w-0 flex-1 self-end">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="inp_grup_custom_cari" aria-label="Cari santri" placeholder="Cari nama / NIS…"
              className="h-[26px] w-full pl-8" value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <ExcelTable<Santri>
            tableKey="grup_custom_kandidat"
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
            pager={<Pager page={page} lastPage={lastPage} total={total} perPage={perPage} onPage={(p) => void muatKandidat(p, perPage, { jenjang: sJenjang, ta: sTA, semester: sSemester, tingkat: sTingkat, kelas: sKelas, q: cari })} onPerPage={(pp) => setPerPage(tulisPerPageGlobal(pp))} />}
          />
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

/** Kolom tabel grup: lingkup (lembaga/TA) baca-saja di grid, dipilih lewat
 *  dropdown pada baris input (cermin kolom kunci Tarif). */
function fieldsGrup(lembaga: Opsi[], tas: Opsi[]): ExcelField[] {
  return [
    { key: 'nama', label: 'Grup', kind: 'text', required: true, width: 180 },
    { key: 'keterangan', label: 'Keterangan', kind: 'text', width: 200 },
    {
      key: 'jenjang', label: 'Lembaga', kind: 'static', inputKind: 'select', width: 110,
      inputChoices: [{ value: '', label: 'Semua lembaga' }, ...lembaga.filter((l) => l.nilai !== '').map((l) => ({ value: l.nilai, label: l.label }))],
    },
    {
      key: 'tahun_ajaran', label: 'TA', kind: 'static', inputKind: 'select', width: 120,
      inputChoices: [{ value: '', label: 'Semua TA' }, ...tas.filter((t) => t.nilai !== '').map((t) => ({ value: t.nilai, label: t.label }))],
    },
    { key: 'status', label: 'Status', kind: 'toggle', width: 80 },
  ];
}
