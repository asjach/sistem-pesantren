import { useCallback, useEffect, useRef, useState } from 'react';
import type { CellProps } from 'react-datasheet-grid';
import { Switch } from '@/components/ui/switch';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronDown as ChevronDownIcon } from '@/icons';
import { hasOpenEditor, INPUT_ROW_ID } from './helpers';
import type { CheckColData, GridRow, SelectColData, StaticColData, TextColData, ToggleColData } from './types';

/** Sel teks: span saat baca-saja, input saat fokus edit. */
export function TextCell({ rowData, setRowData, columnData, focus, stopEditing, columnIndex }: CellProps<GridRow, TextColData>) {
  const key = columnData.fieldKey;
  const committed = (rowData[key] as string) ?? '';
  const [val, setVal] = useState<string | null>(null);

  useEffect(() => {
    setVal(null);
  }, [committed]);

  if (!focus && val === null) {
    return (
      <span
        className="simpes-dsg-fill"
        data-col-key={key}
        onDoubleClick={() => columnData.onDblClick?.(rowData.id)}
        onClick={(e) => {
          if (e.detail !== 1) return;
          // Sel yang tadinya aktif sudah otomatis membuka editor lewat
          // mousedown DSG (input fokus) — jangan buka dua kali.
          if (hasOpenEditor()) return;
          columnData.onClickCell?.(rowData.id);
        }}
      >
        {committed}
      </span>
    );
  }
  const cur = val ?? committed;
  const commit = (v: string) => {
    if (v !== committed) setRowData({ ...rowData, [key]: v });
  };
  return (
    <input
      className="dsg-input"
      data-col-key={key}
      value={cur}
      maxLength={columnData.maxLength}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        commit(cur);
        setVal(null);
      }}
      onKeyDown={(e) => {
        // Tab & panah atas/bawah: commit dulu, lalu biarkan DSG yang
        // memindahkan sel + menutup mode edit (DSG tak memicu blur saat
        // input di-unmount, jadi commit wajib di sini).
        if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          commit(cur);
          setVal(null);
          return;
        }
        // Panah kiri/kanan tetap milik input (pindah kursor di dalam teks).
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
        e.stopPropagation();
        if (e.key === 'Enter') {
          commit(cur);
          setVal(null);
          // Baris input (mode Input): Enter = simpan baris. Kursor pindah ke
          // baris bawah (baris input berikutnya) hanya bila kolom wajib lengkap.
          if (String(rowData.id) === INPUT_ROW_ID && columnData.onEnter) {
            const bolehPindah = columnData.onEnter(columnIndex);
            stopEditing({ nextRow: bolehPindah });
            return;
          }
          // stopEditing bawaan DSG = tutup edit + aktif turun 1 baris (kolom sama).
          stopEditing();
        } else if (e.key === 'Escape') {
          setVal(null);
          // Batal: tutup edit tanpa pindah baris.
          stopEditing({ nextRow: false });
        }
      }}
    />
  );
}

/**
 * Sel dropdown `<select>` native — kini hanya dipakai BARIS INPUT (mode Input)
 * lewat `InputStaticSelectCell`: editor native menutup daftar sambil menggeser sel
 * ke baris di bawah, dan saat baris input sedang diisi itu membingungkan.
 * Kolom data biasa memakai `SelectRadixCell`.
 */
