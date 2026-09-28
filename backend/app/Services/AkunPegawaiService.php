<?php

namespace App\Services;

use App\Models\LembagaPegawai;
use App\Models\Pegawai;
use App\Models\User;
use App\Support\Telepon;
use Illuminate\Support\Facades\DB;

/**
 * Penyediaan akun login guru dari baris `pegawai` (sumber: `email_pribadi`).
 *
 * Dipakai dua jalur dengan aturan sama: endpoint `buatkan-akun` dan import
 * pegawai otomatis. Hasil berupa kode agar pemanggil (HTTP vs import)
 * memetakan sendiri ke respons/penghitungnya.
 */
class AkunPegawaiService
{
    /** Sandi bawaan akun yang dibuat otomatis (sama seperti AkunSeeder dev; tanpa wajib ganti). */
    public const SANDI_BAWAAN = 'rahayu45';

    public const ROLE = 'guru';

    public const DIBUAT = 'dibuat';

    public const DISINKRON = 'disinkron';

    public const DILEWATI = 'dilewati';

    public function wewenang(User $aktor): bool
    {
        return $aktor->can('pengguna.tambah')
            && in_array(self::ROLE, $aktor->creatableRoles(), true);
    }

    /**
     * Sediakan akun untuk satu pegawai.
     *
     * - Tanpa tautan + kontak layak → buat user, tautkan (DIBUAT). Kontak
     *   layak = email valid + belum dipakai (login via email), ATAU tanpa
     *   email tapi `no_hp` ada + belum dipakai (login via no. HP, email null).
     * - Email sudah dipakai akun lain → bila `$beriPeranBilaBentrok` (aksi
     *   eksplisit "generate"), tambahkan peran guru ke akun tersebut
     *   (DISINKRON). Penautan `user_id` sendiri dikerjakan `cobaTautkan()`
     *   sebelum pemanggilan ini (generate + tempatkan); tanpa itu (import,
     *   buatkan) → DILEWATI `email_bentrok`.
     * - Sudah tertaut → sinkronkan nama + telepon + pastikan role, SEKALIGUS
     *   pastikan pivot `user_lembaga` untuk semua penempatan aktif (DISINKRON).
     *   Pivot hanya ditambah (tak pernah dicabut di sini; pencabutan lewat
     *   nonaktifkan/hapus penempatan). Jenjang di luar wewenang aktor dilewati.
     *   Email hanya ikut diselaraskan bila `$selaraskanEmail` (aksi eksplisit
     *   "generate"; import otomatis tak pernah mengubah email login).
     * - Sisanya → DILEWATI dengan `kode`: wewenang, email_bentrok,
     *   telepon_bentrok, kontak_kosong, lembaga_akses, lembaga_kosong.
     *
     * Mode `$kering` hanya menghitung status tanpa menulis (untuk periksa).
     *
     * @return array{status: string, kode: string, diubah: bool, user?: User|null, catatan: list<string>}
     */
    public function sediakan(Pegawai $pegawai, User $aktor, bool $kering = false, bool $selaraskanEmail = false, bool $beriPeranBilaBentrok = false): array
    {
        if (! $this->wewenang($aktor)) {
            return ['status' => self::DILEWATI, 'kode' => 'wewenang', 'diubah' => false, 'catatan' => []];
        }

        $tertAut = $pegawai->user_id !== null ? User::find($pegawai->user_id) : null;
        if ($tertAut !== null) {
            $ubah = ['name' => $pegawai->nama_lengkap];
            $telepon = $this->teleponBebas($pegawai, $tertAut->id);
            if ($telepon !== $tertAut->phone) {
                $ubah['phone'] = $telepon;
            }
            $catatan = [];
            if ($selaraskanEmail) {
                $emailBaru = trim((string) $pegawai->email_pribadi);
                if ($emailBaru !== '' && $emailBaru !== $tertAut->email) {
                    if (! filter_var($emailBaru, FILTER_VALIDATE_EMAIL)) {
                        $catatan[] = 'Email baru tak valid; email login dipertahankan.';
                    } elseif (User::where('email', $emailBaru)->whereKeyNot($tertAut->id)->exists()) {
                        $catatan[] = 'Email baru dipakai akun lain; email login dipertahankan.';
                    } else {
                        $ubah['email'] = $emailBaru;
                    }
                }
            }
            $diubah = collect($ubah)->contains(fn ($nilai, $kunci) => $tertAut->getAttribute($kunci) !== $nilai)
                || ! $tertAut->hasRole(self::ROLE);
            $aksesKurang = $this->aksesKurang($pegawai, $tertAut->id, $aktor, $catatan);
            $diubah = $diubah || $aksesKurang !== [];
            if ($kering) {
                return ['status' => self::DISINKRON, 'kode' => 'ok', 'diubah' => $diubah, 'user' => $tertAut, 'catatan' => $catatan];
            }
            $tertAut->update($ubah);
            $tertAut->assignRole(self::ROLE);
            $this->tambahAkses($tertAut->id, $aksesKurang);

            return ['status' => self::DISINKRON, 'kode' => 'ok', 'diubah' => $diubah, 'user' => $tertAut->fresh(), 'catatan' => $catatan];
        }

        $email = trim((string) $pegawai->email_pribadi);
        $emailValid = $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL);
        $pemakaiEmail = $emailValid ? User::where('email', $email)->first() : null;
        if ($pemakaiEmail !== null) {
            if (! $beriPeranBilaBentrok) {
                return ['status' => self::DILEWATI, 'kode' => 'email_bentrok', 'diubah' => false, 'catatan' => []];
            }

            return $this->beriPeranBentrok($aktor, $pemakaiEmail, $kering);
        }

