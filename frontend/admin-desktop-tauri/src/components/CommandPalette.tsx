import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  NAV_GRUP,
  blokGrup,
  halamanSubgrup,
  izinHalaman,
  type HalamanDef,
  type TabKategori,
} from '@/lib/halaman';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { useLembagaAktif } from '@/lembagaAktif';
import { useTheme, type ThemeName } from '@/theme';
import { THEME_PRESETS } from '@/themes';
import { ICON_SETS } from '@/iconSets';
import { WARNA_UI, RADIUS_MIN, RADIUS_MAX, type DensityName } from '@/prefs';
import { cn } from '@/lib/utils';
import {
  Search, Palette, Paintbrush, Blend, Monitor, DensityMedium, Minus, Plus,
} from '@/icons';

/** Izin khusus super_admin yang disembunyikan saat bertindak sebagai lembaga. */
const TERKUNCI = new Set(['izin.lihat', 'server.lihat']);

type Command = {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  icon?: ReactNode;
  run: () => void;
};

/** Palet perintah global (Ctrl/Cmd+K): lompat ke halaman berizin dan jalankan
 *  perintah tampilan dengan cepat. Mandiri — memasang pintasan global sendiri
 *  dan hanya menampilkan <Dialog> saat terbuka. */
export default function CommandPalette() {
  const { user } = useAuth();
  const { bertindak } = useLembagaAktif();
  const navigate = useNavigate();
  const {
    setTheme, setIconSet, setWarnaUI, setNavigasi, setDensity, setRadius, radius,
  } = useTheme();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Pintasan global Ctrl/Cmd+K — togol buka/tutup.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const boleh = (h: HalamanDef) =>
      izinHalaman(h).some((izin) => bisa(user, izin) && !(bertindak && TERKUNCI.has(izin)));

    const nav: Command[] = [];
    const seen = new Set<string>();
    const pushHalaman = (h: HalamanDef) => {
      if (seen.has(h.to)) return;
      seen.add(h.to);
      const Icon = h.icon;
      nav.push({
        id: `nav:${h.to}`,
        label: h.label,
        group: 'Halaman',
        icon: Icon ? <Icon size={16} /> : undefined,
        run: () => navigate(h.to),
      });
    };
    for (const g of NAV_GRUP) {
      for (const b of blokGrup(g.id as TabKategori)) {
        if (Array.isArray(b)) {
          b.filter(boleh).forEach(pushHalaman);
        } else {
          halamanSubgrup(g.id as TabKategori, b.id).filter(boleh).forEach(pushHalaman);
          for (const anak of b.anak ?? []) {
            halamanSubgrup(g.id as TabKategori, anak.id).filter(boleh).forEach(pushHalaman);
          }
        }
      }
    }

    const tampilan: Command[] = [
      ...THEME_PRESETS.map((t) => ({
        id: `tema:${t.id}`,
        label: `Tema: ${t.nama}`,
        group: 'Tampilan',
        keywords: 'theme warna',
        icon: <Palette size={16} />,
        run: () => setTheme(t.id as ThemeName),
      })),
      ...ICON_SETS.map((s) => ({
        id: `ikon:${s.id}`,
        label: `Set ikon: ${s.nama}`,
        group: 'Tampilan',
        keywords: 'icon',
        icon: <Paintbrush size={16} />,
        run: () => setIconSet(s.id),
      })),
      ...WARNA_UI.map((w) => ({
        id: `warna:${w}`,
        label: `Kaya warna: ${w}`,
        group: 'Tampilan',
        keywords: 'warna ui',
        icon: <Blend size={16} />,
        run: () => setWarnaUI(w),
      })),
      {
        id: 'navigasi:sidebar',
        label: 'Navigasi: Sidebar',
        group: 'Tampilan',
        keywords: 'sidebar',
        icon: <Monitor size={16} />,
        run: () => setNavigasi('sidebar'),
      },
      {
        id: 'navigasi:menubar',
        label: 'Navigasi: Menubar',
        group: 'Tampilan',
        keywords: 'menubar',
        icon: <Monitor size={16} />,
        run: () => setNavigasi('menubar'),
      },
      ...(['ramping', 'sedang', 'nyaman'] as DensityName[]).map((d) => ({
        id: `density:${d}`,
        label: `Kerapatan: ${d}`,
        group: 'Tampilan',
        keywords: 'kerapatan density',
        icon: <DensityMedium size={16} />,
        run: () => setDensity(d),
      })),
    ];
    if (radius > RADIUS_MIN) {
      tampilan.push({
        id: 'radius:-1', label: 'Perkecil sudut', group: 'Tampilan', keywords: 'radius sudut',
        icon: <Minus size={16} />, run: () => setRadius(radius - 1),
      });
    }
    if (radius < RADIUS_MAX) {
      tampilan.push({
        id: 'radius:+1', label: 'Perbesar sudut', group: 'Tampilan', keywords: 'radius sudut',
        icon: <Plus size={16} />, run: () => setRadius(radius + 1),
      });
    }

    return [...nav, ...tampilan];
  }, [user, bertindak, navigate, setTheme, setIconSet, setWarnaUI, setNavigasi, setDensity, setRadius, radius]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => { setActive(0); }, [query]);

  const runAt = useCallback((i: number) => {
    const c = filtered[i];
    if (!c) return;
    c.run();
    setOpen(false);
  }, [filtered]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(active);
    }
  }

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-cmd="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, filtered]);

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return Array.from(map.entries());
  }, [filtered]);

  let flat = -1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed top-[14%] left-[50%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border bg-background shadow-lg outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Palet perintah</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Cari halaman atau jalankan perintah tampilan
          </DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Cari halaman atau perintah…"
              aria-label="Cari perintah"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
              ESC
            </kbd>
          </div>
          <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada hasil</p>
            ) : (
              groups.map(([group, items]) => (
                <div key={group} className="mb-1">
                  <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {group}
                  </div>
                  {items.map((c) => {
                    flat += 1;
                    const idx = flat;
                    const selected = idx === active;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        data-cmd={idx}
                        id={`cmd_${c.id.replace(/[^a-z0-9_]/gi, '_')}`}
                        onMouseMove={() => setActive(idx)}
                        onClick={() => runAt(idx)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none',
                          selected
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground hover:bg-accent/50',
                        )}
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                          {c.icon}
                        </span>
                        <span className="flex-1 truncate">{c.label}</span>
                        {selected && (
                          <span className="text-[10px] text-muted-foreground">↵</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>↑↓ navigasi · ↵ pilih</span>
            <span>⌘K / Ctrl+K</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
