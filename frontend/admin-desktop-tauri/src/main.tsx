import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

import './lib/clipboard';
import { bacaPrefsSinkron } from './prefs';
import { pasangWarnaTema } from './theme';
import { findPreset } from './themes';

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

    <ErrorBoundary penuhLayar>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
