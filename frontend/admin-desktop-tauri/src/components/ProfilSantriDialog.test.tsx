import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProfilSantriDialog } from './ProfilSantriDialog';
import { renderDenganTema } from '@/test/utils';
import type { ProfilSantri } from '@/api/siklus';

const profil: ProfilSantri = {
  santri: {
    id: 7,
    nama_lengkap: 'Ahmad Fauzi',
    nama_singkat: null,
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

const salin = vi.fn(async (_teks: string) => true);
vi.mock('@/lib/clipboard', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/lib/clipboard')>();
  return { ...asli, copyText: (t: string) => salin(t) };
});

const profilSantri = vi.fn(async (id: number) => ({ ...profil, santri: { ...profil.santri, id } }));
vi.mock('@/api/siklus', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/siklus')>();
  return { ...asli, profilSantri: (id: number) => profilSantri(id) };
});

const onGanti = vi.fn();
const onOpenChange = vi.fn();

/** Render dialog untuk satu Santri, dengan urutan tabel asal bila ada. */
function renderDialog(daftar?: number[]) {
  return renderDenganTema(
    <ProfilSantriDialog
      target={{ id: 7, daftar: daftar ?? [] }}
      onGanti={onGanti}
      onOpenChange={onOpenChange}
    />,
  );
}

