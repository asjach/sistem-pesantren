<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Semester aktif per lembaga operasional ('1' = Ganjil, '2' = Genap). */
class SemesterAktif extends Model
{
    protected $table = 'semester_aktif';

    protected $fillable = ['jenjang', 'semester', 'diubah_oleh'];

    public function lembaga(): BelongsTo
    {
        return $this->belongsTo(Lembaga::class, 'jenjang', 'jenjang');
    }

    public function pengubah(): BelongsTo
    {
        return $this->belongsTo(User::class, 'diubah_oleh');
    }

    /** Label Indonesia untuk kode semester. */
    public static function label(string $semester): string
    {
        return $semester === '2' ? 'Genap' : 'Ganjil';
    }
}
