import { cloneElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTheme } from '@/theme';
import { FONT_FAMILY_DEFAULT, FONT_OPTIONS, type FontOption } from '@/fonts';
import {
  BAYANGAN,
  PARTS,
  PART_BY_ID,
  PART_GROUPS,
  RENTANG,
  type BayanganName,
  type PartGaya,
  type PartId,
  type PartMode,
  type PartWarna,
} from '@/parts';
import { normalizeHex } from '@/prefs';
import { bangunCssPratinjau, variabelBagian, variabelWajah } from '@/partStyles';
import { contohBagian } from '@/components/PartContohBagian';
import { usePicker } from '@/picker';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDefaultLayout } from 'react-resizable-panels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, Minus, Plus, RotateCcw, Search, SquareMousePointer } from '@/icons';
import { cn } from '@/lib/utils';

/** Objek kosong stabil (menghindari efek pengukuran berulang tanpa henti). */
const TANPA_GAYA: PartGaya = {};
const TANPA_WARNA: PartWarna = {};

const FONT_GROUPS: { id: string; label: string; items: FontOption[] }[] = [
  { id: 'sistem', label: 'Sistem & bawaan', items: FONT_OPTIONS.filter((f) => f.group === 'sistem') },
  { id: 'aptos', label: 'Aptos (bundel offline)', items: FONT_OPTIONS.filter((f) => f.group === 'aptos') },
  { id: 'google', label: 'Google Fonts (bundel offline)', items: FONT_OPTIONS.filter((f) => f.group === 'google') },
];

/** Nilai bawaan terukur dari pratinjau (ditampilkan saat field kosong). */
interface Bawaan {
  font?: string;
  size?: number;
  borderW?: number;
  radius?: number;
  padX?: number;
  padY?: number;
  height?: number;
  minWidth?: number;
  gap?: number;
  margin?: number;
  opacity?: number;
  shadow?: BayanganName;
}

function px(v: string): number | undefined {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;
}

function hexDari(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Warna computed → hex; `undefined` bila transparan/tak dikenali. */
function warnaSolid(v: string): string | undefined {
  const s = v.trim().toLowerCase();
  if (!s || s === 'transparent' || s === 'none') return undefined;
  const rgb = s.match(/^rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)(?:,\s*([\d.]+))?\)$/);
  if (rgb) {
    if (rgb[4] != null && Number(rgb[4]) === 0) return undefined;
    return hexDari(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  }
  const srgb = s.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/);
  if (srgb) {
    if (srgb[4] != null && Number(srgb[4]) === 0) return undefined;
    return hexDari(Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255);
  }
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  return undefined;
}

