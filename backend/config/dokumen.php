<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Mode penyimpanan dokumen
    |--------------------------------------------------------------------------
    |
    | "bebas"   = klien boleh menyimpan ke server atau lokal (dev).
    | "server"  = tolak simpanan lokal; semua berkas wajib ke server
    |             (produksi: "selalu sinkronisasi ke server").
    |
    */
    'mode' => env('DOKUMEN_MODE', 'bebas'),
];
