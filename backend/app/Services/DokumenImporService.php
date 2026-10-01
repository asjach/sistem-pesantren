<?php

namespace App\Services;

use App\Models\DokumenLembaga;
use App\Models\DokumenSantri;
use App\Models\Lembaga;
use App\Models\LembagaSantri;
use App\Models\Pegawai;
use App\Models\Santri;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Import daftar dokumen (checklist) per baris — dipakai tiga halaman dokumen:
 * santri / pegawai (guru) / lembaga. Yang diimport adalah DATA dokumen
 * (pemilik + jenis + status + catatan), bukan berkas fisik; baris cocok
 * diperbarui hanya kolom terisi. Mode kering ($kering = true) menjalankan
 * semua cek tanpa menulis.
 *
 * Kunci pemilik per tipe:
 * - santri : nis_lokal + jenjang (unik per lembaga di DB).
 * - pegawai: pegawai_id eksak → nipp eksak → nama unik.
 * - lembaga: jenjang (baris milik lembaga itu).
 */
class DokumenImporService extends ImporPotongan
{
    public const TIPE = ['santri', 'pegawai', 'lembaga'];

    protected const KOLOM_TEKS = ['nis_lokal', 'nipp', 'pegawai_id', 'santri_id'];

    protected string $tipe;

    /** @param  array<string, mixed>  $baris */
    public function normalisasiBaris(array $baris): array
    {
        $baris = $this->castTeks($baris, self::KOLOM_TEKS);
        $baris = $this->castTanggal($baris);

        return $baris;
    }

    /** Set tipe dokumen (santri|pegawai|lembaga); divalidasi controller. */
    public function setTipe(string $tipe): static
    {
        $this->tipe = $tipe;

        return $this;
    }

    /** @param  array<string, mixed>  $baris */
    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $jenis = trim((string) ($baris['jenis_dokumen'] ?? ''));
        $this->kunciAktif = $jenis !== '' ? $jenis : null;

        // Baris kosong/pemisah: tanpa jenis dokumen.
        if ($jenis === '') {
            return;
        }

        $jenjang = mb_strtoupper(trim((string) ($baris['jenjang'] ?? '')));
        if ($jenjang === '' || ! Lembaga::whereKey($jenjang)->exists()) {
            $this->fail($no, 'jenjang', 'Lembaga tidak valid (isi jenjang, mis. MI/MD).');

            return;
        }

        // Izin mengikuti akun per baris (super_admin lolos semua; admin
        // lembaga hanya lembaganya) — baris luar lingkup gagal per baris.
        $auth = auth()->user();
        if (! $auth || ! $auth->canAccessLembaga($jenjang)) {
            $this->fail($no, 'jenjang', 'Lembaga di luar lingkup akses Anda.');

            return;
        }

        $status = $this->tipe === 'santri' ? null : $this->normalisasiStatus($baris['status_verifikasi'] ?? null);
        if ($status === false) {
            $this->fail($no, 'status_verifikasi', "Status '{$baris['status_verifikasi']}' tidak dikenal (isi Menunggu/Valid/Ditolak).");

            return;
        }

        $catatan = trim((string) ($baris['catatan'] ?? ''));
        $catatan = $catatan !== '' ? $catatan : null;

