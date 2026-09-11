import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from './auth/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import LembagaPage from './pages/LembagaPage';
import ReferensiPage from './pages/ReferensiPage';
import TahunAjaranPage from './pages/TahunAjaranPage';
import KelasPage from './pages/KelasPage';
import PosPage from './pages/PosPage';
import TarifPage from './pages/TarifPage';
import PengaturanPage from './pages/PengaturanPage';

function Shell({ children }: { children: JSX.Element }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-center" />
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
          <Route path="/pengaturan" element={<Shell><PengaturanPage /></Shell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
