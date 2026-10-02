import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Efek samping: pasang penyalin polos desktop (cegah style mode gelap ikut
// ke clipboard). Di lingkup modul agar tak tergantung lifecycle React/HMR.
import './lib/clipboard';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