        $catatan = [];
        $telepon = Telepon::normalisasi($pegawai->no_hp);
        if ($telepon !== null && $this->teleponDipakai($telepon)) {
            if (! $emailValid) {
                return ['status' => self::DILEWATI, 'kode' => 'telepon_bentrok', 'diubah' => false, 'catatan' => []];
            }
            $telepon = null;
            $catatan[] = 'No. HP sudah dipakai akun lain; akun dibuat tanpa no. HP.';
        }
        $emailLayak = $emailValid;
        if (! $emailLayak && $telepon === null) {
            return ['status' => self::DILEWATI, 'kode' => 'kontak_kosong', 'diubah' => false, 'catatan' => []];
        }
        if (! $emailLayak) {
            $catatan[] = 'Akun dibuat tanpa email; login memakai no. HP.';
        }

        $jenjangs = $pegawai->exists
            ? $pegawai->penempatan()->where('is_active_lembaga', LembagaPegawai::YA)->pluck('jenjang')->all()
            : [];
        foreach ($jenjangs as $jenjang) {
            if (! $aktor->canAccessLembaga($jenjang)) {
                return ['status' => self::DILEWATI, 'kode' => 'lembaga_akses', 'diubah' => false, 'catatan' => []];
            }
        }
        if ($jenjangs === [] && ! $aktor->bolehPesantren()) {
            $jenjangs = $aktor->lembagaIds();
            if ($jenjangs === []) {
                return ['status' => self::DILEWATI, 'kode' => 'lembaga_kosong', 'diubah' => false, 'catatan' => []];
            }
            $catatan[] = 'Pegawai belum punya penempatan; scope akun mengikuti lembaga Anda.';
        }

        if ($kering) {
            return ['status' => self::DIBUAT, 'kode' => 'ok', 'diubah' => true, 'user' => null, 'catatan' => $catatan];
        }

