import type { ReactElement } from 'react';
import { bukaDariMenu } from './kelolaTabelDariMenu';
import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import type { AlignKolom } from '@/components/kelolaTabel/jenis';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlignCenter, AlignLeft, AlignRight, Ban, Columns3, Copy, MoveHorizontal, NotebookTabs, Pencil, Pin, PinOff, RotateCcw } from '@/icons';
import { metaAksi } from './actions';
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
  /** Aksi massal blok seleksi (klik kanan di dalam seleksi). Absen = tak tampil. */
  onIsiBlok?: () => void;
  blokLabel?: string;
  /** Kosongkan isi blok (berdampingan dengan aksi isi). Absen = tak tampil;
   *  hanya diantar Mode Ubah, jadi tak ada saat tabel sedang dibaca. */
  onKosongkanBlok?: () => void;
  kosongkanLabel?: string;
  blokJumlah?: number;
  freezeAktif: number;
  ubahFreeze: (n: number) => void;
  /** Sakelar geser judul kolom untuk menyusun posisi kolom (per perangkat,
   *  MATI bawaan). Tersedia di sini sebagai jalan pintas dari area tabel. */
  geserHeader: boolean;
  onUbahGeserHeader: (nyala: boolean) => void;
  onAutoFit: (key: string) => void;
  onAutoFitAll: () => void;
  /** Perataan global per tabel (DB; satu sumber dengan Kelola Tabel). */
  align: Partial<Record<string, AlignKolom>>;
  /** Tulis perataan ke DB global (jalan pintas dialog Kelola Tabel). */
  onUbahAlign: (key: string, a: AlignKolom) => void;
  /** Kelola preset = super_admin saja (tombol perataan disembunyikan). */
  bolehKelola: boolean;
  /** Buka dialog Kelola Tabel dari klik kanan header kolom. Bila tak diberikan
   *  (mis. bukan super_admin efektif, atau halaman tanpa registrasi tabel),
   *  item menu tidak ditampilkan. */
  onKelolaTabel?: () => void;
  salinBaris: (id: string | number) => void;
  salinSel: (id: string | number, key: string) => void;
  salinKolom: (key: string) => void;
  /** Klik kanan di sudut kiri-atas (pilih semua): menu salin seluruh tabel. */
  sudut?: boolean;
  /** Salin seluruh tabel (label header + semua baris) sebagai TSV. */
  onSalinSemua: () => void;
  onKonfirmasi: (konfirmasi: AksiMenu['konfirmasi']) => void;
  /** Tinggi baris: mode "ikut isi" + ada/tidaknya tinggi manual. */
  barisIkutIsi: boolean;
  onUbahBarisIkutIsi: (nyawa: boolean) => void;
  /** Kembalikan tinggi manual baris ini (atau seluruh tabel bila null). */
  onResetTinggiBaris: (rowId: string | number | null) => void;
  barisManualAda: boolean;
  barisManualBarisIni: boolean;
}

/** Isi menu klik-kanan grid: area header (AutoFit, beku, perataan, urutan,
 *  Kelola Tabel) dan area baris (aksi halaman, tinggi baris, salin TSV).
 *  Visibilitas kolom TIDAK ada di sini — diatur di tab Kolom dialog Kelola
 *  Tabel (atau dropdown preset "Kolom" di bilah judul). */
