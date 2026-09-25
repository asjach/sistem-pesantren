<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Logika import pengguna per baris — dipakai dua jalur: file Excel
 * (Maatwebsite, App\Imports\UsersImport sebagai pembungkus tipis) dan
 * potongan JSON bertahap dari browser (endpoint import-potong).
 *
 * Keamanan tenant/peran dihitung SEKALI di depan oleh controller dari
 * akun yang menulis (`lembagaIds` hasil resolusi tenant + `allowedRoles`),
 * bukan dibaca dari baris — jadi file tak bisa menaruh akun ke luar
 * lingkup akses akun maupun mendapat peran di luar wewenannya. Peran di
 * baris di-interseksikan dengan `allowedRoles`; bila tak ada yang cocok,
 * akun dibuat tanpa peran (sama seperti jalur file).
 *
 * Duplikat identifier dalam satu sesi (email|phone|username) dilewati
 * agar file boleh diimport ulang. Mode kering (`$kering = true`)
 * menjalankan SEMUA validasi tanpa menulis akun, pivot `user_lembaga`,
 * maupun peran.
 */
class PenggunaImporService extends ImporPotongan
{
    /** Guard duplikat intra-sesi: "email|phone|username". */
    protected array $dilihat = [];

    /**
     * @param  array<int, string>  $lembagaIds  jenjang hasil resolusi tenant (dari akun)
     * @param  array<int, string>  $allowedRoles  peran yang boleh ditetapkan akun ini
     */
    public function __construct(
        protected array $lembagaIds,
        protected array $allowedRoles,
    ) {}

    /**
     * Normalisasi SEBELUM cek: objek DateTime → Y-m-d; identifier
     * di-trim dan email di-lowercase.
     *
     * @param  array<string, mixed>  $baris
     * @return array<string, mixed>
     */
    public function normalisasiBaris(array $baris): array
    {
        $baris = $this->castTanggal($baris);
        foreach (['email', 'phone', 'username'] as $kolom) {
            if (isset($baris[$kolom])) {
                $teks = strtolower(trim((string) $baris[$kolom]));
                $baris[$kolom] = $teks === '' ? null : $teks;
            }
        }
        if (isset($baris['name'])) {
            $baris['name'] = trim((string) $baris['name']);
        }

        return $baris;
    }

    /** @param  array<string, mixed>  $baris */
    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $email = $baris['email'] ?? null;
        $phone = $baris['phone'] ?? null;
        $username = $baris['username'] ?? null;
        $this->kunciAktif = $email ?: $phone ?: $username;

        if (($email ?? '') === '' && ($phone ?? '') === '' && ($username ?? '') === '') {
            $this->fail($no, 'email', 'Isi email, phone, atau username (minimal satu).');

            return;
        }

        $baris = array_merge($baris, compact('email', 'phone', 'username'));
        $validator = Validator::make($baris, $this->rules());
        if ($validator->fails()) {
            $errors = $validator->errors()->toArray();
            $kolom = (string) array_key_first($errors);
            $this->fail($no, $kolom, (string) ($errors[$kolom][0] ?? 'Nilai tidak valid.'));

            return;
        }

        $kunci = ($email ?: '').'|'.($phone ?: '').'|'.($username ?: '');
        if (isset($this->dilihat[$kunci])) {
            $this->dilewati++;
            $this->valid++;

            return;
        }
        $this->dilihat[$kunci] = true;

        $this->dibuat++;
        $this->valid++;

        if ($kering) {
            return;
        }

        $user = User::create([
            'name' => $baris['name'],
            'email' => $email ?: null,
            'phone' => $phone ?: null,
            'username' => $username ?: null,
            'password' => $baris['password'],
            'email_verified_at' => now(),
        ]);

        // Pivot tenant user_lembaga: `jenjang` adalah FK STRING ke
        // lembaga.jenjang (bukan id numerik) — jangan di-cast ke int.
        foreach ($this->lembagaIds as $lid) {
            DB::table('user_lembaga')->insert([
                'user_id' => $user->id, 'jenjang' => (string) $lid,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $roles = array_map('trim', explode(',', (string) ($baris['roles'] ?? '')));
        $filtered = array_values(array_intersect($roles, $this->allowedRoles));
        if ($filtered !== []) {
            $user->assignRole($filtered);
        }
    }

    /** @return array<string, array<int, mixed>> */
    protected function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'required_without_all:phone,username', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:20', Rule::unique('users', 'phone')],
            'username' => ['nullable', 'string', 'max:50', Rule::unique('users', 'username')],
            'password' => ['required', 'string', 'min:8'],
            'roles' => ['required', 'string'],
        ];
    }
}
