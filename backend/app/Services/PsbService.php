<?php

namespace App\Services;

use App\Models\DokumenSantri;
use App\Models\DokumenWajibLembaga;
use App\Models\Lembaga;
use App\Models\PsbCalonLembaga;
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
    protected PsbGelombangService $gelombang;

    public function __construct(KeuanganService $keuangan, PsbGelombangService $gelombang)
    {
        $this->keuangan = $keuangan;
        $this->gelombang = $gelombang;
    }

    /** Definisi paket (sengaja konstanta, bukan tabel — paket jarang dan selalu spesifik). */
    public const PAKET_MI_MD = ['kode' => 'MI-MD', 'primer' => 'MI', 'anggota' => ['MI', 'MD']];

    /** Kelompok PSB combo (kuota digabung, aturan daftar ganda maks 2 lembaga). */
    public const KELOMPOK_COMBO = 'combo_mi_md';

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
            if (empty($data['gelombang_id'])) {
                $gelombangAktif = $this->gelombang->gelombangAktif();
                if (! $gelombangAktif) {
                    throw ValidationException::withMessages(['gelombang_id' => 'Pendaftaran sedang ditutup: tidak ada gelombang yang sedang dibuka.']);
                }
                $data['gelombang_id'] = $gelombangAktif->id;
            }
            $gelombangModel = PsbGelombang::with('kegiatan:id,tahun_ajaran_id')->findOrFail($data['gelombang_id']);
            $data['tahun_ajaran_id'] = $data['tahun_ajaran_id'] ?? $gelombangModel->kegiatan?->tahun_ajaran_id;

            $isLanjutan = ! empty($data['santri_asal_id']);
            $isPaket = ($data['paket'] ?? null) === self::PAKET_MI_MD['kode'];

            $kandidat = PsbCalonSantri::where('gelombang_id', $data['gelombang_id'])
                ->where('nik', $data['nik'])
                ->whereNotIn('status_pendaftaran', ['ditolak', 'tidak_lolos', 'mengundurkan_diri'])
                ->get(['nama_lengkap', 'tgl_lahir']);

            if (! $isLanjutan) {
                $santriAktif = Santri::where('nik', $data['nik'])->where('status_global', true)->first();
                if ($santriAktif) {
                    throw ValidationException::withMessages([
                        'nik' => "NIK terdaftar sebagai santri aktif (NIS {$santriAktif->nis}). Gunakan Pendaftaran Lanjutan atau hubungi TU.",
                    ]);
                }
                $identik = $kandidat->contains(fn ($r) =>
                    $r->nama_lengkap === $data['nama_lengkap']
                    && $this->tglSama($r->tgl_lahir, $data['tgl_lahir'] ?? null));
                if ($identik) {
                    throw ValidationException::withMessages(['nik' => 'Data ini sudah terdaftar di gelombang ini.']);
                }
                $this->cekAturanGanda($data);
            }

            if ($isPaket && $isLanjutan) {
                throw ValidationException::withMessages(['paket' => 'Paket MI-MD hanya untuk pendaftaran santri baru.']);
            }

            $lembagaDaftar = Lembaga::findOrFail($data['lembaga_id']);
            $isPindahan = (bool) ($data['is_pindahan'] ?? false);
            $targets = [];
            $nominal = 0.0;

            if ($isPaket) {
                if (($data['tipe_santri'] ?? 'non_asrama') !== 'non_asrama') {
                    throw ValidationException::withMessages(['paket' => 'Paket MI-MD hanya tersedia untuk non_asrama.']);
                }
                $lembagaPrimer = Lembaga::where('kode', self::PAKET_MI_MD['primer'])->firstOrFail();
                $lembagaSekunder = Lembaga::where('kode', 'MD')->firstOrFail();
                $kuotaBiaya = $this->kuotaUntuk((int) $data['gelombang_id'], $lembagaPrimer->id, 'non_asrama');
                if (! $kuotaBiaya || $kuotaBiaya->nominal_paket === null) {
                    throw ValidationException::withMessages(['paket' => 'Paket MI-MD tidak ditawarkan di gelombang ini.']);
                }
                $this->validasiMasukTingkat($lembagaPrimer, false, '1');
                $this->validasiMasukTingkat($lembagaSekunder, false, '1');
                $isPindahan = false;
                $nominal = (float) $kuotaBiaya->nominal_paket;
                $targets = [
                    ['lembaga' => $lembagaPrimer, 'peran' => 'primer', 'tingkat' => '1'],
                    ['lembaga' => $lembagaSekunder, 'peran' => 'anggota', 'tingkat' => '1'],
                ];
            } else {
                $tingkat = $this->validasiMasukTingkat($lembagaDaftar, $isPindahan, $data['masuk_tingkat'] ?? null);
                $kuotaBiaya = $this->kuotaUntuk((int) $data['gelombang_id'], (int) $data['lembaga_id'], $data['tipe_santri'] ?? null);
                $nominal = $kuotaBiaya ? $kuotaBiaya->nominalPendaftaranEfektif($isLanjutan) : 0.0;
                $targets = [['lembaga' => $lembagaDaftar, 'peran' => 'primer', 'tingkat' => $tingkat]];
            }

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

            $statusAwal = $this->kuotaPenuh((int) $data['gelombang_id'], (int) $targets[0]['lembaga']->id, $data['tipe_santri'] ?? null)
                ? 'waiting_list'
                : 'baru';

            $usaha = 0;
            $noPendaftaran = $isPaket
                ? $this->generateNoPendaftaranPaket((int) $data['gelombang_id'])
                : $this->generateNoPendaftaran((int) $data['gelombang_id'], (int) $data['lembaga_id']);
            while (true) {
                try {
                    $calon = PsbCalonSantri::create([
                        'lembaga_id' => $targets[0]['lembaga']->id,
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
                    $noPendaftaran = $isPaket
                        ? $this->generateNoPendaftaranPaket((int) $data['gelombang_id'])
                        : $this->generateNoPendaftaran((int) $data['gelombang_id'], (int) $data['lembaga_id']);
                }
            }

            foreach ($targets as $t) {
                PsbCalonLembaga::create([
                    'psb_calon_santri_id' => $calon->id,
                    'lembaga_id' => $t['lembaga']->id,
                    'peran' => $t['peran'],
                    'masuk_tingkat' => $t['tingkat'],
                ]);
            }

            $this->simpanBuktiTransfer($calon, $data['bukti_transfer'] ?? null);

            PsbLogStatus::create(['psb_calon_santri_id' => $calon->id, 'dari' => null, 'ke' => $statusAwal]);

            $tahunAjaranId = $data['tahun_ajaran_id'] ?? $calon->gelombang->kegiatan?->tahun_ajaran_id;
            $this->keuangan->createTagihanPendaftaranPsb($calon, (float) $nominal, (int) $tahunAjaranId);

            return $calon->fresh();
        });
    }

    /** Bukti transfer -> storage/app/psb/bukti/* ; DB hanya path. Dipakai alur satuan & paket. */
    protected function simpanBuktiTransfer(PsbCalonSantri $calon, mixed $file): void
    {
        if (empty($file)) {
            return;
        }
        $path = $file instanceof UploadedFile ? $file->store('psb/bukti', 'local') : (is_string($file) ? $file : null);
        if ($path) {
            DokumenSantri::create([
                'psb_calon_santri_id' => $calon->id,
                'jenis_dokumen_santri' => 'bukti_transfer',
                'path_file' => $path,
            ]);
        }
    }

    /** Kuota POOL GABUNGAN per kelompok PSB (delegasi ke PsbGelombangService). waiting_list tidak memakan kursi. */
    public function kuotaPenuh(int $gelombangId, int $lembagaId, ?string $tipeSantri = null): bool
    {
        return $this->gelombang->sisaKuota($gelombangId, $lembagaId, $tipeSantri) === 0;
    }

    public function verifikasi(int $id, int $adminId): PsbCalonSantri
    {
        return $this->pindahStatus($id, 'terverifikasi', $adminId, ['baru']);
    }

    /** Hapus (soft delete) calon: blokir bila sudah ada pembayaran atau sudah jadi santri. */
    public function hapusCalon(int $id, int $adminId): void
    {
        DB::transaction(function () use ($id, $adminId) {
            $calon = PsbCalonSantri::findOrFail($id);
            if ($calon->status_pendaftaran === 'daftar_ulang') {
                throw ValidationException::withMessages(['status' => 'Calon sudah menjadi santri; kelola lewat data santri, bukan PSB.']);
            }
            if (DB::table('pembayaran')->where('psb_calon_santri_id', $calon->id)->exists()) {
                throw ValidationException::withMessages(['pembayaran' => 'Calon sudah memiliki pembayaran; selesaikan di Keuangan sebelum menghapus.']);
            }
            $this->keuangan->batalkanTagihanPsb($calon);
            $this->tulisLog($calon->id, $calon->status_pendaftaran, 'dihapus', $adminId, 'Calon dihapus (soft delete)');
            $calon->forceFill(['deleted_by' => $adminId])->save();
            $calon->delete();
        });
    }

    public function pulihkanCalon(int $id, int $adminId): PsbCalonSantri
    {
        return DB::transaction(function () use ($id, $adminId) {
            $calon = PsbCalonSantri::withTrashed()->findOrFail($id);
            if (! $calon->trashed()) {
                return $calon;
            }
            $this->keuangan->aktifkanKembaliTagihanPsb($calon);
            $calon->restore();
            $calon->forceFill(['deleted_by' => null])->save();
            $this->tulisLog($calon->id, 'dihapus', $calon->status_pendaftaran, $adminId, 'Calon dipulihkan');

            return $calon->fresh();
        });
    }

    public function promosikanWaiting(int $id, int $adminId): PsbCalonSantri
    {
        $calon = PsbCalonSantri::findOrFail($id);
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

    /**
     * Admin memindahkan calon ke fase daftar ulang: terverifikasi/lolos -> pemberkasan.
     * Lembaga ber-seleksi wajib menyertakan $lolos; false -> tidak_lolos.
     */
    public function masukDaftarUlang(int $id, int $adminId, ?bool $lolos = null, ?string $catatan = null): PsbCalonSantri
    {
        $calon = PsbCalonSantri::with('gelombang')->findOrFail($id);
        $kuotaBiaya = $this->kuotaUntuk((int) $calon->gelombang_id, (int) $calon->lembaga_id, $calon->tipe_santri);
        $butuhSeleksi = $kuotaBiaya ? $kuotaBiaya->butuhSeleksi() : false;

        if ($butuhSeleksi) {
            if ($lolos === null) {
                throw ValidationException::withMessages(['lolos' => 'Lembaga ini memerlukan konfirmasi seleksi (lolos/tidak).']);
            }
            if (! $lolos) {
                return $this->pindahStatus($id, 'tidak_lolos', $adminId, ['terverifikasi', 'lolos'], $catatan);
            }
        }

        return $this->pindahStatus($id, 'pemberkasan', $adminId, ['terverifikasi', 'lolos'], $catatan);
    }

    /** Pengunduran diri: boleh dari fase terdaftar, daftar ulang, dan diterima.
     *  Bila calon sudah diterima lewat pendaftaran INI (santri dibuat saat ACC),
     *  data santri + arsip riwayatnya ditarik kembali — calon dianggap tidak pernah
     *  menjadi santri. Pendaftaran lanjutan (santri lama) tidak menghapus santri. */
    public function undurDiri(int $id, int $adminId, ?string $catatan = null): PsbCalonSantri
    {
        return DB::transaction(function () use ($id, $adminId, $catatan) {
            $hasil = $this->pindahStatus($id, 'mengundurkan_diri', $adminId, [
                'terverifikasi', 'lolos', 'pemberkasan', 'ajukan_daftar_ulang', 'daftar_ulang',
            ], $catatan);

            if ($hasil->santri_id && ! $hasil->santri_asal_id) {
                // Lindungi riwayat keuangan: pembayaran tidak boleh ikut terhapus/lepas.
                $adaBayar = DB::table('pembayaran')
                    ->where('psb_calon_santri_id', $hasil->id)
                    ->orWhere('santri_id', $hasil->santri_id)
                    ->exists();
                if ($adaBayar) {
                    throw ValidationException::withMessages(['pembayaran' => 'Santri sudah memiliki pembayaran; selesaikan di Keuangan sebelum mengundurkan diri.']);
                }
                // Tagihan yang belum dibayar dibatalkan (santri batal diterima).
                Tagihan::where('santri_id', $hasil->santri_id)
                    ->where('nominal_terbayar', '<=', 0)
                    ->update(['status' => 'dibatalkan']);
                Tagihan::where('psb_calon_santri_id', $hasil->id)
                    ->where('nominal_terbayar', '<=', 0)
                    ->update(['status' => 'dibatalkan']);

                // Hapus arsip riwayat + master santri (relasi lain ikut FK cascade).
                RiwayatBelajar::where('santri_id', $hasil->santri_id)->delete();
                Santri::where('id', $hasil->santri_id)->delete();
                $hasil->forceFill(['santri_id' => null])->save();
            }

            return $hasil->fresh();
        });
    }

    /** Batalkan fase: kembali ke status sebelumnya (log terakhir). Fase diterima tidak bisa dibatalkan. */
    public function batalkanFase(int $id, int $adminId, ?string $catatan = null): PsbCalonSantri
    {
        $calon = PsbCalonSantri::findOrFail($id);
        if ($calon->status_pendaftaran === 'daftar_ulang') {
            throw ValidationException::withMessages(['status' => 'Fase diterima tidak bisa dibatalkan (santri sudah dibuat).']);
        }
        $log = PsbLogStatus::where('psb_calon_santri_id', $id)->latest('id')->first();
        if (! $log || ! $log->dari) {
            throw ValidationException::withMessages(['status' => 'Tidak ada fase sebelumnya untuk dibatalkan.']);
        }

        return $this->pindahStatus($id, $log->dari, $adminId, [$calon->status_pendaftaran], $catatan);
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

        return $this->pindahStatus($id, 'ajukan_daftar_ulang', null, $bolehDari);
    }

    public function accDaftarUlang(int $id, int $adminId, ?string $nis = null): Santri
    {
        $nis = $nis !== null && trim($nis) !== '' ? trim($nis) : null;

        return DB::transaction(function () use ($id, $adminId, $nis) {
            $calon = PsbCalonSantri::where('id', $id)->lockForUpdate()->firstOrFail();
            if (! in_array($calon->status_pendaftaran, ['pemberkasan', 'ajukan_daftar_ulang'], true)) {
                throw ValidationException::withMessages(['status' => 'Hanya status pemberkasan/ajukan_daftar_ulang yang bisa di-ACC.']);
            }
            // Kuota sudah dikunci saat INPUT (kuotaPenuh), di sini tinggal reuse/buat santri.
            $santri = $calon->santri_asal_id
                ? Santri::where('id', $calon->santri_asal_id)->lockForUpdate()->firstOrFail()
                : null;
            if ($nis !== null && Santri::nisDipakai($nis, $santri?->id)) {
                throw ValidationException::withMessages(['nis' => 'NIS sudah dipakai santri lain.']);
            }
            if (! $santri) {
                $payload = ['lembaga_id' => $calon->lembaga_id, 'status_global' => true];
                foreach (self::FIELD_MAP as $dari => $ke) {
                    $payload[$ke] = $calon->{$dari};
                }
                $payload['nis'] = $nis; // opsional: diisi saat ACC, atau menyusul via import Excel
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
                if ($nis !== null) {
                    $payload['nis'] = $nis;
                }
                $santri->update($payload);
            }
            // Riwayat belajar menyusul boleh null kelas
            if ($calon->tahun_ajaran_id) {
                if ($calon->lembagaDetail()->count() === 0) {
                    $calon->lembagaDetail()->create(['lembaga_id' => $calon->lembaga_id, 'peran' => 'primer']);
                }
                foreach ($calon->lembagaDetail()->get() as $detail) {
                    [$awalAcc, $tingkatAcc] = $this->awalDanTingkat($calon, $detail);
                    $riwayat = RiwayatBelajar::firstOrCreate(
                        ['santri_id' => $santri->id, 'tahun_ajaran_id' => $calon->tahun_ajaran_id, 'lembaga_id' => $detail->lembaga_id, 'semester' => '1'],
                        ['nis' => $nis, 'status_awal' => $awalAcc, 'tingkat' => $tingkatAcc, 'status_akhir' => 'aktif', 'is_aktif' => true, 'tgl_masuk' => $calon->tanggal_masuk ?? null]
                    );
                    // Riwayat sudah ada (mis. pendaftaran lanjutan) & NIS diisi saat ACC → perbarui arsipnya.
                    if ($nis !== null && $riwayat->nis !== $nis) {
                        $riwayat->update(['nis' => $nis]);
                    }
                }
            }
            // Backfill pembayaran: tagihan/pembayaran calon ikut santri_id (audit psb_calon_santri_id tetap)
            Tagihan::where('psb_calon_santri_id', $calon->id)->update(['santri_id' => $santri->id]);
            DB::table('pembayaran')->where('psb_calon_santri_id', $calon->id)->update(['santri_id' => $santri->id]);
            // PINDAH dokumen: milik santri penuh (jejak asal via santri_id hasil + psb_log_status).
            DokumenSantri::where('psb_calon_santri_id', $calon->id)
                ->update(['santri_id' => $santri->id, 'psb_calon_santri_id' => null]);

            // Checklist dokumen dari ketentuan kegiatan (wajib & opsional, tanpa file) — penekanan saja,
            // tidak menahan proses. Centang "tidak memiliki" tersedia di UI.
            $kegiatanId = $calon->gelombang?->psb_kegiatan_id;
            if ($kegiatanId) {
                $lembagaIds = $calon->lembagaDetail()->pluck('lembaga_id');
                if ($lembagaIds->isEmpty()) {
                    $lembagaIds = collect([$calon->lembaga_id]);
                }
                $syarat = DokumenWajibLembaga::where('psb_kegiatan_id', $kegiatanId)
                    ->whereIn('lembaga_id', $lembagaIds)
                    ->pluck('jenis_dokumen_santri')->unique();
                $sudah = DokumenSantri::where('santri_id', $santri->id)
                    ->whereNotNull('jenis_dokumen_santri')
                    ->pluck('jenis_dokumen_santri')->all();
                foreach ($syarat as $jenis) {
                    if (! in_array($jenis, $sudah, true)) {
                        DokumenSantri::create([
                            'santri_id' => $santri->id,
                            'jenis_dokumen_santri' => $jenis,
                            'path_file' => null,
                            'status_verifikasi' => 'menunggu',
                            'tidak_memiliki' => false,
                        ]);
                    }
                }
            }

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
        $targetLembaga = collect([$lembaga]);
        if (($data['paket'] ?? null) === self::PAKET_MI_MD['kode']) {
            $targetLembaga = Lembaga::whereIn('kode', self::PAKET_MI_MD['anggota'])->get();
        }
        $targetIds = $targetLembaga->pluck('id');

        $aktifLain = PsbCalonSantri::where('nik', $data['nik'])
            ->whereNotIn('status_pendaftaran', ['ditolak', 'tidak_lolos', 'mengundurkan_diri', 'daftar_ulang'])
            ->with('lembagaDetail.lembaga:id,kode,kelompok_psb')->get();
        $existingIds = $aktifLain->flatMap(fn ($c) => $c->lembagaDetail->pluck('lembaga_id'))->unique();

        $existingEksklusif = $aktifLain->flatMap(fn ($c) => $c->lembagaDetail)
            ->contains(fn ($d) => ($d->lembaga->kelompok_psb ?? null) !== self::KELOMPOK_COMBO);
        $targetEksklusif = $targetLembaga->contains(fn ($l) => $l->kelompok_psb !== self::KELOMPOK_COMBO);
        if (($targetEksklusif || $existingEksklusif) && $existingIds->isNotEmpty()) {
            throw ValidationException::withMessages(['lembaga_id' => 'Pendaftaran eksklusif: calon sudah terdaftar aktif di lembaga lain.']);
        }

        $comboIds = Lembaga::where('kelompok_psb', self::KELOMPOK_COMBO)->pluck('id');
        $diCombo = $existingIds->merge($targetIds)->intersect($comboIds)->unique();
        if ($diCombo->count() > 2) {
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
    protected function awalDanTingkat(PsbCalonSantri $calon, ?PsbCalonLembaga $detail = null): array
    {
        $awal = $calon->is_pindahan ? 'pindahan' : 'santri_baru';
        $tingkat = $detail?->masuk_tingkat;
        if (! $tingkat) {
            $lembaga = Lembaga::find($detail?->lembaga_id ?? $calon->lembaga_id);
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

    public function nomorPendaftaranBerikutnya(int $gelombangId, int $lembagaId): string
    {
        return $this->generateNoPendaftaran($gelombangId, $lembagaId);
    }

    public function nominalPendaftaran(int $gelombangId, int $lembagaId, ?string $tipeSantri, bool $lanjutan = false): float
    {
        $kuota = $this->kuotaUntuk($gelombangId, $lembagaId, $tipeSantri);

        return $kuota ? $kuota->nominalPendaftaranEfektif($lanjutan) : 0.0;
    }

    protected function generateNoPendaftaran(int $gelombangId, int $lembagaId): string
    {
        // Format: PSB_{tahun}_{kodeLembaga}_{noGelombang}_{seq4}; seq reset per (lembaga,tahun); unique no_pendaftaran global.
        // Kunci konsistensi-03: count()+lock masih bisa race (dua transaksi hitung sama sebelum insert).
        // Caller WAJIB catch QueryException 1062 pada unique no_pendaftaran lalu regenerate (maks 3x).
        $lembaga = Lembaga::findOrFail($lembagaId);
        $kode = $lembaga->kode ?: ($lembaga->jenjang ?: $lembagaId);
        $tahun = date('Y');
        $gelombang = PsbGelombang::findOrFail($gelombangId);
        $noGelombang = (int) ($gelombang->nomor ?: (PsbGelombang::where('psb_kegiatan_id', $gelombang->psb_kegiatan_id)
            ->where('id', '<=', $gelombangId)->count() ?: 1));
        $seq = PsbCalonSantri::withTrashed()->where('lembaga_id', $lembagaId)
            ->whereYear('created_at', $tahun)
            ->lockForUpdate()->count() + 1;

        return sprintf('PSB_%s_%s_%d_%04d', $tahun, strtoupper((string) $kode), $noGelombang, $seq);
    }

    protected function generateNoPendaftaranPaket(int $gelombangId): string
    {
        // 1 nomor gabungan kode MIMD fixed; counter sendiri agar tidak makan antrian satuan.
        $tahun = date('Y');
        $gelombang = PsbGelombang::findOrFail($gelombangId);
        $noGelombang = (int) ($gelombang->nomor ?: (PsbGelombang::where('psb_kegiatan_id', $gelombang->psb_kegiatan_id)
            ->where('id', '<=', $gelombangId)->count() ?: 1));
        $prefix = sprintf('PSB_%s_MIMD_%d_', $tahun, $noGelombang);
        $seq = PsbCalonSantri::withTrashed()->where('no_pendaftaran', 'like', $prefix . '%')
            ->whereYear('created_at', $tahun)
            ->lockForUpdate()->count() + 1;

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
