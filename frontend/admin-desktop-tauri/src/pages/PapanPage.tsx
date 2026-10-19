import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from '@/icons';
import { PAGE_SHELL } from '@/components/PageHeader';
import {
  muatPapan,
  muatRiwayatPapan,
  pindahStatusPapan,
  type DataPapan,
  type RiwayatPapan,
  type StatusPapan,
} from '@/api/papan';
import { kelompokkanKolom, ratakanKartu, type KartuPapan } from '@/lib/papan';

/** Posisi sisip saat menyeret: sebelum kartu ke-`indeks` di kolom. */
interface SasaranJatuh {
  kolom: StatusPapan;
  indeks: number;
}

/** Warna lencana per status — memakai token semantik yang sudah ada. */
const WARNA_STATUS: Record<StatusPapan, string> = {
  akan: 'var(--info)',
  sedang: 'var(--warning)',
  sudah: 'var(--success)',
  ditunda: 'var(--muted-foreground)',
};

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

/** Garis sisip 2px aksen saat menyeret kartu. */
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

/** Kartu papan: satu sub-modul, dengan ringkasan butir per status. */
function Kartu({
  kartu,
  diseret,
  kolomKini,
  tujuan,
  onMulaiSeret,
  onLepasSeret,
  onDiAtas,
  onPindah,
  onBuka,
}: {
  kartu: KartuPapan;
  diseret: boolean;
  kolomKini: StatusPapan;
  tujuan: { id: StatusPapan; judul: string }[];
  onMulaiSeret: (e: DragEvent) => void;
  onLepasSeret: () => void;
  onDiAtas: (e: DragEvent) => void;
  onPindah: (ke: StatusPapan) => void;
  onBuka: () => void;
}) {
  const total = kartu.butir.length;

  return (
    <article
      id={`kartu_papan_${kartu.kode.replace('.', '_')}`}
      draggable="true"
      onDragStart={onMulaiSeret}
      onDragEnd={onLepasSeret}
      onDragOver={onDiAtas}
      aria-label={`${kartu.kode} ${kartu.nama}. Seret untuk memindahkan.`}
      className={cn('flex cursor-grab flex-col gap-2 p-[10px_12px] transition-shadow active:cursor-grabbing', diseret && 'opacity-40')}
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-px font-mono text-[11px] font-semibold text-muted-foreground">{kartu.kode}</span>
        <button
          id={`btn_buka_papan_${kartu.kode.replace('.', '_')}`}
          type="button"
          onClick={onBuka}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="min-w-0 flex-1 cursor-pointer text-left text-[13px] leading-snug font-medium hover:text-[var(--accent)]"
        >
          {kartu.nama}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        <Lencana label={kartu.modulNama} warna="var(--accent)" />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <select
          id={`select_pindah_papan_${kartu.kode.replace('.', '_')}`}
          aria-label={`Pindahkan ${kartu.kode} ${kartu.nama} ke kolom`}
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
        <span className="tabular-nums">{total} butir</span>
        <span className="ml-auto tabular-nums" aria-label={`${kartu.jumlahButir.sudah} dari ${total} butir selesai`}>
          {kartu.jumlahButir.sudah}/{total}
        </span>
      </div>
    </article>
  );
}

