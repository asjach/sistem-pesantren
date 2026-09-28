<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Autentikasi API memakai token lewat header Authorization, dan aplikasi ini
 * tidak punya route `login` sama sekali. Setiap endpoint harus menjawab 401
 * apa pun header Accept-nya.
 */
class ApiTanpaTokenTest extends TestCase
{
    /** Header Accept yang dipakai frontend untuk tiap jenis permintaan. */
    private function headerAccept(): array
    {
        return [
            'JSON' => ['HTTP_ACCEPT' => 'application/json'],
            'biner' => ['HTTP_ACCEPT' => '*/*'],
            'unduhan' => ['HTTP_ACCEPT' => 'application/octet-stream'],
            'tanpa header Accept' => [],
        ];
    }

    /** Endpoint dari modul lama dan baru; keduanya harus berperilaku sama. */
    private function endpointApi(): array
    {
        return [
            'ekspor nama kelas' => '/api/admin/kelas/export-nama',
            'daftar preset kolom' => '/api/admin/preset-tabel',
            'daftar pegawai' => '/api/admin/pegawai',
            'daftar santri' => '/api/admin/santri',
            'ringkasan dasbor' => '/api/dashboard/ringkasan',
        ];
    }

    public function test_permintaan_tanpa_token_menjawab_401_dengan_setiap_jenis_header_accept(): void
    {
        foreach ($this->headerAccept() as $nama => $header) {
            $this->getJson('/api/admin/pegawai', $header)
                ->assertStatus(401)
                ->assertJsonPath('message', 'Unauthenticated.', "header Accept: {$nama}");
        }
    }

    public function test_setiap_endpoint_api_menjawab_401_bukan_500(): void
    {
        foreach ($this->endpointApi() as $nama => $path) {
            // 500 di sini berarti ada route login yang dipanggil tanpa sengaja.
            $this->getJson($path, ['HTTP_ACCEPT' => '*/*'])
                ->assertStatus(401)
                ->assertJsonMissingPath('exception', $nama);
        }
    }

    public function test_jawaban_401_tidak_bocor_detail_internal(): void
    {
        $res = $this->getJson('/api/admin/pegawai', ['HTTP_ACCEPT' => '*/*'])->assertStatus(401);
        $isi = (string) $res->getContent();

        $this->assertStringNotContainsString('trace', $isi);
        $this->assertStringNotContainsString('vendor/laravel', $isi);
        $this->assertStringNotContainsString('bootstrap/app.php', $isi);
    }
}
