<?php

namespace Tests\Feature;

use App\Models\DesainKartuPeserta;
use App\Models\Lembaga;
use App\Models\PeristiwaNilai;
use App\Models\TahunAjaran;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DesainKartuPesertaTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private PeristiwaNilai $peristiwa;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI', 'is_seleksi' => false,
            'kelompok_psb' => 'eksklusif', 'is_active' => true,
        ]);
        TahunAjaran::create(['nama' => '2026/2027', 'is_aktif' => true]);
        $this->peristiwa = PeristiwaNilai::create([
            'jenjang' => 'MI', 'tahun_ajaran' => '2026/2027', 'kode' => 'ASAS',
            'nama' => 'Asesmen Sumatif Akhir Semester', 'cakupan' => 'semua',
            'kurikulum' => 'keduanya', 'jenis_rapor' => 'akhir', 'urutan' => 1,
            'is_active' => true,
        ]);
        $this->admin = User::create([
            'name' => 'Admin Desain', 'email' => 'admin-desain@example.com',
            'phone' => '081111111111', 'password' => 'password',
        ]);
        $this->admin->assignRole('super_admin');
    }

    public function test_daftar_mengembalikan_ukuran_kartu_bawaan(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/admin/penilaian/desain-kartu?peristiwa_id='.$this->peristiwa->id)
            ->assertOk()
            ->assertJsonCount(0, 'desain')
            ->assertJsonPath('pengaturan.template_bawaan', 'klasik')
            ->assertJsonPath('pengaturan.lebar_mm', 85.6)
            ->assertJsonPath('pengaturan.tinggi_mm', 53.98);
    }

    public function test_desain_dengan_latar_dapat_disimpan_dan_dibaca(): void
    {
        $respons = $this->actingAs($this->admin, 'sanctum')
            ->post('/api/admin/penilaian/desain-kartu', [
                'peristiwa_id' => $this->peristiwa->id,
                'nama' => 'Desain Ujian',
                'warna_latar' => '#ffffff',
                'gaya_latar' => 'foto',
                'elemen' => json_encode([$this->elemenNama()]),
                'latar' => UploadedFile::fake()->image('latar.png', 1200, 800),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('desain.nama', 'Desain Ujian')
            ->assertJsonPath('desain.latar_ada', true);

        $id = $respons->json('desain.id');
        $desain = DesainKartuPeserta::query()->findOrFail($id);
        Storage::disk('local')->assertExists($desain->getRawOriginal('latar_path'));

        $this->actingAs($this->admin, 'sanctum')
            ->get("/api/admin/penilaian/desain-kartu/{$id}/latar")
            ->assertOk();
    }

    public function test_ukuran_dan_desain_disimpan_per_peristiwa(): void
    {
        $desain = DesainKartuPeserta::create([
            'jenjang' => 'MI', 'nama' => 'Bersih', 'elemen' => [$this->elemenNama()],
            'warna_latar' => '#ffffff', 'gaya_latar' => 'bersih',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/admin/penilaian/pengaturan-kartu', [
                'peristiwa_id' => $this->peristiwa->id,
                'desain_id' => $desain->id,
                'template_bawaan' => null,
                'lebar_mm' => 90,
                'tinggi_mm' => 60,
            ])
            ->assertOk();

        $this->assertDatabaseHas('pengaturan_kartu_peserta', [
            'peristiwa_id' => $this->peristiwa->id,
            'desain_id' => $desain->id,
            'lebar_mm' => 90,
            'tinggi_mm' => 60,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/admin/penilaian/desain-kartu/'.$desain->id)
            ->assertOk();
        $this->assertDatabaseHas('pengaturan_kartu_peserta', [
            'peristiwa_id' => $this->peristiwa->id,
            'desain_id' => null,
        ]);
    }

    public function test_desain_yang_sudah_ada_dapat_diubah_dan_namanya_unik_per_lembaga(): void
    {
        $desain = DesainKartuPeserta::create([
            'jenjang' => 'MI', 'nama' => 'Awal', 'elemen' => [$this->elemenNama()],
            'warna_latar' => '#ffffff', 'gaya_latar' => 'bersih',
        ]);
        DesainKartuPeserta::create([
            'jenjang' => 'MI', 'nama' => 'Sudah Ada', 'elemen' => [$this->elemenNama()],
            'warna_latar' => '#ffffff', 'gaya_latar' => 'bersih',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/penilaian/desain-kartu', [
                'id' => $desain->id,
                'peristiwa_id' => $this->peristiwa->id,
                'nama' => 'Diubah',
                'warna_latar' => '#123456',
                'gaya_latar' => 'modern',
                'elemen' => [$this->elemenNama()],
            ])
            ->assertOk()
            ->assertJsonPath('desain.nama', 'Diubah')
            ->assertJsonPath('desain.warna_latar', '#123456');

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/admin/penilaian/desain-kartu', [
                'id' => $desain->id,
                'peristiwa_id' => $this->peristiwa->id,
                'nama' => 'Sudah Ada',
                'warna_latar' => '#ffffff',
                'gaya_latar' => 'bersih',
                'elemen' => [$this->elemenNama()],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('nama');
    }

    public function test_desain_menolak_elemen_di_luar_katalog(): void
    {
        $elemen = $this->elemenNama();
        $elemen['field'] = 'nik_rahasia';

        $this->actingAs($this->admin, 'sanctum')
            ->post('/api/admin/penilaian/desain-kartu', [
                'peristiwa_id' => $this->peristiwa->id,
                'nama' => 'Tidak Valid',
                'warna_latar' => '#ffffff',
                'gaya_latar' => 'bersih',
                'elemen' => json_encode([$elemen]),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('elemen.0.field');
    }

    /** @return array<string, mixed> */
    private function elemenNama(): array
    {
        return [
            'id' => 'nama', 'tipe' => 'data', 'field' => 'nama', 'teks' => null,
            'x' => 20, 'y' => 20, 'lebar' => 70, 'tinggi' => 15,
            'ukuran_font' => 18, 'warna' => '#111827', 'tebal' => true, 'rata' => 'left',
        ];
    }
}
