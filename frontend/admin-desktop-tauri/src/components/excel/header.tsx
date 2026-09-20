import type { DragEvent } from 'react';
import { Ban, GripVertical } from '@/icons';

/** Lebar horizontal yang dipakai gagang geser (ikon 12px + padding/margin).
 *  WAJIB sama dengan CSS `.simpes-dsg-geser`; dipakai ExcelTable untuk
 *  menambah basis lebar kolom agar judul tak menyempit saat grip tampil. */
export const LEBAR_GAGANG_GESER = 14;

/** Judul kolom dengan gagang seret pengubah lebar (drag di tepi kanan).
 *  Klik 2× pada gagang = AutoFit lebar mengikuti isi (seperti Excel).
 *  Field wajib (mode Input) ditandai bintang merah; kolom otomatis (tidak
 *  bisa diisi manual saat mode Input) ditandai ikon merah.
 *  Super_admin bisa menyeret urutan kolom via gagang geser (global). */
export function HeaderTitle({
  label,
  colKey,
  required,
  noInput,
  onResizeStart,
  onResizePrev,
  onAutoFit,
  tooltip = null,
  terkunci = false,
  bisaGeser = false,
  sedangDiseret = false,
  targetSeret = null,
  onDragMulai,
  onDragLewat,
  onDragJatuh,
  onDragSelesai,
}: {
  label: string;
  colKey: string;
  required?: boolean;
  noInput?: boolean;
  onResizeStart: (key: string, e: { preventDefault(): void; stopPropagation(): void; clientX: number }) => void;
  /** Kolom beku: gagang tepi KIRI untuk mengubah lebar kolom sebelumnya
   *  (gagang kanan tertutup oleh sel beku di sebelahnya). */
  onResizePrev?: (e: { preventDefault(): void; stopPropagation(): void; clientX: number }) => void;
  onAutoFit: (key: string) => void;
  /** Teks bantuan dari kamus kolom (hover header). */
  tooltip?: string | null;
  /** Lebar dikunci kamus: gagang seret/AutoFit disembunyikan. */
  terkunci?: boolean;
  /** Seret urutan kolom diizinkan (super_admin efektif). */
  bisaGeser?: boolean;
  /** Kolom ini sedang diseret. */
  sedangDiseret?: boolean;
  /** Kolom ini target drop: indikator di kiri/kanan. */
  targetSeret?: 'kiri' | 'kanan' | null;
  onDragMulai?: (key: string, e: DragEvent) => void;
  onDragLewat?: (key: string, e: DragEvent) => void;
  onDragJatuh?: (key: string, e: DragEvent) => void;
  onDragSelesai?: () => void;
}) {
  return (
    <span
      className={`simpes-dsg-headtitle${sedangDiseret ? ' simpes-dsg-diseret' : ''}${targetSeret === 'kiri' ? ' simpes-dsg-target-kiri' : ''}${targetSeret === 'kanan' ? ' simpes-dsg-target-kanan' : ''}`}
      data-col-key={colKey}
      title={tooltip ?? undefined}
      onDragOver={onDragLewat ? (e) => { e.preventDefault(); onDragLewat(colKey, e); } : undefined}
      onDrop={onDragJatuh ? (e) => { e.preventDefault(); onDragJatuh(colKey, e); } : undefined}
    >
      {bisaGeser && onDragMulai ? (
        <span
          className="simpes-dsg-geser"
          title="Seret untuk pindah posisi kolom (global, tersimpan otomatis)"
          aria-label="Seret untuk pindah posisi kolom"
          draggable
          onDragStart={(e) => onDragMulai(colKey, e)}
          onDragEnd={() => onDragSelesai?.()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>
      ) : null}
      {label}
      {required ? (
        <span className="simpes-dsg-wajib-tanda" title="Wajib diisi pada mode Input">
          *
        </span>
      ) : null}
      {noInput ? (
        <span
          className="simpes-dsg-tak-input"
          title="Kolom otomatis — tidak bisa diisi manual pada mode Input"
          aria-label="Tidak bisa diisi manual"
        >
          <Ban size={11} />
        </span>
      ) : null}
      {onResizePrev && !terkunci ? (
        <span
          className="simpes-dsg-resizer simpes-dsg-resizer-kiri"
          title="Seret untuk ubah lebar kolom di kiri"
          onMouseDown={(e) => onResizePrev(e)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}
      {terkunci ? (
        <span
          className="simpes-dsg-tak-input"
          title="Lebar dikunci kamus kolom"
          aria-label="Lebar dikunci kamus"
        >
          🔒
        </span>
      ) : (
        <span
          className="simpes-dsg-resizer"
          title="Seret untuk ubah lebar • klik 2× untuk sesuaikan isi"
          onMouseDown={(e) => onResizeStart(colKey, e)}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAutoFit(colKey);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </span>
  );
}

/** Tinggi minimum baris header agar judul (termasuk yang membungkus beberapa
 *  baris) tidak meluber: hitung jumlah baris teks × line-height + padding judul.
 *  Tidak bergantung tinggi baris saat ini sehingga stabil (tidak loop). */
export function ukurPerluTinggiHeader(akar: HTMLElement): number {
  let maks = 0;
  akar.querySelectorAll<HTMLElement>('.dsg-row-header .simpes-dsg-headtitle').forEach((ht) => {
    const cs = getComputedStyle(ht);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2 || 15;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    let baris = 1;
    // Judul teks bisa bukan anak pertama (mis. ada gagang geser di depannya).
    const node = Array.from(ht.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
    );
    if (node) {
      const r = document.createRange();
      r.setStart(node, 0);
      r.setEnd(node, (node.textContent ?? '').length);
      baris = Math.max(1, r.getClientRects().length);
    }
    maks = Math.max(maks, Math.ceil(baris * lh + pad));
  });
  return maks;
}
