<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Admin\ToolbarPresetController;
use App\Models\Lembaga;
use App\Models\ToolbarPreset;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Kontrol toolbar global per table_key: baca bebas semua admin. Tulis:
 * ukuran kotak kontrol (lebar/tinggi) terbuka untuk semua pengguna, sedangkan
 * visibilitas/urutan/align khusus super_admin. Kunci kontrol tak dikenal dan
 * nilai di luar rentang ditolak.
 */
class ToolbarPresetTest extends TestCase
{
    use RefreshDatabase;

    protected int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->seq++;
        $u = User::create([
            'name' => ucfirst($role).' '.$this->seq,
            'email' => "toolbar_{$this->seq}_".uniqid().'@example.com',
            'phone' => '0815'.str_pad((string) (40000000 + $this->seq), 8, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'jenjang' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    public function test_simpan_dan_baca_urutan_kolom(): void
    {
        $pusat = $this->makeUser('super_admin');
        $scoped = $this->makeUser('admin');

        // Belum ada baris: urutan kosong (frontend memakai urutan bawaan).
        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.urutan', []);

        // Admin biasa ditolak menulis urutan (403).
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'urutan' => ['b', 'a', 'c'],
        ])->assertStatus(403);

        // Super_admin menyimpan; duplikat dibuang, urutan dipertahankan.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'urutan' => ['b', 'a', 'c', 'e', 'd', 'a'],
        ])->assertStatus(200);
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.urutan', ['b', 'a', 'c', 'e', 'd']);

