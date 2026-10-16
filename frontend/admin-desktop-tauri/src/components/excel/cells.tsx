import { useEffect, useState } from 'react';
import type { CellProps } from 'react-datasheet-grid';
import { Switch } from '@/components/ui/switch';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
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

/** Sel dropdown native (tanpa dependensi baru). */
export function SelectCell({ rowData, setRowData, columnData, focus, stopEditing, disabled, columnIndex }: CellProps<GridRow, SelectColData>) {
  const key = columnData.fieldKey;
  const cur = (rowData[key] as string) ?? '';
  const opsi = String(rowData.id) === INPUT_ROW_ID && columnData.choicesInput
    ? columnData.choicesInput
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
  if (disabled || !focus) {
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
