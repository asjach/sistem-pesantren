import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProfilSantriDialog } from './ProfilSantriDialog';
import { renderDenganTema } from '@/test/utils';
import type { ProfilSantri } from '@/api/siklus';

const profil: ProfilSantri = {
  santri: {
    id: 7,
    nama_lengkap: 'Ahmad Fauzi',
    nama_singkat: 'Fauzi',
    nik: '3201011505950001',
    nisn: '0123456789',
    tmp_lahir: 'Bandung',
    tgl_lahir: '1995-05-15T00:00:00.000000Z',
    jk: 'L',
    tipe_santri: 'asrama',
    is_active_pst: 'Ya',
    // Kolom profil yang tidak ada di tipe ringkas tetap diteruskan apa adanya.
    ...({ agama: 'Islam', ayah_nik: '3201011205600002', wali_nama: null } as object),
  } as unknown as ProfilSantri['santri'],
  keanggotaan: [],
  riwayat: [
    {
      id: 1,
      tahun_ajaran: { nama: '2025/2026' },
      jenjang: 'MTs',
      semester: '1',
      tingkat: '7',
      status_awal: 'baru',
      status_akhir: 'naik',
      is_active_riwayat: 'Ya',
    },
  ] as unknown as ProfilSantri['riwayat'],
  mutasi: [],
  alumni: [],
} as unknown as ProfilSantri;

vi.mock('@/api/siklus', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/siklus')>();
  return { ...asli, profilSantri: vi.fn(async () => profil) };
});

function renderDialog() {
  return renderDenganTema(<ProfilSantriDialog santriId={7} open onOpenChange={() => {}} />);
}

describe('ProfilSantriDialog', () => {
  /** Seluruh isi dialog ada sekaligus — tanpa tab, tanpa ada yang tersembunyi. */
  async function isiDialog(): Promise<HTMLElement> {
    await screen.findByRole('heading', { name: 'Ahmad Fauzi' });
    const isi = document.querySelector('[data-part="isi_profil"]');
    expect(isi).not.toBeNull();
    return isi as HTMLElement;
  }

  it('tidak memakai tab: seluruh bagian sekaligus dalam satu area gulir', async () => {
    renderDialog();
    const isi = await isiDialog();

    // Tidak ada satu pun kontrol tab.
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    // Keempat bagian tampil bersamaan, cukup digulir.
    for (const judul of ['Identitas', 'Alamat', 'Keluarga', 'Keanggotaan & riwayat']) {
      expect(within(isi).getByRole('heading', { name: judul })).toBeInTheDocument();
    }
  });

  it('bagian identitas: label ramah, nilai terkode dibaca, field kosong tampil "—"', async () => {
    renderDialog();
    const isi = await isiDialog();

    expect(within(isi).getByText('Nama lengkap')).toBeInTheDocument();
    expect(within(isi).getByText('3201011505950001')).toBeInTheDocument();
    // jk 'L' dan tipe_santri 'asrama' diterjemahkan, bukan kode mentah.
    expect(within(isi).getByText('Laki-laki')).toBeInTheDocument();
    expect(within(isi).getByText('Asrama')).toBeInTheDocument();
    // Field yang belum diisi tetap kelihatan sebagai "—".
    expect(within(isi).getAllByText('\u2014').length).toBeGreaterThan(0);
  });

  it('bagian keluarga: field orang tua/wali punya label sendiri per orang', async () => {
    renderDialog();
    const isi = await isiDialog();

    for (const judul of ['Ayah', 'Ibu', 'Wali', 'Kartu keluarga']) {
      expect(within(isi).getByText(judul)).toBeInTheDocument();
    }
    // NIK ayah tampil di panel Ayah, bukan label mentah `ayah_nik`.
    expect(within(isi).getByText('3201011205600002')).toBeInTheDocument();
    expect(within(isi).queryByText('ayah_nik')).not.toBeInTheDocument();
  });

  it('bagian keluarga tersusun 2×2: Ayah | Ibu di atas, Wali | Kartu keluarga di bawah', async () => {
    renderDialog();
    const isi = await isiDialog();

    const bagian = within(isi).getByRole('heading', { name: 'Keluarga' }).parentElement as HTMLElement;
    // Dua kolom: urutan DOM = urutan baca grid baris demi baris.
    const grid = bagian.querySelector('div') as HTMLElement;
    expect(grid.className).toContain('sm:grid-cols-2');
    const urutan = within(bagian)
      .getAllByRole('heading', { level: 4 })
      .map((h) => h.textContent);
    expect(urutan).toEqual(['Ayah', 'Ibu', 'Wali', 'Kartu keluarga']);
  });

  it('anak ke dan jumlah saudara berada di panel Kartu keluarga, bukan Kelahiran', async () => {
    renderDialog();
    const isi = await isiDialog();

    /** Elemen <section> sebuah panel (induk dari judulnya). */
    const panel = (judul: string) =>
      within(isi).getByRole('heading', { level: 4, name: judul }).parentElement as HTMLElement;

    const kartu = panel('Kartu keluarga');
    expect(within(kartu).getByText('Anak ke')).toBeInTheDocument();
    expect(within(kartu).getByText('Jumlah saudara')).toBeInTheDocument();

    const kelahiran = panel('Kelahiran');
    expect(within(kelahiran).queryByText('Anak ke')).not.toBeInTheDocument();
    expect(within(kelahiran).queryByText('Jumlah saudara')).not.toBeInTheDocument();
  });

  it('bagian keanggotaan & riwayat: jumlah baris per tabel dan pesan kosong', async () => {
    renderDialog();
    const isi = await isiDialog();

    expect(within(isi).getByRole('heading', { name: /^Riwayat belajar/ })).toBeInTheDocument();
    expect(within(isi).getByText('(1)')).toBeInTheDocument();
    // Tiga tabel tanpa data → pesan kosong, bukan tabel kosong.
    expect(within(isi).getAllByText('Tidak ada data.')).toHaveLength(3);
  });

  it('area isi ber tinggi tetap agar tinggi dialog tidak melompat', async () => {
    renderDialog();
    const isi = await isiDialog();

    // Tinggi tetap (h-*) + minimum, bukan sekadar batas atas (max-h-*):
    // max-h membuat dialog ikut tumbuh/mengecil sesuai panjang data.
    const kelas = isi.className;
    expect(kelas).toContain('h-[60vh]');
    expect(kelas).toContain('min-h-72');
    expect(kelas).not.toContain('max-h-');
  });
});
