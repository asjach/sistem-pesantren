import { useState } from 'react';
import {
  listAkunPegawai,
  type AkunPegawai,
} from '../api/pegawai';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';

const FIELDS: ExcelField[] = [
  { key: 'nama', label: 'pegawai.nama_lengkap', width: 220, kind: 'static' },
  { key: 'nipp', label: 'pegawai.nipp', width: 130, kind: 'static' },
  { key: 'email_pegawai', label: 'pegawai.email_pribadi', width: 220, kind: 'static' },
  { key: 'hp_pegawai', label: 'pegawai.no_hp', width: 150, kind: 'static' },
  { key: 'login', label: 'Login Akun', width: 220, kind: 'static',  },
];

function nilaiBaris(r: AkunPegawai): Record<string, string | null> {
  const akun = r.akun;
  return {
    nama: r.nama_lengkap,
    nipp: r.nipp,
    email_pegawai: r.email_pribadi,
    hp_pegawai: r.no_hp,
    login: akun ? ([akun.email, akun.username, akun.phone].find((v) => v) ?? '—') : '—',
  };
}

/** Halaman Akun Pegawai: guru yang sudah memiliki akun beserta info akunnya (baca-saja). */
export default function AkunPegawaiPage() {
  const [cari, setCari] = useState('');
  const { jenjangs } = useFilterGlobalAktif();

  const { rows, loading, err, urut, arahUrut, terapkanUrut, load, lastPage, total, pager, onSaved } =
    useDaftarTabel<AkunPegawai>({
      tableKey: 'pegawai_akun',
      search: cari,
      ambil: (a) => listAkunPegawai({
        q: a.search || undefined,
        jenjang: jenjangs,
        sort: a.urut.length ? a.urut : undefined,
        arah: a.urut.length ? a.arah : undefined,
        page: a.page,
        per_page: a.perPage,
        signal: a.signal,
      }),
      deps: [jenjangs],
    });

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tampil={{}} tabel={[{ key: 'pegawai_akun', judul: 'Akun Pegawai', fields: FIELDS }]} />
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / NIPP / email / no. HP / username…" />
      <ExcelTable
        tableKey="pegawai_akun"
        sumberTabel="pegawai"
        fields={FIELDS}
        rows={rows}
        getValues={nilaiBaris}
        loading={loading}
        emptyText="Belum ada guru yang memiliki akun."
        canEdit={false}
        onCommit={async () => {}}
        onSaved={onSaved}
        urutAktif={urut}
        arahUrut={arahUrut}
        onUrut={terapkanUrut}
        renderActions={() => <></>}
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
