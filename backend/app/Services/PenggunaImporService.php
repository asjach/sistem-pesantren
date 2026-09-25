<?php

namespace App\Services;

use App\Models\User;
use DateTimeInterface;
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
class PenggunaImporService
{
    /** Galat terkumpul: ['baris' => int, 'nis_lokal' => ?string, 'kolom' => string, 'pesan' => string]. */
    public array $gagal = [];

    public int $valid = 0;

    public int $dibuat = 0;

    public int $diperbarui = 0;

    public int $dilewati = 0;

    /** Identifier baris yang sedang diproses (untuk kolom kunci di galat). */
    protected ?string $idAktif = null;

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

    public function ringkasan(): array
    {
        return [
            'baris_diproses' => $this->valid + count($this->gagal),
            'baris_valid' => $this->valid,
            'baris_gagal' => count($this->gagal),
            'dibuat' => $this->dibuat,
            'diperbarui' => $this->diperbarui,
            'dilewati' => $this->dilewati,
        ];
    }

    /**
     * Normalisasi SEBELUM cek: objek DateTime → Y-m-d; identifier
     * di-trim dan email di-lowercase.
     *
     * @param  array<string, mixed>  $baris
     * @return array<string, mixed>
     */
    public function normalisasiBaris(array $baris): array
    {
        foreach ($baris as $kunci => $nilai) {
            if ($nilai instanceof DateTimeInterface) {
                $baris[$kunci] = $nilai->format('Y-m-d');
            }
        }
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

    /**
     * Proses satu potongan baris (sudah ternormalisasi). `$nomorAwal` =
     * nomor baris file baris pertama potongan dikurangi 1 (heading = 1).
     *
     * @param  array<int, array<string, mixed>>  $potongan
     */
    public function prosesPotongan(array $potongan, int $nomorAwal, bool $kering): void
    {
        $jalan = function () use ($potongan, $nomorAwal, $kering) {
            foreach (array_values($potongan) as $i => $baris) {
                $this->prosesBaris(is_array($baris) ? $baris : [], $nomorAwal + $i + 1, $kering);
            }
        };

        if ($kering) {
            $jalan();
        } else {
            DB::transaction($jalan);
        }
    }

    /** @param  array<string, mixed>  $baris */
    public function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $email = $baris['email'] ?? null;
        $phone = $baris['phone'] ?? null;
        $username = $baris['username'] ?? null;
        $this->idAktif = $email ?: $phone ?: $username;

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

    /** @param  array{baris: int, nis_lokal: ?string, kolom: string, pesan: string}  $gagal */
    protected function fail(int $no, string $kolom, string $pesan): void
    {
        $this->gagal[] = ['baris' => $no, 'nis_lokal' => $this->idAktif, 'kolom' => $kolom, 'pesan' => $pesan];
    }
}
