import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { EditSantriDialog } from './EditSantriDialog';
import type { SantriPenuh } from '@/api/santri';
import { renderDenganTema } from '@/test/utils';

// react-resizable-panels tidak jalan di jsdom — ganti panel bungkus datar.
vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
  ResizablePanel: ({ children }: { children: ReactNode }) => <>{children}</>,
  ResizableHandle: () => null,
}));
// Dialog butuh izin lihat dokumen untuk kolom viewer.
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: { permissions: ['dokumen_santri.lihat'], roles: [{ name: 'super_admin' }] } }),
}));
vi.mock('@/api/dokumen', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/dokumen')>();
  return {
    ...asli,
    listDokumen: vi.fn(async () => ({ data: [], current_page: 1, last_page: 1, total: 0 })),
  };
});

const update = vi.fn(async (_id: number, _p: unknown) => {});
// Pesan validasi lewat toast; tanpa <Toaster /> di test cukup memeriksa pemanggilnya.
// `vi.hoisted` karena `vi.mock` di-hoist ke atas file.
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock('@/api/santri', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/santri')>();
  return { ...asli, updateSantri: (id: number, p: unknown) => update(id, p) };
});

const SANTRI = {
  id: 7,
  nama_lengkap: 'Ahmad Fauzi',
  nama_singkat: null,
  nik: '3201011505950001',
  nisn: null,
  tmp_lahir: 'Bandung',
  tgl_lahir: '1995-05-15',
  jk: 'L',
  tipe_santri: 'asrama',
  is_active_pst: 'Ya',
  agama: 'Islam',
  ayah_nama: 'Budi',
  email_santri: 'fauzi@example.com',
} as unknown as SantriPenuh;

function renderDialog() {
  const Komponen = EditSantriDialog;
  return renderDenganTema(
    <Komponen santri={SANTRI} open onOpenChange={() => {}} />
  );
}

