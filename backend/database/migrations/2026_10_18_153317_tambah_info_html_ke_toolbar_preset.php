<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Info tabel: satu HTML ter-sanitasi per `table_key` (bukan per preset),
     * senada dengan `judul` dan `label` — yang diubah hanya kolom mana yang
     * TAMPIL, bukan keterangan tabelnya.
     *
     * Ditampilkan lewat HoverCard di ujung judul tiap tabel, jadi isinya dibaca
     * semua pengguna sementara hanya super_admin yang boleh menulisnya. HTML-nya
     * sudah dibersihkan `App\Support\HtmlInfo` (allowlist ketat) sebelum
     * sampai ke kolom ini — kolom ini menaruh HTML mentah milik pengguna, bukan
     * teks bebas, jadi `text()` biasa tak cukup.
     *
     * Panjang: `longText` (LONGTEXT, 4 GB di MySQL) + batas aplikasi di
     * `HtmlInfo::PANJANG_MAKS` (1,5 juta karakter). Gambar disandikan base64 di
     * dalam HTML sehingga penyumbang terbesar ukurannya; sisi klien mengecilkan
     * gambar sebelum menyandikan (lihat `InfoEditor`).
     */
    public function up(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->longText('info_html')->nullable()->after('judul');
        });
    }

    public function down(): void
    {
        Schema::table('toolbar_preset', function (Blueprint $table) {
            $table->dropColumn('info_html');
        });
    }
};
