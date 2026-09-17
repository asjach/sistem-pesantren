<?php

namespace App\Models;

use App\Konteks\LembagaAktif;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasRoles, Notifiable;

    protected $guard_name = 'sanctum';

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

    /** Relasi tenant: semua lembaga via pivot user_lembaga. */
    public function lembagas(): BelongsToMany
    {
        return $this->belongsToMany(Lembaga::class, 'user_lembaga');
    }

    /** Semua lembaga_id yang boleh diakses: pivot user_lembaga saja (users tanpa kolom tenant). */
    public function lembagaIds(): array
    {
        // Mode "bertindak sebagai lembaga": seluruh scope menyempit ke lembaga peran.
        if (($peran = $this->lembagaPeran()) !== null) {
            return [$peran];
        }

        return DB::table('user_lembaga')
            ->where('user_id', $this->id)
            ->pluck('lembaga_id')->map(fn ($v) => (int) $v)->all();
    }

    /**
     * Lembaga yang sedang "diperankan" (act-as) untuk super_admin; null = mode penuh.
     * Konteks diisi middleware `lembaga_aktif` dari header X-Lembaga-Aktif.
     */
    public function lembagaPeran(): ?int
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

    /** Admin full = role admin tanpa pivot (akses semua lembaga). */
    public function isAdminFull(): bool
    {
        return $this->hasRole('admin') && empty($this->lembagaIds());
    }

    /**
     * Role yang boleh diberikan aktor ini (create/update/assign/import).
     * super_admin: semua role; admin: guru/orang_tua/santri (role `admin`
     * hanya lewat creatableRoles()); lainnya: tidak ada.
     *
     * @return list<string>
     */
    public function assignableRoles(): array
    {
        if ($this->bolehSuperAdmin()) {
            return ['super_admin', 'admin', 'guru', 'orang_tua', 'santri'];
        }
        if ($this->hasRole('admin')) {
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

    public function canAccessLembaga(int $lembagaId): bool
    {
        // Mode bertindak: hanya lembaga yang sedang diperankan.
        if (($peran = $this->lembagaPeran()) !== null) {
            return (int) $lembagaId === $peran;
        }
        // Choke point tenant lembaga via pivot user_lembaga.
        if ($this->hasRole('super_admin')) {
            return true;
        }
        if ($this->hasRole('admin')) {
            if ($this->isAdminFull()) {
                return Lembaga::whereKey($lembagaId)->exists();
            }
            if (in_array((int) $lembagaId, $this->lembagaIds(), true)) {
                return true;
            }
            // Pengecualian pasangan MI↔MD (timbal-balik, global).
            $pasangan = Lembaga::pasanganId((int) $lembagaId);

            return $pasangan !== null && in_array($pasangan, $this->lembagaIds(), true);
        }

        return in_array((int) $lembagaId, $this->lembagaIds(), true);
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
            $pasangan = Lembaga::pasanganId((int) $id);
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
                ->whereIn('user_lembaga.lembaga_id', $ids);
        });
    }
}
