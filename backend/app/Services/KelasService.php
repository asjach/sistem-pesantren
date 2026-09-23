<?php

namespace App\Services;

use App\Models\KeaktifanPegawai;
use App\Models\Kelas;
use App\Models\Pegawai;
use Illuminate\Validation\ValidationException;

/**
 * Aturan wali kelas (`kelas.walas_id → pegawai`): 3 lapis —
 * (1) pegawai ada, (2) status aktif global, (3) keaktifan aktif di
 * lembaga + tahun ajaran kelas. Dipakai endpoint set-walas, update,
 * dan import file (kolom `walas`: NIP dulu, fallback nama).
 */
class KelasService
{
    /**
     * Tetapkan (atau lepas bila null) wali kelas. Melempar ValidationException
     * berkunci field bila tak memenuhi 3 lapis.
     */
    public function tetapkanWalas(Kelas $kelas, ?int $pegawaiId, string $kunci = 'pegawai_id'): Kelas
    {
        if ($pegawaiId === null) {
            $kelas->update(['walas_id' => null]);

            return $kelas->fresh();
        }

        $pegawai = Pegawai::find($pegawaiId);
        if (! $pegawai) {
            throw ValidationException::withMessages([$kunci => 'Pegawai tidak ditemukan.']);
        }
        $this->cekKelayakan($kelas, $pegawai, $kunci);

        $kelas->update(['walas_id' => $pegawai->id]);

        return $kelas->fresh();
    }

    /**
     * Cari pegawai dari nilai kolom import `walas`: NIP eksak dulu,
     * fallback nama (case-insensitive; ganda → wajib pakai NIP).
     */
    public function cariPegawai(string $nilai): Pegawai
    {
        $teks = trim($nilai);
        $pegawai = Pegawai::where('nip', $teks)->first();
        if ($pegawai) {
            return $pegawai;
        }

        $cocok = Pegawai::whereRaw('LOWER(nama_lengkap) = ?', [mb_strtolower($teks)])->get();
        if ($cocok->isEmpty()) {
            throw ValidationException::withMessages(['walas' => "Pegawai \"{$teks}\" tidak ditemukan (isi NIP atau nama lengkap)."]);
        }
        if ($cocok->count() > 1) {
            throw ValidationException::withMessages(['walas' => "Nama \"{$teks}\" ganda — isi NIP agar unik."]);
        }

        return $cocok->first();
    }

    /** Lapis 2–3: aktif global + keaktifan aktif di lembaga + TA kelas. */
    public function cekKelayakan(Kelas $kelas, Pegawai $pegawai, string $kunci = 'pegawai_id'): void
    {
        if ($pegawai->status_aktif !== Pegawai::AKTIF) {
            throw ValidationException::withMessages([$kunci => 'Pegawai tidak aktif.']);
        }
        $tugas = KeaktifanPegawai::where('pegawai_id', $pegawai->id)
            ->where('jenjang', $kelas->jenjang)
            ->where('tahun_ajaran', $kelas->tahun_ajaran)
            ->where('status_keaktifan', KeaktifanPegawai::AKTIF)
            ->exists();
        if (! $tugas) {
            throw ValidationException::withMessages([$kunci => 'Pegawai tidak aktif di lembaga + tahun ajaran kelas ini.']);
        }
    }
}
