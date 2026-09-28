import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/client';
import { profilPegawai, type ProfilPegawai } from '@/api/pegawai';
import { ViewDialog, type ViewDialogSection } from '@/components/ViewDialog';
import { formatStatus, namaLembaga, namaTahunAjaran } from '@/lib/nilaiTampil';
import { toast } from 'sonner';

const ymd = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

/** Profil pegawai (baca-saja): identitas Buku Induk + penempatan per lembaga
 *  + riwayat keaktifan per tahun ajaran + akun login tertaut.
 *  Memakai ViewDialog generik dengan seksi tabel relasi. */
export function ProfilPegawaiDialog({ pegawaiId, open, onOpenChange }: {
  pegawaiId: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [profil, setProfil] = useState<ProfilPegawai | null>(null);

  useEffect(() => {
    if (!open || pegawaiId == null) return;
    let batal = false;
    setProfil(null);
    profilPegawai(pegawaiId)
      .then((p) => {
        if (!batal) setProfil(p);
      })
      .catch((e) => {
        if (!batal) toast.error(errorMessage(e));
      });
    return () => {
      batal = true;
    };
  }, [open, pegawaiId]);

  const akun = profil?.akun ?? null;

  const sections: ViewDialogSection[] = profil
    ? [
        {
          title: 'Penempatan lembaga',
          columns: [
            { key: 'lembaga', label: 'Lembaga' },
            { key: 'tugas', label: 'Tugas utama' },
            { key: 'status', label: 'Status' },
            { key: 'mulai', label: 'Masuk' },
            { key: 'selesai', label: 'Keluar' },
            { key: 'no_sk', label: 'No. SK PTK' },
            { key: 'tgl_sk', label: 'Tgl. SK PTK' },
          ],
          rows: profil.penempatan.map((p) => ({
            lembaga: namaLembaga(p.lembaga, p.jenjang) ?? '',
            tugas: p.tugas_utama ?? '',
            status: p.is_active_lembaga,
            mulai: ymd(p.tgl_masuk),
            selesai: ymd(p.tgl_selesai),
            no_sk: p.no_sk_awal_ptk ?? '',
            tgl_sk: ymd(p.tgl_sk_awal_ptk),
          })),
        },
        {
          title: 'Keaktifan per tahun ajaran',
          columns: [
            { key: 'tahun', label: 'Tahun ajaran' },
            { key: 'lembaga', label: 'Lembaga' },
            { key: 'tugas', label: 'Tugas utama' },
            { key: 'status', label: 'Status' },
            { key: 'no_sk', label: 'No. SK' },
            { key: 'tgl_sk', label: 'Tgl. SK' },
          ],
          rows: profil.keaktifan.map((k) => ({
            tahun: namaTahunAjaran(k.tahun_ajaran) ?? '',
            lembaga: namaLembaga(k.lembaga, k.jenjang) ?? '',
            tugas: k.tugas_utama ?? '',
            status: formatStatus(k.status_keaktifan) ?? '',
            no_sk: k.no_sk ?? '',
            tgl_sk: ymd(k.tgl_sk),
          })),
        },
        {
          title: 'Akun login tertaut',
          columns: [
            { key: 'nama', label: 'Nama akun' },
            { key: 'login', label: 'Login' },
            { key: 'telepon', label: 'No. HP' },
            { key: 'peran', label: 'Peran' },
            { key: 'akses', label: 'Akses lembaga' },
          ],
          rows: akun
            ? [{
                nama: akun.name,
                login: akun.email ?? akun.username ?? '',
                telepon: akun.phone ?? '',
                peran: akun.roles.map((r) => formatStatus(r.name) ?? r.name).join(', '),
                akses: akun.lembagas
                  .map((l) => `${l.jenjang}${l.pivot?.role ? ` (${formatStatus(l.pivot.role) ?? l.pivot.role})` : ''}`)
                  .join(', '),
              }]
            : [],
        },
      ]
    : [];

  return (
    <ViewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={profil ? `Profil: ${profil.pegawai.nama_lengkap}` : 'Profil Pegawai'}
      row={profil ? (profil.pegawai as unknown as Record<string, unknown>) : null}
      sections={sections}
    />
  );
}
