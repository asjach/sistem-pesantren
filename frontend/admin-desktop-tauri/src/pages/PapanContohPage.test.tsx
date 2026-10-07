import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PapanContohPage from './PapanContohPage';
import { renderDenganTema } from '@/test/utils';

/** DataTransfer tiruan untuk drag-and-drop HTML5 di jsdom. */
function buatDataTransfer() {
  return { effectAllowed: '', dropEffect: '', setData: () => {} };
}

/** Seret kartu ke kolom lain (level kolom = sisip di akhir). */
function seretKeKolom(idKartu: string, idKolom: string) {
  const kartu = document.getElementById(`kartu_contoh_${idKartu}`);
  const kolom = document.getElementById(`kolom_papan_${idKolom}`);
  if (!kartu || !kolom) throw new Error(`elemen seret tak ditemukan: ${idKartu} -> ${idKolom}`);
  const dataTransfer = buatDataTransfer();
  fireEvent.dragStart(kartu, { dataTransfer });
  fireEvent.dragOver(kolom, { dataTransfer });
  fireEvent.drop(kolom, { dataTransfer });
  fireEvent.dragEnd(kartu);
}

describe('PapanContohPage', () => {
  it('menampilkan 4 kolom dan 5 kartu contoh', () => {
    renderDenganTema(<PapanContohPage />);
    expect(screen.getByLabelText('Kolom Antrean, 2 kartu')).toBeInTheDocument();
    expect(screen.getByLabelText('Kolom Dikerjakan, 1 kartu')).toBeInTheDocument();
    expect(screen.getByLabelText('Kolom Ditinjau, 1 kartu')).toBeInTheDocument();
    expect(screen.getByLabelText('Kolom Selesai, 1 kartu')).toBeInTheDocument();
    expect(document.getElementById('kartu_contoh_rekap_spp')).toBeInTheDocument();
  });

  it('seret kartu antar kolom memindahkan jumlahnya', () => {
    renderDenganTema(<PapanContohPage />);
    seretKeKolom('rekap_spp', 'ditinjau');
    expect(screen.getByLabelText('Kolom Dikerjakan, 0 kartu')).toBeInTheDocument();
    expect(screen.getByLabelText('Kolom Ditinjau, 2 kartu')).toBeInTheDocument();
    // Kartu ikut pindah ke DOM kolom tujuan.
    const tujuan = document.getElementById('kolom_papan_ditinjau');
    expect(tujuan?.querySelector('#kartu_contoh_rekap_spp')).not.toBeNull();
  });

  it('kotak selesai bisa dijungkit', () => {
    renderDenganTema(<PapanContohPage />);
    const tombol = document.getElementById('btn_selesai_contoh_jadwal_tes');
    if (!tombol) throw new Error('tombol selesai tak ditemukan');
    expect(tombol).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(tombol);
    expect(tombol).toHaveAttribute('aria-checked', 'true');
  });

  it('kolom bisa dilipat dan dibuka lagi', () => {
    renderDenganTema(<PapanContohPage />);
    fireEvent.click(document.getElementById('btn_lipat_kolom_antrean')!);
    // Isi kolom hilang saat terlipat, kartu tak lagi di dokumen.
    expect(document.getElementById('kartu_contoh_verifikasi_berkas')).toBeNull();
  });
});