beforeEach(() => {
  update.mockClear();
  // PenampilBerkas mengukur wadah via ResizeObserver (tak ada di jsdom).
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

describe('EditSantriDialog', () => {
  it('mengelompokkan field per bagian dan panel, bukan satu daftar panjang', async () => {
    renderDialog();

    for (const judul of ['Identitas', 'Alamat', 'Keluarga']) {
      expect(screen.getByRole('heading', { level: 3, name: judul })).toBeInTheDocument();
    }
    for (const judul of ['Identitas dasar', 'Tambahan', 'Ayah', 'Ibu', 'Wali', 'Kartu keluarga']) {
      expect(screen.getByText(judul)).toBeInTheDocument();
    }
  });

  it('menampilkan input untuk field yang bisa diedit, dan tidak untuk field baca-saja', async () => {
    renderDialog();

    // Dialog dirender lewat portal ke body, jadi kueri di document.
    expect(document.querySelector('#input_edit_santri_nama')).not.toBeNull();
    expect(document.querySelector('#input_edit_santri_nik')).not.toBeNull();
    expect(document.querySelector('#input_edit_santri_ayah_nama')).not.toBeNull();
    // `id` hanya tampil di profil, tidak punya kolom → tidak ada input.
    expect(document.querySelector('#input_edit_santri_id')).toBeNull();
  });

  it('satu kolom: panel disusun ke bawah, bukan berdampingan', async () => {
    renderDialog();

    // Wadah panel tiap bagian: satu kolom (tanpa grid 2 kolom).
    const bagianIdentitas = document.querySelectorAll('section')[0] as HTMLElement;
    const wadah = bagianIdentitas.querySelector('h3')?.nextElementSibling as HTMLElement;
    expect(wadah.className).toContain('space-y-4');
    expect(wadah.className).not.toContain('sm:grid-cols-2');

    // Beberapa panel tersusun di dalam satu wadah, berurutan vertikal.
    const fieldset = Array.from(wadah.querySelectorAll('fieldset'));
    expect(fieldset.length).toBeGreaterThan(1);
  });

  it('baris field inline: label dan kontrol satu baris, baris berdempet tanpa jarak', async () => {
    renderDialog();

    const nik = document.querySelector('#input_edit_santri_nik') as HTMLElement;
    const baris = nik.parentElement as HTMLElement;
    const kelas = baris.className;

    // Dua kolom: label | kontrol, disejajarkan di tengah baris.
    expect(kelas).toContain('grid-cols-[minmax(0,8rem)_minmax(0,1fr)]');
    expect(kelas).toContain('items-center');
    // Baris berdempet: dipisah garis, bukan jarak.
    expect(kelas).toContain('border-t');
    expect(kelas).not.toMatch(/gap-[xy]/);
    // Kontrol menyatu ke baris: tanpa kotak sendiri, tanpa garis dobel.
    expect(nik.className).toContain('border-0');
    expect(nik.className).toContain('bg-transparent');
    expect(nik.className).toContain('shadow-none');
    // Pembatas baris dikumpulkan di satu wadah bergaris.
    const wadah = baris.parentElement as HTMLElement;
    expect(wadah.className).toContain('rounded-lg');
    expect(wadah.className).toContain('border');
    // Label benar-benar di baris yang sama dan tertaut ke kontrolnya.
    const label = baris.querySelector('label') as HTMLElement;
    expect(label.getAttribute('for')).toBe('input_edit_santri_nik');
  });

  it('menandai baris yang diubah dengan warna aksen (belum disimpan)', async () => {
    const user = userEvent.setup();
    renderDialog();

    const nik = document.querySelector('#input_edit_santri_nik') as HTMLElement;
    const barisNik = nik.parentElement as HTMLElement;
    expect(barisNik.className).not.toContain('bg-accent');

    await user.clear(nik);
    await user.type(nik, '3273010101000001');

    // Baris berubah → latar aksen pada baris dan pada kontrolnya.
    expect(barisNik.className).toContain('bg-accent/10');
    expect(nik.className).toContain('bg-accent/15');
  });

  it('dialog penuhi layar bermargin 24px dan area isi mengisi sisa tinggi', async () => {
    renderDialog();

    const konten = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(konten.style.inset).toBe('24px');
    expect(konten.style.display).toBe('flex');

    const form = document.querySelector('form') as HTMLElement;
    expect(form.className).toContain('h-full');
    expect(form.className).toContain('min-h-0');
    expect(form.className).toContain('overflow-y-auto');
    expect(form.className).not.toContain('h-[60vh]');
  });

  it('menyimpan isian yang diubah', async () => {
    const user = userEvent.setup();
    renderDialog();

    const nik = document.querySelector('#input_edit_santri_nik') as HTMLInputElement;
    await user.clear(nik);
    await user.type(nik, '3273010101000001');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));

    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0]).toBe(7);
    expect(update.mock.calls[0][1]).toMatchObject({ nik: '3273010101000001' });
  });

  it('menolak simpan bila ada field tidak valid', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Kolom NISN mewajibkan 10 digit.
    const nisn = document.querySelector('#input_edit_santri_nisn') as HTMLInputElement;
    await user.type(nisn, '123');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));

    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/NISN harus 10 digit angka/);
    expect(update).not.toHaveBeenCalled();
  });

  it('navigasi santri tetangga melingkar seurutan daftar', async () => {
    const user = userEvent.setup();
    const ganti = vi.fn();
    const kedua = { ...SANTRI, id: 8, nama_lengkap: 'Budi Santoso' };
    renderDenganTema(
      <EditSantriDialog santri={SANTRI as SantriPenuh} daftar={[SANTRI as SantriPenuh, kedua as SantriPenuh]} onGanti={ganti} open onOpenChange={() => {}} />
    );

    await user.click(document.querySelector('#btn_santri_berikut_edit_santri') as HTMLElement);
    expect(ganti).toHaveBeenCalledWith(kedua);
    ganti.mockClear();
    // Dari santri pertama, mundur melingkar ke terakhir (= kedua di daftar 2 ini).
    await user.click(document.querySelector('#btn_santri_sebelum_edit_santri') as HTMLElement);
    expect(ganti).toHaveBeenCalledWith(kedua);
  });

  it('tanpa daftar tidak ada navigasi santri', async () => {
    renderDialog();

    expect(document.querySelector('#btn_santri_sebelum_edit_santri')).toBeNull();
    expect(document.querySelector('#btn_santri_berikut_edit_santri')).toBeNull();
  });
});
