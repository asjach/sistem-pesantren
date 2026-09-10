<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class RingkasanAntreanNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected string $type,
        protected int $count,
        protected string $url,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => $this->type,
            'count' => $this->count,
            'url' => $this->url,
            'teks' => $this->teks(),
        ];
    }

    public function toArray(object $notifiable): array
    {
        return $this->toDatabase($notifiable);
    }

    protected function teks(): string
    {
        return match ($this->type) {
            'pengajuan_biodata_summary' => "terdapat {$this->count} pengajuan perubahan identitas, klik di sini untuk memutuskan",
            'psb_daftar_ulang_summary' => "terdapat {$this->count} pengajuan daftar ulang, klik di sini untuk memutuskan",
            default => "terdapat {$this->count} antrean menunggu, klik di sini untuk memutuskan",
        };
    }
}
