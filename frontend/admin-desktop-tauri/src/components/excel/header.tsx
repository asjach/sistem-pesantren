import { Ban } from '@/icons';

/** Judul kolom dengan gagang seret pengubah lebar (drag di tepi kanan).
 *  Klik 2× pada gagang = AutoFit lebar mengikuti isi (seperti Excel).
 *  Field wajib (mode Input) ditandai bintang merah; kolom otomatis (tidak
 *  bisa diisi manual saat mode Input) ditandai ikon merah. */
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
}) {
  return (
    <span className="simpes-dsg-headtitle" data-col-key={colKey} title={tooltip ?? undefined}>
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
    const node = ht.firstChild;
    if (node && node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '') {
      const r = document.createRange();
      r.setStart(node, 0);
      r.setEnd(node, (node.textContent ?? '').length);
      baris = Math.max(1, r.getClientRects().length);
    }
    maks = Math.max(maks, Math.ceil(baris * lh + pad));
  });
  return maks;
}
