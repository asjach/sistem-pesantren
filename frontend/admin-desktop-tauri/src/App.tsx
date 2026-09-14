import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthProvider } from './auth/AuthContext';
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
const PengaturanBagianPage = lazy(() => import('./pages/PengaturanBagianPage'));
const PengaturanServerPage = lazy(() => import('./pages/PengaturanServerPage'));
const PsbPage = lazy(() => import('./pages/PsbPage'));
const KegiatanPsbPage = lazy(() => import('./pages/KegiatanPsbPage'));
const SantriPage = lazy(() => import('./pages/SantriPage'));
const SiklusPage = lazy(() => import('./pages/SiklusPage'));
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
            <Route path="/siklus" element={<SiklusPage />} />
            <Route path="/keuangan" element={<KeuanganPage />} />
            <Route path="/pengajuan-biodata" element={<PengajuanBiodataPage />} />
            <Route path="/dokumen-wajib" element={<DokumenWajibPage />} />
            <Route path="/pengaturan" element={<Navigate to="/pengaturan/tampilan" replace />} />
            <Route path="/pengaturan/tampilan" element={<PengaturanTampilanPage />} />
            <Route path="/pengaturan/bagian" element={<PengaturanBagianPage />} />
            <Route path="/pengaturan/server" element={<PengaturanServerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </PickerProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
