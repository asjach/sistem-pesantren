<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Visibilitas kontrol toolbar generik, GLOBAL per `table_key`: peta
 * kontrol → boolean (`cari`, `info`, `urut`, `kolom`). Hanya nilai `false`
 * yang menyembunyikan; kunci absen/true/null = tampil.
 * Perataan kolom per tabel (satu nilai per kolom, bukan per preset):
 * peta key kolom → 'left'|'center'|'right'; absen = bawaan frontend.
 * Judul tabel yang bisa diisi pengguna (teks biasa, bukan peta): NULL =
 * pakai judul bawaan dari kode.
 * Label kolom per tabel (juga bukan per preset, sejalan dengan perataan):
 * peta key kolom → teks label tampil; absen = label bawaan dari kode.
 * Keduanya per tabel karena preset hanya mengubah kolom mana yang TAMPIL,
 * bukan bagaimana kolom itu dinamai atau diratakan.
 * `lebar` & `tinggi` = ukuran kotak kontrol toolbar per tabel, peta kunci
 * kontrol (`urut`, `kolom`, `filter.<htmlFor>`) → px; absen = bawaan komponen.
 * `nilai_default` = peta kunci kontrol yang sama → label opsi yang jadi nilai
 * AWAL combobox (dipilih dari popover klik-kanan); absen = nilai pemanggil.
 * Peta `lebar` juga memuat lebar label/kontrol terkunci (`<kunci>.label` /
 * `<kunci>.kontrol`) dan penanda `<kunci>.expand` (1 = label mengembang)
 * serta `<kunci>.labeltransparan` (1 = transparan, 0 = ber-bg eksplisit).
 * `info_html` = HTML ter-sanitasi "info tabel" per `table_key` (bukan per
 * preset): isi HoverCard di ujung judul tabel. NULL = belum diisi, dan
 * frontend menyembunyikan tombol Info-nya. Sudah melewati allowlist ketat
 * `App\Support\HtmlInfo` sebelum disimpan, jadi isinya aman dirender sebagai
 * HTML di bilah judul tiap tabel.
 */
class ToolbarPreset extends Model
{
    protected $table = 'toolbar_preset';

    protected $fillable = ['table_key', 'visibilitas', 'lebar', 'tinggi', 'nilai_default', 'urutan', 'align', 'label', 'judul', 'info_html', 'dibuat_oleh'];

    protected $casts = [
        'visibilitas' => 'array',
        'lebar' => 'array',
        'tinggi' => 'array',
        'nilai_default' => 'array',
        'urutan' => 'array',
        'align' => 'array',
        'label' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function dibuatOleh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }
}