/** Penanda posisi "ke-berapa dari berapa" di kepala dialog. */
function posisiTetangga(): HTMLElement {
  return document.querySelector('[data-part="posisi_tetangga"]') as HTMLElement;
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

  it('setiap field punya tombol salin satuan, tanpa perlu blok lalu salin', async () => {
    const user = userEvent.setup();
    renderDialog();
    await isiDialog();

    // Tidak ada lagi tombol salin massal.
    expect(screen.queryByRole('button', { name: /Salin semua/ })).not.toBeInTheDocument();

    // "Salin NIK" juga milik kolom NIK Ayah, jadi klik lewat id.
    await user.click(document.querySelector('#btn_salin_nik') as HTMLElement);

    expect(salin).toHaveBeenCalledTimes(1);
    expect(salin).toHaveBeenCalledWith('3201011505950001');
  });

  it('menyalin nilai mentah untuk field berkode, bukan teks terjemahan', async () => {
    const user = userEvent.setup();
    renderDialog();
    await isiDialog();

    // Tampil "Laki-laki", tapi yang harus masuk EMIS adalah kode "L".
    expect(screen.getByText('Laki-laki')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salin Jenis kelamin' }));

    expect(salin).toHaveBeenCalledWith('L');
  });

  it('tombol salin hanya ada pada field yang terisi', async () => {
    renderDialog();
    await isiDialog();

    // nama_singkat sengaja kosong pada fixture.
    expect(screen.queryByRole('button', { name: 'Salin Nama singkat' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salin Nama lengkap' })).toBeInTheDocument();
  });

  it('tombol salin tersembunyi sampai baris dilewati/difokus', async () => {
    renderDialog();
    await isiDialog();

    const tombol = document.querySelector('#btn_salin_nik') as HTMLElement;
    expect(tombol.className).toContain('opacity-0');
    expect(tombol.className).toContain('group-hover:opacity-100');
    expect(tombol.className).toContain('focus-visible:opacity-100');
  });

  it('navigasi tetangga: tombol Previous/Next berpindah sesuai urutan tabel asal', async () => {
    const user = userEvent.setup();
    renderDialog([5, 7, 9]);

    // Posisi awal = Santri kedua dari tiga.
    expect(posisiTetangga()).toHaveTextContent('2 / 3');
    expect(screen.getByRole('button', { name: /Sebelumnya/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Berikutnya/ })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Berikutnya/ }));
    expect(onGanti).toHaveBeenCalledWith(9);

    await user.click(screen.getByRole('button', { name: /Sebelumnya/ }));
    expect(onGanti).toHaveBeenCalledWith(5);
  });

  it('navigasi tetangga: tombol mati di ujung daftar', async () => {
    // Santri pertama → tidak ada tetangga sebelumnya.
    renderDenganTema(
      <ProfilSantriDialog
        target={{ id: 5, daftar: [5, 7] }}
        onGanti={onGanti}
        onOpenChange={onOpenChange}
      />,
    );
    await screen.findByRole('heading', { name: 'Ahmad Fauzi' });

    expect(posisiTetangga()).toHaveTextContent('1 / 2');
    expect(screen.getByRole('button', { name: /Sebelumnya/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Berikutnya/ })).toBeEnabled();
  });





  it('tanpa daftar tabel asal: tombol tetangga tidak muncul', async () => {
    renderDialog();
    await screen.findByRole('heading', { name: 'Ahmad Fauzi' });

    expect(screen.queryByRole('button', { name: /Sebelumnya/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Berikutnya/ })).not.toBeInTheDocument();
  });

  it('tombol "Buka di tab baru" membuka rute profil mandiri di tab baru', async () => {
    const user = userEvent.setup();
    const buka = vi.fn(async () => 'dibuka' as const);
    window.open = buka as unknown as typeof window.open;
    renderDialog();
    await isiDialog();

    await user.click(screen.getByRole('button', { name: /Buka di tab baru/ }));

    expect(buka).toHaveBeenCalledWith(
      '/santri/7/profil',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('baris tabel relasi juga dirapatkan', async () => {
    renderDialog();
    const isi = await isiDialog();

    // Tabel riwayat belajar punya satu baris data; selnya <td> di dalam tabel.
    const tabel = within(isi).getByRole('table');
    expect(tabel.className).toContain('text-xs');
    expect(tabel.className).toContain('leading-5');
    const sel = tabel.querySelector('tbody td') as HTMLElement;
    expect(sel.className).toContain('py-1');
    expect(sel.className).not.toContain('py-1.5');
    const kepala = tabel.querySelector('thead th') as HTMLElement;
    expect(kepala.className).toContain('py-1');
  });

  it('baris label–nilai dirapatkan supaya banyak field muat tanpa menggulir', async () => {
    renderDialog();
    const isi = await isiDialog();

    // Baris = <div> induk dari <dt> labelnya.
    const baris = within(isi).getByText('Nama lengkap').parentElement as HTMLElement;
    expect(baris.className).toContain('py-0.5');
    expect(baris.className).not.toContain('py-1.5');
    // Nilai 13px dengan line-height tetap → tinggi baris stabil antar panel.
    const nilai = within(isi).getByText('3201011505950001');
    expect(nilai.className).toContain('text-xs');
    expect(nilai.className).toContain('leading-5');
  });

  it('tempat/tanggal lahir dan agama berada di panel Identitas dasar', async () => {
    renderDialog();
    const isi = await isiDialog();

    /** Elemen <section> sebuah panel (induk dari judulnya). */
    const panel = (judul: string) =>
      within(isi).getByRole('heading', { level: 4, name: judul }).parentElement as HTMLElement;

    // Panel Kelahiran sudah dilebur: tidak ada lagi.
    expect(within(isi).queryByRole('heading', { level: 4, name: 'Kelahiran' })).not.toBeInTheDocument();

    const dasar = panel('Identitas dasar');
    for (const label of ['Tempat lahir', 'Tanggal lahir', 'Agama']) {
      expect(within(dasar).getByText(label)).toBeInTheDocument();
    }
    expect(within(dasar).getByText('Bandung')).toBeInTheDocument();
    expect(within(dasar).getByText('1995-05-15')).toBeInTheDocument();
    expect(within(dasar).getByText('Islam')).toBeInTheDocument();

    // Anak ke dan jumlah saudara tetap di Kartu keluarga.
    const kartu = panel('Kartu keluarga');
    expect(within(kartu).getByText('Anak ke')).toBeInTheDocument();
    expect(within(kartu).getByText('Jumlah saudara')).toBeInTheDocument();
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

  it('selagi memuat tampil kerangka, bukan teks polos', () => {
    renderDialog();

    // Promise profil belum selesai: kerangka status terlihat, isi belum ada.
    expect(screen.getByRole('status', { name: 'Memuat profil' })).toBeInTheDocument();
    expect(document.querySelector('[data-part="isi_profil"]')).toBeNull();
  });

  it('judul tiap bagian lengket agar konteks kelihatan saat menggulir', async () => {
    renderDialog();
    const isi = await isiDialog();

    for (const judul of ['Identitas', 'Alamat', 'Keluarga', 'Keanggotaan & riwayat']) {
      const h = within(isi).getByRole('heading', { name: judul });
      expect(h.className).toContain('sticky');
      expect(h.className).toContain('top-0');
      expect(h.className).toContain('bg-background/95');
    }
  });

  it('chip lompat menggulir halus ke bagian yang dituju', async () => {
    const user = userEvent.setup();
    const gulir = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = gulir;
    renderDialog();
    await isiDialog();

    await user.click(screen.getByRole('button', { name: 'Keluarga' }));

    expect(gulir).toHaveBeenCalledTimes(1);
    expect(gulir).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    // Penerima guliran = section Keluarga (pemilik heading-nya).
    const tujuan = within(await isiDialog()).getByRole('heading', { name: 'Keluarga' }).parentElement as HTMLElement;
    expect(tujuan.id).toBe('profil_santri_keluarga');
  });

  it('kepala dialog memberi ruang untuk tombol X bawaan', async () => {
    renderDialog([5, 7, 9]);
    await screen.findByRole('heading', { name: 'Ahmad Fauzi' });

    // Baris judul + tombol tetangga berada di wadah ber-padding kanan
    // agar tombol tutup (absolut kanan-atas) tak menimpanya.
    const wadah = screen.getByRole('button', { name: /Berikutnya/ }).closest('div.pr-10');
    expect(wadah).not.toBeNull();
  });

  it('tombol tutup (X) berwarna merah', async () => {
    renderDialog();
    await screen.findByRole('heading', { name: 'Ahmad Fauzi' });

    // Dua tombol bernama "Tutup": X kanan-atas + tombol footer.
    const merah = screen
      .getAllByRole('button', { name: 'Tutup' })
      .filter((b) => b.className.includes('text-destructive'));
    expect(merah).toHaveLength(1);
  });
});
