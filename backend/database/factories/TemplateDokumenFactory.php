<?php

namespace Database\Factories;

use App\Models\TemplateDokumen;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<TemplateDokumen>
 */
class TemplateDokumenFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $nama = $this->faker->unique()->words(2, true);

        return [
            'kode' => Str::slug($nama).'-'.Str::lower(Str::random(5)),
            'nama' => Str::title($nama),
            'kategori' => 'lainnya',
            'jenis' => TemplateDokumen::JENIS_PDF,
            'jenjang' => null,
            'path_pdf' => 'template/'.Str::random(32).'.pdf',
            'halaman' => [['lebar_mm' => 210.0, 'tinggi_mm' => 297.0]],
            'jumlah_halaman' => 1,
            'definisi' => ['versi' => 1, 'medan' => []],
            'aktif' => true,
        ];
    }

    /** Template cadangan milik satu lembaga, bukan global. */
    public function milikLembaga(string $jenjang): static
    {
        return $this->state(fn () => ['jenjang' => $jenjang]);
    }

    /** Template yang sudah punya medan'sian pada halaman tertentu. */
    public function denganMedan(array $medan): static
    {
        return $this->state(fn () => ['definisi' => ['versi' => 1, 'medan' => $medan]]);
    }
}
