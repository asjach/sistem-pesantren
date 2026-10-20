<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Pengaturan struktur kurikulum per jenjang + tahun ajaran: jumlah minggu
 * efektif (dasar hitungan JP per tahun = JP/minggu × minggu efektif).
 */
class StrukturKurikulumPengaturan extends Model
{
    protected $table = 'struktur_kurikulum_pengaturan';

    protected $guarded = ['id'];

    protected $casts = ['minggu_efektif' => 'integer'];
}
