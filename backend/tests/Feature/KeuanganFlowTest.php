<?php

namespace Tests\Feature;

use App\Models\AkunKas;
use App\Models\JurnalKas;
use App\Models\Lembaga;
use App\Models\Pembayaran;
use App\Models\PembayaranDetail;
use App\Models\PosKeuangan;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\TahunAjaran;
use App\Models\TarifBiaya;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class KeuanganFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        // ISSUE-1 (sqlite :memory:): KeuanganService::buatSatuTagihanBulanan memakai
        // orderByRaw("FIELD(...)") yang khusus MySQL ("no such function: FIELD" di sqlite).
        // Emulasi FIELD() ala MySQL di koneksi uji SAJA (tanpa ubah code app).
        // Rekomendasi app: ganti dengan CASE WHEN yang portabel MySQL+sqlite.
        DB::connection()->getPdo()->sqliteCreateFunction('FIELD', function ($needle, ...$list) {
            foreach (array_values($list) as $i => $v) {
                if ((string) $v === (string) $needle) return $i + 1;
            }

            return 0;
        }, -1);

        // Kamus metode pembayaran global (kolom `nama`, case-sensitive via in_array strict
        // di KeuanganController::bayar). Tanpa baris ini SEMUA bayar → 422 (lihat test_10).
        foreach (['tunai', 'transfer', 'va', 'qris'] as $i => $nama) {
            DB::table('ref_metode_pembayaran')->insert([
                'lembaga_id' => null, 'nama' => $nama, 'urutan' => $i, 'is_active' => true,
            ]);
        }
    }

    // ---------- helpers ----------

    protected function baseFixture(): array
    {
        $root = Lembaga::create([
            'nama' => 'Pesantren Root', 'kode' => 'PESANTREN',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $mi = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Ibtidaiyah', 'kode' => 'MI',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $md = Lembaga::create([
            'parent_id' => $root->id, 'nama' => 'Madrasah Diniyah', 'kode' => 'MD',
            'is_seleksi' => false, 'kelompok_psb' => 'combo_mi_md', 'is_active' => true,
        ]);
        $ta = TahunAjaran::create([
            'lembaga_id' => $root->id, 'nama' => '2026/2027',
            'tanggal_mulai' => '2026-07-01', 'tanggal_selesai' => '2027-06-30', 'is_aktif' => true,
        ]);

        return compact('root', 'mi', 'md', 'ta');
    }

    protected int $userSeq = 0;

    protected function makeUser(string $role, array $lembagaIds = []): User
    {
        $this->userSeq++;
        $u = User::create([
            'name' => ucfirst($role) . ' ' . $this->userSeq,
            'email' => "keu103_u{$this->userSeq}_" . uniqid() . '@example.com',
            'phone' => '08' . str_pad((string) (9200000000 + $this->userSeq * 137 + random_int(0, 99)), 10, '0', STR_PAD_LEFT),
            'password' => 'password',
        ]);
        $u->assignRole($role);
        foreach ($lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $u->id, 'lembaga_id' => $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return $u;
    }

    protected function makeSantriAktif(Lembaga $lembaga, TahunAjaran $ta, array $opt = []): Santri
    {
        $s = Santri::create(array_merge([
            'lembaga_id' => $lembaga->id,
            'nama_lengkap' => 'Santri ' . uniqid(),
            'jk' => 'L',
            'tipe_santri' => 'non_asrama',
            'status_global' => true,
        ], $opt));
        RiwayatBelajar::create([
            'santri_id' => $s->id, 'tahun_ajaran_id' => $ta->id, 'lembaga_id' => $lembaga->id,
            'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_aktif' => true,
        ]);

        return $s;
    }

    protected function makePosTarif(string $kode, Lembaga $lembaga, TahunAjaran $ta, float $nominal, string $tipe = 'semua', ?float $paket = null): PosKeuangan
    {
        $pos = PosKeuangan::create(['kode_pos' => $kode, 'nama_pos' => "Pos {$kode}", 'tipe' => 'bulanan']);
        TarifBiaya::create([
            'pos_keuangan_id' => $pos->id, 'lembaga_id' => $lembaga->id, 'tahun_ajaran_id' => $ta->id,
            'tipe_santri' => $tipe, 'nominal' => $nominal, 'nominal_paket' => $paket,
        ]);

        return $pos;
    }

    protected function makeKas(?int $lembagaId, string $kode): AkunKas
    {
        return AkunKas::create([
            'lembaga_id' => $lembagaId, 'nama_kas' => "Kas {$kode}", 'kode_kas' => $kode, 'saldo' => 0,
        ]);
    }

    protected function bayarPayload(AkunKas $kas, array $items, float $total, array $extra = []): array
    {
        return array_merge([
            'akun_kas_id' => $kas->id,
            'total_bayar' => $total,
            'metode_pembayaran' => 'tunai',
            'items' => $items,
        ], $extra);
    }

    // ---------- 1. generate bulanan idempoten ----------

    public function test_01_generate_bulanan_dua_tagihan_dan_idempoten(): void
    {
        $f = $this->baseFixture();
        $this->makeSantriAktif($f['mi'], $f['ta']);
        $this->makeSantriAktif($f['mi'], $f['ta']);
        $this->makePosTarif('SPP', $f['mi'], $f['ta'], 100000);
        $admin = $this->makeUser('admin'); // admin full (tanpa pivot)

        $r1 = $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ]);
        $r1->assertStatus(200);
        $this->assertEquals(2, $r1->json('data.berhasil'));
        $this->assertEquals(2, Tagihan::count());

        // Generate ulang: tidak ada duplikat.
        $r2 = $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ]);
        $r2->assertStatus(200);
        $this->assertEquals(2, Tagihan::count());
        // Idempoten penuh: generate ulang tidak membuat baru -> berhasil=0.
        $this->assertEquals(0, $r2->json('data.berhasil'));
    }

    // ---------- 2. generate paket MI-MD ----------

    public function test_02_generate_paket_satu_tagihan_di_primer(): void
    {
        $f = $this->baseFixture();
        // Santri paket: 2 riwayat aktif (MI + MD), non_asrama.
        $santri = Santri::create([
            'lembaga_id' => $f['mi']->id, 'nama_lengkap' => 'Anak Paket',
            'jk' => 'L', 'tipe_santri' => 'non_asrama', 'status_global' => true,
        ]);
        foreach ([$f['mi'], $f['md']] as $lem) {
            RiwayatBelajar::create([
                'santri_id' => $santri->id, 'tahun_ajaran_id' => $f['ta']->id, 'lembaga_id' => $lem->id,
                'semester' => '1', 'status_awal' => 'santri_baru', 'status_akhir' => 'aktif', 'is_aktif' => true,
            ]);
        }
        $this->makePosTarif('SPP', $f['mi'], $f['ta'], 100000, 'semua', 150000);
        $admin = $this->makeUser('admin');

        $rMi = $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ]);
        $rMi->assertStatus(200);
        $this->assertEquals(1, $rMi->json('data.berhasil'));
        $tagihan = Tagihan::where('santri_id', $santri->id)->get();
        $this->assertEquals(1, $tagihan->count());
        $this->assertEquals('MI-MD', $tagihan->first()->paket_kode);
        $this->assertEquals(150000, (float) $tagihan->first()->nominal_total);

        // Batch MD: santri paket dilewati (bukan gagal, bukan tagihan baru).
        $rMd = $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['md']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ]);
        $rMd->assertStatus(200);
        $this->assertEquals(1, $rMd->json('data.dilewati_paket'));
        $this->assertEquals(1, Tagihan::where('santri_id', $santri->id)->count());
    }

    // ---------- 3. bayar multi partial ----------

    public function test_03_bayar_multi_partial_saldo_dan_jurnal(): void
    {
        $f = $this->baseFixture();
        $santri = $this->makeSantriAktif($f['mi'], $f['ta']);
        $this->makePosTarif('SPP', $f['mi'], $f['ta'], 100000);
        $this->makePosTarif('KGT', $f['mi'], $f['ta'], 200000);
        $kasir = $this->makeUser('kasir', [$f['mi']->id]);
        $kas = $this->makeKas($f['mi']->id, 'KASMI');
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ])->assertStatus(200);
        $this->assertEquals(2, Tagihan::where('santri_id', $santri->id)->count());
        [$t1, $t2] = Tagihan::where('santri_id', $santri->id)->orderBy('id')->get()->all();

        // Bayar sebagian tagihan 1 (100rb -> 40rb).
        $b1 = $this->actingAs($kasir, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kas, [['tagihan_id' => $t1->id, 'nominal_dibayar' => 40000]], 40000));
        $b1->assertStatus(201);
        $t1->refresh();
        $this->assertEquals('mencicil', $t1->status);
        $this->assertEquals(60000, (float) $t1->sisa_tagihan);

        // Lunasi sisa t1 + t2 sekaligus.
        $b2 = $this->actingAs($kasir, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kas, [
                ['tagihan_id' => $t1->id, 'nominal_dibayar' => 60000],
                ['tagihan_id' => $t2->id, 'nominal_dibayar' => 200000],
            ], 260000));
        $b2->assertStatus(201);
        $this->assertEquals('lunas', $t1->fresh()->status);
        $this->assertEquals('lunas', $t2->fresh()->status);

        $this->assertEquals(300000, (float) $kas->fresh()->saldo);
        $this->assertEquals(2, JurnalKas::where('akun_kas_id', $kas->id)->where('jenis', 'masuk')->count());
        $this->assertEquals(300000, (float) JurnalKas::where('akun_kas_id', $kas->id)->where('jenis', 'masuk')->sum('nominal'));
        $this->assertDatabaseHas('jurnal_kas', [
            'akun_kas_id' => $kas->id, 'jenis' => 'masuk', 'kategori' => 'Penerimaan Tagihan Santri',
        ]);
    }

    // ---------- 4. total != sum 422; lunas dibayar lagi 409 ----------

    public function test_04_total_mismatch_422_dan_lunas_409(): void
    {
        $f = $this->baseFixture();
        $santri = $this->makeSantriAktif($f['mi'], $f['ta']);
        $this->makePosTarif('SPP', $f['mi'], $f['ta'], 100000);
        $kasir = $this->makeUser('kasir', [$f['mi']->id]);
        $kas = $this->makeKas($f['mi']->id, 'KASMI');
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ])->assertStatus(200);
        $t = Tagihan::where('santri_id', $santri->id)->firstOrFail();

        // total_bayar != jumlah items -> 422.
        $this->actingAs($kasir, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kas, [['tagihan_id' => $t->id, 'nominal_dibayar' => 60000]], 50000))
            ->assertStatus(422);

        // Lunasi penuh lalu bayar lagi -> 409.
        $this->actingAs($kasir, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kas, [['tagihan_id' => $t->id, 'nominal_dibayar' => 100000]], 100000))
            ->assertStatus(201);
        $this->assertEquals('lunas', $t->fresh()->status);
        $this->actingAs($kasir, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kas, [['tagihan_id' => $t->id, 'nominal_dibayar' => 10000]], 10000))
            ->assertStatus(409);
    }

    // ---------- 5. idempoten client_op_id ----------

    public function test_05_double_push_client_op_id_tetap_satu_pembayaran(): void
    {
        $f = $this->baseFixture();
        $santri = $this->makeSantriAktif($f['mi'], $f['ta']);
        $this->makePosTarif('SPP', $f['mi'], $f['ta'], 100000);
        $kasir = $this->makeUser('kasir', [$f['mi']->id]);
        $kas = $this->makeKas($f['mi']->id, 'KASMI');
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ])->assertStatus(200);
        $t = Tagihan::where('santri_id', $santri->id)->firstOrFail();

        $payload = $this->bayarPayload($kas,
            [['tagihan_id' => $t->id, 'nominal_dibayar' => 100000]], 100000,
            ['client_op_id' => 'op-uji-103-001']);
        $p1 = $this->actingAs($kasir, 'sanctum')->postJson('/api/keuangan/bayar', $payload);
        $p1->assertStatus(201);
        $p2 = $this->actingAs($kasir, 'sanctum')->postJson('/api/keuangan/bayar', $payload);
        // PERILAKU AKTUAL (catat): kirim ulang mengembalikan existing dengan status 201
        // (bukan 200), no_kuitansi sama.
        $p2->assertStatus(201);
        $this->assertEquals($p1->json('data.id'), $p2->json('data.id'));
        $this->assertEquals($p1->json('data.no_kuitansi'), $p2->json('data.no_kuitansi'));
        $this->assertNotEmpty($p1->json('data.no_kuitansi'));

        $this->assertEquals(1, Pembayaran::count());
        $this->assertEquals(1, PembayaranDetail::count());
        $this->assertEquals(100000, (float) $t->fresh()->nominal_terbayar);
        $this->assertEquals(100000, (float) $kas->fresh()->saldo);
        $this->assertEquals(1, JurnalKas::where('akun_kas_id', $kas->id)->where('jenis', 'masuk')->count());
    }

    // ---------- 6. void admin ----------

    public function test_06_void_admin_kembalikan_sisa_dan_saldo(): void
    {
        $f = $this->baseFixture();
        $santri = $this->makeSantriAktif($f['mi'], $f['ta']);
        $this->makePosTarif('SPP', $f['mi'], $f['ta'], 100000);
        $kasir = $this->makeUser('kasir', [$f['mi']->id]);
        $kas = $this->makeKas($f['mi']->id, 'KASMI');
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ])->assertStatus(200);
        $t = Tagihan::where('santri_id', $santri->id)->firstOrFail();
        $bayarId = $this->actingAs($kasir, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kas, [['tagihan_id' => $t->id, 'nominal_dibayar' => 100000]], 100000))
            ->json('data.id');
        $this->assertEquals(100000, (float) $kas->fresh()->saldo);

        // Kasir tidak boleh void (policy update = admin only) -> 403.
        $this->actingAs($kasir, 'sanctum')->postJson("/api/keuangan/pembayaran/{$bayarId}/void", ['alasan' => 'salah input'])
            ->assertStatus(403);

        // Admin void -> 200.
        $v = $this->actingAs($admin, 'sanctum')->postJson("/api/keuangan/pembayaran/{$bayarId}/void", ['alasan' => 'salah input']);
        $v->assertStatus(200);

        $t->refresh();
        $this->assertEquals(100000, (float) $t->sisa_tagihan);
        $this->assertEquals(0, (float) $t->nominal_terbayar);
        $this->assertEquals('belum_bayar', $t->status);
        $this->assertEquals(0, (float) $kas->fresh()->saldo);
        $this->assertDatabaseHas('jurnal_kas', [
            'pembayaran_id' => $bayarId, 'jenis' => 'keluar', 'kategori' => 'Void Pembayaran',
        ]);
        $this->assertStringStartsWith('[VOID]', Pembayaran::findOrFail($bayarId)->catatan);

        // Void ulang -> 409.
        $this->actingAs($admin, 'sanctum')->postJson("/api/keuangan/pembayaran/{$bayarId}/void", ['alasan' => 'kedua'])
            ->assertStatus(409);
    }

    // ---------- 7. tenant kas ----------

    public function test_07_tenant_kasir_lintas_dan_kas_pusat(): void
    {
        $f = $this->baseFixture();
        $santri = $this->makeSantriAktif($f['mi'], $f['ta']);
        $this->makePosTarif('SPP', $f['mi'], $f['ta'], 100000);
        $kasirMd = $this->makeUser('kasir', [$f['md']->id]);
        $kasirMi = $this->makeUser('kasir', [$f['mi']->id]);
        $kasMd = $this->makeKas($f['md']->id, 'KASMD');
        $kasPusat = $this->makeKas(null, 'KASPST');
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ])->assertStatus(200);
        $t = Tagihan::where('santri_id', $santri->id)->firstOrFail();

        // Kasir MD membayar tagihan MI (kas MD) -> 403 via policy bayar per item.
        $this->actingAs($kasirMd, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kasMd, [['tagihan_id' => $t->id, 'nominal_dibayar' => 50000]], 50000))
            ->assertStatus(403);

        // Kas pusat (lembaga null) oleh kasir MI -> 403.
        $this->actingAs($kasirMi, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kasPusat, [['tagihan_id' => $t->id, 'nominal_dibayar' => 50000]], 50000))
            ->assertStatus(403);

        // Kas pusat oleh admin full -> sukses.
        // DEVIATION-B (catat): tugas tulis `200`, PERILAKU AKTUAL KeuanganController::bayar
        // selalu me-return 201 (Created) termasuk untuk admin full.
        $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kasPusat, [['tagihan_id' => $t->id, 'nominal_dibayar' => 50000]], 50000))
            ->assertStatus(201);
        $this->assertEquals(50000, (float) $kasPusat->fresh()->saldo);
    }

    // ---------- 8. cetak thermal + pdf ----------

    public function test_08_cetak_thermal_dan_pdf(): void
    {
        $f = $this->baseFixture();
        $santri = $this->makeSantriAktif($f['mi'], $f['ta']);
        $this->makePosTarif('SPP', $f['mi'], $f['ta'], 100000);
        $kasir = $this->makeUser('kasir', [$f['mi']->id]);
        $kas = $this->makeKas($f['mi']->id, 'KASMI');
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ])->assertStatus(200);
        $t = Tagihan::where('santri_id', $santri->id)->firstOrFail();
        $noKuitansi = $this->actingAs($kasir, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kas, [['tagihan_id' => $t->id, 'nominal_dibayar' => 100000]], 100000,
                ['santri_id' => $santri->id]))
            ->json('data.no_kuitansi');
        $bayarId = Pembayaran::where('no_kuitansi', $noKuitansi)->firstOrFail()->id;

        $thermal = $this->actingAs($kasir, 'sanctum')->get("/api/kuitansi/{$bayarId}/thermal");
        $thermal->assertStatus(200);
        $thermal->assertSee($noKuitansi, false);

        $pdf = $this->actingAs($kasir, 'sanctum')->get("/api/kuitansi/{$bayarId}/pdf");
        $pdf->assertStatus(200);
        $pdf->assertHeaderContains('Content-Type', 'application/pdf');
        $body = $pdf->getContent(); // stream() dompdf = Response biasa (bukan StreamedResponse)
        $this->assertNotEmpty($body);
        $this->assertStringStartsWith('%PDF', $body);
    }

    // ---------- 9. list tagihan santri ----------

    public function test_09_list_tagihan_santri_dan_tenant(): void
    {
        $f = $this->baseFixture();
        $santri = $this->makeSantriAktif($f['mi'], $f['ta']);
        $this->makePosTarif('SPP', $f['mi'], $f['ta'], 100000);
        $this->makePosTarif('KGT', $f['mi'], $f['ta'], 200000);
        $kasirMi = $this->makeUser('kasir', [$f['mi']->id]);
        $kasirMd = $this->makeUser('kasir', [$f['md']->id]);
        $kas = $this->makeKas($f['mi']->id, 'KASMI');
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ])->assertStatus(200);
        [$t1, $t2] = Tagihan::where('santri_id', $santri->id)->orderBy('id')->get()->all();

        // Cicil t1 40rb; lunasi t2 (t2 lunas tidak ikut ter-list).
        $this->actingAs($kasirMi, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kas, [['tagihan_id' => $t1->id, 'nominal_dibayar' => 40000]], 40000))
            ->assertStatus(201);
        $this->actingAs($kasirMi, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kas, [['tagihan_id' => $t2->id, 'nominal_dibayar' => 200000]], 200000))
            ->assertStatus(201);

        $list = $this->actingAs($kasirMi, 'sanctum')->getJson("/api/keuangan/santri/{$santri->id}/tagihan");
        $list->assertStatus(200);
        $rows = collect($list->json('data'));
        $this->assertEquals(1, $rows->count());
        $this->assertEquals($t1->id, $rows->first()['id']);
        $this->assertEquals(60000, (float) $rows->first()['sisa_tagihan']);

        // Lintas lembaga -> 403.
        $this->actingAs($kasirMd, 'sanctum')->getJson("/api/keuangan/santri/{$santri->id}/tagihan")
            ->assertStatus(403);
    }

    // ---------- 10. metode di luar kamus ----------

    public function test_10_metode_luar_kamus_ditolak_422(): void
    {
        $f = $this->baseFixture();
        $santri = $this->makeSantriAktif($f['mi'], $f['ta']);
        $this->makePosTarif('SPP', $f['mi'], $f['ta'], 100000);
        $kasir = $this->makeUser('kasir', [$f['mi']->id]);
        $kas = $this->makeKas($f['mi']->id, 'KASMI');
        $admin = $this->makeUser('admin');

        $this->actingAs($admin, 'sanctum')->postJson('/api/keuangan/tagihan/generate-bulanan', [
            'lembaga_id' => $f['mi']->id, 'tahun_ajaran_id' => $f['ta']->id, 'periode' => '2026-08',
        ])->assertStatus(200);
        $t = Tagihan::where('santri_id', $santri->id)->firstOrFail();

        // PERILAKU AKTUAL (catat, sesuai KeuanganController::bayar): validasi kamus STRICT —
        // metode di luar ref_metode_pembayaran (case-sensitive, in_array strict) -> 422
        // 'Metode pembayaran tidak dikenal.'. String bebas HANYA bila lookup kamus
        // melempar (mis. tabel ref hilang), bukan bila kamus kosong (kosong -> semua 422).
        $res = $this->actingAs($kasir, 'sanctum')->postJson('/api/keuangan/bayar',
            $this->bayarPayload($kas, [['tagihan_id' => $t->id, 'nominal_dibayar' => 50000]], 50000,
                ['metode_pembayaran' => 'barter_beras']));
        $res->assertStatus(422);
        $this->assertStringContainsStringIgnoringCase('metode', (string) $res->getContent());
        $this->assertEquals(0, Pembayaran::count());
    }
}
