import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthProvider } from './auth/AuthContext';
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
const PengaturanPage = lazy(() => import('./pages/PengaturanPage'));
const PsbPage = lazy(() => import('./pages/PsbPage'));
const KegiatanPsbPage = lazy(() => import('./pages/KegiatanPsbPage'));
const SantriPage = lazy(() => import('./pages/SantriPage'));
const SiklusPage = lazy(() => import('./pages/SiklusPage'));
const KeuanganPage = lazy(() => import('./pages/KeuanganPage'));
const PengajuanBiodataPage = lazy(() => import('./pages/PengajuanBiodataPage'));
const DokumenWajibPage = lazy(() => import('./pages/DokumenWajibPage'));

function Shell({ children }: { children: JSX.Element }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function PageFallback() {
  return <Skeleton className="h-64 w-full" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-center" />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Shell><DashboardPage /></Shell>} />
            <Route path="/users" element={<Shell><UsersPage /></Shell>} />
            <Route path="/lembaga" element={<Shell><LembagaPage /></Shell>} />
            <Route path="/tahun-ajaran" element={<Shell><TahunAjaranPage /></Shell>} />
            <Route path="/kelas" element={<Shell><KelasPage /></Shell>} />
            <Route path="/pos" element={<Shell><PosPage /></Shell>} />
            <Route path="/tarif" element={<Shell><TarifPage /></Shell>} />
            <Route path="/referensi" element={<Shell><ReferensiPage /></Shell>} />
            <Route path="/psb" element={<Shell><PsbPage /></Shell>} />
            <Route path="/kegiatan-psb" element={<Shell><KegiatanPsbPage /></Shell>} />
            <Route path="/santri" element={<Shell><SantriPage /></Shell>} />
            <Route path="/siklus" element={<Shell><SiklusPage /></Shell>} />
            <Route path="/keuangan" element={<Shell><KeuanganPage /></Shell>} />
            <Route path="/pengajuan-biodata" element={<Shell><PengajuanBiodataPage /></Shell>} />
            <Route path="/dokumen-wajib" element={<Shell><DokumenWajibPage /></Shell>} />
            <Route path="/pengaturan" element={<Shell><PengaturanPage /></Shell>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
