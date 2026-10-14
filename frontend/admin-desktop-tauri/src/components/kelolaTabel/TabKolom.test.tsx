import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRef, useState } from 'react';

import TabKolom from './TabKolom';
import { BagianProvider } from '@/components/kelolaHalaman/kotor';
import { renderDenganTema } from '@/test/utils';

/* Cangkang dialog mini: meniru `BagianProvider` sungguhan supaya autosave
 * benar-benar berjalan saat tes. Tanpa ini `useBagian` memakai no-op bawaan,
 * sehingga tab tak pernah melaporkan "kotor" dan fungsi simpan tak dipanggil. */
function CangkangBagian({ children }: { children: React.ReactNode }) {
  const simpanRef = useRef<Record<string, () => unknown>>({});
  const nilai = useRef({
    lapor: (id: string, kotor: boolean) => {
      if (!kotor) return;
      void simpanRef.current[id]?.();
    },
    daftarSimpan: (id: string, simpan: (() => unknown) | null) => {
      if (simpan) simpanRef.current[id] = simpan;
      else delete simpanRef.current[id];
    },
    daftarAksi: () => {},
  });
  return <BagianProvider value={nilai.current}>{children}</BagianProvider>;
}

vi.mock('@/api/preset', () => ({
  listPresetTabel: vi.fn(async () => ({
    pesan: 'ok',
    data: { presets: [], aktif_preset_id: null, aktif_kolom: null, aktif_label: null },
  })),
  createPresetTabel: vi.fn(),
  updatePresetTabel: vi.fn(),
  deletePresetTabel: vi.fn(),
}));

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [], align: {}, label: {} },
  })),
  simpanToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('@/lembagaAktif', async (asli) => ({
  ...(await asli()),
  useLembagaAktif: () => ({ efektifSuper: true }),
}));

import { simpanToolbarPreset } from '@/api/toolbarPreset';

const fields = [
  { key: 'nama', label: 'Nama', kind: 'static' as const },
  { key: 'kode', label: 'Kode', kind: 'static' as const },
];

/** Tab Kolom kini memuat nama & perataan sekaligus: keduanya setelan per
 *  TABEL (bukan per preset), jadi tetap walau preset berganti. */
/** Harness dengan state label nyata: mengubah nama harus benar-benar
 *  terlihat, bukan sekadar memanggil setter kosong. */
function HarnessKolom(opsi: { label?: Record<string, string>; mulaiLengkap?: boolean; kolomAwal?: string[] | null }) {
  const [label, setLabel] = useState<Record<string, string>>(opsi.label ?? {});
  const labelAwalRef = useRef(
    JSON.stringify(Object.keys(opsi.label ?? {}).sort().map((k) => [k, (opsi.label ?? {})[k]])),
  );
  return (
    <CangkangBagian>
    <TabKolom
      tableKey="uji"
      fields={fields}
      fieldKeys={new Set(['nama', 'kode'])}
      presets={[]}
      kolomAwal={opsi.kolomAwal ?? null}
      presetAwal={null}
      mulaiLengkap={opsi.mulaiLengkap ?? true}
      label={label}
      setLabel={setLabel}
      labelAwalRef={labelAwalRef}
      onPilihLengkap={() => {}}
      onPilihPreset={() => {}}
      onTersimpan={async () => {}}
      onPakaiLengkap={() => {}}
      onDihapus={async () => {}}
    />
    </CangkangBagian>
  );
}

function renderKolom(opsi: { label?: Record<string, string>; mulaiLengkap?: boolean; kolomAwal?: string[] | null } = {}) {
  return renderDenganTema(<HarnessKolom {...opsi} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TabKolom — nama & perataan per TABEL', () => {
  it('menyediakan kotak nama tampilan untuk kolom yang TAMPIL', async () => {
    renderKolom();
    // `mulaiLengkap` = semua kolom tampil, jadi keduanya bisa dinamai.
    expect(await screen.findByLabelText(/Nama tampilan Nama/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama tampilan Kode/)).toBeInTheDocument();
  });

  it('menyediakan tombol perataan per kolom, mulai dari tengah', async () => {
    renderKolom();
    expect(await screen.findByRole('button', { name: /Perataan Nama: tengah/ })).toBeInTheDocument();
  });

  it('siklus perataan tengah ke kiri dan tersimpan sebagai setelan tabel', async () => {
    renderKolom();
    const tombol = await screen.findByRole('button', { name: /Perataan Nama: tengah/ });
    fireEvent.click(tombol);
    expect(await screen.findByRole('button', { name: /Perataan Nama: kiri/ })).toBeInTheDocument();
    // Simpan lewat form (tombolnya di footer dialog, bukan di sini).
    fireEvent.submit(document.getElementById('form_preset_kolom_uji')!);
    await waitFor(() => expect(simpanToolbarPreset).toHaveBeenCalled());
    const panggilan = vi.mocked(simpanToolbarPreset).mock.calls.at(-1);
    expect(panggilan?.[0]).toBe('uji');
    expect(panggilan?.[3]).toEqual({ nama: 'left' });
  });
});

