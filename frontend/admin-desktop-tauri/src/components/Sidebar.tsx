import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_GRUP, halamanPerGrup } from '@/lib/halaman';
import { useTheme } from '@/theme';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from '@/icons';

const itemBase =
  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-foreground)]/60';

/** Navigasi utama aplikasi: rail kiri berisi tautan halaman per kategori.
 *  Bisa dilipat ke rail ikon (tombol atau Ctrl/Cmd+B); status di pref
 *  `simpes_sidebar`. Tautan halaman terpisah dari tools di ribbon. */
export default function Sidebar() {
  const { collapsed, setCollapsed } = useTheme();

  // Ctrl/Cmd+B: lipat/buka sidebar (ala editor kode).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapsed, setCollapsed]);

  return (
    <aside
      data-slot="sidebar"
      aria-label="Navigasi utama"
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-r border-white/10 text-white transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-60',
      )}
      style={{ background: 'linear-gradient(180deg, var(--sidebar-deep), var(--sidebar))' }}
    >
      <div className={cn('flex items-center py-3', collapsed ? 'justify-center px-1' : 'gap-2 px-3')}>
        {/* Brand disembunyikan saat dilipat (rail hanya menampilkan tombol). */}
        {!collapsed && (
          <span
            className="truncate text-sm font-semibold tracking-wide"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            SIMPES
          </span>
        )}
        <button
          id="btn_lipat_sidebar"
          type="button"
          title={collapsed ? 'Buka navigasi (Ctrl/Cmd+B)' : 'Lipat navigasi (Ctrl/Cmd+B)'}
          aria-label={collapsed ? 'Buka navigasi' : 'Lipat navigasi'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white',
            !collapsed && 'ml-auto',
          )}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3">
        {NAV_GRUP.map((g) => {
          const items = halamanPerGrup(g.id);
          if (items.length === 0) return null;
          return (
            <div key={g.id} className="mb-1.5">
              {!collapsed && (
                <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-white/45 uppercase">
                  {g.label}
                </div>
              )}
              {items.map((h) => {
                const Icon = h.icon;
                return (
                  <NavLink
                    key={h.to}
                    to={h.to}
                    end={h.to === '/'}
                    title={collapsed ? h.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        itemBase,
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-white/20 font-semibold text-white'
                          : 'text-white/75 hover:bg-white/10 hover:text-white',
                      )
                    }
                  >
                    <Icon size={16} />
                    {!collapsed && <span className="truncate">{h.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
