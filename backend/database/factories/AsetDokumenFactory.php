<?php

namespace Database\Factories;

use App\Models\AsetDokumen;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<AsetDokumen>
 */
class AsetDokumenFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'jenjang' => null,
            'nama' => Str::title($this->faker->words(2, true)),
            'path' => 'template/aset/'.Str::random(32).'.png',
            'mime' => 'image/png',
            'lebar_px' => 600,
            'tinggi_px' => 300,
            'ukuran_byte' => 24000,
        ];
    }

    public function milikLembaga(string $jenjang): static
    {
        return $this->state(fn () => ['jenjang' => $jenjang]);
    }
}
