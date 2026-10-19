<?php

namespace Tests\Feature;

use App\Exports\DokumenTemplateExport;
use App\Exports\KeaktifanTemplateExport;
use App\Exports\PenempatanPegawaiTemplateExport;
use App\Exports\SantriTemplateExport;
use App\Models\Lembaga;
use App\Models\Santri;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kontrak header template import yang belum punya test: urutan kolom =
 * kontrak dengan pengguna Excel, jadi pergeserannya harus terlihat di sini
 * (bukan diam-diam merusak rumus/import lama).
 */
class TemplateHeaderKontrakTest extends TestCase
{
    use RefreshDatabase;

    /** Kolom template dokumen berbeda per tipe pemilik. */
    public function test_dokumen_kolom_per_tipe(): void
    {
        $this->assertSame(
            ['nis_lokal', 'jenis_dokumen', 'lembaga', 'nama_file', 'penyimpanan', 'catatan'],
            DokumenTemplateExport::kolom('santri')
        );
        $this->assertSame(
            ['pegawai_id', 'nipp', 'nama_lengkap', 'jenis_dokumen', 'catatan', 'penyimpanan', 'nama_file', 'is_active'],
            DokumenTemplateExport::kolom('pegawai')
        );
        $this->assertSame(
            ['jenjang', 'jenis_dokumen', 'status_verifikasi', 'catatan'],
            DokumenTemplateExport::kolom('lembaga')
        );

        $this->assertSame([], DokumenTemplateExport::kolom('entah'));
    }

    /** Heading harus SAMA PERSIS dengan daftar kolom (satu sumber). */
    public function test_dokumen_heading_sejajar_kolom(): void
    {
        foreach (['santri', 'pegawai', 'lembaga'] as $tipe) {
            $export = new DokumenTemplateExport($tipe);
            $this->assertSame(DokumenTemplateExport::kolom($tipe), $export->headings());
            $this->assertSame('Dokumen', $export->title());
        }
    }

    /** Kolom wajib tiap tipe harus bagian dari kolomnya (jangan salah ketik). */
    public function test_dokumen_kolom_wajib_ada_di_daftar_kolom(): void
    {
        foreach (['santri', 'pegawai', 'lembaga'] as $tipe) {
            $wajib = DokumenTemplateExport::kolomWajib($tipe);
            $this->assertNotEmpty($wajib, $tipe);
            foreach ($wajib as $k) {
                $this->assertContains($k, DokumenTemplateExport::kolom($tipe), "{$tipe}.{$k}");
            }
        }
        $this->assertSame([], DokumenTemplateExport::kolomWajib('entah'));
    }

    /** Baris contoh sejajar kolom (jumlah sel = jumlah kolom) per tipe. */
    public function test_dokumen_baris_contoh_sejajar_kolom(): void
    {
        foreach (['santri', 'pegawai', 'lembaga'] as $tipe) {
            $export = new DokumenTemplateExport($tipe);
            $baris = $export->array();
            $this->assertCount(1, $baris);
            $this->assertCount(
                count(DokumenTemplateExport::kolom($tipe)), $baris[0], $tipe
            );
        }
    }

    /** Dropdown tipe dokumen: hanya kolom yang benar-benar ada yang diberi pilihan. */
    public function test_dokumen_dropdown_hanya_kolom_relevan(): void
    {
        $lembaga = new Lembaga(['nama' => 'MI', 'jenjang' => 'MI', 'is_active' => true]);
        $lembaga->save();

        $pilihan = (new DokumenTemplateExport('lembaga'))->pilihan();
        $this->assertArrayHasKey('jenjang', $pilihan);
        $this->assertArrayHasKey('status_verifikasi', $pilihan);
        $this->assertSame(['Menunggu', 'Valid', 'Ditolak'], $pilihan['status_verifikasi']);

        $this->assertArrayHasKey('is_active', (new DokumenTemplateExport('pegawai'))->pilihan());
        $this->assertNotContains('jenjang', DokumenTemplateExport::kolom('pegawai'));
        $this->assertNotContains('is_active', DokumenTemplateExport::kolom('santri'));
    }

    /** Keaktifan pegawai: urutan kolom + wajib = jenjang & tahun ajaran. */
    public function test_keaktifan_kolom_dan_wajib(): void
    {
        $this->assertSame([
            'pegawai_id', 'nipp', 'nama_lengkap', 'jenjang', 'tahun_ajaran',
            'tugas_utama', 'status_keaktifan', 'no_sk', 'tgl_sk',
        ], KeaktifanTemplateExport::kolom());
        $this->assertSame(['jenjang', 'tahun_ajaran'], KeaktifanTemplateExport::kolomWajib());
        $this->assertSame(KeaktifanTemplateExport::kolom(), (new KeaktifanTemplateExport)->headings());
        $this->assertSame('Keaktifan Pegawai', (new KeaktifanTemplateExport)->title());
        $baris = (new KeaktifanTemplateExport)->array();
        $this->assertCount(count(KeaktifanTemplateExport::kolom()), $baris[0]);
    }

    /** Penempatan pegawai: urutan kolom + wajib = jenjang saja. */
    public function test_penempatan_kolom_dan_wajib(): void
    {
        $this->assertSame([
            'pegawai_id', 'nipp', 'nama_lengkap', 'jenjang', 'tugas_utama',
            'is_active_lembaga', 'tgl_masuk', 'tgl_selesai', 'tahaj_masuk',
            'no_sk_awal_ptk', 'tgl_sk_awal_ptk',
        ], PenempatanPegawaiTemplateExport::kolom());
        $this->assertSame(['jenjang'], PenempatanPegawaiTemplateExport::kolomWajib());
        $this->assertSame(PenempatanPegawaiTemplateExport::kolom(), (new PenempatanPegawaiTemplateExport)->headings());
        $this->assertSame('Penempatan Pegawai', (new PenempatanPegawaiTemplateExport)->title());
        $baris = (new PenempatanPegawaiTemplateExport)->array();
        $this->assertCount(count(PenempatanPegawaiTemplateExport::kolom()), $baris[0]);
    }

    /**
     * Santri: heading = KOLOM_PROFIL (kontrak buku induk) dan kolom wajib
     * diambil dari rule import — jadi perubahan rule langsung terlihat.
     */
    public function test_santri_heading_dari_kolom_profil_dan_wajib_dari_rule(): void
    {
        $export = new SantriTemplateExport;
        $this->assertSame(Santri::KOLOM_PROFIL, $export->headings());
        $this->assertSame('Data Santri', $export->title());
        $wajib = SantriTemplateExport::kolomWajib();
        $this->assertContains('nama_lengkap', $wajib);
        $this->assertContains('jk', $wajib);
        foreach ($wajib as $k) {
            $this->assertContains($k, SantriTemplateExport::kolom(), "wajib.{$k} bukan kolom");
        }
        $this->assertSame(SantriTemplateExport::kolom(), $export->array()[0] === [] ? [] : $export->headings());
    }

    /** Santri: setiap kolom santri ber-dropdown kamus memakai tipe RefService yang sah. */
    public function test_santri_ref_kolom_menunjuk_tipe_kamus(): void
    {
        $pilihan = (new SantriTemplateExport)->pilihan();
        $this->assertSame(['L', 'P'], $pilihan['jk']);
        $this->assertSame(['WNI', 'WNA'], $pilihan['kewarganegaraan']);
        foreach (SantriTemplateExport::REF_KOLOM as $kolom => $tipe) {
            $this->assertArrayHasKey($kolom, $pilihan, "dropdown {$kolom} tidak dibangun");
            $this->assertIsString($tipe);
        }
    }
}
