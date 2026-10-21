<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Visibilitas navigasi pribadi admin, di bawah batas setelan global. */
class PengaturanNavigasiPengguna extends Model
{
    protected $table = 'pengaturan_navigasi_pengguna';

    protected $fillable = ['user_id', 'tersembunyi'];

    protected $casts = ['tersembunyi' => 'array'];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
