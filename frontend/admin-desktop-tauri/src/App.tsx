import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { bisa } from './api/auth';
import { useLembagaAktif } from './lembagaAktif';
import { LembagaAktifProvider } from './lembagaAktif';
import { TahunAjaranAktifProvider } from './tahunAjaranAktif';
import { SemesterAktifProvider } from './semesterAktif';
import { TingkatAktifProvider } from './tingkatAktif';
import { KelasAktifProvider } from './kelasAktif';
import { ThemeProvider } from './theme';
import Layout from './components/Layout';
import CommandPalette from './components/CommandPalette';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import HalamanTabs, { ArahHalamanTabs } from './components/HalamanTabs';
import { HALAMAN_AKADEMIK, HALAMAN_DATA_INDUK, HALAMAN_PENEMPATAN, HALAMAN_PENEMPATAN_PEGAWAI, HALAMAN_SANTRI_AKTIF, halamanDariPath } from './lib/halaman';
import { DENSITY_PX, bacaPrefsSinkron } from './prefs';
import { TabelMemuat } from './components/excel/primitives';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

const UsersPage = lazy(() => import('./pages/UsersPage'));
const LembagaPage = lazy(() => import('./pages/LembagaPage'));
const ReferensiPage = lazy(() => import('./pages/ReferensiPage'));
const TahunAjaranPage = lazy(() => import('./pages/TahunAjaranPage'));
const SemesterPage = lazy(() => import('./pages/SemesterPage'));
const KelasPage = lazy(() => import('./pages/KelasPage'));
const PengaturanServerPage = lazy(() => import('./pages/PengaturanServerPage'));
const PsbPage = lazy(() => import('./pages/PsbPage'));
const KegiatanPsbPage = lazy(() => import('./pages/KegiatanPsbPage'));
const SantriPage = lazy(() => import('./pages/SantriPage'));
const ProfilSantriPage = lazy(() => import('./pages/ProfilSantriPage'));
const PegawaiPage = lazy(() => import('./pages/PegawaiPage'));
const LembagaPegawaiPage = lazy(() => import('./pages/LembagaPegawaiPage'));
const AkunPegawaiPage = lazy(() => import('./pages/AkunPegawaiPage'));
const KeaktifanPegawaiPage = lazy(() => import('./pages/KeaktifanPegawaiPage'));
const KeanggotaanPage = lazy(() => import('./pages/KeanggotaanPage'));
const RiwayatBelajarPage = lazy(() => import('./pages/RiwayatBelajarPage'));
const DaftarKelasPage = lazy(() => import('./pages/DaftarKelasPage'));
const PindahKelasPage = lazy(() => import('./pages/PindahKelasPage'));
const KenaikanKelasPage = lazy(() => import('./pages/KenaikanKelasPage'));
const KelulusanPage = lazy(() => import('./pages/KelulusanPage'));
const MiMdPage = lazy(() => import('./pages/MiMdPage'));
const RekapSantriPage = lazy(() => import('./pages/RekapSantriPage'));
const KeuanganPage = lazy(() => import('./pages/KeuanganPage'));
const PembayaranPage = lazy(() => import('./pages/PembayaranPage'));
const DispensasiPage = lazy(() => import('./pages/DispensasiPage'));
const PenilaianMasterPage = lazy(() => import('./pages/PenilaianMasterPage'));
const PenilaianImporPage = lazy(() => import('./pages/PenilaianImporPage'));
const PenilaianLegerPage = lazy(() => import('./pages/PenilaianLegerPage'));
const PenilaianRaporPage = lazy(() => import('./pages/PenilaianRaporPage'));
const KurikulumMapelPage = lazy(() => import('./pages/KurikulumMapelPage'));
const KurikulumPengampuPage = lazy(() => import('./pages/KurikulumPengampuPage'));
const KurikulumJadwalPage = lazy(() => import('./pages/KurikulumJadwalPage'));
const MutasiKeluarPage = lazy(() => import('./pages/MutasiKeluarPage'));
const PengajuanBiodataPage = lazy(() => import('./pages/PengajuanBiodataPage'));
const DaftarDokumenSantriPage = lazy(() => import('./pages/DaftarDokumenSantriPage'));
const DokumenSantriPage = lazy(() => import('./pages/DokumenSantriPage'));
const DaftarDokumenPegawaiPage = lazy(() => import('./pages/DaftarDokumenPegawaiPage'));
const DokumenPegawaiPage = lazy(() => import('./pages/DokumenPegawaiPage'));
const DokumenMadrasahPage = lazy(() => import('./pages/DokumenMadrasahPage'));
const KelolaIzinPage = lazy(() => import('./pages/KelolaIzinPage'));
const KomponenPage = lazy(() => import('./pages/KomponenPage'));
const PapanContohPage = lazy(() => import('./pages/PapanContohPage'));

