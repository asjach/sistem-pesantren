<?php

namespace App\Konteks;

/**
 * Konteks per-request "bertindak sebagai lembaga" (act-as) untuk super_admin.
 * Diisi middleware `lembaga_aktif`; dibaca model/policy/controller lewat
 * `User::lembagaPeran()`/`bolehPesantren()`.
 */
class LembagaAktif
{
    protected ?int $id = null;

    public function id(): ?int
    {
        return $this->id;
    }

    public function aktif(): bool
    {
        return $this->id !== null;
    }

    public function set(?int $id): void
    {
        $this->id = $id;
    }

    public function lupakan(): void
    {
        $this->id = null;
    }
}