        match ($this->tipe) {
            'santri' => $this->prosesSantri($baris, $no, $jenjang, $jenis, $catatan, $kering),
            'pegawai' => $this->prosesPegawai($baris, $no, $jenjang, $jenis, $status, $catatan, $kering),
            'lembaga' => $this->prosesLembaga($baris, $no, $jenjang, $jenis, $status, $catatan, $kering),
            default => throw ValidationException::withMessages(['tipe' => 'Tipe dokumen tidak dikenal.']),
        };
    }

    /**
     * Santri: kunci (santri, jenis) — nama_file dibiarkan apa adanya
     * (import tak pernah menimpa/menghapus berkas fisik).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function prosesSantri(array $baris, int $no, string $jenjang, string $jenis, ?string $catatan, bool $kering): void
    {
        $santri = $this->cariSantri($baris, $jenjang, $no);
        if ($santri === null) {
            return;
        }

        $lama = DokumenSantri::where('santri_id', $santri->id)->where('jenis_dokumen_santri', $jenis)->first();

        if ($kering) {
            $lama === null ? $this->dibuat++ : $this->diperbarui++;
            $this->valid++;

            return;
        }

        DB::transaction(function () use ($lama, $santri, $jenis, $catatan): void {
            if ($lama === null) {
                DokumenSantri::create([
                    'santri_id' => $santri->id,
                    'jenis_dokumen_santri' => $jenis,
                    'catatan' => $catatan,
                ]);
                $this->dibuat++;
            } else {
                if ($catatan !== null) {
                    $lama->update(['catatan' => $catatan]);
                    $this->diperbarui++;
                } else {
                    $this->dilewati++;
                }
            }
        });

        $this->valid++;
    }

    /**
     * Pegawai: kunci (pegawai, jenis_dokumen_pegawai).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function prosesPegawai(array $baris, int $no, string $jenjang, string $jenis, ?string $status, ?string $catatan, bool $kering): void
    {
        $pegawai = $this->cariPegawai($baris, $jenjang, $no);
        if ($pegawai === null) {
            return;
        }

        $tabel = DB::table('dokumen_pegawai');
        $lama = $tabel->where('pegawai_id', $pegawai->id)->where('jenis_dokumen_pegawai', $jenis)->first();

        if ($kering) {
            $lama === null ? $this->dibuat++ : $this->diperbarui++;
            $this->valid++;

            return;
        }

        $data = [
            'status_verifikasi' => $status ?? 'menunggu',
            'catatan' => $catatan,
        ];
        if ($lama === null) {
            DB::table('dokumen_pegawai')->insert([
                'pegawai_id' => $pegawai->id,
                'jenis_dokumen_pegawai' => $jenis,
                'status_verifikasi' => $status !== '' && $status !== null ? $status : 'menunggu',
                'catatan' => $catatan,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->dibuat++;
        } else {
            $ubah = [];
            if ($status !== null && $status !== '') {
                $ubah['status_verifikasi'] = $status;
            }
            if ($catatan !== null) {
                $ubah['catatan'] = $catatan;
            }
            if ($ubah !== []) {
                $ubah['updated_at'] = now();
                DB::table('dokumen_pegawai')->where('id', $lama->id)->update($ubah);
                $this->diperbarui++;
            } else {
                $this->dilewati++;
            }
        }
        unset($data);

        $this->valid++;
    }

    /**
     * Lembaga: kunci (jenjang, jenis_dokumen).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function prosesLembaga(array $baris, int $no, string $jenjang, string $jenis, ?string $status, ?string $catatan, bool $kering): void
    {
        $lama = DokumenLembaga::where('jenjang', $jenjang)->where('jenis_dokumen', $jenis)->first();

        if ($kering) {
            $lama === null ? $this->dibuat++ : $this->diperbarui++;
            $this->valid++;

            return;
        }

        if ($lama === null) {
            DokumenLembaga::create([
                'jenjang' => $jenjang,
                'jenis_dokumen' => $jenis,
                'status_verifikasi' => $status !== '' && $status !== null ? $status : 'menunggu',
                'catatan' => $catatan,
            ]);
            $this->dibuat++;
        } else {
            $ubah = [];
            if ($status !== null && $status !== '') {
                $ubah['status_verifikasi'] = $status;
            }
            if ($catatan !== null) {
                $ubah['catatan'] = $catatan;
            }
            if ($ubah !== []) {
                $lama->update($ubah);
                $this->diperbarui++;
            } else {
                $this->dilewati++;
            }
        }

        $this->valid++;
    }

    /**
     * Cari santri via nis_lokal + jenjang (fallback pasangan MI↔MD),
     * pola RiwayatBelajarImporService::cariSantri.
     *
     * @param  array<string, mixed>  $baris
     */
    protected function cariSantri(array $baris, string $jenjang, int $no): ?Santri
    {
        $nisLokal = trim((string) ($baris['nis_lokal'] ?? ''));
        if ($nisLokal !== '') {
            $ls = LembagaSantri::where('jenjang', $jenjang)->where('nis_lokal', $nisLokal)->first();
            if ($ls) {
                $santri = Santri::find($ls->santri_id);
                if ($santri) {
                    return $santri;
                }
            }

            $pasangan = Lembaga::pasanganJenjang($jenjang);
            if ($pasangan !== null) {
                $kandidat = LembagaSantri::where('jenjang', $pasangan)->where('nis_lokal', $nisLokal)->first();
                if ($kandidat) {
                    $santri = Santri::find($kandidat->santri_id);
                    if ($santri) {
                        return $santri;
                    }
                }
            }
        }

        $this->fail($no, 'nis_lokal', 'Santri tidak ditemukan (cocokkan NIS lokal + lembaga).');

        return null;
    }

    /**
     * Cari pegawai: pegawai_id eksak → nipp eksak → nama unik (wajib
     * ditempatkan di lembaga baris agar cakupan lembaga bermakna).
     *
     * @param  array<string, mixed>  $baris
     */
    protected function cariPegawai(array $baris, string $jenjang, int $no): ?Pegawai
    {
        if (! empty($baris['pegawai_id'])) {
            $p = Pegawai::find((int) $baris['pegawai_id']);
            if ($p) {
                return $p;
            }
        }

        $nipp = trim((string) ($baris['nipp'] ?? ''));
        if ($nipp !== '') {
            $p = Pegawai::where('nipp', $nipp)->first();
            if ($p) {
                return $p;
            }
        }

        $nama = trim((string) ($baris['nama_lengkap'] ?? ''));
        if ($nama !== '') {
            $kandidat = Pegawai::where('nama_lengkap', $nama)->get();
            if ($kandidat->count() === 1) {
                return $kandidat->first();
            }
            if ($kandidat->count() > 1) {
                $this->fail($no, 'nama_lengkap', 'Nama pegawai tidak unik — isi pegawai_id atau NIPP.');

                return null;
            }
        }

        $this->fail($no, 'nipp', 'Pegawai tidak ditemukan (cocokkan pegawai_id / NIPP / nama).');

        return null;
    }

    /** Status verifikasi: Menunggu/Valid/Ditolak (apa pun kapitalnya) / kode kanonis; selain itu false. */
    protected function normalisasiStatus(mixed $nilai): string|null|false
    {
        $teks = mb_strtolower(trim((string) ($nilai ?? '')));
        if ($teks === '') {
            return '';
        }
        foreach (['menunggu', 'valid', 'ditolak'] as $kode) {
            if (strcasecmp($teks, $kode) === 0) {
                return $kode;
            }
        }

        return false;
    }
}
