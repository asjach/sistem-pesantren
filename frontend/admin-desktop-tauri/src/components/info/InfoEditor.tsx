import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageUp, Link2, Loader2 } from '@/icons';
import { GalatGambar, gambarKeDataUrl } from './gambar';
import { PANJANG_HTML_MAKS, sanitasiHtml } from './sanitasiHtml';

/** Escape teks supaya aman ditempel ke atribut HTML yang kita susun sendiri. */
function amanAtribut(teks: string): string {
  return teks
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Jalankan `execCommand` dengan aman: di jsdom (tes) fungsi ini tak ada. */
function perintahBrowser(nama: string, arg?: string): void {
  if (typeof document.execCommand !== 'function') return;
  try {
    // `styleWithCSS` dimatikan supaya tebal/miring jadi `<b>`/`<i>`, bukan
    // `<span style="…">` — sanitizer backend membuang seluruh `style`.
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(nama, false, arg);
  } catch {
    /* execCommand usang; peramban yang menolaknya tetap bisa mengetik biasa. */
  }
}

/** Tombol toolbar: `mousedown` ditahan supaya seleksi di editor tidak hilang
 *  sebelum perintahnya dijalankan. */
function TombolFormat({
  id,
  label,
  onClick,
  disabled,
  children,
}: {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      id={id}
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/**
 * Editor info tabel: area tulis kaya (contentEditable) + toolbar format +
 * sisip gambar.
 *
 * Nilai keluar-masuk berupa HTML mentah; pemanggil yang menyimpan. Sanitasi
 * tetap dilakukan dua kali — di sini untuk paste/gambar (agar editor tidak
 * menyimpan sampah `style` dari Word), dan sekali lagi di backend saat
 * menyimpan (penjaga sebenarnya, karena isinya dirender ke semua pengguna).
 *
 * Sengaja tanpa dependensi editor pihak ketiga: kebutuhan info tabel hanya
 * format dasar + gambar, dan contentEditable bawaan WebView sudah cukup.
 * Perintah memakai `execCommand` yang usang tapi masih satu-satunya API
 * format tanpa pustaka; bila peramban menolaknya, mengetik tetap berjalan.
 */
export default function InfoEditor({
  nilai,
  onUbah,
  id = 'editor_info_tabel',
}: {
  /** HTML tersimpan (hasil muat server). */
  nilai: string;
  /** Dipanggil tiap isi berubah, dengan HTML terkini. */
  onUbah: (html: string) => void;
  id?: string;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const berkasRef = useRef<HTMLInputElement>(null);
  /** Seleksi terakhir di editor — bertahan saat fokus pindah ke toolbar,
   *  kotak tautan, atau dialog berkas. */
  const pilihanRef = useRef<Range | null>(null);
  const [sibukGambar, setSibukGambar] = useState(false);
  const [tautanBuka, setTautanBuka] = useState(false);
  const [tautan, setTautan] = useState('');

  /* Nilai dari luar (muat server / kembali ke awal) ditulis ke DOM. Saat
     mengetik, `innerHTML` sudah sama dengan `nilai` sehingga kursor tidak
     pernah di-reset. */
  useEffect(() => {
    const el = areaRef.current;
    if (el === null || el.innerHTML === nilai) return;
    el.innerHTML = nilai;
  }, [nilai]);

  const simpanPilihan = useCallback(() => {
    const sel = window.getSelection();
    if (sel === null || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!areaRef.current?.contains(range.commonAncestorContainer)) return;
    pilihanRef.current = range.cloneRange();
  }, []);

  const pulihkanPilihan = useCallback(() => {
    const el = areaRef.current;
    const range = pilihanRef.current;
    el?.focus();
    if (range === null) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const jalankan = useCallback((nama: string, arg?: string) => {
    pulihkanPilihan();
    perintahBrowser(nama, arg);
    if (areaRef.current !== null) onUbah(areaRef.current.innerHTML);
  }, [onUbah, pulihkanPilihan]);

  /** Sisipkan HTML di posisi kursor (atau di akhir bila tak ada seleksi). */
  const sisip = useCallback((html: string) => {
    pulihkanPilihan();
    perintahBrowser('insertHTML', html);
    if (areaRef.current !== null) onUbah(areaRef.current.innerHTML);
  }, [onUbah, pulihkanPilihan]);

  const tempel = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    e.preventDefault();
    if (html.trim() !== '') {
      // Buang `style`/`class`/tag asing dari sumber luar (Word, web) SEBELUM
      // masuk editor, supaya yang terlihat sama dengan yang nanti tersimpan.
      perintahBrowser('insertHTML', sanitasiHtml(html));
    } else {
      perintahBrowser('insertText', e.clipboardData.getData('text/plain'));
    }
    if (areaRef.current !== null) onUbah(areaRef.current.innerHTML);
  }, [onUbah]);

  const pilihGambar = useCallback(async () => {
    const berkas = berkasRef.current?.files?.[0];
    if (berkasRef.current !== null) berkasRef.current.value = '';
    if (berkas === undefined) return;

    setSibukGambar(true);
    try {
      const url = await gambarKeDataUrl(berkas);
      const potongan = `<img src="${url}" alt="${amanAtribut(berkas.name)}">`;
      // Base64 menambah ±33%: tolak SEBELUM menyisip, jangan biarkan backend
      // memotong HTML di tengah `data:` (gambar rusak tanpa penjelasan).
      if ((areaRef.current?.innerHTML.length ?? 0) + potongan.length > PANJANG_HTML_MAKS) {
        toast.error('Gambar terlalu besar: info tabel akan melebihi batas ukuran.');
        return;
      }
      sisip(potongan);
    } catch (e) {
      toast.error(e instanceof GalatGambar ? e.message : 'Gagal memproses gambar.');
    } finally {
      setSibukGambar(false);
    }
  }, [sisip]);

  const bukaTautan = useCallback(() => {
    simpanPilihan();
    setTautan('');
    setTautanBuka(true);
  }, [simpanPilihan]);

  const terapkanTautan = useCallback(() => {
    const url = tautan.trim();
    setTautanBuka(false);
    setTautan('');
    if (url === '') return;

    // Seleksi kosong: `createLink` tak membuat apa pun, jadi sisipkan tautan
    // berisi URL-nya sendiri. Seleksi berisi teks: jadikan tautan.
    const pilihan = pilihanRef.current;
    if (pilihan === null || pilihan.collapsed) {
      sisip(`<a href="${amanAtribut(url)}">${amanAtribut(url)}</a>`);
      return;
    }
    jalankan('createLink', url);
  }, [jalankan, sisip, tautan]);

  return (
    <div className="flex flex-col rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
        <TombolFormat id={`${id}_tebal`} label="Tebal" onClick={() => jalankan('bold')}>
          <span className="text-[11px] font-bold">B</span>
        </TombolFormat>
        <TombolFormat id={`${id}_miring`} label="Miring" onClick={() => jalankan('italic')}>
          <span className="text-[11px] italic">I</span>
        </TombolFormat>
        <TombolFormat id={`${id}_garis_bawah`} label="Garis bawah" onClick={() => jalankan('underline')}>
          <span className="text-[11px] underline">U</span>
        </TombolFormat>
        <TombolFormat id={`${id}_coret`} label="Coret" onClick={() => jalankan('strikeThrough')}>
          <span className="text-[11px] line-through">S</span>
        </TombolFormat>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <TombolFormat id={`${id}_judul_2`} label="Judul besar" onClick={() => jalankan('formatBlock', '<h2>')}>
          <span className="text-[11px] font-semibold">H2</span>
        </TombolFormat>
        <TombolFormat id={`${id}_judul_3`} label="Judul kecil" onClick={() => jalankan('formatBlock', '<h3>')}>
          <span className="text-[11px] font-semibold">H3</span>
        </TombolFormat>
        <TombolFormat id={`${id}_paragraf`} label="Paragraf" onClick={() => jalankan('formatBlock', '<p>')}>
          <span className="text-[11px]">¶</span>
        </TombolFormat>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <TombolFormat id={`${id}_daftar_butir`} label="Daftar butir" onClick={() => jalankan('insertUnorderedList')}>
          <span className="text-[11px]">•—</span>
        </TombolFormat>
        <TombolFormat id={`${id}_daftar_nomor`} label="Daftar bernomor" onClick={() => jalankan('insertOrderedList')}>
          <span className="text-[11px]">1.</span>
        </TombolFormat>
        <TombolFormat id={`${id}_kutipan`} label="Kutipan" onClick={() => jalankan('formatBlock', '<blockquote>')}>
          <span className="text-[11px]">❝</span>
        </TombolFormat>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <TombolFormat id={`${id}_tautan`} label="Tautan" onClick={bukaTautan}>
          <Link2 size={13} />
        </TombolFormat>
        <TombolFormat
          id={`${id}_gambar`}
          label="Sisipkan gambar"
          disabled={sibukGambar}
          onClick={() => {
            simpanPilihan();
            berkasRef.current?.click();
          }}
        >
          {sibukGambar ? <Loader2 size={13} className="animate-spin" /> : <ImageUp size={13} />}
        </TombolFormat>
        <input
          ref={berkasRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          aria-label="Pilih berkas gambar info tabel"
          onChange={() => void pilihGambar()}
        />
      </div>
      {tautanBuka ? (
        <div className="flex items-center gap-1 border-b px-2 py-1">
          <Input
            id={`${id}_input_tautan`}
            value={tautan}
            autoFocus
            placeholder="https://"
            aria-label="Alamat tautan"
            className="h-6 min-w-0 flex-1 text-xs"
            onChange={(e) => setTautan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                terapkanTautan();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setTautanBuka(false);
                setTautan('');
              }
            }}
          />
          <Button type="button" variant="outline" size="xs" onClick={terapkanTautan}>
            Pasang
          </Button>
        </div>
      ) : null}
      <div
        ref={areaRef}
        id={id}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Isi info tabel"
        spellCheck
        className="info-tabel-isi min-h-44 overflow-y-auto px-2 py-1.5 text-xs outline-none"
        onInput={(e) => onUbah(e.currentTarget.innerHTML)}
        onKeyUp={simpanPilihan}
        onMouseUp={simpanPilihan}
        onBlur={simpanPilihan}
        onPaste={tempel}
      />
    </div>
  );
}