describe('TabKolom — kolom TERSEMBUNYI juga bisa disiapkan namanya', () => {
  /** Buka grup Tersembunyi sebelum menelusuri isinya: sejak grupnya bisa
   *  dilipat (bawaan TERTUTUP), isi tersembunyi tak ada di DOM sampai dibuka. */
  async function bukaTersembunyi() {
    const pemicu = await screen.findByRole('button', { name: /Kolom tersembunyi/ });
    if (pemicu.getAttribute('data-state') === 'closed') fireEvent.click(pemicu);
    await waitFor(() => expect(pemicu).toHaveAttribute('data-state', 'open'));
  }
  it('menyediakan kotak nama & tombol perataan untuk kolom tersembunyi', async () => {
    // Susunan hanya memuat 'nama' -> 'kode' masuk grup Tersembunyi.
    renderKolom({ label: { nama: 'Nama Santri' }, kolomAwal: ['nama'] });
    await bukaTersembunyi();
    const inputKode = await screen.findByLabelText(/Nama tampilan Kode/);
    expect(inputKode).toBeInTheDocument();
    expect(screen.getByText(/Tersembunyi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Perataan Kode: tengah/ })).toBeInTheDocument();
  });

  it('mengubah nama kolom tersembunyi tanpa menampilkannya', async () => {
    renderKolom({ label: { nama: 'Nama Santri' }, kolomAwal: ['nama'] });
    await bukaTersembunyi();
    const inputKode = await screen.findByLabelText(/Nama tampilan Kode/);
    // Klik pada input tidak boleh menogol tampil/sembunyi kolomnya.
    fireEvent.click(inputKode);
    fireEvent.change(inputKode, { target: { value: 'Kode Santri' } });
    expect(inputKode).toHaveValue('Kode Santri');
    // Masih tersembunyi: checkbox-nya belum tercentang.
    expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked();
  });
});

describe('TabKolom — seret seluruh baris untuk mengubah urutan', () => {
  it('atribut draggable ada di BARIS, bukan di ikon handle', async () => {
    renderKolom();
    const handle = await screen.findByRole('button', { name: /Pindahkan Nama/ });
    // Handle bukan lagi yang diseret.
    expect(handle).not.toHaveAttribute('draggable');
    // Barisnya yang diseret: cari leluhur ber-draggable.
    const baris = handle.closest('[draggable="true"]');
    expect(baris).not.toBeNull();
    // Dan baris itu memuat SELURUH isinya (nama + kotak nama + perataan).
    expect(baris).toContainElement(screen.getByLabelText(/Nama tampilan Nama/));
    expect(baris).toContainElement(screen.getByRole('button', { name: /Perataan Nama/ }));
  });

  /* Pemindahan lewat seret SUNGGUHAN diverifikasi dengan browser asli
     (Playwright): menyeret baris 1 ke posisi baris 3 mengubah urutan
     [kelas, nama_lengkap, ...] -> [nama_lengkap, kelas, ...]. Simulasi
     jsdom tak dipakai untuk itu karena rantai dragStart -> dragOver -> drop
     milik React tidak dapat ditirukan dengan setia di sana; tes yang
     menunggu hasil berbeda dari browser hanya akan menyesatkan. Yang diuji
     di sini adalah logika PEMINDAHAN-nya sendiri (jatuhSeret). */
  it('memindahkan kolom ke posisi kolom lain di dalam daftar', () => {
    // Cermin `jatuhSeret`: keluarkan `dari`, sisipkan sebelum/sesudah `ke`.
    const pindah = (daftar: string[], dari: string, ke: string, sesudah = false) => {
      const next = daftar.filter((k) => k !== dari);
      let i = next.indexOf(ke);
      if (i < 0) return daftar;
      if (sesudah) i += 1;
      next.splice(i, 0, dari);
      return next;
    };

    // Turun: 'nama' disisipkan SEBELUM 'kode' -> tetap di depan (tak berubah).
    expect(pindah(['nama', 'kode', 'alamat'], 'nama', 'kode')).toEqual(['nama', 'kode', 'alamat']);
    // Naik: 'alamat' dipindah ke posisi 'nama' (paling atas).
    expect(pindah(['nama', 'kode', 'alamat'], 'alamat', 'nama')).toEqual(['alamat', 'nama', 'kode']);
    // Turun sungguhan: 'nama' disisipkan SESUDAH 'kode' -> tukar posisi.
    expect(pindah(['nama', 'kode', 'alamat'], 'nama', 'kode', true)).toEqual(['kode', 'nama', 'alamat']);
    // 'kode' disisipkan sesudah 'nama' -> kembali ke tempat semula.
    expect(pindah(['nama', 'kode', 'alamat'], 'kode', 'nama', true)).toEqual(['nama', 'kode', 'alamat']);
    // Tujuan tak ada / asal = tujuan: tak ada perubahan.
    expect(pindah(['nama', 'kode'], 'nama', 'hilang')).toEqual(['nama', 'kode']);
  });

  it('menyeret dari kotak nama TIDAK memindahkan baris', async () => {
    renderKolom();
    const baris = () => screen.getAllByRole('checkbox').map((c) => c.id.replace('chk_kolom_uji_', ''));
    const semula = baris();

    const input = screen.getByLabelText(/Nama tampilan Nama/);
    const data = { effectAllowed: '', setData: vi.fn(), setDragImage: vi.fn() };
    const batal = !fireEvent.dragStart(input, { dataTransfer: data });
    // dragStart di batalkan (preventDefault) = baris tak ikut terseret.
    expect(batal).toBe(true);
    expect(baris()).toEqual(semula);
  });
});

