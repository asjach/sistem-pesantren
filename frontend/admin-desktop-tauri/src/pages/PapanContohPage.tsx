import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from '@/icons';
import { PAGE_SHELL } from '@/components/PageHeader';

/** Status kolom papan contoh. */
type StatusPapan = 'antrean' | 'dikerjakan' | 'ditinjau' | 'selesai';

interface KartuContoh {
  id: string;
  judul: string;
  label: string;
  warna_label: string;
  tanggal: string;
  penanggung_jawab: string;
  sub_tugas_selesai: number;
  sub_tugas_total: number;
}

interface KolomPapan {
  id: StatusPapan;
  judul: string;
  kartu: KartuContoh[];
}

const DATA_AWAL: KolomPapan[] = [
  {
    id: 'antrean',
    judul: 'Antrean',
    kartu: [
      { id: 'verifikasi_berkas', judul: 'Verifikasi berkas PSB gelombang 2', label: 'PSB', warna_label: 'var(--info)', tanggal: '12 Okt', penanggung_jawab: 'AS', sub_tugas_selesai: 1, sub_tugas_total: 4 },
      { id: 'jadwal_tes', judul: 'Jadwalkan tes lisan calon santri baru', label: 'PSB', warna_label: 'var(--info)', tanggal: '14 Okt', penanggung_jawab: 'RH', sub_tugas_selesai: 0, sub_tugas_total: 2 },
    ],
  },
  {
    id: 'dikerjakan',
    judul: 'Dikerjakan',
    kartu: [
      { id: 'rekap_spp', judul: 'Rekap tunggakan SPP bulan September', label: 'Keuangan', warna_label: 'var(--warning)', tanggal: '10 Okt', penanggung_jawab: 'BD', sub_tugas_selesai: 2, sub_tugas_total: 3 },
    ],
  },
  {
    id: 'ditinjau',
    judul: 'Ditinjau',
    kartu: [
      { id: 'jadwal_ujian', judul: 'Draf jadwal ujian tengah semester', label: 'Kurikulum', warna_label: 'var(--accent)', tanggal: '9 Okt', penanggung_jawab: 'ML', sub_tugas_selesai: 3, sub_tugas_total: 3 },
    ],
  },
  {
    id: 'selesai',
    judul: 'Selesai',
    kartu: [
      { id: 'arsip_rapor', judul: 'Arsipkan rapor semester genap', label: 'Akademik', warna_label: 'var(--success)', tanggal: '5 Okt', penanggung_jawab: 'AS', sub_tugas_selesai: 5, sub_tugas_total: 5 },
    ],
  },
];

/** Lencana label kartu: tinta semantik di atas campurannya (ala badge Gr8r). */
function Lencana({ label, warna }: { label: string; warna: string }) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-[5px] px-[7px] text-xs font-medium whitespace-nowrap"
      style={{ color: warna, background: `color-mix(in srgb, ${warna} 12%, transparent)` }}
    >
      {label}
    </span>
  );
}

/** Kartu tugas ala kcard Gr8r: permukaan + bayangan kartu + radius 8. */
function Kartu({ kartu, selesai, onJungkit }: { kartu: KartuContoh; selesai: boolean; onJungkit: () => void }) {
  return (
    <article
      id={`kartu_contoh_${kartu.id}`}
      className="flex cursor-pointer flex-col gap-2 rounded-lg p-[10px_12px] transition-shadow"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start gap-2">
        <button
          id={`btn_selesai_contoh_${kartu.id}`}
          type="button"
          role="checkbox"
          aria-checked={selesai}
          aria-label={selesai ? `Batalkan selesai: ${kartu.judul}` : `Tandai selesai: ${kartu.judul}`}
          onClick={onJungkit}
          className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition-colors"
          style={{
            borderColor: selesai ? 'var(--accent)' : 'var(--border-strong)',
            background: selesai ? 'var(--accent)' : 'transparent',
            color: 'var(--on-accent)',
          }}
        >
          {selesai ? <Check size={11} /> : null}
        </button>
        <h3 className={cn('min-w-0 flex-1 text-[13px] leading-snug font-medium', selesai && 'text-muted-foreground line-through')}>
          {kartu.judul}
        </h3>
      </div>
      <div className="flex flex-wrap gap-1">
        <Lencana label={kartu.label} warna={kartu.warna_label} />
      </div>
      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
        <span className="tabular-nums">{kartu.tanggal}</span>
        <span className="tabular-nums">
          {kartu.sub_tugas_selesai}/{kartu.sub_tugas_total}
        </span>
        <span
          aria-label={`Penanggung jawab ${kartu.penanggung_jawab}`}
          className="ml-auto grid size-5 place-items-center rounded-full text-[10px] font-semibold"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent-soft-foreground)' }}
        >
          {kartu.penanggung_jawab}
        </span>
      </div>
    </article>
  );
}

/** Halaman contoh papan kanban (demonstrasi bahasa desain Gr8r).
 *  Data statis di memori — tanpa backend, izin ikut dasbor. */
export default function PapanContohPage() {
  const [selesai, setSelesai] = useState<Set<string>>(() => new Set(['arsip_rapor']));
  const [lipat, setLipat] = useState<Set<StatusPapan>>(() => new Set());

  function jungkitSelesai(id: string) {
    setSelesai((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function jungkitLipat(id: StatusPapan) {
    setLipat((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const total = DATA_AWAL.reduce((n, k) => n + k.kartu.length, 0);

  return (
    <div id="papan_contoh" className={cn(PAGE_SHELL, 'h-full')}>
      <div className="mx-auto w-full max-w-none px-6 pt-7 pb-3">
        <h2 className="text-base font-semibold">Contoh Papan</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Demonstrasi bahasa desain Gr8r — {total} kartu contoh, perubahan hanya di memori.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 pb-6">
        {DATA_AWAL.map((kolom) => {
          const terlipat = lipat.has(kolom.id);
          return (
            <section
              key={kolom.id}
              id={`kolom_papan_${kolom.id}`}
              aria-label={`Kolom ${kolom.judul}`}
              className={cn('flex max-h-full shrink-0 flex-col rounded-[10px] border', terlipat && 'w-11 cursor-pointer items-center pt-2')}
              style={{
                width: terlipat ? undefined : 284,
                background: 'var(--sunken)',
                borderColor: 'var(--divider)',
              }}
              onClick={terlipat ? () => jungkitLipat(kolom.id) : undefined}
            >
              {terlipat ? (
                <span className="text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]">
                  {kolom.judul} · {kolom.kartu.length}
                </span>
              ) : (
                <>
                  <header className="flex items-center gap-[7px] pt-[10px] pr-2 pb-1.5 pl-3 text-[12.5px] font-semibold">
                    {kolom.judul}
                    <span className="font-medium text-muted-foreground tabular-nums">{kolom.kartu.length}</span>
                    <button
                      id={`btn_lipat_kolom_${kolom.id}`}
                      type="button"
                      aria-label={`Lipat kolom ${kolom.judul}`}
                      onClick={() => jungkitLipat(kolom.id)}
                      className="ml-auto grid size-[26px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </header>
                  <div className="flex min-h-[60px] flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
                    {kolom.kartu.map((kartu) => (
                      <Kartu key={kartu.id} kartu={kartu} selesai={selesai.has(kartu.id)} onJungkit={() => jungkitSelesai(kartu.id)} />
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
