import { describe, expect, it } from 'vitest';

import { ApiError, errorMessage } from './client';

function galat(status: number, body: unknown): ApiError {
  return new ApiError(status, body);
}

describe('errorMessage', () => {
  it('mengutamakan pesan aplikasi karena sudah berbahasa Indonesia', () => {
    expect(
      errorMessage(galat(422, { pesan: 'Aset masih dipakai oleh 2 medan pada template. Hapus medannya lebih dulu.' })),
    ).toBe('Aset masih dipakai oleh 2 medan pada template. Hapus medannya lebih dulu.');
  });

  it('memakai message bawaan Laravel bila pesan tidak ada', () => {
    expect(errorMessage(galat(422, { message: 'The nama field is required.', errors: { nama: ['wajib'] } }))).toBe(
      'The nama field is required.',
    );
  });

  it('memakai pesan bawaan untuk status lain', () => {
    expect(errorMessage(galat(403, { pesan: 'Akses ditolak.' }))).toBe('Akses ditolak.');
  });

  it('memberi teks cadangan yang mengarahkan saat badan tidak punya pesan', () => {
    expect(errorMessage(galat(422, { errors: { nama: ['wajib'] } }))).toBe('Validasi gagal. Periksa isian.');
    expect(errorMessage(galat(0, {}))).toBe('Tidak dapat menghubungi server.');
    expect(errorMessage(galat(401, {}))).toContain('Kredensial');
    expect(errorMessage(galat(403, {}))).toContain('Akses ditolak');
  });

  it('mengabaikan pesan kosong agar tidak menampilkan ruang kosong', () => {
    expect(errorMessage(galat(422, { pesan: '', message: 'Cadangan' }))).toBe('Cadangan');
    expect(errorMessage(galat(422, { pesan: '   ' }))).toBe('Validasi gagal. Periksa isian.');
  });

  it('menangani galat yang bukan ApiError', () => {
    expect(errorMessage(new Error('jaringan putus'))).toBe('jaringan putus');
    expect(errorMessage('entah')).toBe('Gagal terhubung ke server.');
  });
});