export default function MenuKonteksGrid({
  tableKey,
  header,
  headerLabel,
  headerIdx,
  row,
  rowAksi,
  onIsiBlok,
  blokLabel,
  onKosongkanBlok,
  kosongkanLabel,
  blokJumlah,
  freezeAktif,
  ubahFreeze,
  geserHeader,
  onUbahGeserHeader,
  onAutoFit,
  onAutoFitAll,
  align,
  onUbahAlign,
  bolehKelola,
  onKelolaTabel,
  salinBaris,
  salinSel,
  salinKolom,
  sudut,
  onSalinSemua,
  onKonfirmasi,
  barisIkutIsi,
  onUbahBarisIkutIsi,
  onResetTinggiBaris,
  barisManualAda,
  barisManualBarisIni,
}: MenuKonteksGridProps) {

  return (
    <ContextMenuContent>
      {/* Sudut kiri-atas (kotak centang pilih semua): salin seluruh tabel. */}
      {sudut && (
        <>
          <ContextMenuLabel>TABEL</ContextMenuLabel>
          <ContextMenuItem
            id={`menu_ctx_salin_semua_${tableKey}`}
            onSelect={() => onSalinSemua()}
          >
            <Copy size={16} />
            <span>Salin semua (TSV)</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {/* Area header kolom: semua tombol dalam SATU baris ikon tanpa label
          (perataan | lebar | beku | salin). */}
      {header && (
        <>
          <ContextMenuLabel>KOLOM: {headerLabel}</ContextMenuLabel>
          <div className="flex items-center gap-1 px-2 pb-1 pt-0.5">
            {/* Perataan = setelan TABEL yang ditulis ke SERVER, super_admin
                efektif. Tanpa `bolehKelola` tombolnya disembunyikan supaya
                pengguna tak menabrak 403 "Setelan tabel hanya dapat diubah
                super_admin." — tombol lebar/beku di sebelahnya tetap lokal
                jadi tetap tampil untuk semua pengguna. */}
            {bolehKelola && (
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
                        id={`btn_ctx_align_${nilai}_${tableKey}`}
                        aria-label={`Rata ${label.toLowerCase()}`}
                        aria-pressed={aktif}
                        onClick={() => onUbahAlign(header.colKey, nilai)}
                        className={cn( aktif && 'bg-accent text-foreground')}
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
                  id={`btn_ctx_autofit_kolom_${tableKey}`}
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
                  id={`btn_ctx_autofit_semua_${tableKey}`}
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
                  id={`btn_ctx_bekukan_${tableKey}`}
                  aria-label="Freeze Column"
                  disabled={headerIdx < 0 || freezeAktif >= headerIdx + 1}
                  onClick={() => headerIdx >= 0 && ubahFreeze(headerIdx + 1)}
                  className={cn( 'disabled:pointer-events-none disabled:opacity-40')}
                >
                  <Pin size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Freeze Column</p>
              </TooltipContent>
            </Tooltip>
            {freezeAktif > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon"
                    type="button"
                    id={`btn_ctx_lepas_bekukan_${tableKey}`}
                    aria-label="Lepas Semua Beku"
                    onClick={() => ubahFreeze(0)}
                                      >
                    <PinOff size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Lepas Semua Beku</p>
                </TooltipContent>
              </Tooltip>
            )}
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon"
                  type="button"
                  id={`btn_ctx_salin_kolom_${tableKey}`}
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
          {/* Jalan pintas ke dialog pengaturan tabel (super_admin efektif,
              halaman berregistrasi tabel) — setara klik kanan bilah judul. */}
          {onKelolaTabel && (
            <>
              <ContextMenuItem
                id={`menu_ctx_kelola_tabel_${tableKey}`}
                /* Lewat `bukaDariMenu`: menandai jendela tenggang supaya panel
                   non-modal tak langsung tertutup oleh sisa fokus/interaksi
                   gestur menu (hanya jalur klik kanan; tombol gerigi tidak
                   melewati menu sehingga tak terpengaruh). Lihat
                   `./kelolaTabelDariMenu`. */
                onSelect={() => bukaDariMenu(() => onKelolaTabel())}
              >
                <NotebookTabs size={16} />
                <span>Kelola Tabel</span>
              </ContextMenuItem>
            </>
          )}
          {/* Susun posisi kolom dengan seret judul. Checkbox (bukan tombol
              ikon) supaya status aktif/matinya jelas terbaca. Per perangkat,
              MATI bawaan — perilaku klik judul lama tetap utuh. */}
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem
            id={`menu_ctx_geser_header_${tableKey}`}
            checked={geserHeader}
            onCheckedChange={(c) => onUbahGeserHeader(!!c)}
          >
            <span>Geser judul untuk menyusun kolom</span>
          </ContextMenuCheckboxItem>
        </>
      )}

      {/* Area baris data: aksi halaman + salin. */}
      {row && (
        <>
          <ContextMenuLabel>{row.rowLabel}</ContextMenuLabel>
          {(onIsiBlok || onKosongkanBlok) && (
            <>
              <ContextMenuLabel>BLOK {blokJumlah ?? 0} SEL</ContextMenuLabel>
              {onIsiBlok && (
              <ContextMenuItem
                id={`menu_ctx_isi_blok_${tableKey}`}
                /* WebKit/WKWebView dapat memfokuskan item saat pointerdown dan
                   menggeser menu satu baris; pointerup lalu mendarat di item
                   lain sehingga aksi blok tak pernah dipilih. Cegah fokus itu —
                   pemilihan tetap lewat click/onSelect. */
                onPointerDown={(e) => e.preventDefault()}
                onSelect={onIsiBlok}
              >
                <Pencil size={16} />
                <span>{blokLabel ?? 'Isi blok…'}</span>
              </ContextMenuItem>
              )}
              {onKosongkanBlok && (
              <ContextMenuItem
                id={`menu_ctx_kosongkan_blok_${tableKey}`}
                /* `onPointerDown` preventDefault: sama seperti item isi blok,
                   mencegah WebKit menggeser pilihan ke item lain. */
                onPointerDown={(e) => e.preventDefault()}
                onSelect={onKosongkanBlok}
              >
                <Ban size={16} />
                <span>{kosongkanLabel ?? 'Kosongkan blok…'}</span>
              </ContextMenuItem>
              )}
              <ContextMenuSeparator />
            </>
          )}
          {rowAksi.length > 0 && (
            <>
              <ContextMenuSeparator />
              <ContextMenuLabel>AKSI</ContextMenuLabel>
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
            </>
          )}
          <ContextMenuLabel>TINGGI BARIS</ContextMenuLabel>
          <ContextMenuCheckboxItem
            id={`menu_ctx_baris_ikut_isi_${tableKey}`}
            checked={barisIkutIsi}
            onCheckedChange={(c) => onUbahBarisIkutIsi(!!c)}
          >
            <span>Baris ikut isi (teks panjang membungkus)</span>
          </ContextMenuCheckboxItem>
          <ContextMenuItem
            id={`menu_ctx_reset_tinggi_baris_${tableKey}`}
            disabled={!barisManualBarisIni && !barisManualAda}
            onSelect={() => onResetTinggiBaris(barisManualBarisIni ? row.rowId : null)}
          >
            <RotateCcw size={16} />
            <span>
              Kembalikan tinggi baris{barisManualBarisIni ? ' (baris ini)' : ' (seluruh tabel)'}
            </span>
          </ContextMenuItem>
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
