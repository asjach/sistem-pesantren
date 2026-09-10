<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// 2d: prune token kedaluwarsa harian (butuh cron scheduler di VPS, catatan 900/901).
Schedule::command('sanctum:prune-expired --hours=24')->daily();
