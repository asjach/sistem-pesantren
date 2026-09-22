<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PsbCalonSantri extends Model
{
    use SoftDeletes;

    protected $table = 'psb_calon_santri';

    protected $guarded = ['id'];

    protected $casts = [
        'tgl_lahir' => 'date', 'tanggal_daftar' => 'date', 'tanggal_masuk' => 'date',
        'ayah_tgl_lahir' => 'date', 'ibu_tgl_lahir' => 'date', 'wali_tgl_lahir' => 'date',
        'is_duplikat_kontak' => 'boolean', 'is_lanjutan' => 'boolean',
        'is_pindahan' => 'boolean',
    ];

    public function gelombang(): BelongsTo
    {
        return $this->belongsTo(PsbGelombang::class, 'gelombang_id');
    }

    public function lembagaTujuan(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function lembagaDetail(): HasMany
    {
        return $this->hasMany(PsbCalonLembaga::class, 'psb_calon_santri_id');
    }

    /**
     * Admin salah satu lembaga tujuan (paket MI/MD), admin full, atau super_admin.
     * Cermin otorisasi aksi per calon di PsbController.
     */
    public function bolehDiaksesOleh(User $auth): bool
    {
        if ($auth->bolehPesantren()) {
            return true;
        }
        $ids = $this->lembagaDetail()->pluck('jenjang');
        if ($ids->isEmpty()) {
            $ids = collect([$this->jenjang]);
        }

        return $ids->contains(fn ($id) => $auth->canAccessLembaga($id));
    }

    /**
     * Calon ini tanggungan wali? Cocok via email ortu, telp ortu ternormalisasi,
     * atau relasi wali ke santri asal. $hanyaRelasiAktif=false meniru cek lama
     * PsbService::ajukanDaftarUlang (tanpa filter is_active).
     */
    public function milikWali(User $wali, bool $hanyaRelasiAktif = true): bool
    {
        if ($this->email_ortu && $this->email_ortu === $wali->email) {
            return true;
        }
        if ($this->telp_ortu && self::normalTelp($this->telp_ortu) === self::normalTelp($wali->phone ?? '')) {
            return true;
        }
        if (! $this->santri_asal_id) {
            return false;
        }
        $q = WaliSantriRelasi::where('user_id', $wali->id)->where('santri_id', $this->santri_asal_id);
        if ($hanyaRelasiAktif) {
            $q->where('is_active', true);
        }

        return $q->exists();
    }

    /** Normalisasi nomor telepon Indonesia: buang non-digit, 0/62 → 62. */
    public static function normalTelp(?string $telp): string
    {
        $t = preg_replace('/\D/', '', $telp ?? '');

        return preg_replace('/^(0|62)/', '62', $t);
    }

    public function santriAsal(): BelongsTo
    {
        return $this->belongsTo(Santri::class, 'santri_asal_id');
    }

    public function santriHasil(): BelongsTo
    {
        return $this->belongsTo(Santri::class, 'santri_id');
    }

    public function berkas(): HasMany
    {
        return $this->hasMany(DokumenSantri::class, 'psb_calon_santri_id');
    }

    public function logStatus(): HasMany
    {
        return $this->hasMany(PsbLogStatus::class, 'psb_calon_santri_id');
    }

    /** Paket = calon mendaftar ke lebih dari satu lembaga (mis. MI-MD). */
    public function isPaket(): bool
    {
        return $this->relationLoaded('lembagaDetail')
            ? $this->lembagaDetail->count() > 1
            : $this->lembagaDetail()->count() > 1;
    }
}
