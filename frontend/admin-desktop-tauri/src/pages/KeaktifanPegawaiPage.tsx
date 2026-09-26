import { useCallback, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  aktifkanMassalKeaktifan,
  listKeaktifanPegawai,
  nonaktifkanKeaktifan,
  type KeaktifanPegawai,
} from '../api/pegawai';
import { Button } from '@/components/ui/button';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { targetTunggal, useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import CatatanProsesTahunAjaran from '@/components/CatatanProsesTahunAjaran';
import { ActionIcon } from '@/components/RowActions';
import { X } from '@/icons';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { toast } from 'sonner';

const FIELDS: ExcelField[] = [
  { key: 'nama', label: 'pegawai.nama_lengkap', width: 220, kind: 'static', sumber: { tabel: 'pegawai', kolom: 'nama_lengkap' } },
  { key: 'lembaga', label: 'lembaga.jenjang', width: 100, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
  { key: 'ta', label: 'tahun_ajaran.nama', width: 130, kind: 'static', sumber: { tabel: 'tahun_ajaran', kolom: 'nama' } },
  { key: 'tugas', label: 'Tugas', width: 180, kind: 'static', sumber: { tabel: 'keaktifan_pegawai', kolom: 'tugas_utama' } },
  { key: 'status', label: 'Status', width: 110, kind: 'static', sumber: { tabel: 'keaktifan_pegawai', kolom: 'status_keaktifan' } },
];

function nilaiBaris(r: KeaktifanPegawai): Record<string, string | null> {
  return {
    nama: r.pegawai?.nama_lengkap ?? '—',
    lembaga: r.lembaga?.jenjang ?? r.jenjang,
    ta: r.tahun_ajaran,
    tugas: r.tugas_utama,
    status: r.status_keaktifan,
  };
}

/** Halaman Keaktifan Pegawai: daftar guru aktif per lembaga + tahun ajaran. */
export default function KeaktifanPegawaiPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'pegawai.ubah');
  const { jenjangs, tahunAjaranNames } = useFilterGlobalAktif();
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('');
  const taTunggal = targetTunggal(tahunAjaranNames);
  const jenjangTunggal = targetTunggal(jenjangs);

  const { rows, loading, err, urut, arahUrut, terapkanUrut, load, lastPage, total, pager, onSaved } =
    useDaftarTabel<KeaktifanPegawai>({
      tableKey: 'pegawai_keaktifan',
      search: cari,
      ambil: (a) => {
        if (!taTunggal) {
          return Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: a.perPage, total: 0 });
        }
        return listKeaktifanPegawai({
          jenjang: jenjangs,
          tahun_ajaran: tahunAjaranNames,
          status_keaktifan: status || undefined,
          q: a.search || undefined,
          sort: a.urut.length ? a.urut : undefined,
          arah: a.urut.length ? a.arah : undefined,
          page: a.page,
          per_page: a.perPage,
          signal: a.signal,
        });
      },
      deps: [jenjangs, tahunAjaranNames, status],
    });

  const onAktifkanMassal = useCallback(async () => {
    if (!jenjangTunggal || !taTunggal) {
      toast.error('Pilih satu lembaga dan satu tahun ajaran di filter.');
      return;
    }
    try {
      const res = await aktifkanMassalKeaktifan({ jenjang: jenjangTunggal, tahun_ajaran: taTunggal });
      toast.success(res.pesan);
      pager.goFirst();
      await load(1);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [jenjangTunggal, taTunggal, pager, load]);

  const onNonaktif = useCallback(async (r: KeaktifanPegawai) => {
    try {
      await nonaktifkanKeaktifan(r.id);
      toast.success('Keaktifan dinonaktifkan.');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [load]);

  const renderActions = useCallback((r: KeaktifanPegawai) => (
    <>
      {canUbah && r.status_keaktifan === 'aktif' && (
        <ActionIcon
          id={`btn_nonaktif_keaktifan_${r.id}`}
          title="Nonaktifkan"
          aria-label={`Nonaktifkan ${r.pegawai?.nama_lengkap}`}
          onClick={() => void onNonaktif(r)}
        >
          <X size={16} />
        </ActionIcon>
      )}
    </>
  ), [canUbah, onNonaktif]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tampil={{ semester: false, tingkat: false }} tabel={[{ key: 'pegawai_keaktifan', judul: 'Keaktifan', fields: FIELDS }]} />
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / NIP / NIPP…" />
      {!taTunggal && <CatatanProsesTahunAjaran />}
      <ExcelTable
        tableKey="pegawai_keaktifan"
        sumberTabel="keaktifan_pegawai"
        fields={FIELDS}
        rows={rows}
        getValues={nilaiBaris}
        loading={loading}
        emptyText={taTunggal ? 'Belum ada guru aktif di TA ini.' : 'Pilih satu tahun ajaran di filter.'}
        canEdit={false}
        onCommit={async () => {}}
        onSaved={onSaved}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        addButton={canUbah ? (
          <Button id="btn_aktifkan_massal_keaktifan" variant="outline" disabled={!jenjangTunggal || !taTunggal} onClick={() => void onAktifkanMassal()}>
            Aktifkan penempatan untuk TA ini
          </Button>
        ) : undefined}
        renderActions={renderActions}
      />
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />
    </div>
  );
}
