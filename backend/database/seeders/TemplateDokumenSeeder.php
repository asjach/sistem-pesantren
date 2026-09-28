<?php

namespace Database\Seeders;

use App\Models\TemplateDokumen;
use App\Services\Template\DefinisiProfilPegawai;
use Illuminate\Database\Seeder;

/**
 * Template cetak bawaan sistem.
 *
 * Definisi tata letak tidak ditulis di dalam seeder melainkan diambil dari
 * service `Definisi*` supaya satu sumber kebenaran: template yang sama bisa
 * dibangun ulang, diuji, dan dipratinjau tanpa membaca isi seeder.
 *
 * Idempoten: dilewati bila kodenya sudah ada, jadi aman dijalankan berulang
 * tanpa menimpa template yang sudah disunting desainer.
 */
class TemplateDokumenSeeder extends Seeder
{
    public function run(): void
    {
        $this->templat([
            'kode' => DefinisiProfilPegawai::KODE,
            'nama' => DefinisiProfilPegawai::NAMA,
            'deskripsi' => 'Profil lengkap pegawai: identitas, domisili, kepegawaian, penempatan, dan akun.',
            'kategori' => DefinisiProfilPegawai::KATEGORI,
            'definisi' => DefinisiProfilPegawai::definisi(),
            'halaman' => [DefinisiProfilPegawai::ukuranHalaman()],
            'jumlah_halaman' => DefinisiProfilPegawai::JUMLAH_HALAMAN,
        ]);
    }

    /** @param  array<string, mixed>  $atribut */
    private function templat(array $atribut): void
    {
        if (TemplateDokumen::where('kode', $atribut['kode'])->exists()) {
            return;
        }

        TemplateDokumen::create($atribut + [
            'jenis' => TemplateDokumen::JENIS_HTML,
            'jenjang' => null,
            'path_pdf' => null,
            'aktif' => true,
        ]);
    }
}
