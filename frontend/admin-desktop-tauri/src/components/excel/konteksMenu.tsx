import type { MutableRefObject, ReactElement } from 'react';
import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import type { PresetKolomApi } from '@/components/PresetKolom';
import type { AlignName } from '@/components/GridPrefs';
import { cn } from '@/lib/utils';
import { AlignCenter, AlignLeft, AlignRight, Copy, MoveHorizontal, RotateCcw } from '@/icons';
import { flattenAksi, metaAksi } from './actions';
import type { AksiMenu } from './types';

export interface KonteksHeader {
  colKey: string;
}

export interface KonteksRow {
  rowId: string | number;
  rowLabel: string;
  colKey: string | null;
}

export interface MenuKonteksGridProps {
  tableKey: string;
  header: KonteksHeader | null;
  headerLabel: string;
  headerIdx: number;
  row: KonteksRow | null;
  rowAksi: ReactElement[];
  freezeAktif: number;
  ubahFreeze: (n: number) => void;
  onAutoFit: (key: string) => void;
  onAutoFitAll: () => void;
  align: Record<string, AlignName>;
  setAlign: (key: string, a: AlignName) => void;
  presetApiRef: MutableRefObject<PresetKolomApi | null>;
  salinBaris: (id: string | number) => void;
  salinSel: (id: string | number, key: string) => void;
  onKonfirmasi: (konfirmasi: AksiMenu['konfirmasi']) => void;
}

/** Isi menu klik-kanan grid: area header (AutoFit, beku, perataan, tampil di
 *  preset) dan area baris (aksi halaman + salin TSV). */
export default function MenuKonteksGrid({
  tableKey,
  header,
  headerLabel,
  headerIdx,
  row,
  rowAksi,
  freezeAktif,
  ubahFreeze,
  onAutoFit,
  onAutoFitAll,
  align,
  setAlign,
  presetApiRef,
  salinBaris,
  salinSel,
  onKonfirmasi,
}: MenuKonteksGridProps) {
  return (
    <ContextMenuContent>
      {/* Area header kolom: perataan + show/hide di preset. */}
      {header && (
        <>
          <ContextMenuLabel>Kolom: {headerLabel}</ContextMenuLabel>
          <ContextMenuItem id={`btn_ctx_autofit_kolom_${tableKey}`} onSelect={() => onAutoFit(header.colKey)}>
            <MoveHorizontal size={14} />
            <span>Sesuaikan lebar kolom ini</span>
          </ContextMenuItem>
          <ContextMenuItem id={`btn_ctx_autofit_semua_${tableKey}`} onSelect={() => onAutoFitAll()}>
            <MoveHorizontal size={14} />
            <span>Sesuaikan lebar semua kolom</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            id={`btn_ctx_bekukan_${tableKey}`}
            disabled={headerIdx < 0 || freezeAktif >= headerIdx + 1}
            onSelect={() => headerIdx >= 0 && ubahFreeze(headerIdx + 1)}
          >
            <MoveHorizontal size={14} />
            <span>Bekukan sampai kolom ini</span>
          </ContextMenuItem>
          {freezeAktif > 0 && (
            <ContextMenuItem id={`btn_ctx_lepas_bekukan_${tableKey}`} onSelect={() => ubahFreeze(0)}>
              <RotateCcw size={14} />
              <span>Lepas semua kolom beku</span>
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <div className="flex items-center gap-1 px-2 py-1">
            <span className="mr-auto text-xs text-muted-foreground">Perataan</span>
            {([
              { nilai: 'left' as const, label: 'Kiri', Icon: AlignLeft },
              { nilai: 'center' as const, label: 'Tengah', Icon: AlignCenter },
              { nilai: 'right' as const, label: 'Kanan', Icon: AlignRight },
            ]).map(({ nilai, label, Icon }) => {
              const aktif = (align[header.colKey] ?? 'center') === nilai;
              return (
                <button
                  key={nilai}
                  type="button"
                  id={`btn_ctx_align_${nilai}_${tableKey}`}
                  title={`Rata ${label.toLowerCase()} (berlaku semua tabel)`}
                  aria-label={`Rata ${label.toLowerCase()}`}
                  aria-pressed={aktif}
                  onClick={() => setAlign(header.colKey, nilai)}
                  className={cn(
                    'grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                    aktif && 'bg-accent text-foreground',
                  )}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
          <ContextMenuSeparator />
          <ContextMenuLabel>Tampilkan di preset</ContextMenuLabel>
          {(presetApiRef.current?.presets.length ?? 0) === 0 ? (
            <ContextMenuItem disabled>Belum ada preset</ContextMenuItem>
          ) : presetApiRef.current?.presets.map((p) => (
            <ContextMenuCheckboxItem
              key={p.id}
              checked={p.kolom.includes(header.colKey)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(c) =>
                void presetApiRef.current?.toggleKolom(p.id, header.colKey, !!c)
              }
            >
              {p.lembaga_id === null
                ? p.nama
                : `${p.nama} (${p.lembaga?.kode ?? p.lembaga?.nama ?? p.lembaga_id})`}
            </ContextMenuCheckboxItem>
          ))}
        </>
      )}

      {/* Area baris data: aksi halaman + salin. */}
      {row && (
        <>
          <ContextMenuLabel>{row.rowLabel}</ContextMenuLabel>
          {rowAksi.map((el, i) => {
            const m = metaAksi(el);
            return (
              <ContextMenuItem
                key={el.key ?? i}
                onSelect={() => {
                  if (m.konfirmasi) onKonfirmasi(m.konfirmasi);
                  else m.onClick?.();
                }}
              >
                {m.icon}
                <span>{m.label}</span>
              </ContextMenuItem>
            );
          })}
          {rowAksi.length > 0 && <ContextMenuSeparator />}
          <ContextMenuItem onSelect={() => salinBaris(row.rowId)}>
            <Copy size={16} />
            <span>Salin baris (TSV)</span>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!row.colKey}
            onSelect={() => {
              if (row.colKey) salinSel(row.rowId, row.colKey);
            }}
          >
            <Copy size={16} />
            <span>Salin nilai sel</span>
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
