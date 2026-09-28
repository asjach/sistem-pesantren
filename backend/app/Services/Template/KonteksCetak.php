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
     * @param  array<string, string>  $tetap  nilai diketik sekali di formulir isian (Nilai Tetap)
     */
    public function __construct(
        public readonly ?string $jenjang = null,
        public readonly ?string $tahunAjaran = null,
        public readonly ?string $semester = null,
        public readonly ?int $kelasId = null,
        public readonly ?User $pencetak = null,
        public readonly array $tetap = [],
        public readonly ?string $tanggalAbsen = null,
        public readonly ?int $idSantri = null,
        public readonly ?int $idPegawai = null,
        public readonly ?int $idPsbCalon = null,
    ) {}

    /**
     * Turunkan konteks dengan sebagian atribut diganti. `idSantri` dan
     * `idPegawai` menentukan record yang dipakai sumber nilai skalar.
     *
     * @param  array<string, mixed>  $atribut
     */
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
            idSantri: $atribut['id_santri'] ?? $this->idSantri,
            idPegawai: $atribut['id_pegawai'] ?? $this->idPegawai,
            idPsbCalon: $atribut['id_psb_calon'] ?? $this->idPsbCalon,
        );
    }
}
