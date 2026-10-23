import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pindahStatusPapan, ubahButirPapan } from './papan';

const { api } = vi.hoisted(() => ({
  api: vi.fn(async (_url: string, _init?: { method?: string; body?: string }) => ({})),
}));
vi.mock('./client', () => ({ api }));

beforeEach(() => api.mockClear());
const body = () => JSON.parse(api.mock.calls[0][1]?.body ?? '{}') as Record<string, unknown>;

describe('API Board - persetujuan Reopen', () => {
  it('perpindahan biasa tidak mengirim persetujuan Reopen', async () => {
    await pindahStatusPapan('DA11.4', 639, 'for_review');
    expect(body()).toEqual({ status: 'for_review' });
  });

  it('perpindahan yang dikonfirmasi mengirim flag pada endpoint status', async () => {
    await pindahStatusPapan('DA11.4', 639, 'in_progress', undefined, true);
    expect(api).toHaveBeenCalledWith('/board/DA11.4/butir/639/status', expect.objectContaining({ method: 'PATCH' }));
    expect(body()).toEqual({ status: 'in_progress', konfirmasi_reopen: true });
  });

  it('checklist yang dikonfirmasi mengirim flag pada endpoint update poin', async () => {
    const subpoin = [{ teks: 'Periksa saldo.', selesai: false }];
    await ubahButirPapan('DA11.4', 639, { subpoin, konfirmasi_reopen: true });
    expect(body()).toEqual({ subpoin, konfirmasi_reopen: true });
  });
});
