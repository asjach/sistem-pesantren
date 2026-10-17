import { describe, expect, it } from 'vitest';
import { hitungSlotBaru, jamDariMenit, jamPendek, menitDariJam } from './jadwal';

describe('menitDariJam', () => {
  it('menerima HH:MM dan HH:MM:SS', () => {
    expect(menitDariJam('07:45')).toBe(465);
    expect(menitDariJam('07:45:00')).toBe(465);
  });

  it('menolak nilai kosong atau di luar 00:00–23:59', () => {
    expect(menitDariJam(null)).toBeNull();
    expect(menitDariJam('')).toBeNull();
    expect(menitDariJam('24:00')).toBeNull();
    expect(menitDariJam('07:60')).toBeNull();
  });
});

describe('jamDariMenit', () => {
  it('memformat menit menjadi HH:MM', () => {
    expect(jamDariMenit(465)).toBe('07:45');
    expect(jamDariMenit(0)).toBe('00:00');
  });

  it('menolak nilai yang melewati 23:59', () => {
    expect(jamDariMenit(24 * 60)).toBeNull();
    expect(jamDariMenit(-1)).toBeNull();
  });
});

describe('jamPendek', () => {
  it('memotong detik dan menjaga null', () => {
    expect(jamPendek('07:45:00')).toBe('07:45');
    expect(jamPendek(null)).toBeNull();
  });
});

describe('hitungSlotBaru', () => {
  it('memulai dari 07:00 bila belum ada slot berjam', () => {
    expect(hitungSlotBaru([], 45)).toEqual({
      nama_slot: 'Jam 1',
      jam_mulai: '07:00',
      jam_selesai: '07:45',
      urutan: 1,
    });
  });

  it('memakai jam selesai TERAKHIR, bukan urutan baris', () => {
    expect(hitungSlotBaru([
      { jam_mulai: '08:30', jam_selesai: '09:15', urutan: 2 },
      { jam_mulai: '07:00', jam_selesai: '07:45', urutan: 1 },
    ], 45)).toEqual({
      nama_slot: 'Jam 3',
      jam_mulai: '09:15',
      jam_selesai: '10:00',
      urutan: 3,
    });
  });

  it('mengabaikan slot tanpa jam selesai', () => {
    expect(hitungSlotBaru([
      { jam_mulai: null, jam_selesai: null, urutan: 5 },
    ], 60)).toEqual({
      nama_slot: 'Jam 6',
      jam_mulai: '07:00',
      jam_selesai: '08:00',
      urutan: 6,
    });
  });

  it('null bila durasi tidak sah atau hasil melewati 23:59', () => {
    expect(hitungSlotBaru([], 0)).toBeNull();
    expect(hitungSlotBaru([], -45)).toBeNull();
    expect(hitungSlotBaru([
      { jam_mulai: '22:30', jam_selesai: '23:30', urutan: 1 },
    ], 45)).toBeNull();
  });
});
