import { useState, type DragEvent } from 'react';
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

/** Posisi sisip saat menyeret: sebelum kartu ke-`indeks` di kolom. */
interface SasaranJatuh {
  kolom: StatusPapan;
  indeks: number;
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

/** Garis sisip 2px aksen ala Gr8r (trow drop-before/after). */
function GarisSisip({ id }: { id: string }) {
  return (
    <div
      id={id}
      aria-hidden="true"
      className="h-[2px] shrink-0 rounded-full"
      style={{ background: 'var(--accent)' }}
    />
  );
}

/** Kartu tugas ala kcard Gr8r: permukaan + bayangan kartu + radius 8. */
function Kartu({
  kartu,
  selesai,
  diseret,
  kolomKini,
  tujuan,
  onJungkit,
  onMulaiSeret,
  onLepasSeret,
  onDiAtas,
  onPindah,
}: {
  kartu: KartuContoh;
  selesai: boolean;
  diseret: boolean;
  kolomKini: StatusPapan;
  tujuan: { id: StatusPapan; judul: string }[];
  onJungkit: () => void;
  onMulaiSeret: (e: DragEvent) => void;
  onLepasSeret: () => void;
  onDiAtas: (e: DragEvent) => void;
  onPindah: (ke: StatusPapan) => void;
}) {
  return (
    <article
      id={`kartu_contoh_${kartu.id}`}
      draggable="true"
      onDragStart={onMulaiSeret}
      onDragEnd={onLepasSeret}
      onDragOver={onDiAtas}
      aria-label={`Kartu ${kartu.judul}. Seret untuk memindahkan.`}
      className={cn(
        'flex cursor-grab flex-col gap-2 rounded-lg p-[10px_12px] transition-shadow active:cursor-grabbing',
        diseret && 'opacity-40',
      )}
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
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">{kartu.tanggal}</span>

        <select
          id={`select_pindah_contoh_${kartu.id}`}
          aria-label={`Pindahkan ${kartu.judul} ke kolom`}
          value=""
          onChange={(e) => {
            if (e.target.value !== '') onPindah(e.target.value as StatusPapan);
          }}
          onDragStart={(e) => e.preventDefault()}
          className="h-5 max-w-[6.5rem] cursor-pointer truncate rounded border bg-transparent pr-0 text-[11px] outline-none hover:text-foreground focus:border-[var(--accent)]"
          style={{ borderColor: 'var(--divider)' }}
        >
          <option value="">Pindah…</option>
          {tujuan
            .filter((t) => t.id !== kolomKini)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.judul}
              </option>
            ))}
        </select>
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
 *  Seret kartu antar/antar kolom; data statis di memori — izin ikut dasbor. */