/** Panel riwayat perpindahan status. */
function PanelRiwayat({ riwayat }: { riwayat: RiwayatPapan[] }) {
  if (riwayat.length === 0) return null;

  return (
    <div id="panel_riwayat_papan" className="mx-auto w-full max-w-none px-6 pb-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {riwayat.slice(0, 6).map((r, i) => (
          <li key={`${r.kode}-${r.waktu}-${i}`} className="tabular-nums">
            <span className="font-mono">{r.kode}</span> {r.dari ?? '—'} → {r.ke}
            <span className="ml-1 opacity-70">{r.waktu}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Papan perkembangan proyek — kartu = sub-modul, kolom = status.
 *
 * Sumbernya API /papan (bukan data pesantren), jadi halaman ini tidak ikut
 * mode lembaga aktif. Seret kartu antar kolom atau pakai menu "Pindah…".
 */
export default function PapanPage() {
  const [data, setData] = useState<DataPapan | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatPapan[]>([]);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [seret, setSeret] = useState<string | null>(null);
  const [sasaran, setSasaran] = useState<SasaranJatuh | null>(null);
  const [lipat, setLipat] = useState<Set<StatusPapan>>(() => new Set());
  const [pengumuman, setPengumuman] = useState('');
  const [pilihan, setPilihan] = useState<KartuPapan | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [papan, log] = await Promise.all([muatPapan(), muatRiwayatPapan(undefined, 8)]);
      setData(papan);
      setRiwayat(log.riwayat);
      setGalat(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Papan gagal dimuat.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const kartu = useMemo(() => (data ? ratakanKartu(data.modul) : []), [data]);
  const kolom = useMemo(() => kelompokkanKolom(kartu), [kartu]);

  function bersihkanSeret() {
    setSeret(null);
    setSasaran(null);
  }

  function mulaiSeret(e: DragEvent, kode: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', kode);
    setSeret(kode);
  }

  function indeksSisip(e: DragEvent, indeks: number): number {
    const kotak = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY > kotak.top + kotak.height / 2 ? indeks + 1 : indeks;
  }

  function diAtasKartu(e: DragEvent, kolomId: StatusPapan, indeks: number) {
    if (!seret) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const posisi = indeksSisip(e, indeks);
    setSasaran((prev) =>
      prev && prev.kolom === kolomId && prev.indeks === posisi ? prev : { kolom: kolomId, indeks: posisi },
    );
  }

  function diAtasKolom(e: DragEvent, kolomId: StatusPapan, jumlah: number) {
    if (!seret) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setSasaran((prev) =>
      prev && prev.kolom === kolomId && prev.indeks === jumlah ? prev : { kolom: kolomId, indeks: jumlah },
    );
  }

  function tinggalkanKolom(e: DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setSasaran(null);
  }

  /** Simpan perpindahan ke server; gagal = kembalikan tampilan ke data server. */
  async function pindah(kode: string, ke: StatusPapan) {
    const asal = kartu.find((k) => k.kode === kode);
    if (!asal || asal.status === ke) {
      bersihkanSeret();
      return;
    }

    setData((prev) =>
      prev
        ? {
            ...prev,
            modul: prev.modul.map((m) => ({
              ...m,
              sub: m.sub.map((s) => (s.kode === kode ? { ...s, status: ke } : s)),
            })),
          }
        : prev,
    );
    setPengumuman(`${kode} ${asal.nama} dipindahkan ke ${ke}.`);
    bersihkanSeret();

    try {
      await pindahStatusPapan(kode, ke);
      const log = await muatRiwayatPapan(undefined, 8);
      setRiwayat(log.riwayat);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Perpindahan gagal disimpan.');
      void muat();
    }
  }

  function jatuhkan(e: DragEvent, kolomId: StatusPapan, jumlah: number) {
    e.preventDefault();
    if (!seret) return;
    void pindah(seret, kolomId);
    void jumlah;
  }

  function jungkitLipat(id: StatusPapan) {
    setLipat((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (memuat && !data) {
    return (
      <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
        <div className="px-6 pt-7 text-sm text-muted-foreground">Memuat papan…</div>
      </div>
    );
  }

  if (galat && !data) {
    return (
      <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
        <div className="px-6 pt-7 text-sm" style={{ color: 'var(--danger)' }}>
          {galat}
        </div>
      </div>
    );
  }

  return (
    <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
      <div id="status_papan_modul" role="status" aria-live="polite" className="sr-only">
        {pengumuman}
      </div>

      <div className="mx-auto flex w-full max-w-none items-baseline gap-3 px-6 pt-7 pb-3">
        <h2 className="text-base font-semibold">Papan Modul</h2>
        {data ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {data.ringkasan.sudah} sudah · {data.ringkasan.sedang} sedang · {data.ringkasan.akan} akan ·{' '}
            {data.ringkasan.ditunda} ditunda
          </p>
        ) : null}
      </div>

      <PanelRiwayat riwayat={riwayat} />

      {galat ? (
        <div className="mx-auto w-full max-w-none px-6 pb-2 text-xs" style={{ color: 'var(--danger)' }}>
          {galat}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 pb-6">
        {kolom.map((item) => {
          const terlipat = lipat.has(item.id);
          const disorot = sasaran?.kolom === item.id && seret !== null;

          return (
            <section
              key={item.id}
              id={`kolom_papan_${item.id}`}
              aria-label={`Kolom ${item.judul}, ${item.kartu.length} kartu`}
              onDragOver={(e) => diAtasKolom(e, item.id, item.kartu.length)}
              onDragLeave={tinggalkanKolom}
              onDrop={(e) => jatuhkan(e, item.id, item.kartu.length)}
              className={cn(
                'flex max-h-full shrink-0 flex-col rounded-[10px] border',
                terlipat && 'w-11 cursor-pointer items-center pt-2',
              )}
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
                      id={`btn_lipat_kolom_papan_${item.id}`}
                      type="button"
                      aria-label={`Lipat kolom ${item.judul}`}
                      onClick={() => jungkitLipat(item.id)}
                      className="ml-auto grid size-[26px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </header>

                  <div className="flex min-h-[60px] flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
                    {item.kartu.map((k, idx) => (
                      <div key={k.kode} className="flex flex-col gap-1.5">
                        {sasaran && sasaran.kolom === item.id && sasaran.indeks === idx ? (
                          <GarisSisip id={`garis_sisip_papan_${item.id}_${idx}`} />
                        ) : null}
                        <Kartu
                          kartu={k}
                          diseret={seret === k.kode}
                          kolomKini={item.id}
                          tujuan={kolom.map((c) => ({ id: c.id, judul: c.judul }))}
                          onMulaiSeret={(e) => mulaiSeret(e, k.kode)}
                          onLepasSeret={bersihkanSeret}
                          onDiAtas={(e) => diAtasKartu(e, item.id, idx)}
                          onPindah={(ke) => void pindah(k.kode, ke)}
                          onBuka={() => setPilihan(k)}
                        />
                      </div>
                    ))}
                    {sasaran && sasaran.kolom === item.id && sasaran.indeks >= item.kartu.length ? (
                      <GarisSisip id={`garis_sisip_papan_${item.id}_akhir`} />
                    ) : null}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>

      {pilihan ? (
        <div
          id="dialog_butir_papan"
          role="dialog"
          aria-label={`Butir ${pilihan.kode}`}
          className="absolute inset-0 z-20 grid place-items-center"
          style={{ background: 'color-mix(in srgb, var(--foreground) 24%, transparent)' }}
          onClick={() => setPilihan(null)}
        >
          <div
            className="max-h-[70vh] w-[min(560px,90vw)] overflow-y-auto border p-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--divider)', boxShadow: 'var(--shadow-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs font-semibold text-muted-foreground">{pilihan.kode}</span>
              <h3 className="text-sm font-semibold">{pilihan.nama}</h3>
              <button
                id="btn_tutup_butir_papan"
                type="button"
                onClick={() => setPilihan(null)}
                className="ml-auto cursor-pointer text-xs text-muted-foreground hover:text-foreground"
              >
                Tutup
              </button>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {pilihan.butir.map((b) => (
                <li key={b.id} className="flex items-start gap-2 text-[13px] leading-snug">
                  <Lencana label={b.status} warna={WARNA_STATUS[b.status]} />
                  <span className="min-w-0 flex-1">{b.deskripsi}</span>
                </li>
              ))}
              {pilihan.butir.length === 0 ? (
                <li className="text-xs text-muted-foreground">Belum ada butir.</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
