import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LembagaAktifProvider } from './lembagaAktif';
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
const TahunAjaranPage = lazy(() => import('./pages/TahunAjaranPage'));
const KelasPage = lazy(() => import('./pages/KelasPage'));
const PosPage = lazy(() => import('./pages/PosPage'));
const TarifPage = lazy(() => import('./pages/TarifPage'));
const PengaturanTampilanPage = lazy(() => import('./pages/PengaturanTampilanPage'));
const PengaturanTampilanStandarPage = lazy(() => import('./pages/PengaturanTampilanStandarPage'));
const PengaturanServerPage = lazy(() => import('./pages/PengaturanServerPage'));
const PsbPage = lazy(() => import('./pages/PsbPage'));
const KegiatanPsbPage = lazy(() => import('./pages/KegiatanPsbPage'));
const SantriPage = lazy(() => import('./pages/SantriPage'));
const RiwayatBelajarPage = lazy(() => import('./pages/RiwayatBelajarPage'));
const DaftarKelasPage = lazy(() => import('./pages/DaftarKelasPage'));
const PindahKelasPage = lazy(() => import('./pages/PindahKelasPage'));
const KenaikanKelasPage = lazy(() => import('./pages/KenaikanKelasPage'));
const KelulusanPage = lazy(() => import('./pages/KelulusanPage'));
const RekapSantriPage = lazy(() => import('./pages/RekapSantriPage'));
const MutasiKeluarPage = lazy(() => import('./pages/MutasiKeluarPage'));
const KeuanganPage = lazy(() => import('./pages/KeuanganPage'));
const PengajuanBiodataPage = lazy(() => import('./pages/PengajuanBiodataPage'));
const DokumenWajibPage = lazy(() => import('./pages/DokumenWajibPage'));

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

/** Batasi halaman ke peran tertentu; peran lain dialihkan ke beranda. */
function KhususPeran({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user?.roles.some((r) => roles.includes(r.name))) return <Navigate to="/" replace />;
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
        <StandarTampilanProvider>
          <ThemeProvider>
            <BrowserRouter>
              <PickerProvider>
                <Toaster richColors position="top-center" />
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<Shell />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/lembaga" element={<LembagaPage />} />
                    <Route path="/tahun-ajaran" element={<TahunAjaranPage />} />
                    <Route path="/kelas" element={<KelasPage />} />
                    <Route path="/pos" element={<PosPage />} />
                    <Route path="/tarif" element={<TarifPage />} />
                    <Route path="/referensi" element={<ReferensiPage />} />
                    <Route path="/psb" element={<PsbPage />} />
                    <Route path="/kegiatan-psb" element={<KegiatanPsbPage />} />
                    <Route path="/santri" element={<SantriPage />} />
                    <Route path="/riwayat-belajar" element={<RiwayatBelajarPage />} />
                    <Route path="/daftar-kelas" element={<DaftarKelasPage />} />
                    <Route path="/pindah-kelas" element={<PindahKelasPage />} />
                    <Route path="/kenaikan" element={<KenaikanKelasPage />} />
                    <Route path="/kelulusan" element={<KelulusanPage />} />
                    <Route path="/rekap-santri" element={<RekapSantriPage />} />
                    <Route path="/mutasi-keluar" element={<MutasiKeluarPage />} />
                    <Route path="/siklus" element={<Navigate to="/riwayat-belajar" replace />} />
                    <Route path="/keuangan" element={<KeuanganPage />} />
                    <Route path="/pengajuan-biodata" element={<PengajuanBiodataPage />} />
                    <Route path="/dokumen-wajib" element={<DokumenWajibPage />} />
                    <Route path="/pengaturan" element={<Navigate to="/pengaturan/tampilan" replace />} />
                    <Route path="/pengaturan/tampilan" element={<PengaturanTampilanPage />} />
                    <Route
                      path="/pengaturan/tampilan-standar"
                      element={(
                        <KhususPeran roles={['super_admin']}>
                          <PengaturanTampilanStandarPage />
                        </KhususPeran>
                      )}
                    />
                    <Route path="/pengaturan/bagian" element={<Navigate to="/pengaturan/tampilan" replace />} />
                    <Route path="/pengaturan/server" element={<PengaturanServerPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </PickerProvider>
            </BrowserRouter>
          </ThemeProvider>
        </StandarTampilanProvider>
      </LembagaAktifProvider>
    </AuthProvider>
  );
}
