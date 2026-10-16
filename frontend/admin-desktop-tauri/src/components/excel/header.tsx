import { Ban } from '@/icons';

/** Padding horizontal pembungkus judul `.simpes-dsg-headtitle` (8px kiri +
 *  8px kanan) yang TIDAK terbaca dari sel header (sel header `padding: 0`).
 *  Wajib ikut dihitung AutoFit/lebar awal kolom — kalau tidak, kolom yang
 *  lebarnya ditentukan judul meleset ~8px dan huruf terakhir membungkus ke
 *  baris kedua ("Jenjan g", "Semest er"). WAJIB sinkron dengan CSS. */
export const PAD_JUDUL_X = 16;

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
  seretAktif,
  sedangDiseret,
  sisip,
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
  /** Seret-untuk-menyusun posisi kolom AKTIF: menandai judul sebagai pegangan
   *  (kursor grab) + jangkar bagi listener capture di wadah grid.
   *  Absen = fitur mati (bawaan), dan tak ada perubahan perilaku klik.
   *
   *  Handler TIDAK dipasang di sini sebagai prop React: grid memasang
   *  listener `pointerdown` native fase CAPTURE di wadahnya (lihat
   *  useSeretKolomHeader) karena react-datasheet-grid memanggil
   *  `preventDefault()` pada `mousedown` level dokumen sehingga event React
   *  di dalam grid tak sampai ke penanganan kita. */
  seretAktif?: boolean;
  /** Kolom ini sedang diangkat: diberi peredupan sebagai umpan balik. */
  sedangDiseret?: boolean;
  /** Garis indikator posisi sisip pada kolom ini (kiri/kanan). */
  sisip?: 'kiri' | 'kanan';
}) {
  return (
    <span
      className={`simpes-dsg-headtitle${sedangDiseret ? ' simpes-dsg-headtitle-diserd' : ''}${sisip === 'kiri' ? ' simpes-dsg-sisip-kiri' : sisip === 'kanan' ? ' simpes-dsg-sisip-kanan' : ''}`}
      data-col-key={colKey}
      /* Pegangan seret = SELURUH area judul (lihat useSeretKolomHeader),
         dan tombol kiri saja supaya klik kanan (menu konteks) tetap bebas. */
      data-seret={seretAktif ? 'aktif' : undefined}
    >
      <span className="simpes-dsg-teks-judul">{label}</span>
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
      {onResizePrev ? (
        <span
          className="simpes-dsg-resizer simpes-dsg-resizer-kiri"
          title="Seret untuk ubah lebar kolom di kiri"
          onMouseDown={(e) => onResizePrev(e)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}
      {(
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
    // Teks judul dibungkus span `.simpes-dsg-teks-judul`.
    const judul = ht.querySelector('.simpes-dsg-teks-judul');
    const node = judul?.firstChild
      ?? Array.from(ht.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
      );
    if (node) {
      const r = document.createRange();
      r.selectNodeContents(node);
      baris = Math.max(1, r.getClientRects().length);
    }
    maks = Math.max(maks, Math.ceil(baris * lh + pad));
  });
  return maks;
}