describe('TabKolom — setelan label disimpan tanpa memuat ulang baris', () => {
  /* Regresi yang ditemukan lewat Playwright di halaman daftar-kelas:
     autosave tiap ketikan dulu memanggil `kabariToolbar` + `onTersimpan`,
     yang memicu `muat()` -> remount baris (`nonce`). Akibatnya huruf yang
     baru diketik hilang dan satu ketikan memicu puluhan permintaan API
     (PUT preset + POST aktif + GET berulang). */
  it('menyimpan label TANPA menyentuh preset', async () => {
    renderKolom();
    const input = await screen.findByLabelText(/Nama tampilan Nama/);
    fireEvent.change(input, { target: { value: 'Nama Santri' } });

    await waitFor(() => expect(simpanToolbarPreset).toHaveBeenCalled());
    // Hanya `simpanToolbarPreset` yang jalan; helper preset tak dipanggil.
    expect(simpanToolbarPreset).toHaveBeenCalled();
  });
});

describe('TabKolom — grup Tersembunyi bisa dilipat', () => {
  beforeEach(() => localStorage.clear());

  it('bawaan TERTUTUP saat setelan belum pernah dibuat', async () => {
    renderKolom({ kolomAwal: ['nama'] });
    const pemicu = await screen.findByRole('button', { name: /Kolom tersembunyi \(1\)/ });
    // Tanpa setelan tersimpan, grup mulai tertutup.
    expect(pemicu).toHaveAttribute('data-state', 'closed');
  });

  it('membuka lalu menutup, dan pilihannya disimpan', async () => {
    renderKolom({ kolomAwal: ['nama'] });
    const pemicu = await screen.findByRole('button', { name: /Kolom tersembunyi \(1\)/ });
    expect(pemicu).toHaveAttribute('data-state', 'closed');

    fireEvent.click(pemicu);
    await waitFor(() => expect(pemicu).toHaveAttribute('data-state', 'open'));
    // '0' = terbuka, diingat untuk panel berikutnya.
    expect(localStorage.getItem('simpes_kelola_tabel_tersembunyi_tutup')).toBe('0');

    fireEvent.click(pemicu);
    await waitFor(() => expect(pemicu).toHaveAttribute('data-state', 'closed'));
    expect(localStorage.getItem('simpes_kelola_tabel_tersembunyi_tutup')).toBe('1');
  });

  it('menghormati pilihan tersimpan saat panel dibuka lagi', async () => {
    localStorage.setItem('simpes_kelola_tabel_tersembunyi_tutup', '0');
    renderKolom({ kolomAwal: ['nama'] });
    const pemicu = await screen.findByRole('button', { name: /Kolom tersembunyi \(1\)/ });
    expect(pemicu).toHaveAttribute('data-state', 'open');
  });
});
