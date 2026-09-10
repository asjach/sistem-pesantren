<?php

namespace App\Services;

use App\Models\DokumenSantri;
use App\Models\DokumenWajibLembaga;
use App\Models\Lembaga;
use App\Models\PsbCalonSantri;
use App\Models\PsbGelombang;
use App\Models\PsbKuotaBiaya;
use App\Models\PsbLogStatus;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\Tagihan;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PsbService
{
    /** Copy 1:1 calon -> santri. Field yang tidak ada di map tidak ikut tercopy.
     *  FINAL (dikunci): email_ortu/telp_ortu -> users (akun), BUKAN santri.
     *  Internal PSB (gelombang_id, status, catatan, no_pendaftaran) + nis/kelas_id tidak ikut.
     *  Tahap-2 selaras santri: seluruh kolom EMIS dikumpulkan di PSB tahap-2,
     *  ACC langsung lengkap tanpa entry ulang via 101. */
    public const FIELD_MAP = [
        'nik' => 'nik', 'nama_lengkap' => 'nama_lengkap', 'nama_singkat' => 'nama_singkat',
        'jk' => 'jk', 'tgl_lahir' => 'tgl_lahir', 'tmp_lahir' => 'tmp_lahir',
        'nisn' => 'nisn', 'anak_ke' => 'anak_ke', 'j_saudara' => 'j_saudara',
        'tipe_santri' => 'tipe_santri', 'agama' => 'agama',
        'cita_cita' => 'cita_cita', 'hobi' => 'hobi',
        'kebutuhan_khusus' => 'kebutuhan_khusus', 'kebutuhan_disabilitas' => 'kebutuhan_disabilitas',
        'nomor_kip' => 'nomor_kip', 'no_hp_santri' => 'no_hp_santri', 'email_santri' => 'email_santri',
        'no_kk' => 'no_kk', 'kewarganegaraan' => 'kewarganegaraan', 'bahasa_sehari' => 'bahasa_sehari',
        'status_tempat_tinggal' => 'status_tempat_tinggal', 'jarak_ke_pesantren' => 'jarak_ke_pesantren',
        'waktu_tempuh' => 'waktu_tempuh', 'transportasi' => 'transportasi', 'tanggal_masuk' => 'tanggal_masuk',
        'alamat' => 'alamat', 'provinsi' => 'provinsi', 'kab_kota' => 'kab_kota',
        'kecamatan' => 'kecamatan', 'desa_kelurahan' => 'desa_kelurahan',
        'rt' => 'rt', 'rw' => 'rw', 'kode_pos' => 'kode_pos',
        'ayah_nama' => 'ayah_nama', 'ayah_nik' => 'ayah_nik',
        'ayah_tmp_lahir' => 'ayah_tmp_lahir', 'ayah_tgl_lahir' => 'ayah_tgl_lahir',
        'ayah_status' => 'ayah_status', 'ayah_pendidikan' => 'ayah_pendidikan',
        'ayah_pekerjaan' => 'ayah_pekerjaan', 'ayah_penghasilan' => 'ayah_penghasilan',
        'ayah_telp' => 'ayah_telp', 'ayah_alamat' => 'ayah_alamat',
        'ayah_status_tempat_tinggal' => 'ayah_status_tempat_tinggal',
        'ibu_nama' => 'ibu_nama', 'ibu_nik' => 'ibu_nik',
        'ibu_tmp_lahir' => 'ibu_tmp_lahir', 'ibu_tgl_lahir' => 'ibu_tgl_lahir',
        'ibu_status' => 'ibu_status', 'ibu_pendidikan' => 'ibu_pendidikan',
        'ibu_pekerjaan' => 'ibu_pekerjaan', 'ibu_penghasilan' => 'ibu_penghasilan',
        'ibu_telp' => 'ibu_telp', 'ibu_alamat' => 'ibu_alamat',
        'ibu_status_tempat_tinggal' => 'ibu_status_tempat_tinggal',
        'wali_nama' => 'wali_nama', 'wali_nik' => 'wali_nik',
        'wali_tmp_lahir' => 'wali_tmp_lahir', 'wali_tgl_lahir' => 'wali_tgl_lahir',
        'wali_status' => 'wali_status', 'wali_pendidikan' => 'wali_pendidikan',
        'wali_pekerjaan' => 'wali_pekerjaan', 'wali_penghasilan' => 'wali_penghasilan',
        'wali_telp' => 'wali_telp', 'wali_alamat' => 'wali_alamat',
        'wali_status_tempat_tinggal' => 'wali_status_tempat_tinggal',
        'yang_membiayai' => 'yang_membiayai', 'foto_url' => 'foto_url',
    ];

    protected KeuanganService $keuangan;

    public function __construct(KeuanganService $keuangan)
    {
        $this->keuangan = $keuangan;
    }

    /** Definisi paket (sengaja konstanta, bukan tabel — paket jarang dan selalu spesifik). */
    public const PAKET_MI_MD = ['kode' => 'MI-MD', 'primer' => 'MI', 'anggota' => ['MI', 'MD']];

    /** Tingkat masuk santri baru per kode lembaga (root PRD: is_pindahan=false). */
    public const TINGKAT_MASUK_BARU = ['MI' => '1', 'MD' => '1', 'MTS' => '7', 'MLN' => '10'];

    /** Tingkat boleh untuk pindahan per kode lembaga (root PRD). */
    public const TINGKAT_PINDAHAN = [
        'MI' => ['2', '3', '4', '5', '6'],
        'MD' => ['2', '3', '4', '5', '6'],
        'MTS' => ['8', '9'],
        'MLN' => ['11', '12'],
    ];

    /**
     * Validasi + resolve masuk_tingkat. Santri baru: harus entry jenjang
     * (null = pakai default entry). Pindahan: wajib salah satu dari daftar.
     */
    protected function validasiMasukTingkat(Lembaga $lembaga, bool $isPindahan, mixed $tingkat): string
    {
        $kode = (string) $lembaga->kode;
        if (! $isPindahan) {
            $def = self::TINGKAT_MASUK_BARU[$kode] ?? null;
            if ($def === null) {
                throw ValidationException::withMessages(['lembaga_id' => "Kode lembaga {$kode} belum punya tingkat masuk santri baru."]);
            }
            if ($tingkat !== null && (string) $tingkat !== $def) {
                throw ValidationException::withMessages(['masuk_tingkat' => "Santri baru {$kode} wajib tingkat {$def}."]);
            }

            return $def;
        }
        $boleh = self::TINGKAT_PINDAHAN[$kode] ?? null;
        if ($boleh === null) {
            throw ValidationException::withMessages(['lembaga_id' => "Kode lembaga {$kode} belum punya daftar tingkat pindahan."]);
        }
        if (! in_array((string) ($tingkat ?? ''), $boleh, true)) {
            throw ValidationException::withMessages(['masuk_tingkat' => 'Pindahan ' . $kode . ' wajib tingkat ' . implode('/', $boleh) . '.']);
        }

        return (string) $tingkat;
    }

    /** Cek NIK publik: boolean saja (anti enumerasi) + throttle + captcha di route. */
    public function cekNikTerdaftar(string $nik): bool
    {
        return Santri::where('nik', $nik)->where('status_global', true)->exists();
    }

    public function daftarPublik(array $data): PsbCalonSantri
    {
        return DB::transaction(function () use ($data) {
            $isLanjutan = ! empty($data['santri_asal_id']);

            // Kandidat se-identitas untuk dedup (banding tanggal di PHP agar identik MySQL/SQLite).
            $kandidat = PsbCalonSantri::where('gelombang_id', $data['gelombang_id'])
                ->where('nik', $data['nik'])
                ->whereNotIn('status_pendaftaran', ['ditolak', 'tidak_lolos'])
                ->get(['nama_lengkap', 'tgl_lahir']);

            // Pintu 1: NIK cocok santri aktif -> arahkan ke jalur lanjutan, jangan buat ganda
            if (! $isLanjutan) {
                $santriAktif = Santri::where('nik', $data['nik'])->where('status_global', true)->first();
                if ($santriAktif) {
                    throw ValidationException::withMessages([
                        'nik' => "NIK terdaftar sebagai santri aktif (NIS {$santriAktif->nis}). Gunakan Pendaftaran Lanjutan atau hubungi TU.",
                    ]);
                }
                // Dedup identitas lengkap (NIK boleh fiktif/ganda antar anak berbeda):
                // - nik+nama+tgl_lahir sama persis -> tolak (pendaftaran ganda)
                // - nik sama, nama/tgl beda -> lolos + catatan duplikat untuk verifikator
                // Banding tanggal di PHP (Y-m-d) agar identik di MySQL maupun SQLite.
                $identik = $kandidat->contains(fn ($r) =>
                    $r->nama_lengkap === $data['nama_lengkap']
                    && $this->tglSama($r->tgl_lahir, $data['tgl_lahir'] ?? null));
                if ($identik) {
                    throw ValidationException::withMessages(['nik' => 'Data ini sudah terdaftar di gelombang ini.']);
                }
                $this->cekAturanGanda($data);
            }

            // Jenis PSB + tingkat masuk (root PRD): validasi matriks per kode lembaga.
            $lembagaDaftar = Lembaga::findOrFail($data['lembaga_id']);
            $isPindahan = (bool) ($data['is_pindahan'] ?? false);
            $masukTingkat = $this->validasiMasukTingkat($lembagaDaftar, $isPindahan, $data['masuk_tingkat'] ?? null);

            // Lookup tarif 2 tahap (tanpa interpolasi ke SQL mentah):
            // exact tipe dulu, fallback 'semua'.
            $kuotaBiaya = $this->kuotaUntuk((int) $data['gelombang_id'], (int) $data['lembaga_id'], $data['tipe_santri'] ?? null);
            $nominal = $kuotaBiaya ? $kuotaBiaya->nominalPendaftaranEfektif($isLanjutan) : 0;

            // Auto-catatan duplikat kontak/NIK (tidak diblokir, untuk verifikator)
            $catatanSistem = [];
            if (! empty($data['email_ortu']) && PsbCalonSantri::where('email_ortu', $data['email_ortu'])->exists()) {
                $catatanSistem[] = 'email sudah ada di calon lain';
            }
            if (! empty($data['telp_ortu']) && PsbCalonSantri::where('telp_ortu', $data['telp_ortu'])->exists()) {
                $catatanSistem[] = 'telp sudah ada di calon lain';
            }
            $nikGanda = $kandidat->contains(fn ($r) =>
                $r->nama_lengkap !== $data['nama_lengkap']
                || ! $this->tglSama($r->tgl_lahir, $data['tgl_lahir'] ?? null));
            if ($nikGanda) {
                $catatanSistem[] = 'NIK ganda dengan calon lain (nama/tgl_lahir beda, kemungkinan NIK fiktif) — perlu verifikasi admin';
            }

            // Kuota saat INPUT per-tipe: penuh -> waiting_list + pemberitahuan (bukan tolak)
            $statusAwal = $this->kuotaPenuh((int) $data['gelombang_id'], (int) $data['lembaga_id'], $data['tipe_santri'] ?? null) ? 'waiting_list' : 'baru';

            // Retry 1062: nomor duplikat akibat race regenerate (maks 3x).
            $usaha = 0;
            $noPendaftaran = $this->generateNoPendaftaran((int) $data['gelombang_id'], (int) $data['lembaga_id']);
            while (true) {
                try {
                    $calon = PsbCalonSantri::create([
                        'lembaga_id' => $data['lembaga_id'],
                        'gelombang_id' => $data['gelombang_id'],
                        'tahun_ajaran_id' => $data['tahun_ajaran_id'] ?? null,
                        'tipe_santri' => $data['tipe_santri'],
                        'nik' => $data['nik'],
                        'nama_lengkap' => $data['nama_lengkap'],
                        'jk' => $data['jk'] ?? null,
                        'tgl_lahir' => $data['tgl_lahir'] ?? null,
                        'email_ortu' => $data['email_ortu'] ?? null,
                        'telp_ortu' => $data['telp_ortu'] ?? null,
                        'ayah_nama' => $data['nama_ayah'] ?? null,
                        'ibu_nama' => $data['nama_ibu'] ?? null,
                        'santri_asal_id' => $data['santri_asal_id'] ?? null,
                        'is_lanjutan' => $isLanjutan,
                        'is_pindahan' => $isPindahan,
                        'masuk_tingkat' => $masukTingkat,
                        'is_duplikat_kontak' => ! empty($catatanSistem),
                        'catatan_sistem' => $catatanSistem ? implode('; ', $catatanSistem) : null,
                        'no_pendaftaran' => $noPendaftaran,
                        'status_pendaftaran' => $statusAwal,
                        'tanggal_daftar' => now()->toDateString(),
                    ]);
                    break;
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) {
                        throw $e;
                    }
                    $noPendaftaran = $this->generateNoPendaftaran((int) $data['gelombang_id'], (int) $data['lembaga_id']);
                }
            }

            if (! empty($data['bukti_transfer'])) {
                // File -> storage/app/psb/bukti/* ; DB hanya path.
                $file = $data['bukti_transfer'];
                $path = $file instanceof UploadedFile ? $file->store('psb/bukti', 'local') : (is_string($file) ? $file : null);
                if ($path) {
                    DokumenSantri::create([
                        'psb_calon_santri_id' => $calon->id,
                        'jenis_dokumen_santri' => 'bukti_transfer',
                        'path_file' => $path,
                    ]);
                }
            }

            PsbLogStatus::create(['psb_calon_santri_id' => $calon->id, 'dari' => null, 'ke' => $statusAwal]);

            // Tagihan pendaftaran via Keuangan (nominal boleh 0/cicil)
            $tahunAjaranId = $data['tahun_ajaran_id'] ?? $calon->gelombang->tahun_ajaran_id;
            $this->keuangan->createTagihanPendaftaranPsb($calon, (float) $nominal, (int) $tahunAjaranId);

            return $calon;
        });
    }

    /** Kuota dihitung saat INPUT per-tipe (exact + fallback 'semua'). waiting_list tidak memakan kursi. */
    public function kuotaPenuh(int $gelombangId, int $lembagaId, ?string $tipeSantri = null): bool
    {
        $q = PsbKuotaBiaya::where('gelombang_id', $gelombangId)->where('lembaga_id', $lembagaId);
        if ($tipeSantri) {
            // Kuota per-tipe: baris exact + baris 'semua' (pola sama seperti lookup nominal).
            $kuota = (clone $q)->whereIn('tipe_santri', [$tipeSantri, 'semua'])->sum('kuota');
        } else {
            $kuota = $q->sum('kuota');
        }
        if (! $kuota) {
            return false; // kuota null = tanpa batas
        }
        $terpakai = PsbCalonSantri::where('gelombang_id', $gelombangId)
            ->where('lembaga_id', $lembagaId)
            ->when($tipeSantri, fn ($qq) => $qq->where('tipe_santri', $tipeSantri))
            ->whereNotIn('status_pendaftaran', ['ditolak', 'tidak_lolos', 'waiting_list'])
            ->count();

        return $terpakai >= $kuota;
    }

    /**
     * Daftar paket MI-MD: 1 input -> 2 baris atomik (primer MI + sekunder MD gratis).
     * Lifecycle tidak pernah divergen: semua operasi paket memegang paket_grup_id.
     */
    public function daftarPaket(array $data): array
    {
        return DB::transaction(function () use ($data) {
            if (($data['tipe_santri'] ?? 'non_asrama') !== 'non_asrama') {
                throw ValidationException::withMessages(['paket' => 'Paket MI-MD hanya tersedia untuk non_asrama.']);
            }
            $lembagaPrimer = Lembaga::where('kode', self::PAKET_MI_MD['primer'])->firstOrFail();
            $lembagaSekunder = Lembaga::where('kode', 'MD')->firstOrFail();

            // Harga paket arbitrer dari baris primer (null = paket tidak ditawarkan)
            $kuotaPrimer = PsbKuotaBiaya::where('gelombang_id', $data['gelombang_id'])
                ->where('lembaga_id', $lembagaPrimer->id)
                ->where('tipe_santri', 'non_asrama')->first();
            if (! $kuotaPrimer || $kuotaPrimer->nominal_paket === null) {
                throw ValidationException::withMessages(['paket' => 'Paket MI-MD tidak ditawarkan di gelombang ini.']);
            }
            // Paket selalu santri baru tingkat 1 (kedua jenjang SD).
            $this->validasiMasukTingkat($lembagaPrimer, false, $data['masuk_tingkat'] ?? '1');
            $this->validasiMasukTingkat($lembagaSekunder, false, '1');
            $data['is_pindahan'] = false;
            $data['masuk_tingkat'] = '1';

            $grupId = (string) Str::uuid();
            // Atomik: salah satu penuh -> SELURUH paket waiting_list (paket = non_asrama)
            $waiting = $this->kuotaPenuh((int) $data['gelombang_id'], $lembagaPrimer->id, 'non_asrama')
                || $this->kuotaPenuh((int) $data['gelombang_id'], $lembagaSekunder->id, 'non_asrama');
            $statusAwal = $waiting ? 'waiting_list' : 'baru';

            // 1 nomor gabungan untuk 2 baris (counter sendiri kode MIMD).
            $noPaket = $this->generateNoPendaftaranPaket((int) $data['gelombang_id']);
            $primer = $this->buatBarisCalon($data, $lembagaPrimer->id, $grupId, $statusAwal, $noPaket);
            $sekunder = $this->buatBarisCalon($data, $lembagaSekunder->id, $grupId, $statusAwal, $noPaket);

            // SATU tagihan paket di baris primer; baris sekunder gratis (tanpa tagihan)
            $tahunAjaranId = $data['tahun_ajaran_id'] ?? $primer->gelombang->tahun_ajaran_id;
            $this->keuangan->createTagihanPendaftaranPsb($primer, (float) $kuotaPrimer->nominal_paket, (int) $tahunAjaranId);

            return ['primer' => $primer, 'sekunder' => $sekunder, 'waiting' => $waiting];
        });
    }

    protected function buatBarisCalon(array $data, int $lembagaId, string $grupId, string $status, ?string $noPaket = null): PsbCalonSantri
    {
        // Retry 1062: nomor duplikat akibat race regenerate (maks 3x).
        $usaha = 0;
        while (true) {
            try {
                $calon = PsbCalonSantri::create([
                    'lembaga_id' => $lembagaId,
                    'gelombang_id' => $data['gelombang_id'],
                    'tahun_ajaran_id' => $data['tahun_ajaran_id'] ?? null,
                    'tipe_santri' => 'non_asrama',
                    'nik' => $data['nik'],
                    'nama_lengkap' => $data['nama_lengkap'],
                    'jk' => $data['jk'] ?? null,
                    'tgl_lahir' => $data['tgl_lahir'] ?? null,
                    'email_ortu' => $data['email_ortu'] ?? null,
                    'telp_ortu' => $data['telp_ortu'] ?? null,
                    'ayah_nama' => $data['nama_ayah'] ?? null,
                    'ibu_nama' => $data['nama_ibu'] ?? null,
                    'paket_grup_id' => $grupId,
                    'is_lanjutan' => false,
                    'is_pindahan' => (bool) ($data['is_pindahan'] ?? false),
                    'masuk_tingkat' => $data['masuk_tingkat'] ?? null,
                    'no_pendaftaran' => $noPaket ?? $this->generateNoPendaftaran((int) $data['gelombang_id'], $lembagaId),
                    'status_pendaftaran' => $status,
                    'tanggal_daftar' => now()->toDateString(),
                ]);
                break;
            } catch (QueryException $e) {
                if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) {
                    throw $e;
                }
                $noPaket = str_starts_with($noPaket ?? '', 'PSB_')
                    ? $this->generateNoPendaftaranPaket((int) $data['gelombang_id'])
                    : $this->generateNoPendaftaran((int) $data['gelombang_id'], $lembagaId);
            }
        }
        PsbLogStatus::create(['psb_calon_santri_id' => $calon->id, 'dari' => null, 'ke' => $status]);

        return $calon;
    }

    /**
     * ACC paket tunggal: kedua baris bersama. Boleh oleh admin salah satu
     * lembaga paket (pengecualian scope khusus paket) / admin full / super_admin.
     */
    public function accPaket(string $grupId, User $admin): Santri
    {
        return DB::transaction(function () use ($grupId, $admin) {
            $baris = PsbCalonSantri::where('paket_grup_id', $grupId)->lockForUpdate()->get();
            if ($baris->count() !== 2) {
                throw ValidationException::withMessages(['paket' => 'Paket tidak lengkap (harus 2 baris MI+MD).']);
            }
            foreach ($baris as $b) {
                if ($b->status_pendaftaran !== 'ajukan_daftar_ulang') {
                    throw ValidationException::withMessages(['status' => 'Seluruh baris paket harus berstatus ajukan_daftar_ulang.']);
                }
            }
            $boleh = $admin->hasRole('super_admin') || $admin->isAdminFull()
                || $admin->canAccessLembaga((int) $baris[0]->lembaga_id)
                || $admin->canAccessLembaga((int) $baris[1]->lembaga_id);
            if (! $boleh) {
                abort(403, 'Hanya admin salah satu lembaga paket / admin full yang boleh ACC paket.');
            }
            $baris->load('lembagaTujuan');
            $primer = $baris->first(fn ($b) => $b->lembagaTujuan && $b->lembagaTujuan->kode === self::PAKET_MI_MD['primer']) ?? $baris->first();
            $payload = ['lembaga_id' => $primer->lembaga_id, 'status_global' => true];
            foreach (self::FIELD_MAP as $dari => $ke) {
                $payload[$ke] = $primer->{$dari};
            }
            $payload['nis'] = null;
            $payload['kelas_id'] = null;
            $santri = Santri::create($payload);
            // Dua riwayat (MI + MD): status_awal dari flag tiap baris + tingkat masuknya.
            foreach ($baris as $b) {
                if ($b->tahun_ajaran_id) {
                    [$awalPkt, $tingkatPkt] = $this->awalDanTingkat($b);
                    RiwayatBelajar::firstOrCreate(
                        ['santri_id' => $santri->id, 'tahun_ajaran_id' => $b->tahun_ajaran_id, 'lembaga_id' => $b->lembaga_id, 'semester' => '1'],
                        ['status_awal' => $awalPkt, 'tingkat' => $tingkatPkt, 'status_akhir' => 'aktif', 'is_aktif' => true, 'tgl_masuk' => $b->tanggal_masuk ?? null]
                    );
                }
                Tagihan::where('psb_calon_santri_id', $b->id)->update(['santri_id' => $santri->id]);
                DB::table('pembayaran')->where('psb_calon_santri_id', $b->id)->update(['santri_id' => $santri->id]);
                DokumenSantri::where('psb_calon_santri_id', $b->id)
                    ->update(['santri_id' => $santri->id, 'psb_calon_santri_id' => null]);
                // Tagihan masuk paket SATU di primer saja; baris sekunder gratis.
                if ($b->id === $primer->id) {
                    $this->keuangan->createTagihanMasukPsb($b, $santri);
                }
                $b->update(['santri_id' => $santri->id, 'status_pendaftaran' => 'daftar_ulang']);
                $this->tulisLog($b->id, 'ajukan_daftar_ulang', 'daftar_ulang', $admin->id, 'ACC paket ' . self::PAKET_MI_MD['kode']);
            }

            return $santri;
        });
    }

    public function verifikasi(int $id, int $adminId): PsbCalonSantri
    {
        $calon = PsbCalonSantri::findOrFail($id);
        if ($calon->paket_grup_id) {
            throw ValidationException::withMessages(['paket' => 'Baris paket harus diproses via endpoint paket (grup sekaligus), bukan satuan.']);
        }

        return $this->pindahStatus($id, 'terverifikasi', $adminId, ['baru']);
    }

    /** Tolak satuan (non-paket saja). Baris paket wajib via tolakPaket() agar tidak divergen. */
    public function tolak(int $id, int $adminId, ?string $catatan = null): PsbCalonSantri
    {
        $calon = PsbCalonSantri::findOrFail($id);
        if ($calon->paket_grup_id) {
            throw ValidationException::withMessages(['paket' => 'Baris paket harus ditolak via tolakPaket (grup sekaligus).']);
        }

        return $this->pindahStatus($id, 'ditolak', $adminId, ['baru', 'terverifikasi', 'lolos', 'pemberkasan', 'ajukan_daftar_ulang', 'waiting_list'], $catatan);
    }

    /** Tolak paket MI-MD: 2 baris grup atomik → ditolak bersama. */
    public function tolakPaket(string $grupId, int $adminId, ?string $catatan = null): void
    {
        DB::transaction(function () use ($grupId, $adminId, $catatan) {
            $grup = PsbCalonSantri::where('paket_grup_id', $grupId)->lockForUpdate()->get();
            if ($grup->isEmpty()) {
                throw ValidationException::withMessages(['paket' => 'Grup paket tidak ditemukan.']);
            }
            foreach ($grup as $b) {
                $this->pindahStatus($b->id, 'ditolak', $adminId, ['baru', 'terverifikasi', 'lolos', 'pemberkasan', 'ajukan_daftar_ulang', 'waiting_list'], $catatan);
            }
        });
    }

    /** Promosi waiting_list -> baru (manual oleh admin saat kursi kosong; paket: promosikan grup sekaligus bila keduanya kosong). */
    public function promosikanWaiting(int $id, int $adminId): PsbCalonSantri
    {
        $calon = PsbCalonSantri::findOrFail($id);
        if ($calon->paket_grup_id) {
            return DB::transaction(function () use ($calon, $adminId) {
                $grup = PsbCalonSantri::where('paket_grup_id', $calon->paket_grup_id)->lockForUpdate()->get();
                foreach ($grup as $b) {
                    if ($this->kuotaPenuh((int) $b->gelombang_id, (int) $b->lembaga_id, $b->tipe_santri)) {
                        throw ValidationException::withMessages(['kuota' => 'Kuota salah satu lembaga paket masih penuh.']);
                    }
                }
                foreach ($grup as $b) {
                    $this->pindahStatus($b->id, 'baru', $adminId, ['waiting_list']);
                }

                return $calon->fresh();
            });
        }
        if ($this->kuotaPenuh((int) $calon->gelombang_id, (int) $calon->lembaga_id, $calon->tipe_santri)) {
            throw ValidationException::withMessages(['kuota' => 'Kuota masih penuh.']);
        }

        return $this->pindahStatus($id, 'baru', $adminId, ['waiting_list']);
    }

    public function setSeleksi(int $id, bool $lolos, int $adminId, ?string $catatan = null): PsbCalonSantri
    {
        $calon = PsbCalonSantri::with('gelombang')->findOrFail($id);
        $kuotaBiaya = $this->kuotaUntuk((int) $calon->gelombang_id, (int) $calon->lembaga_id, $calon->tipe_santri);
        $butuhSeleksi = $kuotaBiaya ? $kuotaBiaya->butuhSeleksi() : false;
        if (! $butuhSeleksi) {
            throw ValidationException::withMessages(['status' => 'Gelombang ini jalur langsung, tanpa seleksi.']);
        }
        // Langsung terverifikasi -> lolos/tidak_lolos (TIDAK ada status 'seleksi')
        return $this->pindahStatus($id, $lolos ? 'lolos' : 'tidak_lolos', $adminId, ['terverifikasi'], $catatan);
    }

    public function lengkapiDaftarUlang(int $id, array $data): PsbCalonSantri
    {
        $calon = PsbCalonSantri::findOrFail($id);
        // File foto -> storage/app/psb/foto/* ; DB hanya path
        if (! empty($data['foto']) && $data['foto'] instanceof UploadedFile) {
            $data['foto_url'] = $data['foto']->store('psb/foto', 'local');
        }
        unset($data['foto']);
        // UPDATE baris yang sama (bukan INSERT baru)
        $calon->update(collect($data)->only(array_keys(self::FIELD_MAP))->toArray());
        if ($calon->status_pendaftaran === 'ajukan_daftar_ulang') {
            $this->tulisLog($id, 'ajukan_daftar_ulang', 'pemberkasan', null, 'Edit setelah ajukan: status turun, wajib ajukan ulang');
            $calon->update(['status_pendaftaran' => 'pemberkasan']);
        }

        return $calon->fresh();
    }

    /** Ajukan daftar ulang WAJIB oleh ortu pemilik: calon tertaut ke akun via email/telp_calon = email/phone akun. */
    public function ajukanDaftarUlang(int $id, User $wali): PsbCalonSantri
    {
        $calon = PsbCalonSantri::findOrFail($id);
        $milik = ($calon->email_ortu && $calon->email_ortu === $wali->email)
            || ($calon->telp_ortu && $this->normalTelp($calon->telp_ortu) === $this->normalTelp($wali->phone ?? ''))
            || ($calon->santri_asal_id && DB::table('wali_santri_relasi')->where('user_id', $wali->id)->where('santri_id', $calon->santri_asal_id)->exists());
        if (! $milik) {
            abort(403, 'Calon ini bukan tanggungan akun Anda.');
        }
        $kuotaBiaya = $this->kuotaUntuk((int) $calon->gelombang_id, (int) $calon->lembaga_id, $calon->tipe_santri);
        $butuhSeleksi = $kuotaBiaya ? $kuotaBiaya->butuhSeleksi() : false;
        $bolehDari = $butuhSeleksi ? ['lolos', 'pemberkasan'] : ['terverifikasi', 'pemberkasan', 'lolos'];
        if (! in_array($calon->status_pendaftaran, $bolehDari, true)) {
            throw ValidationException::withMessages(['status' => 'Belum memenuhi syarat ajukan daftar ulang.']);
        }
        // Dokumen wajib lembaga cukup TERUPLOAD (status boleh menunggu; verifikasi menyusul TU).
        $wajib = DokumenWajibLembaga::where('lembaga_id', $calon->lembaga_id)
            ->where('is_wajib', true)->pluck('jenis_dokumen_santri')->all();
        if ($wajib) {
            $ada = DokumenSantri::where('psb_calon_santri_id', $calon->id)
                ->whereIn('jenis_dokumen_santri', $wajib)->pluck('jenis_dokumen_santri')->all();
            $kurang = array_values(array_diff($wajib, $ada));
            if ($kurang) {
                throw ValidationException::withMessages(['dokumen' => 'Dokumen wajib belum diupload: ' . implode(', ', $kurang)]);
            }
        }

        return $this->pindahStatus($id, 'ajukan_daftar_ulang', null, $bolehDari);
    }

    public function accDaftarUlang(int $id, int $adminId): Santri
    {
        return DB::transaction(function () use ($id, $adminId) {
            $calon = PsbCalonSantri::where('id', $id)->lockForUpdate()->firstOrFail();
            if ($calon->paket_grup_id) {
                throw ValidationException::withMessages(['paket' => 'Baris paket MI-MD harus di-ACC via accPaket (grup sekaligus), bukan satuan.']);
            }
            if ($calon->status_pendaftaran !== 'ajukan_daftar_ulang') {
                throw ValidationException::withMessages(['status' => 'Hanya status ajukan_daftar_ulang yang bisa di-ACC.']);
            }
            // Kuota sudah dikunci saat INPUT (kuotaPenuh), di sini tinggal reuse/buat santri.
            $santri = $calon->santri_asal_id
                ? Santri::where('id', $calon->santri_asal_id)->lockForUpdate()->firstOrFail()
                : null;
            if (! $santri) {
                $payload = ['lembaga_id' => $calon->lembaga_id, 'status_global' => true];
                foreach (self::FIELD_MAP as $dari => $ke) {
                    $payload[$ke] = $calon->{$dari};
                }
                $payload['nis'] = null; // NIS diisi belakangan via import Excel
                $payload['kelas_id'] = null; // penempatan kelas menyusul
                $santri = Santri::create($payload);
            } else {
                $payload = [];
                foreach (self::FIELD_MAP as $dari => $ke) {
                    if ($calon->{$dari} !== null) {
                        $payload[$ke] = $calon->{$dari};
                    }
                }
                $payload['lembaga_id'] = $calon->lembaga_id;
                $santri->update($payload);
            }
            // Riwayat belajar menyusul boleh null kelas
            if ($calon->tahun_ajaran_id) {
                [$awalAcc, $tingkatAcc] = $this->awalDanTingkat($calon);
                RiwayatBelajar::firstOrCreate(
                    ['santri_id' => $santri->id, 'tahun_ajaran_id' => $calon->tahun_ajaran_id, 'lembaga_id' => $calon->lembaga_id, 'semester' => '1'],
                    ['status_awal' => $awalAcc, 'tingkat' => $tingkatAcc, 'status_akhir' => 'aktif', 'is_aktif' => true, 'tgl_masuk' => $calon->tanggal_masuk ?? null]
                );
            }
            // Backfill pembayaran: tagihan/pembayaran calon ikut santri_id (audit psb_calon_santri_id tetap)
            Tagihan::where('psb_calon_santri_id', $calon->id)->update(['santri_id' => $santri->id]);
            DB::table('pembayaran')->where('psb_calon_santri_id', $calon->id)->update(['santri_id' => $santri->id]);
            // PINDAH dokumen: milik santri penuh (jejak asal via santri_id hasil + psb_log_status).
            DokumenSantri::where('psb_calon_santri_id', $calon->id)
                ->update(['santri_id' => $santri->id, 'psb_calon_santri_id' => null]);

            // Tagihan masuk/daftar ulang (nominal dari psb_kuota_biaya.nominal_masuk, boleh 0)
            $this->keuangan->createTagihanMasukPsb($calon, $santri);

            $calon->update(['santri_id' => $santri->id, 'status_pendaftaran' => 'daftar_ulang']);
            $this->tulisLog($id, 'ajukan_daftar_ulang', 'daftar_ulang', $adminId, null);

            return $santri;
        });
    }

    protected function cekAturanGanda(array $data): void
    {
        $lembaga = Lembaga::findOrFail($data['lembaga_id']);
        $aktifLain = PsbCalonSantri::where('nik', $data['nik'])
            ->whereNotIn('status_pendaftaran', ['ditolak', 'tidak_lolos', 'daftar_ulang'])
            ->with('lembagaTujuan')->get();
        if ($lembaga->kelompok_psb === 'eksklusif_mts' && $aktifLain->isNotEmpty()) {
            throw ValidationException::withMessages(['lembaga_id' => 'Calon sudah terdaftar aktif di lembaga lain; MTs/Muallimin eksklusif.']);
        }
        $diCombo = $aktifLain->where('lembagaTujuan.kelompok_psb', 'combo_mi_md')->count();
        if ($diCombo >= 2) {
            throw ValidationException::withMessages(['lembaga_id' => 'Maksimal 2 pendaftaran aktif (MI + MD).']);
        }
    }

    protected function normalTelp(?string $telp): string
    {
        $t = preg_replace('/\D/', '', $telp ?? '');

        return preg_replace('/^(0|62)/', '62', $t);
    }

    /**
     * status_awal + tingkat riwayat ACC dari flag calon (root PRD):
     * is_pindahan=false -> 'santri_baru', true -> 'pindahan'.
     */
    protected function awalDanTingkat(PsbCalonSantri $calon): array
    {
        $awal = $calon->is_pindahan ? 'pindahan' : 'santri_baru';
        $tingkat = $calon->masuk_tingkat;
        if (! $tingkat) {
            $lembaga = $calon->lembagaTujuan ?? Lembaga::find($calon->lembaga_id);
            $tingkat = $lembaga ? (self::TINGKAT_MASUK_BARU[$lembaga->kode] ?? null) : null;
        }

        return [$awal, $tingkat];
    }

    /** Banding tanggal null-safe lintas DB (normalisasi Y-m-d). */
    protected function tglSama(mixed $a, mixed $b): bool
    {
        $na = $a ? date('Y-m-d', strtotime((string) $a)) : null;
        $nb = $b ? date('Y-m-d', strtotime((string) $b)) : null;

        return $na === $nb;
    }

    /** Lookup kuota exact-tipe lalu fallback 'semua' (konsisten di semua pemakaian). */
    protected function kuotaUntuk(int $gelombangId, int $lembagaId, ?string $tipeSantri): ?PsbKuotaBiaya
    {
        return PsbKuotaBiaya::where('gelombang_id', $gelombangId)
                ->where('lembaga_id', $lembagaId)
                ->where('tipe_santri', $tipeSantri ?? 'semua')
                ->first()
            ?? PsbKuotaBiaya::where('gelombang_id', $gelombangId)
                ->where('lembaga_id', $lembagaId)
                ->where('tipe_santri', 'semua')
                ->first();
    }

    /** Verifikasi paket MI-MD: 2 baris grup atomik baru -> terverifikasi bersama (agar bisa diajukan). */
    public function verifikasiPaket(string $grupId, int $adminId): array
    {
        return DB::transaction(function () use ($grupId, $adminId) {
            $grup = PsbCalonSantri::where('paket_grup_id', $grupId)->lockForUpdate()->get();
            if ($grup->count() !== 2) {
                throw ValidationException::withMessages(['paket' => 'Paket tidak lengkap (harus 2 baris MI+MD).']);
            }
            $hasil = [];
            foreach ($grup as $b) {
                $hasil[] = $this->pindahStatus($b->id, 'terverifikasi', $adminId, ['baru']);
            }

            return $hasil;
        });
    }

    protected function generateNoPendaftaran(int $gelombangId, int $lembagaId): string
    {
        // Format: PSB_{tahun}_{kodeLembaga}_{noGelombang}_{seq4}; seq reset per (lembaga,tahun); unique no_pendaftaran per lembaga
        // Kunci konsistensi-03: count()+lock masih bisa race (dua transaksi hitung sama sebelum insert).
        // Caller (daftarPublik/buatBarisCalon) WAJIB catch QueryException 1062 pada unique[lembaga_id,no_pendaftaran]
        // lalu regenerate sekali (maks 3x), pola sama seperti retry kuitansi di 103.
        $lembaga = Lembaga::findOrFail($lembagaId);
        $kode = $lembaga->kode ?: ($lembaga->jenjang ?: $lembagaId);
        $tahun = date('Y');
        $gelombang = PsbGelombang::findOrFail($gelombangId);
        // noGelombang = urutan gelombang ini di tahun ajarannya (1, 2, ...)
        $noGelombang = PsbGelombang::where('tahun_ajaran_id', $gelombang->tahun_ajaran_id)
            ->where('id', '<=', $gelombangId)
            ->count() ?: 1;
        $seq = PsbCalonSantri::where('lembaga_id', $lembagaId)
            ->whereYear('created_at', $tahun)
            ->lockForUpdate()->count() + 1;

        return sprintf('PSB_%s_%s_%d_%04d', $tahun, strtoupper((string) $kode), $noGelombang, $seq);
    }

    protected function generateNoPendaftaranPaket(int $gelombangId): string
    {
        // 1 nomor gabungan kode MIMD fixed; counter sendiri agar tidak makan antrian satuan.
        $tahun = date('Y');
        $gelombang = PsbGelombang::findOrFail($gelombangId);
        $noGelombang = PsbGelombang::where('tahun_ajaran_id', $gelombang->tahun_ajaran_id)
            ->where('id', '<=', $gelombangId)
            ->count() ?: 1;
        $prefix = sprintf('PSB_%s_MIMD_%d_', $tahun, $noGelombang);
        // 1 nomor dipakai 2 baris MI+MD — hitung nomor unik, bukan baris.
        $seq = PsbCalonSantri::where('no_pendaftaran', 'like', $prefix . '%')
            ->whereYear('created_at', $tahun)
            ->lockForUpdate()->distinct()->count('no_pendaftaran') + 1;

        return sprintf('%s%04d', $prefix, $seq);
    }

    protected function pindahStatus(int $id, string $ke, ?int $oleh, array $dariBoleh, ?string $catatan = null): PsbCalonSantri
    {
        return DB::transaction(function () use ($id, $ke, $oleh, $dariBoleh, $catatan) {
            $calon = PsbCalonSantri::where('id', $id)->lockForUpdate()->firstOrFail();
            if (! in_array($calon->status_pendaftaran, $dariBoleh, true)) {
                throw ValidationException::withMessages(['status' => "Transisi {$calon->status_pendaftaran} -> {$ke} tidak diizinkan."]);
            }
            $dari = $calon->status_pendaftaran;
            $calon->update(['status_pendaftaran' => $ke, 'catatan_admin' => $catatan ?? $calon->catatan_admin]);
            $this->tulisLog($id, $dari, $ke, $oleh, $catatan);

            return $calon->fresh();
        });
    }

    protected function tulisLog(int $calonId, ?string $dari, string $ke, ?int $oleh, ?string $catatan): void
    {
        PsbLogStatus::create(['psb_calon_santri_id' => $calonId, 'dari' => $dari, 'ke' => $ke, 'oleh_user_id' => $oleh, 'catatan' => $catatan]);
    }
}
