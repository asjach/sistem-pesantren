import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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
import { StandarTampilanProvider } from './standarTampilan';
import { ThemeProvider } from './theme';
import { PickerProvider } from './picker';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// Halaman lain dimuat saat rutenya dibuka (code splitting) — login & dashboard
// tetap eager karena jadi tampilan pertama.
const UsersPage = lazy(() => import('./pages/UsersPage'));
const LembagaPage = lazy(() => import('./pages/LembagaPage'));
const ReferensiPage = lazy(() => import('./pages/ReferensiPage'));
const KamusLabelPage = lazy(() => import('./pages/KamusLabelPage'));
const TahunAjaranPage = lazy(() => import('./pages/TahunAjaranPage'));
const SemesterPage = lazy(() => import('./pages/SemesterPage'));
const KelasPage = lazy(() => import('./pages/KelasPage'));
const PengaturanTampilanPage = lazy(() => import('./pages/PengaturanTampilanPage'));
const PengaturanServerPage = lazy(() => import('./pages/PengaturanServerPage'));
const PsbPage = lazy(() => import('./pages/PsbPage'));
const KegiatanPsbPage = lazy(() => import('./pages/KegiatanPsbPage'));
const SantriPage = lazy(() => import('./pages/SantriPage'));
const KeanggotaanPage = lazy(() => import('./pages/KeanggotaanPage'));
const RiwayatBelajarPage = lazy(() => import('./pages/RiwayatBelajarPage'));
const PindahSemesterPage = lazy(() => import('./pages/PindahSemesterPage'));
const DaftarKelasPage = lazy(() => import('./pages/DaftarKelasPage'));
const PindahKelasPage = lazy(() => import('./pages/PindahKelasPage'));
const KenaikanKelasPage = lazy(() => import('./pages/KenaikanKelasPage'));
const KelulusanPage = lazy(() => import('./pages/KelulusanPage'));
const MiMdPage = lazy(() => import('./pages/MiMdPage'));
const RekapSantriPage = lazy(() => import('./pages/RekapSantriPage'));
const MutasiKeluarPage = lazy(() => import('./pages/MutasiKeluarPage'));
const PengajuanBiodataPage = lazy(() => import('./pages/PengajuanBiodataPage'));
const DokumenWajibPage = lazy(() => import('./pages/DokumenWajibPage'));
const KelolaIzinPage = lazy(() => import('./pages/KelolaIzinPage'));

// Shell dipasang SEKALI sebagai rute induk: TopBar/ribbon + provider tetap
// mounted saat pindah halaman. Suspense ada di dalam area konten sehingga
// memuat halaman lazy hanya menukar isi <main>, bukan seluruh kerangka.
function Shell() {
  return (
    <ProtectedRoute>
      <Layout>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
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

function PageFallback() {
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
          <StandarTampilanProvider>
            <ThemeProvider>
              <BrowserRouter>
                <PickerProvider>
                  <Toaster richColors position="top-center" />
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route element={<Shell />}>
                      <Route path="/" element={<KhususIzin izin="dashboard.lihat"><DashboardPage /></KhususIzin>} />
                      <Route path="/users" element={<KhususIzin izin="pengguna.lihat"><UsersPage /></KhususIzin>} />
                      <Route path="/lembaga" element={<KhususIzin izin="lembaga.lihat"><LembagaPage /></KhususIzin>} />
                      <Route path="/tahun-ajaran" element={<KhususIzin izin="tahun_ajaran.lihat"><TahunAjaranPage /></KhususIzin>} />
                      <Route path="/pengaturan/semester" element={<KhususIzin izin="semester.aktivasi"><SemesterPage /></KhususIzin>} />
                      <Route path="/kelas" element={<KhususIzin izin="kelas.lihat"><KelasPage /></KhususIzin>} />
                      <Route path="/referensi" element={<KhususIzin izin="referensi.lihat"><ReferensiPage /></KhususIzin>} />
                      <Route path="/pengaturan/kamus-label" element={<KhususIzin izin="kamus_label.lihat"><KamusLabelPage /></KhususIzin>} />
                      <Route path="/psb" element={<Navigate to="/psb/pendaftar" replace />} />
                      <Route path="/psb/:tahap" element={<KhususIzin izin="psb.lihat"><PsbPage /></KhususIzin>} />
                      <Route path="/kegiatan-psb" element={<KhususIzin izin="kegiatan_psb.lihat"><KegiatanPsbPage /></KhususIzin>} />
                      <Route path="/santri" element={<KhususIzin izin="santri.lihat"><SantriPage /></KhususIzin>} />
                      <Route path="/keanggotaan" element={<KhususIzin izin="santri.lihat"><KeanggotaanPage /></KhususIzin>} />
                      <Route path="/riwayat-belajar" element={<KhususIzin izin="riwayat_belajar.lihat"><RiwayatBelajarPage /></KhususIzin>} />
                      <Route path="/pindah-semester" element={<KhususIzin izin="kenaikan.lihat"><PindahSemesterPage /></KhususIzin>} />
                      <Route path="/daftar-kelas" element={<KhususIzin izin="daftar_kelas.lihat"><DaftarKelasPage /></KhususIzin>} />
                      <Route path="/pindah-kelas" element={<KhususIzin izin="pindah_kelas.lihat"><PindahKelasPage /></KhususIzin>} />
                      <Route path="/kenaikan" element={<KhususIzin izin="kenaikan.lihat"><KenaikanKelasPage /></KhususIzin>} />
                      <Route path="/kelulusan" element={<KhususIzin izin="kelulusan.lihat"><KelulusanPage /></KhususIzin>} />
                      <Route path="/rekap-santri" element={<KhususIzin izin="rekap_santri.lihat"><RekapSantriPage /></KhususIzin>} />
                      <Route path="/mi-md" element={<KhususIzin izin="rekap_santri.lihat"><MiMdPage /></KhususIzin>} />
                      <Route path="/mutasi-keluar" element={<KhususIzin izin="mutasi_keluar.lihat"><MutasiKeluarPage /></KhususIzin>} />
                      <Route path="/siklus" element={<Navigate to="/riwayat-belajar" replace />} />
                      <Route path="/pengajuan-biodata" element={<KhususIzin izin="pengajuan_biodata.lihat"><PengajuanBiodataPage /></KhususIzin>} />
                      <Route path="/dokumen-wajib" element={<KhususIzin izin="dokumen_wajib.lihat"><DokumenWajibPage /></KhususIzin>} />
                      <Route path="/pengaturan" element={<Navigate to="/pengaturan/tampilan" replace />} />
                      <Route path="/pengaturan/tampilan" element={<KhususIzin izin="tampilan.lihat"><PengaturanTampilanPage /></KhususIzin>} />
                      <Route path="/pengaturan/izin" element={<KhususIzin izin="izin.lihat"><KelolaIzinPage /></KhususIzin>} />
                      <Route path="/pengaturan/bagian" element={<Navigate to="/pengaturan/tampilan" replace />} />
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
                  </Routes>
                </PickerProvider>
              </BrowserRouter>
            </ThemeProvider>
          </StandarTampilanProvider>
          </KelasAktifProvider>
          </TingkatAktifProvider>
          </SemesterAktifProvider>
        </TahunAjaranAktifProvider>
      </LembagaAktifProvider>
    </AuthProvider>
  );
}