        $user = DB::transaction(function () use ($pegawai, $email, $emailLayak, $telepon, $jenjangs) {
            $dibuat = User::create([
                'name' => $pegawai->nama_lengkap,
                'email' => $emailLayak ? $email : null,
                'phone' => $telepon,
                'password' => self::SANDI_BAWAAN,
                'email_verified_at' => now(),
            ]);
            foreach ($jenjangs as $jenjang) {
                DB::table('user_lembaga')->insert([
                    'user_id' => $dibuat->id, 'jenjang' => $jenjang, 'role' => self::ROLE,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            $dibuat->assignRole(self::ROLE);
            $pegawai->update(['user_id' => $dibuat->id]);

            return $dibuat;
        });

        return ['status' => self::DIBUAT, 'kode' => 'ok', 'diubah' => true, 'user' => $user, 'catatan' => $catatan];
    }

    /**
     * Tautkan pegawai ke akun yang memakai email-nya (bila memenuhi syarat).
     * Dipakai generate + tempatkan agar relasi berikutnya (peran, pivot
     * lembaga) mengalir otomatis. Pagar: pegawai belum tertaut, email valid,
     * akun belum dipakai baris lain, target boleh dimutasi aktor, satu tenant.
     * Gagal syarat → null (pemanggil lanjut seperti biasa).
     */
    public function cobaTautkan(Pegawai $pegawai, User $aktor): ?User
    {
        if ($pegawai->user_id !== null) {
            return User::find($pegawai->user_id);
        }
        $email = trim((string) $pegawai->email_pribadi);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }
        $target = User::where('email', $email)->first();
        if ($target === null) {
            return null;
        }
        if (Pegawai::where('user_id', $target->id)->exists()) {
            return null;
        }
        if (! $target->bolehDimutasiOleh($aktor) || ! $aktor->isSameTenant($target)) {
            return null;
        }

        $pegawai->update(['user_id' => $target->id]);

        return $target->fresh();
    }

    /** Telepon pegawai (kanonik) bila belum dipakai user lain; null bila kosong/bentrok. */
    private function teleponBebas(Pegawai $pegawai, int $kecualiId): ?string
    {
        $telepon = Telepon::normalisasi($pegawai->no_hp);
        if ($telepon === null) {
            return null;
        }

        return $this->teleponDipakai($telepon, $kecualiId) ? null : $telepon;
    }

    /**
     * Email dipakai akun lain + flag generate: tambahkan peran guru ke akun
     * tersebut (bila belum ada). Pengaman: target boleh dimutasi aktor + satu
     * tenant; gagal → tetap DILEWATI `email_bentrok`. Pegawai tidak ditautkan
     * otomatis.
     *
     * Pengecualian vs assign-role manual: akun SENDIRI boleh (kunci-diri di
     * endpoint manual tetap ketat). Aman karena ini murni ADITIF — menambah
     * peran tanpa izin tak bisa mengunci keluar atau menaikkan hak melebihi
     * yang sudah dimiliki aktor admin. Token sendiri TIDAK dicabut (tetap
     * bisa lanjut kerja); target lain tetap dipaksa login ulang (2b).
     *
     * @return array{status: string, kode: string, diubah: bool, user: User|null, catatan: list<string>}
     */
    private function beriPeranBentrok(User $aktor, User $target, bool $kering): array
    {
        if (! $target->bolehDimutasiOleh($aktor) || ! $aktor->isSameTenant($target)) {
            return ['status' => self::DILEWATI, 'kode' => 'email_bentrok', 'diubah' => false, 'catatan' => []];
        }

        $sudah = $target->hasRole(self::ROLE);
        if ($kering) {
            return ['status' => self::DISINKRON, 'kode' => 'ok', 'diubah' => ! $sudah, 'user' => $target, 'catatan' => []];
        }
        $diri = $aktor->id === $target->id;
        if (! $sudah) {
            $target->assignRole(self::ROLE);
            if (! $diri) {
                $target->tokens()->delete();
            }
        }

        if ($sudah) {
            $catatan = [];
        } elseif ($diri) {
            $catatan = ['Email ini dipakai akun Anda sendiri; peran guru ditambahkan.'];
        } else {
            $catatan = ['Email dipakai akun lain; peran guru ditambahkan. Tautkan manual bila memang orang yang sama.'];
        }

        return [
            'status' => self::DISINKRON, 'kode' => 'ok', 'diubah' => ! $sudah, 'user' => $target->fresh(),
            'catatan' => $catatan,
        ];
    }

    /**
     * Cek bentrok nomor ke `users.phone`, mengenali varian penulisan lama
     * (`08...` mentah vs kanonik `62...`) agar tak terjadi akun ganda.
     */
    private function teleponDipakai(string $normal, ?int $kecualiId = null): bool
    {
        $query = User::whereIn('phone', Telepon::varian($normal));
        if ($kecualiId !== null) {
            $query->whereKeyNot($kecualiId);
        }

        return $query->exists();
    }

    /**
     * Jenjang penempatan aktif yang belum ada di pivot `user_lembaga`
     * (hanya yang dalam wewenang aktor; sisanya dicatat, bukan digagalkan).
     *
     * @param  list<string>  $catatan
     * @return list<string>
     */
    private function aksesKurang(Pegawai $pegawai, int $userId, User $aktor, array &$catatan): array
    {
        if (! $pegawai->exists) {
            return [];
        }
        $aktif = $pegawai->penempatan()->where('is_active_lembaga', LembagaPegawai::YA)->pluck('jenjang')->all();
        if ($aktif === []) {
            return [];
        }
        $punya = DB::table('user_lembaga')->where('user_id', $userId)->whereIn('jenjang', $aktif)->pluck('jenjang')->all();

        $kurang = [];
        foreach (array_diff($aktif, $punya) as $jenjang) {
            if ($aktor->canAccessLembaga($jenjang)) {
                $kurang[] = $jenjang;
            } else {
                $catatan[] = "Akses {$jenjang} di luar wewenang Anda; tidak ditambahkan.";
            }
        }

        return array_values($kurang);
    }

    /** Tambahkan baris-baris pivot `user_lembaga` (idempoten per baris). */
    private function tambahAkses(int $userId, array $jenjangs): void
    {
        foreach ($jenjangs as $jenjang) {
            DB::table('user_lembaga')->updateOrInsert(
                ['user_id' => $userId, 'jenjang' => $jenjang, 'role' => self::ROLE],
                ['created_at' => now(), 'updated_at' => now()]
            );
        }
    }
}