export function SelectCell({ rowData, setRowData, columnData, focus, stopEditing, disabled, columnIndex }: CellProps<GridRow, SelectColData>) {
  const key = columnData.fieldKey;
  const cur = (rowData[key] as string) ?? '';
  const opsi = String(rowData.id) === INPUT_ROW_ID && columnData.choicesInput
    ? columnData.choicesInput
    : columnData.choicesForRow
      ? columnData.choicesForRow(rowData.id)
      : columnData.choices;
  const label = opsi.find((c) => c.value === cur)?.label ?? cur;
  /* Nilai sel belum ada di daftar pilihan — baris input selalu mulai kosong,
     sel data bisa dikosongkan (Delete), dan pilihan bisa menyusut saat filter
     lembaga berubah. Tanpa option kosong di bawah, browser menampilkan opsi
     PERTAMA seolah terpilih padahal `value` tak cocok satu pun, sehingga
     memilih opsi pertama itu tak memicu `change`: nilai pertama terasa tak
     bisa dipilih. Teksnya: petunjuk `placeholder` bila sel kosong, atau nilai
     lama yang sudah di luar daftar supaya tak tersamar jadi opsi pertama. */
  const placeholder = cur === '' ? (columnData.placeholder ?? 'Pilih…') : cur;
  const perluPlaceholder = !opsi.some((c) => c.value === cur);
  const terkunci = disabled || (columnData.bolehSelect !== undefined && !columnData.bolehSelect(rowData.id));
  if (terkunci || !focus) {
    return (
      <span
        className="simpes-dsg-fill"
        data-col-key={key}
        onDoubleClick={() => columnData.onDblClick?.(rowData.id)}
        onClick={(e) => {
          if (e.detail !== 1) return;
          if (hasOpenEditor()) return;
          columnData.onClickCell?.(rowData.id);
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <select
      className="simpes-dsg-select"
      data-col-key={key}
      aria-label={key}
      value={perluPlaceholder ? '' : cur}
      autoFocus
      onChange={(e) => {
        setRowData({ ...rowData, [key]: e.target.value });
        setTimeout(() => stopEditing(), 0);
      }}
      onBlur={() => stopEditing()}
      onKeyDown={(e) => {
        if (e.key === 'Tab') return;
        e.stopPropagation();
        if (e.key === 'Escape') stopEditing();
        if (e.key === 'Enter' && String(rowData.id) === INPUT_ROW_ID && columnData.onEnter) {
          e.preventDefault();
          const bolehPindah = columnData.onEnter(columnIndex);
          stopEditing({ nextRow: bolehPindah });
        }
      }}
    >
      {perluPlaceholder && (
        <option value="" disabled hidden>
          {placeholder}
        </option>
      )}
      {opsi.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

/** Nilai kosong yang dipetakan jadi sentinel untuk Select (Radix): Radix
 *  menolak nilai opsi berupa string kosong, jadi "belum ada pilihan" memakai
 *  sentinel ini lalu dikembalikan lagi jadi `''` sebelum masuk ke baris grid. */
const KOSONG_RADIX = '__kosong__';

/** Kunci yang dipakai Radix untuk membuka/mengGERAKKAN daftar (bukan milik
 *  grid): Enter, spasi, panah atas/bawah, Home, End. */
const KUNCI_BUKA_RADIX = ['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'];

/**
 * Sel select untuk SETIAP kolom `kind: 'select'`.
 *
 *  Dua keputusan bentuk di sini, keduanya hasil pengukuran (tabel pengampu
 *  ratusan baris):
 *
 *  1. **Instance Radix hanya dipasang saat daftar dibuka.** Kalau setiap sel
 *     merender `<Select>` (Radix) penuh, tabel 200+ baris terasa berat: tiap baris
 *     membawa provider + ikon Radix, dan pemuatan tabel memicu
 *     task panjang ratusan ms (terukur: 2 task ~500 ms tanpa kolom select → 0 task).
 *     Jadi sel default berupa `<button>` biasa yang murah, lalu klik pertama
 *     PASANG `<Select open>` untuk sel itu saja — daftar tetap Radix (gaya sama
 *     dengan dialog), tapi hanya SATU instance yang hidup pada satu waktu.
 *  2. **`<select>` native tersisa hanya untuk baris input** mode Input
 *     (`InputStaticSelectCell`), yang editor native-nya memindahkan kursor ke baris
   *  bawah setiap daftar ditutup — tak cocok untuk baris yang sedang diisi).
 *
 *  Perilaku yang dijaga:
 *  - **Satu klik untuk membuka.** Tombol sel sudah ada sebelum diklik, jadi tak
 *    perlu klik kedua seperti pada select native (yang baru dirender DSG saat sel
 *    jadi sel aktif + mode Edit).
 *  - **Fokus tak lompat setelah memilih nilai.** `stopEditing()` bawaan DSG
 *    memindahkan sel ke baris berikutnya; di sini dipanggil `nextRow: false`,
 *    fokus dilepas dari tombol, lalu sel aktif dikembalikan ke grid (klik di
 *    panel portal atau Escape menghapus sel aktif menurut DSG).
 *  - Nilai kosong memakai sentinel `KOSONG_RADIX` (Radix menolak nilai opsi
 *    string kosong), dan nilai yang tak ada di daftar pilihan ditampilkan lewat
 *    `placeholder` alih-alih menyamar jadi opsi pertama.
 *  - `onKeyDown` menahan hanya kunci milik Radix (buka/gerak daftar); sisanya
 *    ke grid. */
export function SelectRadixCell({ rowData, setRowData, columnData, stopEditing, disabled }: CellProps<GridRow, SelectColData>) {
  const key = columnData.fieldKey;
  const cur = (rowData[key] as string) ?? '';
  const opsi = String(rowData.id) === INPUT_ROW_ID && columnData.choicesInput
    ? columnData.choicesInput
    : columnData.choicesForRow
      ? columnData.choicesForRow(rowData.id)
      : columnData.choices;
  const label = opsi.find((c) => c.value === cur)?.label ?? cur;
  const placeholder = cur === '' ? (columnData.placeholder ?? 'Pilih…') : cur;
  const terkunci = disabled || (columnData.bolehSelect !== undefined && !columnData.bolehSelect(rowData.id));
  const [buka, setBuka] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  /** Tutup daftar → keluar dari mode edit TANPA melompat baris, lepas fokus dari
   *  tombol, kembalikan sel aktif ke grid, lalu LEPAS instance Radix (kembali ke
   *  tombol murah). Langkah terakhir مهم: hanya sel yang daftar terbukanya yang
   *  perlu instance. */
  const tutup = useCallback(() => {
    setTimeout(() => {
      stopEditing({ nextRow: false });
      triggerRef.current?.blur();
      columnData.fokuskanSel?.(rowData.id);
      setBuka(false);
    }, 0);
  }, [stopEditing, columnData, rowData.id]);

  if (terkunci) {
    return (
      <span
        className="simpes-dsg-fill"
        data-col-key={key}
        onDoubleClick={() => columnData.onDblClick?.(rowData.id)}
        onClick={(e) => {
          if (e.detail !== 1) return;
          if (hasOpenEditor()) return;
          columnData.onClickCell?.(rowData.id);
        }}
      >
        {label}
      </span>
    );
  }

  if (!buka) {
    // Tombol murah: belum ada instance Radix untuk sel ini.
    return (
      <button
        type="button"
        className="simpes-dsg-select flex h-full w-full items-center justify-between gap-1 text-left text-xs"
        data-col-key={key}
        aria-label={key}
        aria-haspopup="listbox"
        aria-expanded={false}
        onClick={(e) => {
          // Jangan buka dua kali: klik yang sama bisa jadi "aktifkan sel" DSG
          // (untuk kolom yang butuh mode Edit).
          if (hasOpenEditor()) return;
          e.stopPropagation();
          setBuka(true);
        }}
        onKeyDown={(e) => {
          if (KUNCI_BUKA_RADIX.includes(e.key)) e.stopPropagation();
        }}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 opacity-50" />
      </button>
    );
  }

  return (
    <Select
      open
      value={cur === '' ? KOSONG_RADIX : cur}
      onValueChange={(v) => {
        setRowData({ ...rowData, [key]: v === KOSONG_RADIX ? '' : v });
        tutup();
      }}
      onOpenChange={(o) => { if (!o) tutup(); }}
    >
      <SelectTrigger
        ref={triggerRef}
        className="simpes-dsg-select text-xs"
        style={{ height: '100%', padding: '0 2px', border: 0 }}
        data-col-key={key}
        aria-label={key}
        /* Catatan fokus: DSG membaca keyboard lewat listener di `document`, jadi
           tanpa `stopPropagation` tombol panah/Enter milik Radix ikut memindahkan
           sel grid. Ditahan HANYA untuk kunci yang memang milik Radix (buka/gerak
           daftar); sisanya — termasuk Tab — ke grid. */
        onKeyDown={(e) => {
          if (e.key === 'Tab') return;
          e.stopPropagation();
        }}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {/* Radix mengembalikan fokus ke trigger saat daftar ditutup; itu membuat fokus
          "nempel" di tombol (cincin fokus ikut muncul). Cegah, fokus dilepas
          supaya grid yang menerimanya. */}
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {opsi.map((c) => (
          <SelectItem key={c.value} value={c.value === '' ? KOSONG_RADIX : c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


/** Sel boolean (Switch ON/OFF) — langsung mengubah nilai tanpa mode Edit.
 *  Nilai grid tetap string 'ya'/'tidak' agar pipeline data tak berubah.
 *  mousedown sengaja TIDAK dihentikan agar sel tetap bisa diseleksi/aktif
 *  di grid; klik Switch tetap dihentikan agar tidak memicu aksi grid. */
export function ToggleCell({ rowData, setRowData, columnData, disabled }: CellProps<GridRow, ToggleColData>) {
  const key = columnData.fieldKey;
  return (
    <span
      className="simpes-dsg-fill flex items-center justify-center"
      data-col-key={key}
      onClick={(e) => e.stopPropagation()}
    >
      <Switch
        size="xs"
        checked={rowData[key] === 'ya'}
        disabled={disabled || !columnData.bisaEdit}
        aria-label={columnData.label}
        onCheckedChange={(v) => setRowData({ ...rowData, [key]: v ? 'ya' : 'tidak' })}
      />
    </span>
  );
}

/** Sel baca-saja (teks polos). */
export function StaticCell({ rowData, columnData }: CellProps<GridRow, StaticColData>) {
  const teks = String(rowData[columnData.fieldKey] ?? '');
  const isi = (
    <span
      className="simpes-dsg-fill"
      data-col-key={columnData.fieldKey}
      onDoubleClick={() => columnData.onDblClick?.()}
    >
      {teks}
    </span>
  );

  // Kartu hover opsional: isi panjang yang terpotong lebar kolom tetap utuh
  // dibaca. Delay kecil supaya terasa langsung, bukan tooltip bawaan browser.
  if (columnData.kartuHover) {
    return (
      <HoverCard openDelay={120} closeDelay={80}>
        <HoverCardTrigger asChild>{isi}</HoverCardTrigger>
        <HoverCardContent
          align="start"
          side="bottom"
          className="w-auto max-w-[26rem] p-3 text-xs"
        >
          {columnData.kartuHover(rowData)}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return isi;
}

/** Sel centang: status dikendalikan penuh oleh grid (`checkedIds`).
 *  Toggle HANYA lewat delegasi klik ExcelTable (`toggleCheckByCell`) yang
 *  membaca `data-row-id` — bukan lewat `mousedown`/`onChange` input (jalur
 *  bawaan DSG butuh 2× klik dan flip bawaan browser bikin DOM tak sinkron).
 *  Toggle keyboard via fokus (Enter) bawaan DSG sengaja tidak dipakai karena
 *  efeknya ikut jalan saat mount/remount dan membalik status spontan. */
export function CheckCell({ rowData, disabled }: CellProps<GridRow, CheckColData>) {
  return (
    <input
      type="checkbox"
      className="dsg-checkbox"
      tabIndex={-1}
      disabled={disabled}
      data-row-id={String(rowData.id)}
      checked={Boolean(rowData.checked)}
      // Cegah flip bawaan browser pada click (onChange di bawah no-op).
      onClick={(e) => e.preventDefault()}
      onChange={() => {}}
    />
  );
}

/** Kolom static + inputKind 'text': baca-saja untuk baris data, input teks
 *  untuk baris input (mode Input). */
export function InputStaticTextCell(props: CellProps<GridRow, TextColData>) {
  if (String(props.rowData.id) !== INPUT_ROW_ID) {
    return <StaticCell {...(props as unknown as CellProps<GridRow, StaticColData>)} />;
  }
  return <TextCell {...props} />;
}

/** Kolom static + inputKind 'select': baca-saja untuk baris data, dropdown
 *  untuk baris input (mode Input). */
export function InputStaticSelectCell(props: CellProps<GridRow, SelectColData>) {
  if (String(props.rowData.id) !== INPUT_ROW_ID) {
    return <StaticCell {...(props as unknown as CellProps<GridRow, StaticColData>)} />;
  }
  return <SelectCell {...props} />;
}