function Shell() {

  const lokasi = useLocation();
  return (
    <ProtectedRoute>
      <Layout>
        <ErrorBoundary key={lokasi.pathname}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </ProtectedRoute>
  );
}

/** Batasi halaman ke satu izin matriks; tanpa izin dialihkan ke beranda.
 *  Saat bertindak sebagai lembaga, izin khusus super_admin dianggap nonaktif. */
const IZIN_TERKUNCI = new Set(['izin.lihat', 'server.lihat']);

function KhususIzin({ izin, children }: { izin: string; children: ReactNode }) {
  const { user } = useAuth();
  const { bertindak } = useLembagaAktif();
  if (!bisa(user, izin) || (bertindak && IZIN_TERKUNCI.has(izin))) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Kerangka halaman saat chunk-nya masih dimuat. Halaman bertabel memakai
 *  kerangka BERBENTUK TABEL (judul + baris) sehingga transisi ke grid mulus —
 *  bukan blok besar yang tampak "melompat" saat tabel muncul. */
function PageFallback() {
  const halaman = halamanDariPath(window.location.pathname);
  const rowH = DENSITY_PX[bacaPrefsSinkron()?.density ?? 'sedang'];
  if (halaman?.grid) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-8 shrink-0 items-center border-b border-border px-3">
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="min-h-0 flex-1">
          <TabelMemuat rowH={rowH} baris={16} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="min-h-[280px] w-full flex-1" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LembagaAktifProvider>
        <TahunAjaranAktifProvider>
          <SemesterAktifProvider>
          <TingkatAktifProvider>
          <KelasAktifProvider>
            <ThemeProvider>
              <BrowserRouter>
                  <Toaster richColors position="bottom-center" />
                  <CommandPalette />
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route element={<Shell />}>
                      <Route path="/" element={<KhususIzin izin="dashboard.lihat"><DashboardPage /></KhususIzin>} />
                      <Route path="/contoh-papan" element={<KhususIzin izin="dashboard.lihat"><PapanContohPage /></KhususIzin>} />

                      <Route path="/data-induk" element={<ArahHalamanTabs def={HALAMAN_DATA_INDUK} />} />
                      <Route element={<HalamanTabs def={HALAMAN_DATA_INDUK} />}>
                        <Route path="/users" element={<KhususIzin izin="pengguna.lihat"><UsersPage /></KhususIzin>} />
                        <Route path="/lembaga" element={<KhususIzin izin="lembaga.lihat"><LembagaPage /></KhususIzin>} />
                        <Route path="/tahun-ajaran" element={<KhususIzin izin="tahun_ajaran.lihat"><TahunAjaranPage /></KhususIzin>} />
                        <Route path="/pengaturan/semester" element={<KhususIzin izin="semester.aktivasi"><SemesterPage /></KhususIzin>} />
                        <Route path="/kelas" element={<KhususIzin izin="kelas.lihat"><KelasPage /></KhususIzin>} />
                        <Route path="/santri" element={<KhususIzin izin="santri.lihat"><SantriPage /></KhususIzin>} />
                        <Route path="/referensi" element={<KhususIzin izin="referensi.lihat"><ReferensiPage /></KhususIzin>} />
                      </Route>
                      <Route path="/psb" element={<Navigate to="/psb/pendaftar" replace />} />
                      <Route path="/psb/:tahap" element={<KhususIzin izin="psb.lihat"><PsbPage /></KhususIzin>} />
                      <Route path="/kegiatan-psb" element={<KhususIzin izin="kegiatan_psb.lihat"><KegiatanPsbPage /></KhususIzin>} />

                      <Route path="/penempatan-pegawai" element={<ArahHalamanTabs def={HALAMAN_PENEMPATAN_PEGAWAI} />} />
                      <Route element={<HalamanTabs def={HALAMAN_PENEMPATAN_PEGAWAI} />}>
                        <Route path="/pegawai" element={<KhususIzin izin="pegawai.lihat"><PegawaiPage /></KhususIzin>} />
                        <Route path="/pegawai-penempatan" element={<KhususIzin izin="pegawai.lihat"><LembagaPegawaiPage /></KhususIzin>} />
                        <Route path="/pegawai-akun" element={<KhususIzin izin="pegawai.lihat"><AkunPegawaiPage /></KhususIzin>} />
                      </Route>
                      <Route path="/pegawai-keaktifan" element={<KhususIzin izin="pegawai.lihat"><KeaktifanPegawaiPage /></KhususIzin>} />

                      <Route path="/penempatan" element={<ArahHalamanTabs def={HALAMAN_PENEMPATAN} />} />
                      <Route element={<HalamanTabs def={HALAMAN_PENEMPATAN} />}>
                        <Route path="/keanggotaan" element={<KhususIzin izin="santri.lihat"><KeanggotaanPage /></KhususIzin>} />
                        <Route path="/mi-md" element={<KhususIzin izin="rekap_santri.lihat"><MiMdPage /></KhususIzin>} />
                        <Route path="/riwayat-belajar" element={<KhususIzin izin="riwayat_belajar.lihat"><RiwayatBelajarPage /></KhususIzin>} />
                      </Route>
                      <Route path="/pindah-semester" element={<Navigate to="/riwayat-belajar" replace />} />

                      <Route path="/santri-aktif" element={<ArahHalamanTabs def={HALAMAN_SANTRI_AKTIF} />} />
                      <Route element={<HalamanTabs def={HALAMAN_SANTRI_AKTIF} />}>
                        <Route path="/daftar-kelas" element={<KhususIzin izin="daftar_kelas.lihat"><DaftarKelasPage /></KhususIzin>} />
                        <Route path="/rekap-santri" element={<KhususIzin izin="rekap_santri.lihat"><RekapSantriPage /></KhususIzin>} />
                        <Route path="/pengajuan-biodata" element={<KhususIzin izin="pengajuan_biodata.lihat"><PengajuanBiodataPage /></KhususIzin>} />
                      </Route>

                      <Route path="/akademik" element={<ArahHalamanTabs def={HALAMAN_AKADEMIK} />} />
                      <Route element={<HalamanTabs def={HALAMAN_AKADEMIK} />}>
                        <Route path="/pindah-kelas" element={<KhususIzin izin="pindah_kelas.lihat"><PindahKelasPage /></KhususIzin>} />
                        <Route path="/mutasi-keluar" element={<KhususIzin izin="mutasi_keluar.lihat"><MutasiKeluarPage /></KhususIzin>} />
                        <Route path="/kenaikan" element={<KhususIzin izin="kenaikan.lihat"><KenaikanKelasPage /></KhususIzin>} />
                        <Route path="/kelulusan" element={<KhususIzin izin="kelulusan.lihat"><KelulusanPage /></KhususIzin>} />
                      </Route>
                      <Route path="/keuangan" element={<KhususIzin izin="keuangan.lihat"><KeuanganPage /></KhususIzin>} />
                      <Route path="/keuangan/dispensasi" element={<KhususIzin izin="keuangan.lihat"><DispensasiPage /></KhususIzin>} />
                      <Route path="/pembayaran" element={<KhususIzin izin="keuangan.lihat"><PembayaranPage /></KhususIzin>} />

                      <Route path="/penilaian/master" element={<KhususIzin izin="penilaian.lihat"><PenilaianMasterPage /></KhususIzin>} />
                      <Route path="/penilaian/impor" element={<KhususIzin izin="penilaian.lihat"><PenilaianImporPage /></KhususIzin>} />
                      <Route path="/penilaian/leger" element={<KhususIzin izin="penilaian.lihat"><PenilaianLegerPage /></KhususIzin>} />
                      <Route path="/penilaian/rapor" element={<KhususIzin izin="penilaian.lihat"><PenilaianRaporPage /></KhususIzin>} />

                      <Route path="/kurikulum/mapel" element={<KhususIzin izin="kurikulum.lihat"><KurikulumMapelPage /></KhususIzin>} />
                      <Route path="/kurikulum/pengampu" element={<KhususIzin izin="kurikulum.lihat"><KurikulumPengampuPage /></KhususIzin>} />
                      <Route path="/kurikulum/jadwal" element={<KhususIzin izin="kurikulum.lihat"><KurikulumJadwalPage /></KhususIzin>} />
                      <Route path="/siklus" element={<Navigate to="/riwayat-belajar" replace />} />
                      <Route path="/dokumen-santri" element={<KhususIzin izin="dokumen_santri.lihat"><DaftarDokumenSantriPage /></KhususIzin>} />
                      <Route path="/dokumen-santri/lihat" element={<KhususIzin izin="dokumen_santri.lihat"><DokumenSantriPage /></KhususIzin>} />
                      <Route path="/dokumen-guru" element={<KhususIzin izin="dokumen_pegawai.lihat"><DaftarDokumenPegawaiPage /></KhususIzin>} />
                      <Route path="/dokumen-guru/lihat" element={<KhususIzin izin="dokumen_pegawai.lihat"><DokumenPegawaiPage /></KhususIzin>} />
                      <Route path="/dokumen-madrasah" element={<KhususIzin izin="dokumen_lembaga.lihat"><DokumenMadrasahPage /></KhususIzin>} />
                      <Route path="/dokumen-lembaga" element={<Navigate to="/dokumen-madrasah" replace />} />
                      <Route path="/pengaturan" element={<Navigate to="/pengaturan/izin" replace />} />
                      <Route path="/pengaturan/izin" element={<KhususIzin izin="izin.lihat"><KelolaIzinPage /></KhususIzin>} />
                      <Route path="/komponen" element={<KhususIzin izin="izin.lihat"><KomponenPage /></KhususIzin>} />
                      <Route
                        path="/pengaturan/server"
                        element={(
                          <KhususIzin izin="server.lihat">
                            <PengaturanServerPage />
                          </KhususIzin>
                        )}
                      />
                      <Route
                        path="/pengaturan/izin"
                        element={(
                          <KhususIzin izin="izin.lihat">
                            <KelolaIzinPage />
                          </KhususIzin>
                        )}
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>

                    <Route
                      path="/santri/:id/profil"
                      element={(
                        <ProtectedRoute>
                          <KhususIzin izin="santri.lihat">

                            <ErrorBoundary penuhLayar>
                              <Suspense fallback={<PageFallback />}>
                                <ProfilSantriPage />
                              </Suspense>
                            </ErrorBoundary>
                          </KhususIzin>
                        </ProtectedRoute>
                      )}
                    />
                  </Routes>
              </BrowserRouter>
            </ThemeProvider>
          </KelasAktifProvider>
          </TingkatAktifProvider>
          </SemesterAktifProvider>
        </TahunAjaranAktifProvider>
      </LembagaAktifProvider>
    </AuthProvider>
  );
}
