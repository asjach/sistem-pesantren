<?php

namespace App\Services;

use App\Models\KeaktifanPegawai;
use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use Illuminate\Support\Facades\DB;

/**
 * Pintu tunggal penempatan pegawai di lembaga (`lembaga_pegawai`):
 * 1 baris per (pegawai, lembaga); masuk-lagi = aktifkan ulang.
 *
 * Setiap perubahan penempatan sekaligus menyelaraskan pivot `user_lembaga`
 * milik akun tertaut (`pegawai.user_id`): penempatan aktif → baris pivot
 * ada; penempatan nonaktif/dihapus → baris pivot dicabut. Tanpa akun
 * tertaut, langkah ini dilewati (no-op).
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

            $data = [
                'tugas_utama' => $atribut['tugas_utama'] ?? 'Guru Pengampu',
                'tahaj_masuk' => $atribut['tahaj_masuk'] ?? null,
                'tgl_masuk' => $atribut['tgl_masuk'] ?? null,
            ];
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
                $segar = $row->fresh();
                $this->selaraskanAkses($pegawai, $jenjang, $segar->is_active_lembaga);

                return $segar;
            }

            $dibuat = LembagaPegawai::create($data + [
                'pegawai_id' => $pegawai->id,
                'jenjang' => $jenjang,
                'is_active_lembaga' => $data['is_active_lembaga'] ?? LembagaPegawai::YA,
            ]);
            $this->selaraskanAkses($pegawai, $jenjang, $dibuat->is_active_lembaga);

            return $dibuat;
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
            $this->cabutAkses($row->pegawai, $row->jenjang);

            return $row->fresh();
        });
    }

    /** Aktifkan ulang penempatan (buka lagi; `tgl_selesai` dikosongkan). */
    public function aktifkanPenempatan(LembagaPegawai $row): LembagaPegawai
    {
        return DB::transaction(function () use ($row) {
            $row->update(['is_active_lembaga' => LembagaPegawai::YA, 'tgl_selesai' => null]);
            $this->pastikanAkses($row->pegawai, $row->jenjang);

            return $row->fresh();
        });
    }

    /** Hapus penempatan permanen + keaktifan terkait + akses lembaga akun tertaut. */
    public function hapusPenempatan(LembagaPegawai $row): void
    {
        DB::transaction(function () use ($row) {
            KeaktifanPegawai::where('pegawai_id', $row->pegawai_id)
                ->where('jenjang', $row->jenjang)
                ->delete();
            $this->cabutAkses($row->pegawai, $row->jenjang);
            $row->delete();
        });
    }

    /**
     * Selaraskan satu baris pivot `user_lembaga` dengan status penempatan:
     * aktif → pastikan ada; nonaktif → cabut. Tanpa akun tertaut: no-op.
     */
    private function selaraskanAkses(Pegawai $pegawai, string $jenjang, ?string $statusAktif): void
    {
        if ($statusAktif === LembagaPegawai::YA) {
            $this->pastikanAkses($pegawai, $jenjang);
        } else {
            $this->cabutAkses($pegawai, $jenjang);
        }
    }

    /** Pastikan akun tertaut punya baris pivot guru ke jenjang (idempoten). */
    private function pastikanAkses(Pegawai $pegawai, string $jenjang): void
    {
        $userId = $pegawai->user_id;
        if ($userId === null) {
            return;
        }
        DB::table('user_lembaga')->updateOrInsert(
            ['user_id' => $userId, 'jenjang' => $jenjang, 'role' => 'guru'],
            ['created_at' => now(), 'updated_at' => now()]
        );
    }

    /** Cabut baris pivot guru akun tertaut dari jenjang (idempoten; peran lain utuh). */
    private function cabutAkses(Pegawai $pegawai, string $jenjang): void
    {
        $userId = $pegawai->user_id;
        if ($userId === null) {
            return;
        }
        DB::table('user_lembaga')
            ->where('user_id', $userId)
            ->where('jenjang', $jenjang)
            ->where('role', 'guru')
            ->delete();
    }
}
