import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { bukaDariMenu } from '@/components/excel/kelolaTabelDariMenu';
import type { AlignKolom } from '@/components/kelolaTabel/jenis';
import { cn } from '@/lib/utils';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns3,
  Copy,
  MoveHorizontal,
  NotebookTabs,
  Pin,
  PinOff,
} from '@/icons';

export interface MenuKonteksV2Props {
  tableKey: string;
  /** Area judul kolom yang diklik kanan. */
  header: { colKey: string } | null;
  headerLabel: string;
  /** Area baris yang diklik kanan. */
  row: { rowId: string | number; rowLabel: string; colKey: string | null } | null;
  /** Klik kanan di sudut kiri-atas: salin seluruh tabel. */
  sudut?: boolean;
  onAutoFit: (key: string) => void;
  onAutoFitAll: () => void;
  /** Jumlah kolom data yang sedang dibekukan; 0 = tak ada. */
  freezeAktif: number;
  /** Indeks kolom header yang diklik kanan di dalam `fields`; -1 = tak dikenal. */
  headerIdx: number;
  /** Ubah jumlah kolom beku (0 = lepas semua). */
  onFreeze: (n: number) => void;
  /** Perataan global per tabel (DB; satu sumber dengan Kelola Tabel). */
  align: Partial<Record<string, AlignKolom>>;
  /** Tulis perataan ke DB. Absen = tombol perataan disembunyikan. */
  onUbahAlign?: (key: string, nilai: AlignKolom) => void;
  /** Buka dialog Kelola Tabel. Absen = item disembunyikan. */
  onKelolaTabel?: () => void;
  salinBaris: (id: string | number) => void;
  salinSel: (id: string | number, key: string) => void;
  salinKolom: (key: string) => void;
  onSalinSemua: () => void;
}

/** Menu klik-kanan V2.
 *
 *  Sengaja terpisah dari MenuKonteksGrid V1: menu V2 hanya memuat fitur yang
 *  benar-benar sudah ada di V2 (AutoFit, kolom beku, salin TSV, perataan,
 *  Kelola Tabel). Tinggi baris dan geser judul belum ada di V2 sehingga tidak
 *  ditampilkan sebagai tombol mati. */
export default function MenuKonteksV2({
  tableKey,
  header,
  headerLabel,
  row,
  sudut,
  onAutoFit,
  onAutoFitAll,
  freezeAktif,
  headerIdx,
  onFreeze,
  align,
  onUbahAlign,
  onKelolaTabel,
  salinBaris,
  salinSel,
  salinKolom,
  onSalinSemua,
}: MenuKonteksV2Props) {
  return (
    <ContextMenuContent>
      {sudut && (
        <>
          <ContextMenuLabel>TABEL</ContextMenuLabel>
          <ContextMenuItem
            id={`menu_ctx_v2_salin_semua_${tableKey}`}
            onSelect={() => onSalinSemua()}
          >
            <Copy size={16} />
            <span>Salin semua (TSV)</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}

      {header && (
        <>
          <ContextMenuLabel>KOLOM: {headerLabel}</ContextMenuLabel>
          <div className="flex items-center gap-1 px-2 pb-1 pt-0.5">
            {onUbahAlign && (
              <>
                {([
                  { nilai: 'left' as const, label: 'Kiri', Icon: AlignLeft },
                  { nilai: 'center' as const, label: 'Tengah', Icon: AlignCenter },
                  { nilai: 'right' as const, label: 'Kanan', Icon: AlignRight },
                ]).map(({ nilai, label, Icon }) => {
                  const aktif = (align[header.colKey] ?? 'center') === nilai;
                  return (
                    <Tooltip key={nilai}>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon"
                          type="button"
                          id={`btn_ctx_v2_align_${nilai}_${tableKey}`}
                          aria-label={`Rata ${label.toLowerCase()}`}
                          aria-pressed={aktif}
                          onClick={() => onUbahAlign(header.colKey, nilai)}
                          className={cn(aktif && 'bg-accent text-foreground')}
                        >
                          <Icon size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{`Rata ${label.toLowerCase()} (berlaku semua tabel)`}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon"
                  type="button"
                  id={`btn_ctx_v2_autofit_kolom_${tableKey}`}
                  aria-label="Sesuaikan lebar kolom ini"
                  onClick={() => onAutoFit(header.colKey)}
                >
                  <MoveHorizontal size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sesuaikan lebar kolom ini</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon"
                  type="button"
                  id={`btn_ctx_v2_autofit_semua_${tableKey}`}
                  aria-label="Sesuaikan lebar semua kolom"
                  onClick={() => onAutoFitAll()}
                >
                  <Columns3 size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sesuaikan lebar semua kolom</p>
              </TooltipContent>
            </Tooltip>
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon"
                  type="button"
                  id={`btn_ctx_v2_bekukan_${tableKey}`}
                  aria-label="Bekukan kolom sampai di sini"
                  disabled={headerIdx < 0 || freezeAktif >= headerIdx + 1}
                  onClick={() => { if (headerIdx >= 0) onFreeze(headerIdx + 1); }}
                  className={cn('disabled:pointer-events-none disabled:opacity-40')}
                >
                  <Pin size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bekukan kolom sampai di sini</p>
              </TooltipContent>
            </Tooltip>
            {freezeAktif > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon"
                    type="button"
                    id={`btn_ctx_v2_lepas_bekukan_${tableKey}`}
                    aria-label="Lepas semua kolom beku"
                    onClick={() => onFreeze(0)}
                  >
                    <PinOff size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Lepas semua kolom beku</p>
                </TooltipContent>
              </Tooltip>
            )}
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon"
                  type="button"
                  id={`btn_ctx_v2_salin_kolom_${tableKey}`}
                  aria-label="Salin kolom (TSV)"
                  onClick={() => salinKolom(header.colKey)}
                >
                  <Copy size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Salin kolom (TSV)</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <ContextMenuSeparator />

          {onKelolaTabel && (
            <ContextMenuItem
              id={`menu_ctx_v2_kelola_tabel_${tableKey}`}
              onSelect={() => bukaDariMenu(() => onKelolaTabel())}
            >
              <NotebookTabs size={16} />
              <span>Kelola Tabel</span>
            </ContextMenuItem>
          )}
        </>
      )}

      {row && (
        <>
          <ContextMenuLabel>{row.rowLabel}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuLabel>SALIN</ContextMenuLabel>
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
