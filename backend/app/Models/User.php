<?php

namespace App\Models;

use App\Konteks\LembagaAktif;
use App\Services\IzinKatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Contracts\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasRoles, Notifiable {
        // `parent::` tak menjangkau metode trait: alias agar override
        // hasPermissionTo() di bawah bisa memanggil implementasi Spatie.
        HasRoles::hasPermissionTo as hasPermissionToBawaan;
    }

    protected $guard_name = 'sanctum';

    /**
     * Peran yang boleh dicatat per lembaga di pivot `user_lembaga`.
     * `super_admin` selalu global (tanpa baris pivot).
     */
    public const PERAN_LEMBAGA = ['admin', 'guru', 'orang_tua', 'santri'];

    /** Cache izin per nama peran (guard sanctum) per instance. */
    private array $izinPeranCache = [];

    /** Cache peta peran pivot per instance (satu request). */
    private ?array $peranLembagaCache = null;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'username',
        'password',
        'email_verified_at',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function loginAudits(): HasMany
    {
        return $this->hasMany(LoginAudit::class);
    }

    public function waliAnak(): HasMany
    {
        return $this->hasMany(WaliSantriRelasi::class, 'user_id');
    }

    /** Relasi tenant: semua lembaga via pivot user_lembaga (kunci `jenjang`). */
    public function lembagas(): BelongsToMany
    {
        return $this->belongsToMany(Lembaga::class, 'user_lembaga', 'user_id', 'jenjang')
            ->withPivot('role')
            ->distinct();
    }

    /** Semua jenjang lembaga yang boleh diakses: pivot user_lembaga (peran apa pun). */
    public function lembagaIds(): array
    {
        // Mode "bertindak sebagai lembaga": scope menyempit ke lembaga peran.
        if (($peran = $this->lembagaPeran()) !== null) {
            return [$peran];
        }

        return array_values(array_unique(DB::table('user_lembaga')
            ->where('user_id', $this->id)
            ->pluck('jenjang')->all()));
    }

    /**
     * Peta peran per lembaga dari pivot: jenjang => daftar role.
     * `null` = baris cakupan warisan (tanpa peran tercatat).
     *
     * @return array<string, list<string|null>>
     */
    public function peranLembaga(): array
    {
        if ($this->peranLembagaCache === null) {
            $peta = [];
            $baris = DB::table('user_lembaga')->where('user_id', $this->id)->get(['jenjang', 'role']);
            foreach ($baris as $b) {
                $peta[$b->jenjang][] = $b->role;
            }
            foreach ($peta as $jenjang => $daftar) {
                $peta[$jenjang] = array_values(array_unique($daftar));
            }
            $this->peranLembagaCache = $peta;
        }

        return $this->peranLembagaCache;
    }

    /** Punya peran tercatat di lembaga? (`null`/baris warisan tidak dihitung.) */
    public function punyaPeranDi(string $role, string $jenjang): bool
    {
        return in_array($role, $this->peranLembaga()[$jenjang] ?? [], true);
    }

    /**
     * Lembaga yang sedang "diperankan" (act-as) untuk super_admin; null = mode penuh.
     * Konteks diisi middleware `lembaga_aktif` dari header X-Lembaga-Aktif.
     */
    public function lembagaPeran(): ?string
    {
        if (! $this->hasRole('super_admin')) {
            return null;
        }

        return app(LembagaAktif::class)->id();
    }

    /**
     * Kemampuan lintas lembaga (super_admin / admin full). Dimatikan saat
     * super_admin bertindak sebagai satu lembaga.
     */
    public function bolehPesantren(): bool
    {
        if ($this->lembagaPeran() !== null) {
            return false;
        }

        return $this->hasRole('super_admin') || $this->isAdminFull();
    }

    /**
     * Kemampuan khusus super_admin (mis. kelola lembaga, mutasi akun admin,
     * referensi global). Tetap dimatikan saat bertindak sebagai lembaga.
     */
    public function bolehSuperAdmin(): bool
    {
        return $this->hasRole('super_admin') && $this->lembagaPeran() === null;
    }

    /**
     * Cek izin matriks dengan kesadaran act-as: saat bertindak sebagai
     * lembaga, 14 izin eksklusif super_admin nonaktif (efektif = set admin).
     * Semua gerbang `permission:` route, `$user->can()`, dan Gate::before
     * Spatie bermuara ke sini.
     *
     * Setelah peran global, izin peran tercatat di pivot `user_lembaga`
     * untuk konteks lembaga tunggal ikut dihitung (act-as, atau filter
     * `jenjang` request yang tepat satu).
     */
    public function hasPermissionTo($permission, ?string $guardName = null): bool
    {
        $nama = $permission instanceof Permission
            ? $permission->name
            : (string) $permission;
        if ($this->lembagaPeran() !== null && in_array($nama, IzinKatalog::EKSKLUSIF_SUPER_ADMIN, true)) {
            return false;
        }
        if ($this->hasPermissionToBawaan($permission, $guardName)) {
            return true;
        }

        return $this->punyaIzinLembaga($nama);
    }

    /**
     * Izin efektif untuk respons `/me`.
     * - Tanpa konteks (global): izin peran global + GABUNGAN semua peran
     *   tercatat (agar tombol yang memang dimiliki di suatu lembaga tampil;
     *   backend tetap menegakkan per konteks lembaga).
     * - `?jenjang=X`: global + peran tercatat di X saja.
     * - Saat bertindak sebagai lembaga: seperti di atas lalu dikurangi izin
     *   eksklusif super_admin.
     */
    public function izinEfektif(?string $jenjang = null): array
    {
        $semua = $this->getAllPermissions()->pluck('name')->values()->all();
        $peta = $this->peranLembaga();
        $lembaga = $jenjang ?? $this->lembagaPeran();
        $daftar = $lembaga === null
            ? array_merge(...array_values($peta ?: [[]]))
            : ($peta[$lembaga] ?? []);
        foreach ($daftar as $peran) {
            if ($peran !== null) {
                array_push($semua, ...$this->izinUntukPeran($peran));
            }
        }
        $semua = array_values(array_unique($semua));
        if ($this->lembagaPeran() === null) {
            return $semua;
        }

        return array_values(array_diff($semua, IzinKatalog::EKSKLUSIF_SUPER_ADMIN));
    }

    /**
     * Izin dari peran tercatat di pivot untuk konteks lembaga tunggal:
     * header act-as, atau filter `jenjang` request yang tepat satu.
     */
    private function punyaIzinLembaga(string $izin): bool
    {
        $konteks = $this->konteksLembagaTunggal();
        if ($konteks === null) {
            return false;
        }
        foreach ($this->peranLembaga()[$konteks] ?? [] as $peran) {
            if ($peran !== null && in_array($izin, $this->izinUntukPeran($peran), true)) {
                return true;
            }
        }

        return false;
    }

    /** Konteks lembaga tunggal untuk resolusi peran pivot (null = global). */
    private function konteksLembagaTunggal(): ?string
    {
        $aktif = app(LembagaAktif::class)->id();
        if ($aktif !== null) {
            return $aktif;
        }
        $nilai = request()->input('jenjang');
        $daftar = is_array($nilai) ? $nilai : explode(',', (string) ($nilai ?? ''));
        $daftar = array_values(array_unique(array_filter(array_map(
            fn ($v) => trim((string) $v),
            $daftar
        ))));

        return count($daftar) === 1 ? $daftar[0] : null;
    }

    /** Daftar izin guard sanctum untuk sebuah nama peran (cache instance). */
    private function izinUntukPeran(string $peran): array
    {
        if (! array_key_exists($peran, $this->izinPeranCache)) {
            $role = Role::where('name', $peran)->where('guard_name', 'sanctum')->first();
            $this->izinPeranCache[$peran] = $role === null
                ? []
                : $role->permissions->pluck('name')->all();
        }

        return $this->izinPeranCache[$peran];
    }

    /** Admin full = role admin tanpa pivot (akses semua lembaga). */
    public function isAdminFull(): bool
    {
        return $this->hasRole('admin') && empty($this->lembagaIds());
    }

    /**
     * Role yang boleh diberikan aktor ini (create/update/assign/import).
     * super_admin: semua role; admin (atau super_admin yang sedang bertindak
     * sebagai lembaga): guru/orang_tua/santri (role `admin` hanya lewat
     * creatableRoles()); lainnya: tidak ada.
     *
     * @return list<string>
     */
    public function assignableRoles(): array
    {
        if ($this->bolehSuperAdmin()) {
            return ['super_admin', 'admin', 'guru', 'orang_tua', 'santri'];
        }
        if ($this->hasRole('admin') || $this->lembagaPeran() !== null) {
            return ['guru', 'orang_tua', 'santri'];
        }

        return [];
    }

    /**
     * Role yang boleh diberikan saat MEMBUAT user: admin (full/scoped) boleh
     * memberi role `admin` saat create; batas lembaga dijamin pemanggil.
     *
     * @return list<string>
     */
    public function creatableRoles(): array
    {
        $roles = $this->assignableRoles();
        if ($this->hasRole('admin') && ! in_array('admin', $roles, true)) {
            $roles[] = 'admin';
        }

        return $roles;
    }

    /**
     * Target pemegang role admin/super_admin hanya boleh dimutasi super_admin
     * (akun sendiri dikecualikan; aturan kunci-diri diatur per aksi).
     */
    public function bolehDimutasiOleh(User $auth): bool
    {
        return $auth->bolehSuperAdmin()
            || $auth->id === $this->id
            || ! $this->hasAnyRole(['admin', 'super_admin']);
    }

    public function canAccessLembaga(string $jenjang): bool
    {
        // Mode bertindak: hanya lembaga yang sedang diperankan.
        if ($this->lembagaPeran() !== null) {
            return $jenjang === $this->lembagaPeran();
        }
        // Choke point tenant lembaga via pivot user_lembaga.
        if ($this->hasRole('super_admin')) {
            return true;
        }
        if ($this->hasRole('admin')) {
            if ($this->isAdminFull()) {
                return Lembaga::whereKey($jenjang)->exists();
            }
            if (in_array($jenjang, $this->lembagaIds(), true)) {
                return true;
            }
            // Pengecualian pasangan MI↔MD (timbal-balik, global).
            $pasangan = Lembaga::pasanganJenjang($jenjang);

            return $pasangan !== null && in_array($pasangan, $this->lembagaIds(), true);
        }

        return in_array($jenjang, $this->lembagaIds(), true);
    }

    /**
     * Pivot + pasangan MI↔MD (khusus admin scoped; act-as/super/full tak berubah).
     * Dipakai semua scope daftar agar baris counterpart ikut tampil.
     */
    public function lembagaIdsDenganPasangan(): array
    {
        $ids = $this->lembagaIds();
        if ($this->lembagaPeran() !== null || ! $this->hasRole('admin') || $this->isAdminFull()) {
            return $ids;
        }
        foreach ($ids as $id) {
            $pasangan = Lembaga::pasanganJenjang($id);
            if ($pasangan !== null && ! in_array($pasangan, $ids, true)) {
                $ids[] = $pasangan;
            }
        }

        return $ids;
    }

    /** Cek tenant via lembaga/pivot saja (tanpa kolom di users). */
    public function isSameTenant(User $target): bool
    {
        if ($this->bolehPesantren()) {
            return true;
        }

        return ! empty(array_intersect($this->lembagaIds(), $target->lembagaIds()));
    }

    /**
     * Filter query hanya untuk tenant milik user yang sedang login.
     * - super_admin / admin full: semua (kecuali sedang bertindak → lembaga peran).
     * - admin subset: users yang pivot-nya beririsan (whereExists user_lembaga).
     * - non-admin (guru/orang_tua/santri): kosong (tidak boleh list users).
     */
    public function scopeTenantScope(Builder $query): Builder
    {
        $authUser = auth()->user();

        if ($authUser->bolehPesantren()) {
            return $query;
        }

        $ids = $authUser->lembagaIds();
        if (empty($ids)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereExists(function ($exists) use ($ids) {
            $exists->select(DB::raw(1))
                ->from('user_lembaga')
                ->whereColumn('user_lembaga.user_id', 'users.id')
                ->whereIn('user_lembaga.jenjang', $ids);
        });
    }
}
