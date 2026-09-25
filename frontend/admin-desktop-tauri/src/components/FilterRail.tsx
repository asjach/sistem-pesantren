import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { errorMessage } from '@/api/client';
import { simpanPengaturanHalaman, type FilterModeHalaman } from '@/api/halaman';
import { listKelas, referensiList, type Kelas, type ReferensiRow } from '@/api/master';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { useKelasAktif } from '@/kelasAktif';
import { useTingkatAktif } from '@/tingkatAktif';
import { useVisibilitasFilter, pageKeyDariPath } from '@/components/VisibilitasFilter';
import { Switch } from '@/components/ui/switch';
import { useLembagaAktif } from '@/lembagaAktif';
import type { ModeFilterGlobal } from '@/lib/filterHalaman';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type RailGroup = 'tingkat' | 'kelas';

type DragState = {
  group: RailGroup;
  pointerId: number;
  visited: Set<string>;
  tingkat: Set<string>;
  kelas: Set<string>;
  moved: boolean;
};

function idNilai(prefix: string, value: string, index: number): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${prefix}_${slug || index + 1}`;
}

function RailModeToggle({
  group,
  mode,
  disabled,
  onChange,
}: {
  group: RailGroup;
  mode: ModeFilterGlobal;
  disabled: boolean;
  onChange: (mode: ModeFilterGlobal) => void;
}) {
  const label = group === 'tingkat' ? 'tingkat' : 'kelas';
  const jamak = mode === 'multiple';
  return (
    <div className="flex h-7 items-center justify-center border-b border-border/60">
      <Switch
        id={`filter_rail_mode_${group}`}
        size="xs"
        checked={jamak}
        disabled={disabled}
        title={jamak ? 'Klik satu · drag atau Ctrl/Cmd klik untuk beberapa' : 'Klik untuk satu nilai'}
        aria-label={`Mode ${label}: ${jamak ? 'jamak' : 'tunggal'}`}
        onCheckedChange={(checked) => onChange(checked ? 'multiple' : 'single')}
      />
    </div>
  );
}

function RailSectionLabel({ children }: { children: string }) {
  return (
    <div className="flex h-6 shrink-0 items-center justify-center whitespace-nowrap border-b border-border/60 px-0.5 text-[10px] font-normal leading-none tracking-tight text-muted-foreground">
      {children}
    </div>
  );
}

export default function FilterRail() {
  const { pathname } = useLocation();
  const filter = useVisibilitasFilter();
  const { jenjangs, tahunAjaranNames, tingkat, kelas, loading: filterLoading } = useFilterGlobalAktif();
  const { pilih: pilihTingkat } = useTingkatAktif();
  const { pilih: pilihKelas } = useKelasAktif();
  const [kelasTersedia, setKelasTersedia] = useState<Kelas[]>([]);
  const [tingkatReferensi, setTingkatReferensi] = useState<ReferensiRow[]>([]);
  const [tingkatReferensiLoading, setTingkatReferensiLoading] = useState(false);
  const [tingkatReferensiGagal, setTingkatReferensiGagal] = useState(false);
  const [modeBusy, setModeBusy] = useState<RailGroup | null>(null);
  const stateFilterRef = useRef({ tingkat, kelas, kelasTersedia });
  stateFilterRef.current = { tingkat, kelas, kelasTersedia };
  const dragState = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const { efektifSuper } = useLembagaAktif();
  const setMode = filter?.setMode;
  const pageKey = filter?.registrasi?.pageKey ?? pageKeyDariPath(pathname);
  const bolehUbahMode = efektifSuper && !!setMode;
  const scopeMiMd = pathname === '/mi-md';
  const scopeJenjang = useMemo(() => (scopeMiMd ? ['MI', 'MD'] : jenjangs), [scopeMiMd, jenjangs]);
  const showTingkat = !!filter?.filterRelevan.includes('tingkat') && filter.tampil.tingkat;
  const showKelas = !!filter?.filterRelevan.includes('kelas') && filter.tampil.kelas;
  const modeTingkat = filter?.mode.tingkat ?? 'single';
  const modeKelas = filter?.mode.kelas ?? 'single';
  const loading = filterLoading || tingkatReferensiLoading;

  async function ubahMode(group: RailGroup, next: ModeFilterGlobal) {
    const current = group === 'tingkat' ? modeTingkat : modeKelas;
    if (!bolehUbahMode || !setMode || current === next || modeBusy) return;
    const previous = current;
    setMode((values) => ({ ...values, [group]: next }));
    setModeBusy(group);
    const changes: FilterModeHalaman = group === 'tingkat' ? { tingkat: next } : { kelas: next };
    try {
      await simpanPengaturanHalaman(pageKey, {}, changes);
    } catch (error) {
      setMode((values) => ({ ...values, [group]: previous }));
      toast.error(errorMessage(error));
    } finally {
      setModeBusy(null);
    }
  }

  useEffect(() => {
    const finishDrag = (event: PointerEvent) => {
      const drag = dragState.current;
      if (!drag) return;
      dragState.current = null;
      if (drag.moved && event.type === 'pointerup') {
        if (drag.group === 'tingkat') applyLevelSelection([...drag.tingkat], [...drag.kelas]);
        else applyClassSelection([...drag.kelas]);
      }
      if (drag.moved) suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    };
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, []);

  useEffect(() => {
    if (!showTingkat) {
      setTingkatReferensi([]);
      setTingkatReferensiLoading(false);
      setTingkatReferensiGagal(false);
      return;
    }
    let hidup = true;
    setTingkatReferensi([]);
    setTingkatReferensiLoading(true);
    setTingkatReferensiGagal(false);
    referensiList('tingkat', scopeJenjang.length > 0 ? scopeJenjang : undefined)
      .then((rows) => {
        if (hidup) setTingkatReferensi(rows.filter((row) => row.is_active !== false));
      })
      .catch(() => {
        if (hidup) setTingkatReferensiGagal(true);
      })
      .finally(() => {
        if (hidup) setTingkatReferensiLoading(false);
      });
    return () => { hidup = false; };
  }, [scopeJenjang, showTingkat]);

  useEffect(() => {
    if ((!showTingkat && !showKelas) || scopeJenjang.length === 0 || tahunAjaranNames.length === 0) {
      setKelasTersedia([]);
      return;
    }
    if (filterLoading) return;
    let hidup = true;
    listKelas({ jenjang: scopeJenjang, tahun_ajaran: tahunAjaranNames, per_page: 1000 })
      .then((res) => { if (hidup) setKelasTersedia(res.data); })
      .catch(() => { if (hidup) setKelasTersedia([]); });
    return () => { hidup = false; };
  }, [filterLoading, showKelas, showTingkat, scopeJenjang, tahunAjaranNames]);

  const tingkatOpsi = useMemo(() => {
    const values = new Map<string, number>();
    for (const row of tingkatReferensi) {
      const nama = row.nama?.trim();
      if (!nama || row.is_active === false) continue;
      const urutan = Number.isFinite(row.urutan) ? row.urutan : 0;
      const lama = values.get(nama);
      if (lama === undefined || urutan < lama) values.set(nama, urutan);
    }
    return [...values.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], 'id', { numeric: true }))
      .map(([nama]) => nama);
  }, [tingkatReferensi]);

  const kelasOpsi = useMemo(() => {
    const values = kelasTersedia
      .filter((item) => !showTingkat || tingkat.length === 0 || (item.tingkat != null && tingkat.includes(String(item.tingkat))))
      .map((item) => item.nama_kelas)
      .filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [kelasTersedia, tingkat]);

  if (!showTingkat && !showKelas) return null;

  function applyLevelSelection(next: string[], currentKelas: readonly string[] = stateFilterRef.current.kelas) {
    pilihTingkat(next);
    const validClasses = new Set(
      stateFilterRef.current.kelasTersedia
        .filter((item) => next.length === 0 || (item.tingkat != null && next.includes(String(item.tingkat))))
        .map((item) => item.nama_kelas),
    );
    const kelasSekarang = stateFilterRef.current.kelas;
    const nextKelas = currentKelas.filter((item) => validClasses.has(item));
    if (nextKelas.length !== kelasSekarang.length || nextKelas.some((item, index) => item !== kelasSekarang[index])) {
      pilihKelas(nextKelas);
    }
  }

  function applyClassSelection(next: string[]) {
    pilihKelas(next);
  }

  function addDragValue(group: RailGroup, value: string) {
    const drag = dragState.current;
    if (!drag || drag.group !== group || drag.visited.has(value)) return;
    drag.visited.add(value);
    if (group === 'tingkat') drag.tingkat.add(value);
    else drag.kelas.add(value);
    drag.moved = true;
  }

  function startDrag(group: RailGroup, value: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const mode = group === 'tingkat' ? modeTingkat : modeKelas;
    if (mode !== 'multiple' || event.button !== 0) return;
    const modifier = event.ctrlKey || event.metaKey;
    const workingTingkat = new Set(group === 'kelas' || modifier ? tingkat : []);
    const workingKelas = new Set(group === 'tingkat' || modifier ? kelas : []);
    if (group === 'tingkat') workingTingkat.add(value);
    else workingKelas.add(value);
    dragState.current = {
      group,
      pointerId: event.pointerId,
      visited: new Set([value]),
      tingkat: workingTingkat,
      kelas: workingKelas,
      moved: false,
    };
  }

  function continueDrag(group: RailGroup, value: string, event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragState.current?.pointerId !== event.pointerId) return;
    addDragValue(group, value);
  }

  function clickValue(group: RailGroup, value: string, event: MouseEvent<HTMLButtonElement>) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const mode = group === 'tingkat' ? modeTingkat : modeKelas;
    const current = group === 'tingkat' ? tingkat : kelas;
    const modifier = event.ctrlKey || event.metaKey;
    if (mode === 'multiple' && !modifier) {
      if (group === 'tingkat') applyLevelSelection([value]);
      else applyClassSelection([value]);
      return;
    }
    const next = mode === 'single'
      ? (current.length === 1 && current[0] === value ? [] : [value])
      : current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
    if (group === 'tingkat') applyLevelSelection(next);
    else applyClassSelection(next);
  }

  const itemClass = (active: boolean) => cn(
    'flex h-6 w-full select-none items-center justify-center border-b border-border/60 px-1 text-xs font-normal text-foreground/75 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
    loading && 'cursor-wait opacity-60',
    active && 'bg-accent text-accent-foreground shadow-[inset_3px_0_0_var(--accent)]',
  );

  return (
    <aside
       id="filter_rail_tingkat_kelas"
       aria-label="Filter tingkat dan kelas"
       aria-busy={loading}
      className="flex h-full w-[42px] shrink-0 flex-col gap-2 overflow-hidden border-r border-border bg-background text-foreground"
    >
      {showTingkat ? (
        <section aria-label="Tingkat" className="shrink-0">
          <RailSectionLabel>Tingkat</RailSectionLabel>
          <RailModeToggle
            group="tingkat"
            mode={modeTingkat}
             disabled={loading || !bolehUbahMode || modeBusy !== null}
            onChange={(next) => { void ubahMode('tingkat', next); }}
          />
          <button
            id="filter_rail_tingkat_all"
             type="button"
             disabled={loading}
             aria-label="Pilih semua tingkat"
            aria-pressed={tingkat.length === 0}
            title="Semua tingkat"
            onClick={() => pilihTingkat([])}
            className={itemClass(tingkat.length === 0)}
          >
            All
          </button>
           {tingkatReferensiLoading ? (
             <span className="block px-1 py-3 text-center text-[10px] text-muted-foreground">Memuat…</span>
           ) : tingkatReferensiGagal ? (
             <span className="block px-1 py-3 text-center text-[10px] text-muted-foreground">Gagal memuat</span>
           ) : tingkatOpsi.length > 0 ? tingkatOpsi.map((value, index) => {
             const active = tingkat.includes(value);
             return (
               <button
                 key={value}
                 id={idNilai('filter_rail_tingkat', value, index)}
                 type="button"
                 disabled={loading}
                 aria-label={`Pilih tingkat ${value}`}
                 aria-pressed={active}
                 title={modeTingkat === 'single' && active ? `${value} · klik untuk Semua` : `Pilih tingkat ${value}`}
                 onPointerDown={(event) => startDrag('tingkat', value, event)}
                 onPointerEnter={(event) => continueDrag('tingkat', value, event)}
                  onClick={(event) => clickValue('tingkat', value, event)}
                 className={itemClass(active)}
               >
                 {value}
               </button>
             );
           }) : (
             <span className="block px-1 py-3 text-center text-[10px] text-muted-foreground">Tidak ada tingkat</span>
           )}
        </section>
      ) : null}
      {showKelas ? (
        <section aria-label="Kelas" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <RailSectionLabel>Kelas</RailSectionLabel>
          <RailModeToggle
            group="kelas"
            mode={modeKelas}
             disabled={loading || !bolehUbahMode || modeBusy !== null}
            onChange={(next) => { void ubahMode('kelas', next); }}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <button
              id="filter_rail_kelas_all"
               type="button"
               disabled={loading}
               aria-label="Pilih semua kelas"
              aria-pressed={kelas.length === 0}
              title="Semua kelas"
              onClick={() => pilihKelas([])}
              className={itemClass(kelas.length === 0)}
            >
              All
            </button>
             {loading ? (
               <span className="block px-2 py-3 text-center text-xs text-muted-foreground">Memuat…</span>
             ) : kelasOpsi.length > 0 ? kelasOpsi.map((value, index) => {
               const active = kelas.includes(value);
               return (
                 <button
                   key={value}
                   id={idNilai('filter_rail_kelas', value, index)}
                   type="button"
                   disabled={loading}
                   aria-label={`Pilih kelas ${value}`}
                   aria-pressed={active}
                   title={modeKelas === 'single' && active ? `${value} · klik untuk Semua` : `Pilih kelas ${value}`}
                   onPointerDown={(event) => startDrag('kelas', value, event)}
                   onPointerEnter={(event) => continueDrag('kelas', value, event)}
                    onClick={(event) => clickValue('kelas', value, event)}
                   className={itemClass(active)}
                 >
                   <span className="max-w-full truncate">{value}</span>
                 </button>
               );
             }) : (
               <span className="block px-2 py-3 text-center text-xs text-muted-foreground">Tidak ada kelas</span>
             )}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
