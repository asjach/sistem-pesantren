<?php

namespace App\Services;

use App\Models\Kelas;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Penerimaan santri ke sebuah lembaga (satu pintu untuk semua jalur):
 * ACC PSB, dialog input riwayat, dan import riwayat.
 *
 * Membuat/mengaktifkan `lembaga_santri` (keanggotaan + NIS lokal) dan riwayat
 * perdana semester 1. Tanpa menyentuh kolom relasi di `santri` (buku induk).
 */
class PenerimaanService
{
    /**
     * Pastikan ada keanggotaan AKTIF santri di lembaga (buat baru bila belum ada).
     * Baris lama yang nonaktif tidak diaktifkan ulang — dibuat baris baru agar
     * jejak keanggotaan (tgl_mulai/tgl_selesai) tetap utuh.
     *
     * @param  array{nis_lokal?: ?string, tgl_mulai?: ?string}  $data
     */
    public function pastikanKeanggotaan(Santri $santri, int $lembagaId, array $data = []): LembagaSantri
    {
        $nisLokal = $data['nis_lokal'] ?? null;
        $nisLokal = $nisLokal !== null ? trim((string) $nisLokal) : null;
        $nisLokal = $nisLokal === '' ? null : $nisLokal;

        $aktif = LembagaSantri::aktif($santri->id, $lembagaId);

        if ($aktif !== null) {
            $ubah = [];
            if ($nisLokal !== null && $nisLokal !== $aktif->nis_lokal) {
                if (LembagaSantri::nisLokalDipakai($lembagaId, $nisLokal, $aktif->id)) {
                    throw ValidationException::withMessages(['nis_lokal' => 'NIS lokal sudah dipakai santri lain di lembaga ini.']);
                }
                $ubah['nis_lokal'] = $nisLokal;
            }
            if ($aktif->tgl_mulai === null && ! empty($data['tgl_mulai'])) {
                $ubah['tgl_mulai'] = $data['tgl_mulai'];
            }
            if ($ubah !== []) {
                $aktif->update($ubah);
            }

            return $aktif->fresh();
        }

        if ($nisLokal !== null && LembagaSantri::nisLokalDipakai($lembagaId, $nisLokal)) {
            throw ValidationException::withMessages(['nis_lokal' => 'NIS lokal sudah dipakai santri lain di lembaga ini.']);
        }

        return LembagaSantri::create([
            'santri_id' => $santri->id,
            'lembaga_id' => $lembagaId,
            'nis_lokal' => $nisLokal,
            'is_active' => true,
            'tgl_mulai' => $data['tgl_mulai'] ?? null,
        ]);
    }

    /**
     * Terima santri ke lembaga: keanggotaan aktif + riwayat perdana semester 1.
     *
     * @param  array{nis_lokal?: ?string, kelas_id?: ?int, tingkat?: ?string, no_absen?: ?int,
     *               status_awal?: ?string, tgl_masuk?: ?string, tgl_mulai?: ?string}  $data
     */
    public function terima(Santri $santri, int $lembagaId, int $tahunAjaranId, array $data = []): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $lembagaId, $tahunAjaranId, $data) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();

            $tahun = TahunAjaran::find($tahunAjaranId);
            if (! $tahun) {
                throw ValidationException::withMessages(['tahun_ajaran_id' => 'Tahun ajaran tidak ditemukan.']);
            }
            if ((int) $tahun->lembaga_id !== $lembagaId) {
                throw ValidationException::withMessages(['tahun_ajaran_id' => 'Tahun ajaran bukan milik lembaga ini.']);
            }

            $kelasId = ! empty($data['kelas_id']) ? (int) $data['kelas_id'] : null;
            if ($kelasId !== null) {
                $kelas = Kelas::find($kelasId);
                if (! $kelas || (int) $kelas->lembaga_id !== $lembagaId) {
                    throw ValidationException::withMessages(['kelas_id' => 'Kelas bukan milik lembaga ini.']);
                }
                if ((int) $kelas->tahun_ajaran_id !== $tahunAjaranId) {
                    throw ValidationException::withMessages(['kelas_id' => 'Kelas bukan milik tahun ajaran ini.']);
                }
            }

            $adaAktif = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('lembaga_id', $lembagaId)
                ->where('is_aktif', true)
                ->lockForUpdate()
                ->exists();
            if ($adaAktif) {
                throw ValidationException::withMessages(['riwayat' => 'Santri sudah punya riwayat aktif di lembaga ini.']);
            }

            $statusAwal = $data['status_awal'] ?? 'santri_baru';
            $kamusAwal = RefService::kodeAktif('status_awal', $lembagaId);
            if ($kamusAwal !== [] && ! in_array($statusAwal, $kamusAwal, true)) {
                throw ValidationException::withMessages(['status_awal' => "Status awal {$statusAwal} tidak aktif di lembaga ini."]);
            }

            $this->pastikanKeanggotaan($santri, $lembagaId, [
                'nis_lokal' => $data['nis_lokal'] ?? null,
                'tgl_mulai' => $data['tgl_mulai'] ?? $data['tgl_masuk'] ?? null,
            ]);

            $noAbsen = isset($data['no_absen']) ? (int) $data['no_absen'] : null;
            if ($noAbsen !== null) {
                (new SiklusSantriService)->cekBentrokAbsen($kelasId, $tahunAjaranId, '1', $noAbsen);
            }

            $baru = RiwayatBelajar::create([
                'santri_id' => $santri->id,
                'tahun_ajaran_id' => $tahunAjaranId,
                'lembaga_id' => $lembagaId,
                'kelas_id' => $kelasId,
                'semester' => '1',
                'tgl_masuk' => $data['tgl_masuk'] ?? null,
                'no_absen' => $noAbsen,
                'tingkat' => $data['tingkat'] ?? null,
                'status_awal' => $statusAwal,
                'status_akhir' => 'aktif',
                'is_aktif' => true,
            ]);

            $santri->hitungUlangStatusGlobal();

            return $baru;
        });
    }

    /** Cari tahun ajaran berikut (tanggal_mulai lebih besar) untuk kenaikan/mengulang. */
    public function tahunAjaranBerikut(int $lembagaId, RiwayatBelajar $lama): ?TahunAjaran
    {
        $taLama = TahunAjaran::find($lama->tahun_ajaran_id);

        return TahunAjaran::where('lembaga_id', $lembagaId)
            ->when($taLama?->tanggal_mulai, fn ($q, $mulai) => $q->where('tanggal_mulai', '>', $mulai))
            ->orderBy('tanggal_mulai')->orderBy('id')->first();
    }
}
