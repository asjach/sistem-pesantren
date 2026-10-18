import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Paginate } from '@/api/master';
import { useDaftarTabel, type ArgsMuat } from '@/hooks/useDaftarTabel';

/* usePager membaca pref + pengaturan global; keduanya distub agar tes fokus
   pada logika useDaftarTabel (debounce, race, paginasi). */
vi.mock('@/api/pengaturanGlobal', () => ({
  muatPengaturanGlobal: async () => ({ pesan: 'ok', data: { peta: {} } }),
}));

type Baris = { id: number; nama: string };

const halaman = (data: Baris[], over: Partial<Paginate<Baris>> = {}): Paginate<Baris> => ({
  data,
  current_page: 1,
  last_page: 1,
  total: data.length,
  per_page: 50,
  ...over,
} as Paginate<Baris>);

describe('useDaftarTabel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('memuat saat pager siap dan mengisi rows/total', async () => {
    const ambil = vi.fn(async () => halaman([{ id: 1, nama: 'A' }]));
    const { result } = renderHook(() => useDaftarTabel<Baris>({ tableKey: 't1', ambil }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(ambil).toHaveBeenCalledTimes(1);
    expect(result.current.rows).toEqual([{ id: 1, nama: 'A' }]);
    expect(result.current.total).toBe(1);
  });

  it('meneruskan signal AbortSignal ke pemanggil', async () => {
    const ambil = vi.fn(async (_a: ArgsMuat) => halaman([]));
    const { result } = renderHook(() => useDaftarTabel<Baris>({ tableKey: 't2', ambil }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const arg = ambil.mock.calls[0][0] as ArgsMuat;
    expect(arg.signal).toBeInstanceOf(AbortSignal);
  });

  /* INTI: balasan lama yang tiba SETELAH balasan baru harus diabaikan, supaya
     tabel tak menampilkan hasil query yang sudah tak relevan. */
  it('mengabaikan balasan lama yang tiba setelah balasan baru', async () => {
    const tunda: Array<() => void> = [];
    let panggil = 0;
    const ambil = vi.fn(async () => {
      const ke = panggil++;
      await new Promise<void>((r) => tunda.push(r));
      return halaman([{ id: ke, nama: ke === 0 ? 'LAMA' : 'BARU' }]);
    });

    const { result } = renderHook(() => useDaftarTabel<Baris>({ tableKey: 't3', ambil }));
    await waitFor(() => expect(ambil).toHaveBeenCalledTimes(1));

    // Muat ulang paksa -> request kedua jalan sebelum yang pertama selesai.
    act(() => { void result.current.load(); });
    await waitFor(() => expect(ambil).toHaveBeenCalledTimes(2));

    // Selesaikan yang BARU dulu, lalu yang LAMA.
    await act(async () => { tunda[1]?.(); });
    await act(async () => { tunda[0]?.(); });

    expect(result.current.rows).toEqual([{ id: 1, nama: 'BARU' }]);
  });

  it('mengabaikan error dari request yang sudah dibatalkan', async () => {
    let panggil = 0;
    const ambil = vi.fn(async (a: ArgsMuat) => {
      const ke = panggil++;
      if (ke === 0) {
        // Request pertama menggantung sampai di-abort, lalu menolak.
        await new Promise<void>((_r, rej) => {
          a.signal?.addEventListener('abort', () => rej(new Error('dibatalkan')));
        });
      }
      return halaman([]);
    });

    const { result } = renderHook(() => useDaftarTabel<Baris>({ tableKey: 't4', ambil }));
    await waitFor(() => expect(ambil).toHaveBeenCalledTimes(1));
    act(() => { void result.current.load(); });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.err).toBe('');
  });

  it('mencatat pesan error dari request yang masih berlaku', async () => {
    const ambil = vi.fn(async () => { throw new Error('server mati'); });
    const { result } = renderHook(() => useDaftarTabel<Baris>({ tableKey: 't5', ambil }));

    await waitFor(() => expect(result.current.err).not.toBe(''));
    expect(result.current.err).toContain('server mati');
    expect(result.current.loading).toBe(false);
  });

  it('memanggil onData dengan respons valid', async () => {
    const onData = vi.fn();
    const ambil = vi.fn(async () => halaman([{ id: 1, nama: 'A' }]));
    const { result } = renderHook(() =>
      useDaftarTabel<Baris>({ tableKey: 't6', ambil, onData }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onData).toHaveBeenCalledTimes(1);
  });

  /* `sync` mengoreksi halaman yang sudah tak valid (data berkurang). */
  it('mengoreksi halaman bila halaman tersimpan melebihi last_page', async () => {
    localStorage.setItem('simpes_page_t7', '9');
    const ambil = vi.fn(async (a: ArgsMuat) =>
      halaman([{ id: a.page, nama: 'hal' + a.page }], { current_page: a.page, last_page: 2 }),
    );
    const { result } = renderHook(() => useDaftarTabel<Baris>({ tableKey: 't7', ambil }));

    await waitFor(() => expect(result.current.pager.page).toBe(2));
  });

  it('terapkanUrut mengubah urut, arah, dan kembali ke halaman 1', async () => {
    const ambil = vi.fn(async (_a: ArgsMuat) => halaman([]));
    const { result } = renderHook(() => useDaftarTabel<Baris>({ tableKey: 't8', ambil }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.terapkanUrut(['nama'], 'turun'); });

    await waitFor(() => expect(result.current.urut).toEqual(['nama']));
    expect(result.current.arahUrut).toBe('turun');
    expect(result.current.pager.page).toBe(1);
    const terakhir = ambil.mock.calls.at(-1)![0] as ArgsMuat;
    expect(terakhir.urut).toEqual(['nama']);
    expect(terakhir.arah).toBe('turun');
  });

  /* Arah per kolom hanya berlaku bila ada kolom yang diurutkan. */
  it('terapkanUrut tanpa kolom membuang arahKolom', async () => {
    const ambil = vi.fn(async (_a: ArgsMuat) => halaman([]));
    const { result } = renderHook(() => useDaftarTabel<Baris>({ tableKey: 't9', ambil }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.terapkanUrut([], 'naik', { nama: 'turun' }); });
    waitFor(() => expect(result.current.urut).toEqual([]));
    const terakhir = ambil.mock.calls.at(-1)![0] as ArgsMuat;
    expect(terakhir.arahKolom).toBeUndefined();
  });

  it('onSearchChange mengembalikan ke halaman 1', async () => {
    const ambil = vi.fn(async (_a: ArgsMuat) => halaman([]));
    const { result } = renderHook(() => useDaftarTabel<Baris>({ tableKey: 't10', ambil }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.onSearchChange('budi'); });
    expect(result.current.search).toBe('budi');
    expect(result.current.pager.page).toBe(1);
  });

  /* Live search menunda 400 ms agar API tak dipanggil tiap ketikan.
     Timer asli dipakai (bukan fake): `waitFor` milik testing-library
     berjalan di atas timer asli, dan mencampurnya dengan fake timer
     membuat keduanya saling mengunci. Jeda di sini cuma 400 ms. */
  it('menunda pencarian sebelum memanggil ulang API', async () => {
    const ambil = vi.fn(async (_a: ArgsMuat) => halaman([]));
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useDaftarTabel<Baris>({ tableKey: 't11', ambil, search: q }),
      { initialProps: { q: 'a' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(ambil.mock.calls.length).toBeGreaterThan(0));
    const awal = ambil.mock.calls.length;

    // Query baru, majukan 300 ms (< 400): belum ada panggilan baru.
    rerender({ q: 'abu' });
    await new Promise((r) => setTimeout(r, 300));
    expect(ambil.mock.calls.length).toBe(awal);

    // Lewat 400 ms: panggilan baru terjadi.
    await waitFor(() => expect(ambil.mock.calls.length).toBeGreaterThan(awal));
  });

  it('pencarian kosong diterapkan tanpa jeda', async () => {
    const ambil = vi.fn(async (_a: ArgsMuat) => halaman([]));
    const { rerender } = renderHook(
      ({ q }: { q: string }) => useDaftarTabel<Baris>({ tableKey: 't12', ambil, search: q }),
      { initialProps: { q: 'abc' } },
    );
    // Ketik dulu supaya ada nilai yang benar-benar kembali ke kosong.
    await waitFor(() => expect(ambil.mock.calls.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 450));
    const awal = ambil.mock.calls.length;

    // Dikosongkan -> jeda 0 ms, jadi tak perlu menunggu 400 ms.
    rerender({ q: '' });
    await waitFor(() => expect(ambil.mock.calls.length).toBeGreaterThan(awal));
    expect((ambil.mock.calls.at(-1)![0] as ArgsMuat).search).toBe('');
  });

  /* Mengosongkan saat nilai tertunda MEMANG sudah kosong tak memicu muat
     ulang: `setSearchTertunda('')` tak mengubah state, jadi tak ada render
     baru dan tak ada permintaan sia-sia. Dikunci agar tak jadi regresi. */
  it('tidak memuat ulang bila pencarian tertunda sudah kosong', async () => {
    const ambil = vi.fn(async (_a: ArgsMuat) => halaman([]));
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useDaftarTabel<Baris>({ tableKey: 't13', ambil, search: q }),
      { initialProps: { q: '' } },
    );
    // Muat awal memang bisa >1x (usePager melewati `ready`, `perPage`
    // berubah). Yang diuji di sini: SETELAH tenang, mengosongkan pencarian
    // yang sudah kosong tak menambah permintaan sia-sia.
    await waitFor(() => expect(result.current.loading).toBe(false));
    await new Promise((r) => setTimeout(r, 500));
    const awal = ambil.mock.calls.length;

    rerender({ q: '   ' }); // hanya spasi = tetap kosong setelah trim
    await new Promise((r) => setTimeout(r, 250));
    expect(ambil.mock.calls.length).toBe(awal);
  });
});
