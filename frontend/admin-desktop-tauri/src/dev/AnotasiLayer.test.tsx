import { act, render, screen, waitFor, within } from '@testing-library/react';
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

const api = vi.hoisted(() => ({
  muat: vi.fn<() => Promise<Anotasi[]>>(async () => []),
  simpan: vi.fn<(anotasi: Anotasi) => Promise<Anotasi>>(async (anotasi) => anotasi),
  hapus: vi.fn<(id: string) => Promise<void>>(async () => {}),
}));

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
  tampilkan();
  await user.click(screen.getByRole('button', { name: 'Tandai elemen untuk agent' }));
  await user.click(asal);
  await user.type(screen.getByRole('textbox', { name: 'Instruksi untuk agent' }), 'Pindahkan ke container');
  return { user, pointer, asal, tujuan };
}

describe('AnotasiLayer', () => {
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
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    await user.keyboard('{Escape}');
    expect(tutup).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveValue('Pindahkan tombol modal');
    await user.click(screen.getByRole('button', { name: 'Pilih tujuan' }));
    const tujuan = screen.getByRole('region', { name: 'Container modal' });
    pointer.mockReturnValue(tujuan);
    await user.click(tujuan);
    expect(screen.getByRole('textbox', { name: 'Instruksi untuk agent' })).toHaveFocus();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(api.simpan).toHaveBeenCalledWith(expect.objectContaining({ selector: '#asal_modal', tujuan: expect.objectContaining({ selector: '#tujuan_modal', posisi: 'di_dalam' }) }));
    expect(tutup).not.toHaveBeenCalled();
    expect(screen.getByText('Dialog pasangan')).toBeInTheDocument();
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
