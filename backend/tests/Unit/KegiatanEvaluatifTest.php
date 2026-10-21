<?php

namespace Tests\Unit;

use App\Models\KegiatanEvaluatif;
use Tests\TestCase;

class KegiatanEvaluatifTest extends TestCase
{
    public function test_batas_atas_rentang_nilai(): void
    {
        $this->assertSame(100.0, (new KegiatanEvaluatif(['rentang_nilai' => null]))->nilaiMaks());
        $this->assertSame(100.0, (new KegiatanEvaluatif(['rentang_nilai' => '0-100']))->nilaiMaks());
        $this->assertSame(10.0, (new KegiatanEvaluatif(['rentang_nilai' => '0-10']))->nilaiMaks());
        $this->assertSame(4.0, (new KegiatanEvaluatif(['rentang_nilai' => '0-4']))->nilaiMaks());
    }
}
