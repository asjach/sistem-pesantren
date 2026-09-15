import { useEffect, useState } from 'react';
import { errorMessage } from '@/api/client';
import { profilSantri, type ProfilSantri } from '@/api/siklus';
import { ViewDialog, type ViewDialogSection } from '@/components/ViewDialog';
import { toast } from 'sonner';

const ymd = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

/** Profil santri (baca-saja): identitas + riwayat belajar + mutasi + alumni.
 *  Memakai ViewDialog generik dengan seksi tabel relasi. */
export function ProfilSantriDialog({ santriId, open, onOpenChange }: {
  santriId: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [profil, setProfil] = useState<ProfilSantri | null>(null);

  useEffect(() => {
    if (!open || santriId == null) return;
    let batal = false;
    setProfil(null);
    profilSantri(santriId)
      .then((p) => {
        if (!batal) setProfil(p);
      })
      .catch((e) => {
        if (!batal) toast.error(errorMessage(e));
      });
    return () => {
      batal = true;
    };
  }, [open, santriId]);

  const sections: ViewDialogSection[] = profil
    ? [
        {
          title: 'Keanggotaan lembaga',
          columns: [
            { key: 'lembaga', label: 'Lembaga' },
            { key: 'nis_lokal', label: 'NIS lokal' },
            { key: 'nis_kemenag', label: 'NIS Kemenag' },
            { key: 'mulai', label: 'Mulai' },
            { key: 'selesai', label: 'Selesai' },
            { key: 'aktif', label: 'Aktif' },
          ],
          rows: profil.keanggotaan.map((k) => ({
            lembaga: k.lembaga?.kode ?? k.lembaga?.nama ?? '',
            nis_lokal: k.nis_lokal ?? '',
            nis_kemenag: k.nis_kemenag ?? '',
            mulai: ymd(k.tgl_mulai),
            selesai: ymd(k.tgl_selesai),
            aktif: k.is_active ? 'Ya' : 'Tidak',
          })),
        },
        {
          title: 'Riwayat belajar',
          columns: [
            { key: 'tahun', label: 'Tahun ajaran' },
            { key: 'semester', label: 'Smt' },
            { key: 'tingkat', label: 'Tingkat' },
            { key: 'lembaga', label: 'Lembaga' },
            { key: 'kelas', label: 'Kelas' },
            { key: 'status_awal', label: 'Awal' },
            { key: 'status_akhir', label: 'Akhir' },
            { key: 'aktif', label: 'Aktif' },
          ],
          rows: profil.riwayat.map((r) => ({
            tahun: r.tahun_ajaran?.nama ?? '',
            semester: r.semester,
            tingkat: r.tingkat ?? '',
            lembaga: r.lembaga?.kode ?? r.lembaga?.nama ?? '',
            kelas: r.kelas?.nama_kelas ?? '',
            status_awal: r.status_awal ?? '',
            status_akhir: r.status_akhir ?? '',
            aktif: r.is_aktif ? 'Ya' : 'Tidak',
          })),
        },
        {
          title: 'Mutasi keluar',
          columns: [
            { key: 'lembaga', label: 'Lembaga' },
            { key: 'kelas', label: 'Kelas terakhir' },
            { key: 'tanggal', label: 'Tanggal' },
            { key: 'alasan', label: 'Alasan' },
            { key: 'tujuan', label: 'Tujuan' },
          ],
          rows: profil.mutasi.map((m) => ({
            lembaga: m.lembaga?.kode ?? m.lembaga?.nama ?? '',
            kelas: m.kelas_terakhir?.nama_kelas ?? '',
            tanggal: ymd(m.tanggal_mutasi),
            alasan: m.alasan_mutasi ?? '',
            tujuan: m.nama_sekolah_tujuan ?? '',
          })),
        },
        {
          title: 'Alumni',
          columns: [
            { key: 'lembaga', label: 'Lembaga lulus' },
            { key: 'ta', label: 'Tahun lulus' },
            { key: 'ijazah', label: 'No. ijazah' },
            { key: 'tanggal', label: 'Tanggal lulus' },
            { key: 'penyerahan', label: 'Ijazah' },
          ],
          rows: profil.alumni.map((a) => ({
            lembaga: a.lembaga_lulus?.kode ?? a.lembaga_lulus?.nama ?? '',
            ta: a.tahun_ajaran_lulus?.nama ?? '',
            ijazah: a.nomor_ijazah ?? '',
            tanggal: ymd(a.tanggal_lulus),
            penyerahan: a.penyerahan_ijazah ?? '',
          })),
        },
      ]
    : [];

  return (
    <ViewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={profil ? `Profil: ${profil.santri.nama_lengkap}` : 'Profil Santri'}
      row={profil ? (profil.santri as unknown as Record<string, unknown>) : null}
      sections={sections}
    />
  );
}