export default function PapanContohPage() {
  const [kolom, setKolom] = useState<KolomPapan[]>(DATA_AWAL);
  const [selesai, setSelesai] = useState<Set<string>>(() => new Set(['arsip_rapor']));
  const [lipat, setLipat] = useState<Set<StatusPapan>>(() => new Set());
  const [seretId, setSeretId] = useState<string | null>(null);
  const [sasaran, setSasaran] = useState<SasaranJatuh | null>(null);
  const [pengumuman, setPengumuman] = useState('');

  function cariKartu(id: string): { kartu: KartuContoh; kolom: KolomPapan } | null {
    for (const k of kolom) {
      const kartu = k.kartu.find((c) => c.id === id);
      if (kartu) return { kartu, kolom: k };
    }
    return null;
  }

  function jungkitSelesai(id: string) {
    const temu = cariKartu(id);
    setSelesai((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (temu) {
      setPengumuman(
        selesai.has(id)
          ? `Kartu ${temu.kartu.judul} dibatalkan selesainya.`
          : `Kartu ${temu.kartu.judul} ditandai selesai.`,
      );
    }
  }

  function jungkitLipat(id: StatusPapan) {
    setLipat((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bersihkanSeret() {
    setSeretId(null);
    setSasaran(null);
  }

  function mulaiSeret(e: DragEvent, id: string) {
    e.dataTransfer.effectAllowed = 'move';

    e.dataTransfer.setData('text/plain', id);
    setSeretId(id);
  }

  /** Indeks sisip dari posisi pointer: paruh atas = sebelum, bawah = sesudah. */
  function indeksSisip(e: DragEvent, indeks: number): number {
    const kotak = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY > kotak.top + kotak.height / 2 ? indeks + 1 : indeks;
  }

  function diAtasKartu(e: DragEvent, kolomId: StatusPapan, indeks: number) {
    if (!seretId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const posisi = indeksSisip(e, indeks);
    setSasaran((prev) => (prev && prev.kolom === kolomId && prev.indeks === posisi ? prev : { kolom: kolomId, indeks: posisi }));
  }

  function diAtasKolom(e: DragEvent, kolomId: StatusPapan, jumlah: number) {
    if (!seretId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setSasaran((prev) => (prev && prev.kolom === kolomId && prev.indeks === jumlah ? prev : { kolom: kolomId, indeks: jumlah }));
  }

  function tinggalkanKolom(e: DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setSasaran(null);
  }

  function pindahkanKartu(id: string, ke: StatusPapan, indeks: number) {
    setKolom((prev) => {
      const asal = prev.find((k) => k.kartu.some((c) => c.id === id));
      if (!asal) return prev;
      const kartu = asal.kartu.find((c) => c.id === id);
      if (!kartu) return prev;
      const tanpa = prev.map((k) => (k.id === asal.id ? { ...k, kartu: k.kartu.filter((c) => c.id !== id) } : k));
      return tanpa.map((k) => {
        if (k.id !== ke) return k;
        let posisi = Math.max(0, Math.min(indeks, k.kartu.length));

        if (asal.id === ke) {
          const idxAsal = asal.kartu.findIndex((c) => c.id === id);
          if (idxAsal < posisi) posisi -= 1;
        }
        return { ...k, kartu: [...k.kartu.slice(0, posisi), kartu, ...k.kartu.slice(posisi)] };
      });
    });
  }

  function umumkanPindah(id: string, ke: StatusPapan) {
    const temu = cariKartu(id);
    const tujuan = kolom.find((k) => k.id === ke);
    if (temu && tujuan && temu.kolom.id !== ke) {
      setPengumuman(`Kartu ${temu.kartu.judul} dipindahkan ke kolom ${tujuan.judul}.`);
    }
  }

  function jatuhkan(e: DragEvent, kolomId: StatusPapan, jumlah: number) {
    e.preventDefault();
    if (!seretId) return;
    const target = sasaran && sasaran.kolom === kolomId ? sasaran.indeks : jumlah;
    umumkanPindah(seretId, kolomId);
    pindahkanKartu(seretId, kolomId, target);
    bersihkanSeret();
  }

  function pindahKeyboard(id: string, ke: StatusPapan) {
    const tujuan = kolom.find((k) => k.id === ke);
    if (!tujuan) return;
    umumkanPindah(id, ke);
    pindahkanKartu(id, ke, tujuan.kartu.length);
  }

  const total = kolom.reduce((n, k) => n + k.kartu.length, 0);

  return (
    <div id="papan_contoh" className={cn(PAGE_SHELL, 'h-full')}>
      <div id="status_papan_contoh" role="status" aria-live="polite" className="sr-only">
        {pengumuman}
      </div>
      <div className="mx-auto w-full max-w-none px-6 pt-7 pb-3">
        <h2 className="text-base font-semibold">Contoh Papan</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Demonstrasi bahasa desain Gr8r — seret kartu antar kolom, {total} kartu contoh, perubahan hanya di memori.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 pb-6">
        {kolom.map((item) => {
          const terlipat = lipat.has(item.id);
          const disorot = sasaran?.kolom === item.id && seretId !== null;
          return (
            <section
              key={item.id}
              id={`kolom_papan_${item.id}`}
              aria-label={`Kolom ${item.judul}, ${item.kartu.length} kartu`}
              onDragOver={(e) => diAtasKolom(e, item.id, item.kartu.length)}
              onDragLeave={tinggalkanKolom}
              onDrop={(e) => jatuhkan(e, item.id, item.kartu.length)}
              className={cn('flex max-h-full shrink-0 flex-col rounded-[10px] border', terlipat && 'w-11 cursor-pointer items-center pt-2')}
              style={{
                width: terlipat ? undefined : 284,
                background: disorot ? 'color-mix(in srgb, var(--accent) 6%, var(--sunken))' : 'var(--sunken)',
                borderColor: disorot ? 'var(--accent-line)' : 'var(--divider)',
              }}
            >
              {terlipat ? (

                <button
                  type="button"
                  onClick={() => jungkitLipat(item.id)}
                  className="cursor-pointer text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]"
                >
                  {item.judul} · {item.kartu.length}
                </button>
              ) : (
                <>
                  <header className="flex items-center gap-[7px] pt-[10px] pr-2 pb-1.5 pl-3 text-[12.5px] font-semibold">
                    {item.judul}
                    <span className="font-medium text-muted-foreground tabular-nums">{item.kartu.length}</span>
                    <button
                      id={`btn_lipat_kolom_${item.id}`}
                      type="button"
                      aria-label={`Lipat kolom ${item.judul}`}
                      onClick={() => jungkitLipat(item.id)}
                      className="ml-auto grid size-[26px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </header>
                  <div className="flex min-h-[60px] flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
                    {item.kartu.map((kartu, idx) => (
                      <div key={kartu.id} className="flex flex-col gap-1.5">
                        {sasaran && sasaran.kolom === item.id && sasaran.indeks === idx ? (
                          <GarisSisip id={`garis_sisip_${item.id}_${idx}`} />
                        ) : null}
                        <Kartu
                          kartu={kartu}
                          selesai={selesai.has(kartu.id)}
                          diseret={seretId === kartu.id}
                          kolomKini={item.id}
                          tujuan={kolom.map((k) => ({ id: k.id, judul: k.judul }))}
                          onJungkit={() => jungkitSelesai(kartu.id)}
                          onMulaiSeret={(e) => mulaiSeret(e, kartu.id)}
                          onLepasSeret={bersihkanSeret}
                          onDiAtas={(e) => diAtasKartu(e, item.id, idx)}
                          onPindah={(ke) => pindahKeyboard(kartu.id, ke)}
                        />
                      </div>
                    ))}
                    {sasaran && sasaran.kolom === item.id && sasaran.indeks >= item.kartu.length ? (
                      <GarisSisip id={`garis_sisip_${item.id}_akhir`} />
                    ) : null}
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