        // Simpan urutan saja tak menghapus setelan tabel lain yang sudah ada.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => false],
            'align' => ['nama' => 'left'],
        ])->assertStatus(200);
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'urutan' => ['a', 'b'],
        ])->assertStatus(200);
        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.visibilitas', ['info' => false])
            ->assertJsonPath('data.align', ['nama' => 'left'])
            ->assertJsonPath('data.urutan', ['a', 'b']);

        // Kunci urutan asing ditolak.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'urutan' => ['Kolom Asing!'],
        ])->assertStatus(422)->assertJsonValidationErrors(['urutan.0']);
    }

    public function test_baca_bebas_tulis_super_admin_saja(): void
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren', 'jenjang' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'nama' => 'Madrasah Ibtidaiyah', 'jenjang' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $pusat = $this->makeUser('super_admin');
        $scoped = $this->makeUser('admin', [$mi->jenjang]);

        // Belum ada baris: visibilitas kosong (semua tampil).
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.visibilitas', []);

        // Admin lembaga ditolak menulis (403), baris tak terbentuk.
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => false],
        ])->assertStatus(403);
        $this->assertSame(0, ToolbarPreset::where('table_key', 'santri')->count());

        // Super_admin menyimpan + membaca kembali (per kunci: urutan kunci
        // objek JSON MySQL tak dijamin sama dengan urutan kirim).
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => false, 'kolom' => true, 'filter' => false],
        ])->assertStatus(200);
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.visibilitas.info', false)
            ->assertJsonPath('data.visibilitas.kolom', true)
            ->assertJsonPath('data.visibilitas.filter', false);

        // Admin lembaga ditolak menghapus; super_admin mengembalikan bawaan.
        $this->actingAs($scoped, 'sanctum')
            ->deleteJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(403);
        $this->actingAs($pusat, 'sanctum')
            ->deleteJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200);
        $this->assertSame(0, ToolbarPreset::where('table_key', 'santri')->count());
    }

    public function test_validasi_kunci_dan_nilai(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => 'ya'],
        ])->assertStatus(422)->assertJsonValidationErrors(['visibilitas.info']);

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['tombol_asing' => true],
        ])->assertStatus(422)->assertJsonValidationErrors(['visibilitas']);
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['visibilitas_tabel' => true],
        ])->assertStatus(422)->assertJsonValidationErrors(['visibilitas']);

        // Kunci `lebar` versi lama ditolak di sana: ukurannya pindah ke
        // `komponen_custom` (lihat test_setelan_komponen_ditolak_di_endpoint_ini).
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => true],
            'lebar' => ['cari' => 100],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar']);
    }

    /**
     * Sakelar "Visibilitas komponen tabel" (tab Umum Kelola Tabel) menyimpan
     * SEMUA komponen tabel per group di satu peta JSON yang sama dengan filter
     * toolbar. Semua kunci grup itu harus bisa ditulis dalam satu permintaan.
     */
    public function test_visibilitas_mencakup_semua_komponen_tabel(): void
    {
        $pusat = $this->makeUser('super_admin');

        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => [
                // Bilah judul.
                'judul_tabel' => false, 'info_tengah' => false, 'filter' => false,
                'cari' => false, 'keaktifan' => false, 'urutan' => false,
                'kolom' => false, 'tombol_aksi' => false,
                // Kepala tabel.
                'header_kolom' => false, 'rel_filter' => false,
                // Kaki tabel.
                'pager' => false, 'tombol_pengaturan' => false,
                'tombol_tinggi_baris' => false, 'tombol_tambah' => false,
                'tombol_edit' => false,
            ],
        ])->assertStatus(200);

        $res = $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200);
        foreach (ToolbarPresetController::KUNCI as $kunci) {
            if ($kunci === 'info' || $kunci === 'urut' || $kunci === 'bilah_judul' || $kunci === 'kaki_tabel') {
                continue;
            }
            $this->assertFalse($res->json("data.visibilitas.{$kunci}"), "Kunci {$kunci} tak tersimpan.");
        }
    }

    /**
     * Kunci versi lama (`info`/`urut`/`bilah_judul`/`kaki_tabel`) WAJIB tetap
     * diterima.
     *
     * Frontend menulis dengan MERGE di atas peta yang dibaca dari server, jadi
     * begitu satu penanda lama masih tersimpan di baris tabel itu, setiap
     * penyimpanan berikutnya ikut mengirimkannya. Kalau daftar kunci menutup
     * kunci lama, tabel yang sudah punya penanda lama ditolak 422 selamanya —
     * tak bisa disetel lagi sama sekali.
     */
    public function test_penanda_visibilitas_lama_tetap_boleh_ditulis(): void
    {
        $pusat = $this->makeUser('super_admin');

        // Baris versi lama: peta berisi kunci versi pertama.
        ToolbarPreset::create([
            'table_key' => 'pegawai_lembaga',
            'visibilitas' => ['info' => true, 'urut' => true, 'kolom' => true, 'filter' => true],
        ]);

        // FE merge: peta lama ikut terkirim bersama kunci baru.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'pegawai_lembaga',
            'visibilitas' => [
                'info' => true, 'urut' => true, 'kolom' => true, 'filter' => true,
                'kaki_tabel' => false,
            ],
        ])->assertStatus(200);

        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=pegawai_lembaga')
            ->assertStatus(200)
            ->assertJsonPath('data.visibilitas.urut', true)
            ->assertJsonPath('data.visibilitas.kaki_tabel', false);
    }

    public function test_simpan_dan_baca_align_kolom(): void
    {
        $pusat = $this->makeUser('super_admin');
        $scoped = $this->makeUser('admin');

        // Belum ada baris: align kosong (frontend memakai preferensi/bawaan).
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.align', []);

        // Admin biasa ditolak menulis align (403).
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'align' => ['nama_lengkap' => 'left'],
        ])->assertStatus(403);

        // Super_admin menyimpan + membaca kembali.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'align' => ['nama_lengkap' => 'left', 'nisn' => 'center', 'jk' => 'right'],
        ])->assertStatus(200);
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.align.nama_lengkap', 'left')
            ->assertJsonPath('data.align.nisn', 'center')
            ->assertJsonPath('data.align.jk', 'right');

        // Simpan align saja tak menghapus visibilitas/lebar yang sudah ada.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => false],
        ])->assertStatus(200);
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'align' => ['nama_lengkap' => 'right'],
        ])->assertStatus(200);
        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.visibilitas', ['info' => false])
            ->assertJsonPath('data.align', ['nama_lengkap' => 'right']);

        // Nilai & kunci align asing ditolak.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'align' => ['nama_lengkap' => 'justify'],
        ])->assertStatus(422)->assertJsonValidationErrors(['align.nama_lengkap']);
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'align' => ['Kolom Asing!' => 'left'],
        ])->assertStatus(422)->assertJsonValidationErrors(['align']);
    }

    /** Ukuran & nilai awal komponen PINDAH ke `komponen_custom`; endpoint ini
     *  menolak kuncinya dan pesannya menunjuk ke tabel baru. */
    public function test_setelan_komponen_ditolak_di_endpoint_ini(): void
    {
        $admin = $this->makeUser('admin');

        $contoh = ['lebar' => ['urut' => 200], 'tinggi' => ['urut' => 34], 'nilai_default' => ['urut' => 'Nama']];
        foreach ($contoh as $kunci => $isi) {
            $res = $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
                'table_key' => 'santri',
                $kunci => $isi,
            ]);
            $res->assertStatus(422)->assertJsonValidationErrors([$kunci]);
            $this->assertStringContainsString('komponen_custom', (string) $res->json("errors.{$kunci}.0"));
        }

        // Kunci lama `urut`/`kolom` tak bisa murdering lewat jalur ini lagi.
        $res = $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => true],
            'lebar' => ['urut' => 200],
        ]);
        $res->assertStatus(422)->assertJsonValidationErrors(['lebar']);

        // Tidak ada yang tertulis: peta lama tetap kosong.
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', [])
            ->assertJsonPath('data.tinggi', [])
            ->assertJsonPath('data.nilai_default', []);
    }

    /** Setelan komponen (ukuran, warna label, nilai awal, tipe input) ditulis
     *  lewat `komponen_custom` dan boleh ditulis pengguna mana pun — sama
     *  seperti dulu ukuran di endpoint ini (lihat `KomponenCustomTest`). */
    public function test_setelan_komponen_pindah_ke_endpoint_komponen_custom(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/komponen-custom', [
            'table_key' => 'santri',
            'komponen' => 'select_urut_santri',
            'setelan' => ['lebar' => 200],
        ])->assertStatus(200);

        // Tidak muncul di preset tabel (yang hanya menyimpan setelan tabel).
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', []);
        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/komponen-custom')
            ->assertStatus(200)
            ->assertJsonPath('data.peta.santri|select_urut_santri.lebar', 200);
    }
}
