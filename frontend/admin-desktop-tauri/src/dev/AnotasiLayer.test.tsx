import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/theme';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AnotasiLayer from './AnotasiLayer';
import type { Anotasi } from './anotasi';
import type { DraftScreenshot } from './screenshotAnotasi';

const api = vi.hoisted(() => ({
  muat: vi.fn<() => Promise<Anotasi[]>>(async () => []),
  simpan: vi.fn<(anotasi: Anotasi, gambar?: Blob) => Promise<Anotasi>>(async (anotasi) => anotasi),
  hapus: vi.fn<(id: string) => Promise<void>>(async () => {}),
  screenshot: vi.fn<(...args: unknown[]) => Promise<DraftScreenshot>>(),
  revoke: vi.fn(),
}));
vi.mock('./screenshotAnotasi', () => ({ ambilScreenshot: api.screenshot }));

vi.mock('@/dev/anotasi', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/dev/anotasi')>();
  return {
    ...asli,
    muatAnotasi: api.muat,
    simpanAnotasi: api.simpan,
    hapusAnotasi: api.hapus,
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const CATATAN: Anotasi = {
  id: 'a1',
  dibuat: '2026-10-21T00:00:00.000Z',
  rute: '/penilaian/leger',
  selector: '#tombol_simpan',
  tag: 'button',
  teks: 'Simpan',
  komponen: ['PenilaianLegerPage', 'ExcelTable'],
  sumber: 'src/pages/PenilaianLegerPage.tsx:42',
  instruksi: 'Perbesar tombol simpan',
};

beforeEach(() => {
  api.muat.mockResolvedValue([]);
  api.simpan.mockImplementation(async (anotasi) => anotasi);
  api.hapus.mockResolvedValue(undefined);
  api.screenshot.mockResolvedValue({ blob: new Blob(['png'], { type: 'image/png' }), metadata: { lebar: 120, tinggi: 80, dibuat: '2026-10-23T00:00:00Z', preview_aktif: false } });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:anotasi') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: api.revoke });
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

function tampilkan() {
  return render(
    <ThemeProvider>
      <header aria-label="TopBar">
        <AnotasiLayer />
      </header>
    </ThemeProvider>,
  );
}

async function mulaiPasangan() {
  const user = userEvent.setup();
  const wadah = document.createElement('main');
  wadah.innerHTML = '<article id="asal_wadah"><button id="asal_tombol"><span id="asal_ikon">Tombol asal</span></button></article><section id="tujuan_wadah"><span id="tujuan_teks">Container tujuan</span></section><aside id="tujuan_lain">Container lain</aside>';
  document.body.appendChild(wadah);
  const asal = document.getElementById('asal_tombol')!;
  const tujuan = document.getElementById('tujuan_teks')!;
  const pointer = vi.spyOn(document, 'elementFromPoint').mockReturnValue(asal);
  const tampilan = tampilkan();
  await user.click(screen.getByRole('button', { name: 'Tandai elemen untuk agent' }));
  await user.click(asal);
  await user.type(screen.getByRole('textbox', { name: 'Instruksi untuk agent' }), 'Pindahkan ke container');
  return { user, pointer, asal, tujuan, tampilan };
}

async function terapkanPreview(user: ReturnType<typeof userEvent.setup>, label: string, properti: string, nilai: string) {
  const buka = screen.getByRole('button', { name: `Preview tampilan ${label}` });
  if (buka.getAttribute('aria-expanded') === 'false') await user.click(buka);
  const panel = within(screen.getByRole('region', { name: `Preview ${label}` }));
  await user.selectOptions(panel.getByLabelText('Properti'), properti);
  await user.clear(panel.getByLabelText('Nilai CSS'));
  await user.type(panel.getByLabelText('Nilai CSS'), nilai);
  await user.click(panel.getByRole('button', { name: 'Terapkan preview' }));
  return panel;
}

describe('AnotasiLayer', () => {
  it('capture ulang mengganti gambar sebelumnya dan melepaskan URL lama', async () => {
    const { user } = await mulaiPasangan();
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:pertama').mockReturnValueOnce('blob:kedua');
    await user.click(screen.getByRole('button', { name: 'Ambil screenshot' }));
    await user.click(screen.getByRole('button', { name: 'Ambil ulang screenshot' }));
    expect(screen.getByRole('img', { name: /Screenshot anotasi/ })).toHaveAttribute('src', 'blob:kedua');
    expect(api.revoke).toHaveBeenCalledWith('blob:pertama');
  });

  it('menolak hasil capture yang selesai setelah scroll berubah', async () => {
    const { user } = await mulaiPasangan();
    let selesai!: (gambar: DraftScreenshot) => void;
    api.screenshot.mockImplementationOnce(() => new Promise((resolve) => { selesai = resolve; }));
    await user.click(screen.getByRole('button', { name: 'Ambil screenshot' }));
    fireEvent.scroll(window);
    await act(async () => selesai({ blob: new Blob(['png']), metadata: { lebar: 10, tinggi: 10, dibuat: CATATAN.dibuat, preview_aktif: false } }));
    expect(screen.queryByRole('img', { name: /Screenshot anotasi/ })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Area atau tampilan berubah');
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeEnabled();
  });

  it('menampilkan screenshot tersimpan di daftar dan error gambar hilang', async () => {
    api.muat.mockResolvedValueOnce([{ ...CATATAN, gambar: { berkas: 'screenshots/a1.png', lebar: 100, tinggi: 80, dibuat: CATATAN.dibuat, preview_aktif: true } }]);
    const user = userEvent.setup();
    tampilkan();
    await user.click(await screen.findByRole('button', { name: 'Buka daftar anotasi (1)' }));
    const image = screen.getByRole('img', { name: /Screenshot anotasi/ });
    expect(image).toHaveAttribute('src', '/__anotasi/gambar?id=a1');
    expect(screen.getByText(/Diambil dengan preview style aktif/)).toBeInTheDocument();
    fireEvent.error(image);
    expect(screen.getByRole('alert')).toHaveTextContent('Screenshot tidak dapat dibuka');
  });

  it('mengambil screenshot pasangan dengan preview aktif, memperbesar, lalu menyimpan PNG terkait', async () => {
    const { user, pointer, asal, tujuan } = await mulaiPasangan();
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    await terapkanPreview(user, 'asal', 'color', 'blue');
    await user.click(screen.getByRole('button', { name: 'Ambil screenshot' }));
    expect(api.screenshot).toHaveBeenCalledWith(asal, tujuan, true);
    expect(screen.getByRole('img', { name: /Screenshot anotasi/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Perbesar screenshot' }));
    expect(screen.getByRole('button', { name: 'Kecilkan screenshot' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    const [catatan, blob] = api.simpan.mock.calls[0];
    expect(catatan.gambar?.berkas).toBe(`screenshots/${catatan.id}.png`);
    expect(blob).toBeInstanceOf(Blob);
    expect(api.revoke).toHaveBeenCalledWith('blob:anotasi');
  });

  it('capture gagal mempertahankan draft dan tetap mengizinkan simpan tanpa screenshot', async () => {
    const { user } = await mulaiPasangan();
    api.screenshot.mockRejectedValueOnce(new Error('Canvas tidak tersedia'));
    await user.click(screen.getByRole('button', { name: 'Ambil screenshot' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Canvas tidak tersedia');
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan.mock.calls[0][0]).not.toHaveProperty('gambar');
  });

  it('mengunci perubahan selama capture dan membuang hasil jika rute berubah', async () => {
    const { user, tampilan } = await mulaiPasangan();
    let selesai!: (gambar: DraftScreenshot) => void;
    api.screenshot.mockImplementationOnce(() => new Promise((resolve) => { selesai = resolve; }));
    await user.click(screen.getByRole('button', { name: 'Ambil screenshot' }));
    expect(screen.getByRole('status')).toHaveTextContent('Sedang menyiapkan');
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pilih tujuan' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('region', { name: 'Editor anotasi' })).toBeInTheDocument();
    tampilan.rerender(<ThemeProvider><AnotasiLayer rute="/lain" /></ThemeProvider>);
    await act(async () => selesai({ blob: new Blob(['png']), metadata: { lebar: 120, tinggi: 80, dibuat: '2026-10-23T00:00:00Z', preview_aktif: false } }));
    expect(screen.queryByRole('img', { name: /Screenshot anotasi/ })).not.toBeInTheDocument();
  });

  it.each(['preview', 'parent', 'tujuan', 'scroll', 'resize'])('mewajibkan capture ulang setelah perubahan %s', async (cara) => {
    const { user, pointer, tujuan } = await mulaiPasangan();
    await user.click(screen.getByRole('button', { name: 'Ambil screenshot' }));
    expect(screen.getByRole('img', { name: /Screenshot anotasi/ })).toBeInTheDocument();
    if (cara === 'preview') await terapkanPreview(user, 'asal', 'color', 'blue');
    else if (cara === 'parent') await user.click(screen.getByRole('button', { name: 'Pilih asal: article#asal_wadah' }));
    else if (cara === 'tujuan') {
      await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
      pointer.mockReturnValue(tujuan);
      await user.click(tujuan);
    } else fireEvent(window, new Event(cara));
    expect(screen.queryByRole('img', { name: /Screenshot anotasi/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan.mock.calls[0][0]).not.toHaveProperty('gambar');
  });

  it('scroll editor tidak membatalkan screenshot dan pengguna dapat membuangnya', async () => {
    const { user } = await mulaiPasangan();
    await user.click(screen.getByRole('button', { name: 'Ambil screenshot' }));
    fireEvent.scroll(screen.getByRole('region', { name: 'Editor anotasi' }));
    expect(screen.getByRole('img', { name: /Screenshot anotasi/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Buang screenshot' }));
    expect(screen.queryByRole('img', { name: /Screenshot anotasi/ })).not.toBeInTheDocument();
  });

  it('retry simpan mempertahankan gambar dan ID, sedangkan perubahan geometri tidak memakai gambar lama', async () => {
    const { user, asal } = await mulaiPasangan();
    await user.click(screen.getByRole('button', { name: 'Ambil screenshot' }));
    api.simpan.mockRejectedValueOnce(new Error('server gagal'));
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(screen.getByRole('img', { name: /Screenshot anotasi/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan.mock.calls[1]).toEqual(api.simpan.mock.calls[0]);
    // Draft baru untuk memeriksa perubahan runtime di luar preview.
    await user.click(screen.getByRole('button', { name: 'Tandai elemen untuk agent' }));
    await user.click(asal);
    await user.type(screen.getByRole('textbox', { name: 'Instruksi untuk agent' }), 'Ubah');
    await user.click(screen.getByRole('button', { name: 'Ambil screenshot' }));
    (asal as HTMLElement).style.color = 'red';
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert')).toHaveTextContent('Area atau tampilan berubah');
  });

  it('Enter pada nilai CSS menerapkan preview tanpa menyimpan anotasi', async () => {
    const { user, asal } = await mulaiPasangan();
    await user.click(screen.getByRole('button', { name: 'Preview tampilan asal' }));
    const panel = within(screen.getByRole('region', { name: 'Preview asal' }));
    await user.type(panel.getByLabelText('Nilai CSS'), 'blue{Enter}');
    expect((asal as HTMLElement).style.color).toBe('blue');
    expect(api.simpan).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect((asal as HTMLElement).style.color).toBe('');
  });

  it('mengunci perubahan dan Reset preview sampai penyimpanan selesai', async () => {
    const { user, asal } = await mulaiPasangan();
    (asal as HTMLElement).style.color = 'red';
    const panel = await terapkanPreview(user, 'asal', 'color', 'blue');
    let selesai!: (anotasi: Anotasi) => void;
    api.simpan.mockImplementationOnce(() => new Promise((resolve) => { selesai = resolve; }));
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(panel.getByLabelText('Properti')).toBeDisabled();
    expect(panel.getByLabelText('Nilai CSS')).toBeDisabled();
    expect(panel.getByRole('button', { name: 'Reset preview' })).toBeDisabled();
    expect(panel.getByRole('button', { name: 'Terapkan preview' })).toBeDisabled();
    expect((asal as HTMLElement).style.color).toBe('blue');
    await act(async () => selesai(api.simpan.mock.calls[0][0]));
    expect((asal as HTMLElement).style.color).toBe('red');
  });

  it('menyimpan preview kedua elemen beserta sebelum/sesudah, lalu memulihkan tampilan', async () => {
    const { user, pointer, asal, tujuan } = await mulaiPasangan();
    (asal as HTMLElement).style.color = 'red';
    (tujuan as HTMLElement).style.color = 'green';
    const asalPanel = await terapkanPreview(user, 'asal', 'color', 'blue');
    expect(asalPanel.getByText('rgb(255, 0, 0) → rgb(0, 0, 255)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    expect((asal as HTMLElement).style.color).toBe('blue');
    await terapkanPreview(user, 'tujuan', 'color', 'yellow');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan).toHaveBeenCalledWith(expect.objectContaining({
      preview: expect.objectContaining({ sebelum: expect.objectContaining({ color: 'rgb(255, 0, 0)' }), sesudah: expect.objectContaining({ color: 'rgb(0, 0, 255)' }), perubahan: { color: 'blue' } }),
      tujuan: expect.objectContaining({ preview: expect.objectContaining({ perubahan: { color: 'yellow' } }) }),
    }));
    expect((asal as HTMLElement).style.color).toBe('red');
    expect((tujuan as HTMLElement).style.color).toBe('green');
  });

  it('nilai CSS salah tidak merusak preview aktif dan menampilkan error', async () => {
    const { user, asal } = await mulaiPasangan();
    await terapkanPreview(user, 'asal', 'color', 'blue');
    const panel = await terapkanPreview(user, 'asal', 'color', 'bukan_warna');
    expect(panel.getByRole('alert')).toHaveTextContent('Nilai CSS tidak valid');
    expect((asal as HTMLElement).style.color).toBe('blue');
  });

  it('Reset mengembalikan style dan anotasi berikutnya tidak menyimpan preview', async () => {
    const { user, asal } = await mulaiPasangan();
    (asal as HTMLElement).style.color = 'red';
    const panel = await terapkanPreview(user, 'asal', 'color', 'blue');
    await user.click(panel.getByRole('button', { name: 'Reset preview' }));
    expect((asal as HTMLElement).style.color).toBe('red');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan.mock.calls[0][0]).not.toHaveProperty('preview');
  });

  it.each(['Batal', 'Escape', 'pintasan'])('memulihkan preview saat editor dibatalkan melalui %s', async (cara) => {
    const { user, asal } = await mulaiPasangan();
    const awal = asal.getAttribute('style');
    await terapkanPreview(user, 'asal', 'color', 'blue');
    if (cara === 'Batal') await user.click(screen.getByRole('button', { name: 'Batal' }));
    else if (cara === 'Escape') await user.keyboard('{Escape}');
    else await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}');
    expect(asal.getAttribute('style')).toBe(awal);
    expect(screen.queryByRole('region', { name: 'Editor anotasi' })).not.toBeInTheDocument();
  });

  it('memulihkan preview asal ketika parent dipilih, tanpa menghapus instruksi', async () => {
    const { user, asal } = await mulaiPasangan();
    (asal as HTMLElement).style.color = 'red';
    await terapkanPreview(user, 'asal', 'color', 'blue');
    await user.click(screen.getByRole('button', { name: 'Pilih asal: article#asal_wadah' }));
    expect((asal as HTMLElement).style.color).toBe('red');
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan.mock.calls[0][0]).not.toHaveProperty('preview');
  });

  it('mempertahankan preview saat Simpan gagal, lalu memulihkannya ketika retry berhasil', async () => {
    const { user, asal } = await mulaiPasangan();
    (asal as HTMLElement).style.color = 'red';
    await terapkanPreview(user, 'asal', 'color', 'blue');
    api.simpan.mockRejectedValueOnce(new Error('gagal'));
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect((asal as HTMLElement).style.color).toBe('blue');
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan.mock.calls[1][0].preview?.perubahan).toEqual({ color: 'blue' });
    expect((asal as HTMLElement).style.color).toBe('red');
  });

  it('memulihkan preview tujuan lama saat tujuan diganti atau dihapus', async () => {
    const { user, pointer, asal, tujuan } = await mulaiPasangan();
    (tujuan as HTMLElement).style.color = 'green';
    await terapkanPreview(user, 'asal', 'color', 'blue');
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    await terapkanPreview(user, 'tujuan', 'color', 'yellow');
    await user.click(screen.getByRole('button', { name: 'Ganti tujuan' }));
    const lain = document.getElementById('tujuan_lain')!;
    pointer.mockReturnValue(lain);
    await user.click(lain);
    expect((tujuan as HTMLElement).style.color).toBe('green');
    await terapkanPreview(user, 'tujuan', 'color', 'purple');
    await user.click(screen.getByRole('button', { name: 'Hapus tujuan' }));
    expect(lain.style.color).toBe('');
    expect((asal as HTMLElement).style.color).toBe('blue');
  });

  it('memulihkan preview saat rute berubah dan ketika layer dilepas', async () => {
    const { user, asal, tampilan } = await mulaiPasangan();
    const awal = asal.getAttribute('style');
    await terapkanPreview(user, 'asal', 'color', 'blue');
    tampilan.rerender(<ThemeProvider><header aria-label="TopBar"><AnotasiLayer rute="/halaman_lain" /></header></ThemeProvider>);
    expect(asal.getAttribute('style')).toBe(awal);
    expect(screen.queryByRole('region', { name: 'Editor anotasi' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tandai elemen untuk agent' }));
    await user.click(asal);
    await terapkanPreview(user, 'asal', 'color', 'blue');
    tampilan.unmount();
    expect(asal.getAttribute('style')).toBe(awal);
  });

  it('menyimpan snapshot terbaru kedua elemen meskipun detail tidak dibuka', async () => {
    const { user, pointer, asal, tujuan } = await mulaiPasangan();
    asal.setAttribute('style', 'padding-left: 8px; color: red;');
    tujuan.setAttribute('style', 'margin-top: 12px; background-color: rgba(0, 0, 0, 0);');
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    // Data berubah setelah pemilihan; snapshot harus dibaca saat Simpan.
    (asal as HTMLElement).style.paddingLeft = '16px';
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan).toHaveBeenCalledWith(expect.objectContaining({
      style: expect.objectContaining({ 'padding-left': '16px', color: 'rgb(255, 0, 0)' }),
      tujuan: expect.objectContaining({ style: expect.objectContaining({ 'margin-top': '12px', 'background-color': 'rgba(0, 0, 0, 0)' }) }),
    }));
  });

  it('mempertahankan detail terbuka dan memperbarui nilainya saat parent dipilih', async () => {
    const { user, asal } = await mulaiPasangan();
    (asal as HTMLElement).style.paddingLeft = '8px';
    const parent = document.getElementById('asal_wadah')!;
    parent.style.paddingLeft = '24px';
    await user.click(screen.getByRole('button', { name: 'Detail tampilan asal' }));
    expect(within(screen.getByRole('region', { name: 'Style asal' })).getByText('8px')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pilih asal: article#asal_wadah' }));
    expect(screen.getByRole('button', { name: 'Detail tampilan asal' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(screen.getByRole('region', { name: 'Style asal' })).getByText('24px')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
  });

  it('menyimpan asal, parent tujuan, instruksi, dan posisi dalam satu anotasi', async () => {
    const { user, pointer, tujuan } = await mulaiPasangan();
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    expect(screen.queryByRole('region', { name: 'Editor anotasi' })).not.toBeInTheDocument();
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    const parent = screen.getByRole('button', { name: 'Pilih tujuan: section#tujuan_wadah' });
    await user.hover(parent);
    await user.click(parent);
    expect(parent).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
    await user.selectOptions(screen.getByLabelText('Posisi terhadap tujuan'), 'sebelum');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan).toHaveBeenCalledWith(expect.objectContaining({
      selector: '#asal_tombol', instruksi: 'Pindahkan ke container',
      tujuan: expect.objectContaining({ selector: '#tujuan_wadah', tag: 'section', posisi: 'sebelum' }),
    }));
    await user.click(screen.getByRole('button', { name: 'Buka daftar anotasi (1)' }));
    const daftar = within(screen.getByRole('region', { name: 'Daftar anotasi UI' }));
    expect(daftar.getByText('Asal:')).toBeInTheDocument();
    expect(daftar.getByText('#tujuan_wadah')).toBeInTheDocument();
    expect(daftar.getByText('Tujuan · Sebelum:')).toBeInTheDocument();
  });

  it('memilih parent asal lewat keyboard tanpa menghapus instruksi', async () => {
    const { user } = await mulaiPasangan();
    const parent = screen.getByRole('button', { name: 'Pilih asal: article#asal_wadah' });
    act(() => parent.focus());
    await user.keyboard('{Enter}');
    expect(parent).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(api.simpan).toHaveBeenCalledWith(expect.objectContaining({ selector: '#asal_wadah' }));
    expect(api.simpan.mock.calls[0][0]).not.toHaveProperty('tujuan');
  });

  it('Escape saat memilih tujuan mempertahankan asal, tujuan lama, posisi, dan instruksi', async () => {
    const { user, pointer, tujuan } = await mulaiPasangan();
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    await user.selectOptions(screen.getByLabelText('Posisi terhadap tujuan'), 'sesudah');
    await user.click(screen.getByRole('button', { name: 'Ganti tujuan' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
    expect(screen.getByLabelText('Posisi terhadap tujuan')).toHaveValue('sesudah');
    expect(within(screen.getByRole('region', { name: 'Elemen tujuan' })).getByText('#tujuan_teks')).toBeInTheDocument();
    expect(api.simpan).not.toHaveBeenCalled();
  });

  it('button batal memilih tujuan mengembalikan draft tanpa tujuan', async () => {
    const { user } = await mulaiPasangan();
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    await user.click(screen.getByRole('button', { name: 'Batal memilih tujuan' }));
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
    expect(screen.queryByRole('region', { name: 'Elemen tujuan' })).not.toBeInTheDocument();
  });

  it('mengganti lalu menghapus tujuan dan tetap dapat menyimpan anotasi biasa', async () => {
    const { user, pointer, tujuan } = await mulaiPasangan();
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    await user.click(screen.getByRole('button', { name: 'Ganti tujuan' }));
    const lain = document.getElementById('tujuan_lain')!;
    pointer.mockReturnValue(lain);
    await user.click(lain);
    expect(within(screen.getByRole('region', { name: 'Elemen tujuan' })).getByText('#tujuan_lain')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hapus tujuan' }));
    expect(screen.queryByLabelText('Posisi terhadap tujuan')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan.mock.calls[0][0]).not.toHaveProperty('tujuan');
  });

  it('menolak tujuan yang sama dengan asal tanpa menjalankan aksi komponen', async () => {
    const { user, pointer, asal, tujuan } = await mulaiPasangan();
    const aksi = vi.fn();
    asal.addEventListener('click', aksi);
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    pointer.mockReturnValue(asal);
    await user.click(asal);
    expect(screen.getByRole('alert')).toHaveTextContent('Pilih tujuan yang berbeda');
    expect(aksi).not.toHaveBeenCalled();
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
  });

  it('mempertahankan seluruh draft saat simpan gagal dan dapat dicoba kembali', async () => {
    const { user, pointer, tujuan } = await mulaiPasangan();
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    api.simpan.mockRejectedValueOnce(new Error('dev server gagal'));
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
    expect(screen.getByLabelText('Posisi terhadap tujuan')).toHaveValue('di_dalam');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(api.simpan).toHaveBeenCalledTimes(2);
    expect(api.simpan.mock.calls[1][0].tujuan?.selector).toBe('#tujuan_teks');
    expect(screen.queryByRole('region', { name: 'Editor anotasi' })).not.toBeInTheDocument();
  });

  it('tidak menghapus draft lewat pintasan selama penyimpanan berlangsung', async () => {
    const { user } = await mulaiPasangan();
    let selesai!: (anotasi: Anotasi) => void;
    api.simpan.mockImplementationOnce(() => new Promise((resolve) => { selesai = resolve; }));
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(screen.getByRole('button', { name: 'Menyimpan…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pilih tujuan' })).toBeDisabled();
    await user.keyboard('{Escape}{Control>}{Shift>}a{/Shift}{/Control}');
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan ke container');
    await act(async () => selesai(api.simpan.mock.calls[0][0]));
    expect(screen.queryByRole('region', { name: 'Editor anotasi' })).not.toBeInTheDocument();
  });

  it('membatalkan pemilihan tujuan dan menyimpan pasangan dalam dialog tanpa menutup dialog', async () => {
    const user = userEvent.setup();
    const tutup = vi.fn();
    render(
      <ThemeProvider>
        <Dialog open onOpenChange={tutup}>
          <DialogContent showCloseButton={false}>
            <DialogHeader><DialogTitle>Dialog pasangan</DialogTitle><DialogDescription>Uji pemilihan tujuan.</DialogDescription></DialogHeader>
            <button type="button" id="asal_modal">Tombol modal</button>
            <section id="tujuan_modal" aria-label="Container modal">Tujuan modal</section>
          </DialogContent>
        </Dialog>
        <AnotasiLayer />
      </ThemeProvider>,
    );
    const asal = screen.getByRole('button', { name: 'Tombol modal' });
    const pointer = vi.spyOn(document, 'elementFromPoint').mockReturnValue(asal);
    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}');
    await user.click(asal);
    await user.type(screen.getByRole('textbox', { name: 'Instruksi untuk agent' }), 'Pindahkan tombol modal');
    await user.click(screen.getByRole('button', { name: 'Detail tampilan asal' }));
    expect(screen.getByRole('region', { name: 'Style asal' })).toBeInTheDocument();
    expect(tutup).not.toHaveBeenCalled();
    const styleAwal = asal.getAttribute('style');
    await terapkanPreview(user, 'asal', 'color', 'blue');
    expect(tutup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    await user.keyboard('{Escape}');
    expect(tutup).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan tombol modal');
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    const tujuan = screen.getByRole('region', { name: 'Container modal' });
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Ambil screenshot' }));
    await user.click(screen.getByRole('button', { name: 'Perbesar screenshot' }));
    expect(tutup).not.toHaveBeenCalled();
    expect(within(screen.getByRole('dialog')).getByRole('img', { name: /Screenshot anotasi/ })).toBeInTheDocument();
    screen.getByRole('textbox', { name: 'Instruksi untuk agent' }).focus();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(api.simpan).toHaveBeenCalledWith(expect.objectContaining({ selector: '#asal_modal', tujuan: expect.objectContaining({ selector: '#tujuan_modal', posisi: 'di_dalam' }), gambar: expect.any(Object) }), expect.any(Blob));
    expect(tutup).not.toHaveBeenCalled();
    expect(screen.getByText('Dialog pasangan')).toBeInTheDocument();
    expect(asal.getAttribute('style')).toBe(styleAwal);
  });

  it('menyediakan kontrol di TopBar dan membuka serta menutup daftar dari sana', async () => {
    const user = userEvent.setup();
    api.muat.mockResolvedValue([CATATAN]);
    tampilkan();

    const topbar = within(screen.getByRole('banner', { name: 'TopBar' }));
    const daftar = await topbar.findByRole('button', { name: 'Buka daftar anotasi (1)' });
    expect(topbar.getByRole('button', { name: 'Tandai elemen untuk agent' })).toBeInTheDocument();
    expect(daftar).toHaveAttribute('aria-expanded', 'false');

    await user.click(daftar);
    expect(screen.getByRole('region', { name: 'Daftar anotasi UI' })).toBeInTheDocument();
    expect(daftar).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Tutup daftar anotasi' }));
    expect(screen.queryByRole('region', { name: 'Daftar anotasi UI' })).not.toBeInTheDocument();
    expect(daftar).toHaveAttribute('aria-expanded', 'false');
  });

  it('menyimpan anotasi elemen yang diklik', async () => {
    const user = userEvent.setup();
    const target = document.createElement('button');
    target.textContent = 'Tombol target';
    document.body.appendChild(target);

    target.getBoundingClientRect = () => ({
      left: 20, top: 30, right: 120, bottom: 60,
      width: 100, height: 30, x: 20, y: 30, toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);

    tampilkan();
    await user.click(screen.getByRole('button', { name: 'Tandai elemen untuk agent' }));

    expect(screen.getByText(/Klik elemen untuk diberi instruksi/)).toBeInTheDocument();

    await user.click(target);
    const input = await screen.findByRole('textbox', { name: 'Instruksi untuk agent' });
    await user.type(input, 'Samakan font NIS');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));

    expect(api.simpan).toHaveBeenCalledWith(expect.objectContaining({
      rute: '/',
      tag: 'button',
      teks: 'Tombol target',
      selector: 'body > button',
      instruksi: 'Samakan font NIS',
    }));
    expect(screen.queryByRole('textbox', { name: 'Instruksi untuk agent' })).not.toBeInTheDocument();
  });

  it('mengaktifkan mode tandai lewat pintasan dan menandai elemen dalam dialog', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <Dialog open>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Uji modal</DialogTitle>
              <DialogDescription>Dialog untuk menguji anotasi.</DialogDescription>
            </DialogHeader>
            <button type="button">Tombol dalam modal</button>
          </DialogContent>
        </Dialog>
        <AnotasiLayer />
      </ThemeProvider>,
    );

    const target = screen.getByRole('button', { name: 'Tombol dalam modal' });
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);

    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}');
    expect(await screen.findByText(/Klik elemen untuk diberi instruksi/)).toBeInTheDocument();

    await user.click(target);
    const input = document.querySelector<HTMLTextAreaElement>('#input_instruksi_anotasi');
    expect(input).not.toBeNull();
    await waitFor(() => expect(input).toHaveFocus());

    await user.type(input!, 'Perbaiki tombol modal');
    expect(input).toHaveValue('Perbaiki tombol modal');

    await user.keyboard('{Escape}');
    expect(document.querySelector('#input_instruksi_anotasi')).toBeNull();
    expect(screen.getByText('Uji modal')).toBeInTheDocument();
  });

  it('menampilkan daftar anotasi dan menghapus entri', async () => {
    const user = userEvent.setup();
    api.muat.mockResolvedValue([CATATAN]);

    tampilkan();
    await user.click(screen.getByRole('button', { name: /Buka daftar anotasi/ }));

    expect(await screen.findByText('Perbesar tombol simpan')).toBeInTheDocument();
    expect(screen.getByText('src/pages/PenilaianLegerPage.tsx:42')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Hapus anotasi/ }));

    expect(api.hapus).toHaveBeenCalledWith('a1');
    await waitFor(() => {
      expect(screen.queryByText('Perbesar tombol simpan')).not.toBeInTheDocument();
    });
  });
});
