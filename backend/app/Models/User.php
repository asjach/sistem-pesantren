<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
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
        return \Illuminate\Support\Facades\DB::table('user_lembaga')
            ->where('user_id', $this->id)
            ->pluck('lembaga_id')->map(fn ($v) => (int) $v)->all();
    }

    /** Admin full = role admin tanpa pivot (akses semua lembaga). */
    public function isAdminFull(): bool
    {
        return $this->hasRole('admin') && empty($this->lembagaIds());
    }

    public function canAccessLembaga(int $lembagaId): bool
    {
        // Choke point tenant lembaga via pivot user_lembaga.
        if ($this->hasRole('super_admin')) {
            return true;
        }
        if ($this->hasRole('admin')) {
            if ($this->isAdminFull()) {
                return Lembaga::whereKey($lembagaId)->exists();
            }
            return in_array((int) $lembagaId, $this->lembagaIds(), true);
        }
        return in_array((int) $lembagaId, $this->lembagaIds(), true);
    }

    /** Cek tenant via lembaga/pivot saja (tanpa kolom di users). */
    public function isSameTenant(User $target): bool
    {
        if ($this->hasRole('super_admin')) {
            return true;
        }
        if ($this->hasRole('admin') && $this->isAdminFull()) {
            return true;
        }
        return ! empty(array_intersect($this->lembagaIds(), $target->lembagaIds()));
    }

    /**
     * Filter query hanya untuk tenant milik user yang sedang login.
     * - super_admin: semua.
     * - admin full (tanpa pivot): semua.
     * - admin subset: users yang pivot-nya beririsan (whereExists user_lembaga).
     * - non-admin (kasir/guru/orang_tua/santri): kosong (tidak boleh list users).
     */
    public function scopeTenantScope(Builder $query): Builder
    {
        $authUser = auth()->user();

        if ($authUser->hasRole('super_admin')) {
            return $query;
        }

        if ($authUser->hasRole('admin') && empty($authUser->lembagaIds())) {
            return $query; // admin full
        }

        if ($authUser->hasRole('admin')) {
            $ids = $authUser->lembagaIds();
            if (empty($ids)) {
                return $query;
            }
            return $query->whereExists(function ($exists) use ($authUser, $ids) {
                $exists->select(\Illuminate\Support\Facades\DB::raw(1))
                    ->from('user_lembaga')
                    ->whereColumn('user_lembaga.user_id', 'users.id')
                    ->whereIn('user_lembaga.lembaga_id', $ids);
            });
        }

        return $query->whereRaw('1 = 0');
    }
}
