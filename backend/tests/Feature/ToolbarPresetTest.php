<?php

namespace Tests\Feature;

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

        // Simpan urutan saja tak menghapus visibilitas/lebar yang sudah ada.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => false],
            'lebar' => ['urut' => 200],
        ])->assertStatus(200);
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'urutan' => ['a', 'b'],
        ])->assertStatus(200);
        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.visibilitas', ['info' => false])
            ->assertJsonPath('data.lebar', ['urut' => 200])
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

        // Kotak cari dihapus: kunci lama ditolak di visibilitas maupun lebar.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['cari' => true],
        ])->assertStatus(422)->assertJsonValidationErrors(['visibilitas']);
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => true],
            'lebar' => ['cari' => 100],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar']);
    }

    public function test_simpan_dan_baca_lebar_kontrol(): void
    {
        $pusat = $this->makeUser('super_admin');

        // Tanpa baris: lebar kosong (frontend memakai bawaan px).
        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', []);

        // Simpan lebar + visibilitas sekaligus.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => true],
            'lebar' => ['urut' => 150, 'kolom' => 176],
        ])->assertStatus(200);
        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar.urut', 150)
            ->assertJsonPath('data.lebar.kolom', 176);

        // Kunci lebar tak dikenal + di luar rentang ditolak.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => true],
            'lebar' => ['info' => 100],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar']);
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => true],
            'lebar' => ['urut' => 10],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar.urut']);

        // Kunci filter halaman (filter.<id>) diterima; pola asing ditolak.
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => true],
            'lebar' => ['filter.select_status_santri' => 160],
        ])->assertStatus(200);
        $this->actingAs($pusat, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', ['filter.select_status_santri' => 160]);
        $this->actingAs($pusat, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'visibilitas' => ['info' => true],
            'lebar' => ['filter.besar!' => 100],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar']);
    }

    /** Ukuran kotak kontrol (lebar/tinggi) diatur dari popover klik-kanan
     *  combobox, jadi semua pengguna boleh menulisnya — sedangkan visibilitas,
     *  urutan, dan perataan tetap khusus super_admin. */
    public function test_ukuran_boleh_ditulis_semua_pengguna(): void
    {
        $scoped = $this->makeUser('admin');

        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => ['filter.select_status_santri' => 300],
            'tinggi' => ['filter.select_status_santri' => 34],
        ])->assertStatus(200);

        // Kunci peta memuat titik (`filter.<htmlFor>`) → bandingkan peta utuh,
        // sebab `assertJsonPath` memperlakukan titik sebagai path bersarang.
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', ['filter.select_status_santri' => 300])
            ->assertJsonPath('data.tinggi', ['filter.select_status_santri' => 34]);

        // Sisanya tetap tertutup untuk admin biasa.
        foreach ([['visibilitas' => ['info' => false]], ['urutan' => ['a']], ['align' => ['nisn' => 'left']]] as $kirim) {
            $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
                'table_key' => 'santri',
                ...$kirim,
            ])->assertStatus(403);
        }

        // Batas lebar disamakan dengan popover (40–1200).
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => ['filter.select_status_santri' => 900],
        ])->assertStatus(200);
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => ['filter.select_status_santri' => 1201],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar.filter.select_status_santri']);

        // Tinggi: kunci dikenal & rentang 20–120 dijaga.
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'tinggi' => ['info' => 30],
        ])->assertStatus(422)->assertJsonValidationErrors(['tinggi']);
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'tinggi' => ['urut' => 500],
        ])->assertStatus(422)->assertJsonValidationErrors(['tinggi.urut']);

        // Simpan tinggi saja tak menghapus lebar yang sudah ada.
        $this->actingAs($scoped, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'tinggi' => ['urut' => 30],
        ])->assertStatus(200);
        $this->actingAs($scoped, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', ['filter.select_status_santri' => 900])
            ->assertJsonPath('data.tinggi', ['urut' => 30]);
    }

    /** Lebar label/kontrol terkunci (`<kunci>.label` / `<kunci>.kontrol`)
     *  disimpan di peta `lebar` yang sama; label di atas 400px ditolak. */
    public function test_simpan_dan_baca_lebar_label_kontrol(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => [
                'filter.select_status_santri.label' => 64,
                'filter.select_status_santri.kontrol' => 180,
            ],
        ])->assertStatus(200);
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', [
                'filter.select_status_santri.label' => 64,
                'filter.select_status_santri.kontrol' => 180,
            ]);

        // Label di atas 400px ditolak; sufiks asing & kunci asing ditolak.
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => ['filter.select_status_santri.label' => 500],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar.filter.select_status_santri.label']);
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => ['filter.select_status_santri.asing' => 100],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar']);
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => ['info.label' => 100],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar']);

        // Rentang total tetap dijaga di controller (batas bawah longgar di request).
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => ['urut' => 10],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar.urut']);

        // Penanda expanding: = 1 diterima (label mengembang), selain itu ditolak.
        // Catatan: peta `lebar` yang dikirim MENGGANTI utuh, jadi kirim
        // ulang kunci yang sudah ada.
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => [
                'filter.select_status_santri.label' => 64,
                'filter.select_status_santri.kontrol' => 180,
                'filter.select_status_santri.expand' => 1,
            ],
        ])->assertStatus(200);
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', [
                'filter.select_status_santri.label' => 64,
                'filter.select_status_santri.kontrol' => 180,
                'filter.select_status_santri.expand' => 1,
            ]);
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => ['filter.select_status_santri.expand' => 2],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar.filter.select_status_santri.expand']);

        // Penanda label transparan: 1 (transparan) & 0 (ber-bg eksplisit)
        // diterima, selain itu ditolak.
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => [
                'filter.select_status_santri.label' => 64,
                'filter.select_status_santri.kontrol' => 180,
                'filter.select_status_santri.expand' => 1,
                'filter.select_status_santri.labeltransparan' => 0,
            ],
        ])->assertStatus(200);
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/toolbar-preset?table_key=santri')
            ->assertStatus(200)
            ->assertJsonPath('data.lebar', [
                'filter.select_status_santri.label' => 64,
                'filter.select_status_santri.kontrol' => 180,
                'filter.select_status_santri.expand' => 1,
                'filter.select_status_santri.labeltransparan' => 0,
            ]);
        $this->actingAs($admin, 'sanctum')->putJson('/api/admin/toolbar-preset', [
            'table_key' => 'santri',
            'lebar' => ['filter.select_status_santri.labeltransparan' => 2],
        ])->assertStatus(422)->assertJsonValidationErrors(['lebar.filter.select_status_santri.labeltransparan']);
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
}