/** Nama keluarga pertama dari daftar font computed (untuk label "Bawaan"). */
function keluargaUtama(font: string): string {
  return font.split(',')[0].replace(/["']/g, '').trim();
}

/** Kontrol warna opsional: picker + hex + tombol kembali ke bawaan. */
function WarnaField({
  id,
  label,
  nilai,
  bawaan,
  onChange,
}: {
  id: string;
  label: string;
  nilai?: string;
  bawaan?: string;
  onChange: (v: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(nilai ?? '');
  useEffect(() => setDraft(nilai ?? ''), [nilai]);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Label htmlFor={`${id}_picker`} className="w-12 shrink-0">{label}</Label>
      <input
        id={`${id}_picker`}
        type="color"
        value={nilai ?? bawaan ?? '#808080'}
        onChange={(e) => onChange(e.target.value)}
        title={bawaan ? `Nilai bawaan: ${bawaan}` : 'Nilai bawaan: transparan'}
        className="h-6 w-8 shrink-0 cursor-pointer rounded-md border bg-card p-1"
      />
      <Input
        id={`${id}_hex`}
        value={draft}
        placeholder={bawaan ?? 'bawaan'}
        maxLength={7}
        className="min-w-[6.5rem] flex-1 font-mono"
        onChange={(e) => {
          setDraft(e.target.value);
          const n = normalizeHex(e.target.value);
          if (n) onChange(n);
        }}
      />
      <Button
        id={`${id}_reset`}
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Kembalikan ke bawaan"
        disabled={nilai == null}
        onClick={() => onChange(undefined)}
      >
        <RotateCcw size={14} />
      </Button>
    </div>
  );
}

/** Kontrol angka opsional (px) bergaya stepper: tombol −/+, ketik manual,
 *  dikomit saat blur/Enter, langkah dimulai dari nilai yang tampil (bawaan). */
function AngkaField({
  id,
  label,
  nilai,
  bawaan,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  nilai?: number;
  bawaan?: number;
  min: number;
  max: number;
  onChange: (v: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const basis = nilai ?? bawaan ?? min;
  const commit = (raw: string) => {
    setDraft(null);
    const t = raw.trim();
    if (t === '') return onChange(undefined);
    const n = Number(t);
    if (!Number.isFinite(n)) return;
    onChange(Math.min(max, Math.max(min, Math.round(n))));
  };
  const langkah = (d: number) => {
    setDraft(null);
    onChange(Math.min(max, Math.max(min, Math.round(basis + d))));
  };
  const tampil = draft ?? (nilai != null ? String(nilai) : '');
  const tombol =
    'grid w-7 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id} className="w-20 shrink-0">{label}</Label>
      <div className="flex h-6 min-w-0 flex-1 items-stretch overflow-hidden rounded-md border bg-transparent focus-within:ring-2 focus-within:ring-ring/40">
        <button
          type="button"
          id={`${id}_kurang`}
          aria-label={`${label} kurang`}
          title={`${label} −1`}
          disabled={basis <= min}
          onClick={() => langkah(-1)}
          className={tombol}
        >
          <Minus size={12} />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={tampil}
          placeholder={bawaan != null ? String(bawaan) : 'bawaan'}
          title={bawaan != null ? `Nilai bawaan: ${bawaan} px` : 'Nilai bawaan tidak terukur'}
          aria-label={label}
          className="h-full w-full min-w-0 border-x bg-transparent px-2 text-center text-xs outline-none placeholder:text-muted-foreground"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft ?? tampil)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <button
          type="button"
          id={`${id}_tambah`}
          aria-label={`${label} tambah`}
          title={`${label} +1`}
          disabled={basis >= max}
          onClick={() => langkah(1)}
          className={tombol}
        >
          <Plus size={12} />
        </button>
      </div>
      <span className="w-4 shrink-0 text-xs text-muted-foreground">px</span>
    </div>
  );
}

/** Editor gaya atomik per bagian UI + pratinjau.
 *  Tipografi & kotak berlaku kedua mode; warna dipisah terang/gelap. */
export default function PartStyleEditor() {
  const { parts, theme, setGayaBagian, setWarnaBagian, resetBagian, resetBagianBanyak, resetSemuaBagian } = useTheme();
  const picker = usePicker();
  const [aktif, setAktif] = useState<PartId>('ribbon');
  const [cari, setCari] = useState('');
  const [tampilBelum, setTampilBelum] = useState(true);
  /** Konfirmasi Reset semua. */
  const [konfirmReset, setKonfirmReset] = useState(false);
  /** Info selektor target: teks selektor + jumlah elemen nyata (di luar pratinjau). */
  const [infoSel, setInfoSel] = useState<{ sel: string; jumlah: number }>({ sel: '', jumlah: 0 });
  /** Selektor bagian yang cocok di pratinjau (null = pakai pembungkus). */
  const [selPratinjau, setSelPratinjau] = useState<string | null>(null);
  const [tertutup, setTertutup] = useState<Record<string, boolean>>({});
  const [bawaan, setBawaan] = useState<Bawaan>({});
  /** Warna "bawaan" terukur per mode (untuk placeholder WarnaField). */
  const [bawaanWarna, setBawaanWarna] = useState<Record<PartMode, PartWarna>>({ terang: {}, gelap: {} });
  const refTerang = useRef<HTMLDivElement | null>(null);
  const refGelap = useRef<HTMLDivElement | null>(null);
  /** Tablet & desktop (md+): 2 kolom dengan pemisah yang bisa digeser.
   *  Desktop (lg+) memakai batas rasio; tablet memakai batas px agar tidak sempit. */
  const pakaiPanel = useMediaQuery('(min-width: 768px)');
  const lebarLg = useMediaQuery('(min-width: 1024px)');
  const ukuranAccordion = lebarLg
    ? { defaultSize: '20%', minSize: '14%', maxSize: '28%' }
    : { defaultSize: '260px', minSize: '200px', maxSize: '300px' };
  const layoutH = useDefaultLayout({ id: 'simpes_bagian_ui_h', onlySaveAfterUserInteractions: true });
  const layoutV = useDefaultLayout({ id: 'simpes_bagian_ui_v', onlySaveAfterUserInteractions: true });
  const meta = PARTS.find((p) => p.id === aktif) ?? PARTS[0];
  const g = parts.gaya[aktif] ?? TANPA_GAYA;
  const wTerang = parts.terang[aktif] ?? TANPA_WARNA;
  const wGelap = parts.gelap[aktif] ?? TANPA_WARNA;
  const alihGrup = (nama: string) => setTertutup((prev) => ({ ...prev, [nama]: !prev[nama] }));
  const diatur = (id: PartId) => !!(parts.gaya[id] || parts.terang[id] || parts.gelap[id]);
  // Bagian hasil "pilih komponen" → jadikan bagian aktif lalu bersihkan.
  useEffect(() => {
    if (picker.hasil) {
      setAktif(picker.hasil);
      picker.konsumsi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker.hasil]);
  /** Hapus semua pengaturan dalam satu grup (termasuk sub-komponennya). */
  const resetGrup = (nama: string) => {
    resetBagianBanyak(PARTS.filter((p) => p.grup === nama).map((p) => p.id));
  };

  // Ukur nilai nyata elemen pratinjau → ditampilkan sebagai nilai "bawaan".
  useLayoutEffect(() => {
    const elT = refTerang.current;
    const elG = refGelap.current;
    if (!elT || !elG) return;
    const m = PART_BY_ID.get(aktif);
    // Tentukan titik ukur/pratinjau: sub-komponen selalu pakai slot-nya;
    // bagian biasa pakai slot bila ada di markup pratinjau (agar gaya kotak
    // seperti tinggi/bayangan kena elemen yang sama seperti di aplikasi).
    const sel = m ? (m.induk ? m.sel : (elT.querySelector(m.sel) ? m.sel : null)) : null;
    setSelPratinjau(sel);
    const selUkur = m?.ukurSel ?? sel ?? undefined;
    const targetDari = (root: HTMLElement) =>
      (selUkur ? root.querySelector<HTMLElement>(selUkur) : root.querySelector<HTMLElement>('[class*="text-"]')) ?? root;
    // Tipografi & kotak (sama untuk kedua mode) diukur dari kanvas terang.
    const t = targetDari(elT);
    const s = selUkur ? t : elT;
    const cs = getComputedStyle(s);
    const ct = getComputedStyle(t);
    setBawaan({
      font: ct.fontFamily,
      size: px(ct.fontSize),
      borderW: px(cs.borderTopWidth),
      radius: px(cs.borderTopLeftRadius),
      padX: px(cs.paddingLeft),
      padY: px(cs.paddingTop),
      height: px(cs.height),
      minWidth: px(cs.minWidth),
      gap: px(cs.gap),
      margin: px(cs.marginTop),
      opacity: Number.isFinite(parseFloat(cs.opacity)) ? Math.round(parseFloat(cs.opacity) * 100) : undefined,
      shadow: cs.boxShadow === 'none' ? 'none' : undefined,
    });
    // Warna diukur dari kanvas masing-masing mode.
    const warnaDari = (root: HTMLElement): PartWarna => {
      const tt = targetDari(root);
      const ss = selUkur ? tt : root;
      const c = getComputedStyle(ss);
      const cd = getComputedStyle(tt);
      return {
        bg: warnaSolid(c.backgroundColor) ?? warnaSolid(cd.backgroundColor),
        fg: warnaSolid(cd.color),
        border: warnaSolid(c.borderTopColor),
      };
    };
    setBawaanWarna({ terang: warnaDari(elT), gelap: warnaDari(elG) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif, parts, theme, g, wTerang, wGelap]);

  // Info selektor target: jumlah elemen nyata yang cocok (di luar pratinjau).
  useLayoutEffect(() => {
    const m = PARTS.find((p) => p.id === aktif);
    if (!m) return;
    let jumlah = 0;
    try {
      for (const node of document.querySelectorAll(m.sel)) {
        if (!node.closest('#pratinjau_bagian')) jumlah += 1;
      }
    } catch {
      jumlah = 0;
    }
    setInfoSel({ sel: m.sel, jumlah });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif, parts]);

  const grupTampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const cocokAwal = q
      ? PARTS.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            p.hint.toLowerCase().includes(q) ||
            p.grup.toLowerCase().includes(q) ||
            (p.sub ?? '').toLowerCase().includes(q),
        )
      : PARTS;
    const cocokIds = new Set(cocokAwal.map((p) => p.id));
    // Sertakan induk bila salah satu anaknya cocok, agar anak tetap tampil.
    for (const p of PARTS) {
      if (p.induk && cocokIds.has(p.id)) cocokIds.add(p.induk);
    }
    const cocok = PARTS.filter(
      (p) => cocokIds.has(p.id) && (tampilBelum || !p.belumDipakai),
    );
    return PART_GROUPS.map((nama) => {
      const items = cocok.filter((p) => p.grup === nama && !p.induk);
      const subs: { nama: string; items: typeof items; diatur: number }[] = [];
      for (const p of items) {
        const namaSub = p.sub ?? 'Umum';
        let s = subs.find((x) => x.nama === namaSub);
        if (!s) {
          s = { nama: namaSub, items: [], diatur: 0 };
          subs.push(s);
        }
        s.items.push(p);
        const keluarga = [p, ...PARTS.filter((c) => c.induk === p.id)];
        if (keluarga.some((x) => diatur(x.id))) s.diatur += 1;
      }
      return {
        nama,
        subs,
        berlapis: subs.length > 1,
        diatur: subs.reduce((n, s) => n + s.diatur, 0),
      };
    }).filter((g) => g.subs.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cari, parts, tampilBelum]);

  const mencari = cari.trim() !== '';
  const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const jumlahDiatur = useMemo(() => {
    const ids = new Set<string>([
      ...Object.keys(parts.gaya),
      ...Object.keys(parts.terang),
      ...Object.keys(parts.gelap),
    ]);
    return ids.size;
  }, [parts]);
  /** Wajah tema untuk kanvas pratinjau (per mode, keduanya ditampilkan). */
  const wajah = (modeGelap: boolean) =>
    ({
      ...variabelWajah(theme, modeGelap),
      ...variabelBagian(aktif, g, modeGelap ? wGelap : wTerang),
    }) as unknown as CSSProperties;

  /** Seksi warna satu mode (keduanya ditampilkan berdampingan). */
  const seksiWarna = (pm: PartMode, judul: string) => {
    const w = pm === 'gelap' ? wGelap : wTerang;
    const bw = bawaanWarna[pm];
    return (
      <FieldSet className="gap-2 rounded-lg border p-3">
        <FieldLegend variant="label" className="mb-0">{judul}</FieldLegend>
        <WarnaField
          id={`warna_bg_${pm}`}
          label="Latar"
          nilai={w.bg}
          bawaan={bw.bg}
          onChange={(v) => setWarnaBagian(pm, aktif, { bg: v })}
        />
        <WarnaField
          id={`warna_fg_${pm}`}
          label="Teks"
          nilai={w.fg}
          bawaan={bw.fg}
          onChange={(v) => setWarnaBagian(pm, aktif, { fg: v })}
        />
        <WarnaField
          id={`warna_border_${pm}`}
          label="Border"
          nilai={w.border}
          bawaan={bw.border}
          onChange={(v) => setWarnaBagian(pm, aktif, { border: v })}
        />
      </FieldSet>
    );
  };

  const fontGroups = useMemo(
    () =>
      FONT_GROUPS.map((grp) => ({
        ...grp,
        items: grp.items.map((f) =>
          f.value === FONT_FAMILY_DEFAULT && bawaan.font
            ? { ...f, label: `Bawaan — ${keluargaUtama(bawaan.font)}` }
            : f,
        ),
      })),
    [bawaan.font],
  );

  /** Tombol satu bagian (dipakai di dalam sub-kelompok). */
  const tombolBagian = (p: (typeof PARTS)[number]) => (
    <button
      key={p.id}
      id={`btn_bagian_${p.id}`}
      type="button"
      title={p.hint}
      data-part="daftar_bagian"
      onClick={() => setAktif(p.id)}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
        p.id === aktif ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-muted',
        p.belumDipakai && p.id !== aktif && 'text-muted-foreground',
      )}
    >
      <span className="flex-1 truncate">{p.label}</span>
      {p.belumDipakai && (
        <span
          className="shrink-0 rounded-sm border px-1 text-[9px] leading-4 text-muted-foreground"
          title="Belum dipakai di aplikasi — pengaturan hanya tampak di pratinjau"
        >
          belum
        </span>
      )}
      {diatur(p.id) && (
        <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Ada pengaturan" />
      )}
    </button>
  );

  /** Baris satu bagian; bila punya sub-komponen, tampilkan anak bersarang. */
  const barisBagian = (p: (typeof PARTS)[number]) => {
    const anak = PARTS.filter((c) => c.induk === p.id);
    if (anak.length === 0) return tombolBagian(p);
    const kunci = `anak:${p.id}`;
    const buka = mencari || !tertutup[kunci];
    return (
      <div key={p.id} className="flex flex-col gap-0.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            id={`btn_sub_bagian_${p.id}`}
            aria-expanded={buka}
            title={tertutup[kunci] ? `Buka sub ${p.label}` : `Tutup sub ${p.label}`}
            onClick={() => alihGrup(kunci)}
            className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground/80 hover:bg-muted"
          >
            <ChevronDown size={11} className={cn('transition-transform', !buka && '-rotate-90')} />
          </button>
          {tombolBagian(p)}
        </div>
        {buka && anak.length > 0 && (
          <div className="flex flex-col gap-0.5 pl-4">{anak.map(tombolBagian)}</div>
        )}
      </div>
    );
  };

  /** Isi daftar bagian (dipakai di panel resizable & tumpukan mobile). */
  const daftarBagian = (
    <>
          <div className="relative md:sticky md:top-0 md:z-10 md:bg-card">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="input_cari_bagian"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari bagian…"
              aria-label="Cari bagian"
              className="pl-7"
            />
          </div>
          <div className="flex items-center gap-1.5 px-1 py-1">
            <Checkbox
              id="cek_tampil_belum"
              checked={tampilBelum}
              onCheckedChange={(v) => setTampilBelum(v === true)}
            />
            <Label htmlFor="cek_tampil_belum" className="text-xs font-normal text-muted-foreground">
              Tampilkan yang belum dipakai
            </Label>
          </div>
          <Button
            id="btn_pilih_komponen"
            type="button"
            variant={picker.aktif ? 'default' : 'outline'}
            size="sm"
            className="w-full"
            data-picker-abaikan
            onClick={() => (picker.aktif ? picker.batal() : picker.mulai())}
            title="Klik komponen mana pun di halaman ini untuk membuka pengaturannya"
          >
            <SquareMousePointer size={14} /> {picker.aktif ? 'Batal pilih (Esc)' : 'Pilih komponen'}
          </Button>
          {picker.aktif && (
            <p className="rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
              Klik komponen mana pun untuk membukanya. Esc untuk batal.
            </p>
          )}
          {grupTampil.map((gr) => {
            const kunciGrup = `grup:${gr.nama}`;
            const bukaGrup = mencari || !tertutup[kunciGrup];
            return (
              <div key={gr.nama}>
                <div className="flex items-center gap-0.5">
                  <button
                    id={`btn_grup_${slug(gr.nama)}`}
                    type="button"
                    aria-expanded={bukaGrup}
                    title={tertutup[kunciGrup] ? `Buka grup ${gr.nama}` : `Tutup grup ${gr.nama}`}
                    onClick={() => alihGrup(kunciGrup)}
                    className="flex w-full items-center gap-1 rounded px-1 py-1 text-left hover:bg-muted"
                  >
                    <ChevronDown
                      size={12}
                      className={cn('shrink-0 text-muted-foreground transition-transform', !bukaGrup && '-rotate-90')}
                    />
                    <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {gr.nama}
                    </span>
                    {gr.diatur > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none">
                        {gr.diatur}
                      </Badge>
                    )}
                  </button>
                  <button
                    type="button"
                    id={`btn_reset_grup_${slug(gr.nama)}`}
                    title={`Reset grup ${gr.nama}`}
                    aria-label={`Reset grup ${gr.nama}`}
                    disabled={gr.diatur === 0}
                    onClick={() => resetGrup(gr.nama)}
                    className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
                  >
                    <RotateCcw size={11} />
                  </button>
                </div>
                {bukaGrup && (
                  <div className="flex flex-col gap-1 pl-2">
                    {gr.subs.map((sb) => {
                      if (!gr.berlapis) {
                        return (
                          <div key={sb.nama} className="flex flex-col gap-0.5">
                            {sb.items.map(barisBagian)}
                          </div>
                        );
                      }
                      const kunciSub = `sub:${gr.nama}|${sb.nama}`;
                      const bukaSub = mencari || !tertutup[kunciSub];
                      return (
                        <div key={sb.nama}>
                          <button
                            id={`btn_sub_${slug(gr.nama)}_${slug(sb.nama)}`}
                            type="button"
                            aria-expanded={bukaSub}
                            title={tertutup[kunciSub] ? `Buka sub ${sb.nama}` : `Tutup sub ${sb.nama}`}
                            onClick={() => alihGrup(kunciSub)}
                            className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted"
                          >
                            <ChevronDown
                              size={11}
                              className={cn(
                                'shrink-0 text-muted-foreground/80 transition-transform',
                                !bukaSub && '-rotate-90',
                              )}
                            />
                            <span className="flex-1 text-[11px] font-medium text-muted-foreground">
                              {sb.nama}
                            </span>
                            {sb.diatur > 0 && (
                              <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none">
                                {sb.diatur}
                              </Badge>
                            )}
                          </button>
                          {bukaSub && (
                            <div className="flex flex-col gap-0.5 pl-3">{sb.items.map(barisBagian)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {grupTampil.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">Tidak ada bagian yang cocok.</p>
          )}
    </>
  );

  const kartuPratinjau = (
    <div className="flex flex-col rounded-xl border bg-card p-4 md:h-full md:min-h-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Pratinjau</span>
        <Button
          id="btn_reset_semua_bagian"
          type="button"
          variant="outline"
          size="sm"
          disabled={jumlahDiatur === 0}
          onClick={() => setKonfirmReset(true)}
          title="Reset semua"
          aria-label="Reset semua"
        >
          <RotateCcw size={14} />
        </Button>
      </div>
      <div id="pratinjau_bagian" className="grid gap-3 md:flex-1 md:grid-cols-2">
        <style>{bangunCssPratinjau(aktif, g, wTerang, selPratinjau, '#pratinjau_terang')}</style>
        <style>{bangunCssPratinjau(aktif, g, wGelap, selPratinjau, '#pratinjau_gelap')}</style>
        {[false, true].map((modeGelap) => (
          <div key={modeGelap ? 'gelap' : 'terang'} className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {modeGelap ? 'Gelap' : 'Terang'}
            </span>
            <div
              id={modeGelap ? 'pratinjau_gelap' : 'pratinjau_terang'}
              className={cn(
                'grid min-h-[100px] flex-1 place-items-center overflow-hidden rounded-lg border p-3',
                modeGelap && 'dark',
              )}
              style={{ ...wajah(modeGelap), background: 'var(--background)', color: 'var(--foreground)' }}
            >
              <div ref={modeGelap ? refGelap : refTerang} className="contents">
                {cloneElement(contohBagian(aktif), { 'data-pratinjau-part': '' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const kartuKontrol = (
    <div className="flex flex-col rounded-xl border bg-card p-4 md:h-full md:min-h-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {meta.label}
                  {meta.belumDipakai && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                      Belum dipakai di aplikasi
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{meta.hint}</div>
                <div className="mt-1 flex min-w-0 items-center gap-1.5" title={`Selektor: ${infoSel.sel}`}>
                  <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {infoSel.sel}
                  </code>
                  <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px] font-normal">
                    {infoSel.jumlah} elemen
                  </Badge>
                </div>
              </div>
              <Button
                id={`btn_reset_bagian_${meta.id}`}
                type="button"
                variant="outline"
                size="sm"
                disabled={!diatur(meta.id)}
                onClick={() => resetBagian(meta.id)}
              >
                <RotateCcw size={14} /> Reset bagian
              </Button>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2 2xl:grid-cols-3 md:min-h-0 md:flex-1 md:overflow-y-auto">
              <FieldSet className="gap-2 rounded-lg border p-3">
                <FieldLegend variant="label" className="mb-0">Tipografi</FieldLegend>
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="select_font_bagian" className="w-20 shrink-0">Font</Label>
                  <Select
                    value={g.font ?? FONT_FAMILY_DEFAULT}
                    onValueChange={(v) => setGayaBagian(aktif, { font: v === FONT_FAMILY_DEFAULT ? undefined : v })}
                  >
                    <SelectTrigger id="select_font_bagian" title="Font bagian" className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {fontGroups.map((grp) => (
                        <SelectGroup key={grp.id}>
                          <SelectLabel>{grp.label}</SelectLabel>
                          {grp.items.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <AngkaField
                  id="input_size_bagian"
                  label="Ukuran font"
                  nilai={g.size}
                  bawaan={bawaan.size}
                  min={RENTANG.size[0]}
                  max={RENTANG.size[1]}
                  onChange={(v) => setGayaBagian(aktif, { size: v })}
                />
                <FieldDescription>Berlaku untuk mode terang & gelap.</FieldDescription>
              </FieldSet>

              {seksiWarna('terang', 'Warna — Terang')}
              {seksiWarna('gelap', 'Warna — Gelap')}

              <FieldSet className="gap-2 rounded-lg border p-3 md:col-span-2 2xl:col-span-1">
                <FieldLegend variant="label" className="mb-0">Kotak</FieldLegend>
                <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                <AngkaField
                  id="input_borderw_bagian"
                  label="Tebal border"
                  nilai={g.borderW}
                  bawaan={bawaan.borderW}
                  min={RENTANG.borderW[0]}
                  max={RENTANG.borderW[1]}
                  onChange={(v) => setGayaBagian(aktif, { borderW: v })}
                />
                <AngkaField
                  id="input_radius_bagian"
                  label="Radius"
                  nilai={g.radius}
                  bawaan={bawaan.radius}
                  min={RENTANG.radius[0]}
                  max={RENTANG.radius[1]}
                  onChange={(v) => setGayaBagian(aktif, { radius: v })}
                />
                <AngkaField
                  id="input_padx_bagian"
                  label="Padding X"
                  nilai={g.padX}
                  bawaan={bawaan.padX}
                  min={RENTANG.padX[0]}
                  max={RENTANG.padX[1]}
                  onChange={(v) => setGayaBagian(aktif, { padX: v })}
                />
                <AngkaField
                  id="input_pady_bagian"
                  label="Padding Y"
                  nilai={g.padY}
                  bawaan={bawaan.padY}
                  min={RENTANG.padY[0]}
                  max={RENTANG.padY[1]}
                  onChange={(v) => setGayaBagian(aktif, { padY: v })}
                />
                <AngkaField
                  id="input_height_bagian"
                  label="Tinggi"
                  nilai={g.height}
                  bawaan={bawaan.height}
                  min={RENTANG.height[0]}
                  max={RENTANG.height[1]}
                  onChange={(v) => setGayaBagian(aktif, { height: v })}
                />
                <AngkaField
                  id="input_minwidth_bagian"
                  label="Lebar min"
                  nilai={g.minWidth}
                  bawaan={bawaan.minWidth}
                  min={RENTANG.minWidth[0]}
                  max={RENTANG.minWidth[1]}
                  onChange={(v) => setGayaBagian(aktif, { minWidth: v })}
                />
                <AngkaField
                  id="input_gap_bagian"
                  label="Jarak"
                  nilai={g.gap}
                  bawaan={bawaan.gap}
                  min={RENTANG.gap[0]}
                  max={RENTANG.gap[1]}
                  onChange={(v) => setGayaBagian(aktif, { gap: v })}
                />
                <AngkaField
                  id="input_margin_bagian"
                  label="Margin"
                  nilai={g.margin}
                  bawaan={bawaan.margin}
                  min={RENTANG.margin[0]}
                  max={RENTANG.margin[1]}
                  onChange={(v) => setGayaBagian(aktif, { margin: v })}
                />
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="select_bayangan_bagian" className="w-20 shrink-0">Bayangan</Label>
                  <Select
                    value={g.shadow ?? '_bawaan'}
                    onValueChange={(v) =>
                      setGayaBagian(aktif, { shadow: v === '_bawaan' ? undefined : (v as BayanganName) })
                    }
                  >
                    <SelectTrigger id="select_bayangan_bagian" title="Bayangan" className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_bawaan">Bawaan</SelectItem>
                      {BAYANGAN.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <AngkaField
                  id="input_opacity_bagian"
                  label="Opacity"
                  nilai={g.opacity}
                  bawaan={bawaan.opacity}
                  min={RENTANG.opacity[0]}
                  max={RENTANG.opacity[1]}
                  onChange={(v) => setGayaBagian(aktif, { opacity: v })}
                />
                <FieldDescription className="sm:col-span-2 2xl:col-span-1">
                  Berlaku untuk mode terang & gelap. Kosong = bawaan komponen.
                </FieldDescription>
                </div>
              </FieldSet>
            </div>
    </div>
  );

  return (
    <>
    <section className={cn('flex w-full max-w-none flex-col gap-4', pakaiPanel && 'min-h-0 flex-1')}>
      {pakaiPanel ? (
        <div className="min-h-[360px] flex-1">
          <ResizablePanelGroup
            orientation="horizontal"
            id="simpes_bagian_ui_h"
            defaultLayout={layoutH.defaultLayout}
            onLayoutChanged={layoutH.onLayoutChanged}
          >
            <ResizablePanel id="accordion" {...ukuranAccordion}>
              <aside className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto rounded-xl border bg-card p-3">
                {daftarBagian}
              </aside>
            </ResizablePanel>
            <ResizableHandle withHandle orientation="horizontal" />
            <ResizablePanel id="kanan" minSize="40%">
              <ResizablePanelGroup
                orientation="vertical"
                id="simpes_bagian_ui_v"
                defaultLayout={layoutV.defaultLayout}
                onLayoutChanged={layoutV.onLayoutChanged}
              >
                <ResizablePanel id="pratinjau" defaultSize="38%" minSize="14%" maxSize="70%">
                  <div className="h-full min-h-0">{kartuPratinjau}</div>
                </ResizablePanel>
                <ResizableHandle withHandle orientation="vertical" />
                <ResizablePanel id="kontrol" minSize="22%">
                  <div className="h-full min-h-0">{kartuKontrol}</div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <aside className="flex flex-col gap-2 rounded-xl border bg-card p-3">{daftarBagian}</aside>
          {kartuPratinjau}
          {kartuKontrol}
        </div>
      )}
    </section>
      <AlertDialog open={konfirmReset} onOpenChange={setKonfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset semua pengaturan bagian?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh pengaturan gaya & warna pada {jumlahDiatur} bagian akan dihapus
              dan kembali ke bawaan. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction id="btn_reset_semua_konfirmasi" onClick={resetSemuaBagian}>
              Reset semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
