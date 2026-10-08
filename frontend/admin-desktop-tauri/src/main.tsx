import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Efek samping: pasang penyalin polos desktop (cegah style mode gelap ikut
// ke clipboard). Di lingkup modul agar tak tergantung lifecycle React/HMR.
import './lib/clipboard';
import { bacaPrefsSinkron } from './prefs';
import { pasangWarnaTema } from './theme';
import { findPreset } from './themes';

// Tema dipasang SEBELUM render pertama: prefs dibaca sinkron dari penyimpanan
// sehingga cat pertama sudah memakai tema & mode pengguna. Tanpa ini bingkai
// awal memakai nilai bawaan index.css lalu berganti — terlihat sebagai kilatan
// warna di setiap muat halaman.
const prefsAwal = bacaPrefsSinkron();
if (prefsAwal) {
  const gelap =
    prefsAwal.mode === 'gelap' ||
    (prefsAwal.mode === 'sistem' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', gelap);
  document.documentElement.dataset.warna = prefsAwal.warnaUI;
  pasangWarnaTema(prefsAwal.theme, gelap);
  document.documentElement.style.background =
    findPreset(prefsAwal.theme)[gelap ? 'gelap' : 'terang'].bg;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
