<?php

namespace App\Services;

use App\Models\KeaktifanPegawai;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Pintu tunggal penempatan pegawai di lembaga (`lembaga_pegawai`):
 * 1 baris per (pegawai, lembaga); masuk-lagi = aktifkan ulang.
 */
class PegawaiService
{
    /**
     * @param  array<string, mixed>  $atribut
     */
    public function pastikanPenempatan(Pegawai $pegawai, string $jenjang, array $atribut = []): LembagaPegawai
    {
        return DB::transaction(function () use ($pegawai, $jenjang, $atribut) {
            $row = LembagaPegawai::untuk((int) $pegawai->id, $jenjang);
            $nipp = isset($atribut['nipp']) && trim((string) $atribut['nipp']) !== ''
                ? trim((string) $atribut['nipp'])
                : null;

            if ($nipp !== null && LembagaPegawai::nippDipakai($jenjang, $nipp, $row?->id)) {
                throw ValidationException::withMessages(['nipp' => 'NIPP sudah dipakai pegawai lain di lembaga ini.']);
            }

            $data = [
                'tugas_utama' => $atribut['tugas_utama'] ?? 'Guru Pengampu',
                'tahaj_masuk' => $atribut['tahaj_masuk'] ?? null,
                'tgl_masuk' => $atribut['tgl_masuk'] ?? null,
            ];
            if ($nipp !== null || array_key_exists('nipp', $atribut)) {
                $data['nipp'] = $nipp;
            }
            if (array_key_exists('is_active_lembaga', $atribut)) {
                $data['is_active_lembaga'] = $atribut['is_active_lembaga'];
            }
            if (array_key_exists('tgl_selesai', $atribut)) {
                $data['tgl_selesai'] = $atribut['tgl_selesai'] ?: null;
            }
            foreach (['no_sk_awal_ptk', 'tgl_sk_awal_ptk'] as $kolomSk) {
                if (array_key_exists($kolomSk, $atribut)) {
                    $data[$kolomSk] = $atribut[$kolomSk] ?: null;
                }
            }

            if ($row) {
                // Aktifkan ulang bila sebelumnya nonaktif dan tak diminta nonaktif.
                if ($row->is_active_lembaga === LembagaPegawai::TIDAK && ($data['is_active_lembaga'] ?? null) !== LembagaPegawai::TIDAK) {
                    $data['is_active_lembaga'] = LembagaPegawai::YA;
                    $data['tgl_selesai'] = null;
                }
                $row->update($data);

                return $row->fresh();
            }

            return LembagaPegawai::create($data + [
                'pegawai_id' => $pegawai->id,
                'jenjang' => $jenjang,
                'is_active_lembaga' => $data['is_active_lembaga'] ?? LembagaPegawai::YA,
            ]);
        });
    }

    /** Nonaktifkan penempatan + tutup keaktifan TA berjalan (riwayat lama dipertahankan). */
    public function nonaktifkanPenempatan(LembagaPegawai $row, ?string $tglSelesai = null): LembagaPegawai
    {
        return DB::transaction(function () use ($row, $tglSelesai) {
            $row->update([
                'is_active_lembaga' => LembagaPegawai::TIDAK,
                'tgl_selesai' => $tglSelesai ?: date('Y-m-d'),
            ]);
            KeaktifanPegawai::where('pegawai_id', $row->pegawai_id)
                ->where('jenjang', $row->jenjang)
                ->where('status_keaktifan', KeaktifanPegawai::AKTIF)
                ->update(['status_keaktifan' => KeaktifanPegawai::INAKTIF]);

            return $row->fresh();
        });
    }

    /** Aktifkan ulang penempatan (buka lagi; `tgl_selesai` dikosongkan). */
    public function aktifkanPenempatan(LembagaPegawai $row): LembagaPegawai
    {
        $row->update(['is_active_lembaga' => LembagaPegawai::YA, 'tgl_selesai' => null]);

        return $row->fresh();
    }
}
