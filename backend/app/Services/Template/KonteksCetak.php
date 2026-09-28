<?php

namespace App\Services\Template;

use App\Models\User;

/**
 * Konteks satu kali cetak. Semua yang tidak berasal dari template PDF sendiri
 * dikumpulkan di sini: lembaga, tahun ajaran, semester, kelas, dan siapa yang
 * mencetak.
 *
 * Lembaga datang dari header `X-Lembaga-Aktif`, sedangkan tahun ajaran,
 * semester, dan kelas adalah state frontend yang dikirim eksplisit sebagai
 * parameter request, sama seperti modul lain di proyek ini.
 */
final class KonteksCetak
{
    /**
     * @param  array<string, string>  $tetap  value typed once in the fill form (Nilai Tetap)
     */
    public function __construct(
        public readonly ?string $jenjang = null,
        public readonly ?string $tahunAjaran = null,
        public readonly ?string $semester = null,
        public readonly ?int $kelasId = null,
        public readonly ?User $pencetak = null,
        public readonly array $tetap = [],
        public readonly ?string $tanggalAbsen = null,
    ) {}

    /** @param  array<string, string>  $tetap */
    public function dengan(array $atribut): self
    {
        return new self(
            jenjang: $atribut['jenjang'] ?? $this->jenjang,
            tahunAjaran: $atribut['tahun_ajaran'] ?? $this->tahunAjaran,
            semester: $atribut['semester'] ?? $this->semester,
            kelasId: $atribut['kelas_id'] ?? $this->kelasId,
            pencetak: $atribut['pencetak'] ?? $this->pencetak,
            tetap: $atribut['tetap'] ?? $this->tetap,
            tanggalAbsen: $atribut['tanggal_absen'] ?? $this->tanggalAbsen,
        );
    }
}
