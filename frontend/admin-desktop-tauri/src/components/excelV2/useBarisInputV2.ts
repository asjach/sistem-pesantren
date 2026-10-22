import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/api/client';
import type { ExcelField } from '@/components/excel/types';

type NilaiInput = Record<string, string | null>;

export interface BarisInputV2State {
  nilai: NilaiInput;
  galat: Record<string, string>;
  menyimpan: boolean;
  focusKey?: string;
  generasi: number;
  ubah: (key: string, nilai: string | null) => void;
  simpan: () => Promise<void>;
  batal: () => void;
}

export function bisaInput(f: ExcelField): boolean {
  return f.kind !== 'static' || f.inputKind != null;
}

/** Record baru disimpan secara eksplisit; tidak melewati antrean edit sel. */
export function useBarisInputV2({ fields, onCreateRow, inputRowValues, loading, tableKey }: {
  fields: ExcelField[];
  onCreateRow?: (nilai: NilaiInput) => Promise<void>;
  inputRowValues?: NilaiInput;
  loading: boolean;
  tableKey: string;
}) {
  const [aktif, setAktif] = useState(false);
  const [draft, setDraft] = useState<NilaiInput>({});
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [generasi, setGenerasi] = useState(0);
  const kunciSimpan = useRef(false);
  const sesi = useRef(0);
  const draftRef = useRef(draft);
  const boleh = onCreateRow != null;

  useEffect(() => {
    setAktif(false);
    setDraft({});
    draftRef.current = {};
    setGalat({});
    setPesan('');
    setMenyimpan(false);
    kunciSimpan.current = false;
    sesi.current += 1;
    return () => { sesi.current += 1; };
  }, [tableKey, boleh]);

  const ubah = (key: string, nilai: string | null) => {
    if (kunciSimpan.current) return;
    draftRef.current = { ...draftRef.current, [key]: nilai };
    setDraft(draftRef.current);
    setGalat((lama) => ({ ...lama, [key]: '' }));
    setPesan('');
  };
  const batal = () => {
    if (kunciSimpan.current) return;
    setAktif(false);
    setDraft({});
    draftRef.current = {};
    setGalat({});
    setPesan('');
  };
  const simpan = async () => {
    if (!aktif || !onCreateRow || loading || kunciSimpan.current) return;
    const nilai: NilaiInput = {};
    const salah: Record<string, string> = {};
    for (const f of fields) {
      if (!bisaInput(f)) continue;
      const raw = Object.prototype.hasOwnProperty.call(draftRef.current, f.key)
        ? draftRef.current[f.key] : (inputRowValues?.[f.key] ?? (f.kind === 'toggle' ? 'tidak' : null));
      const v = raw == null || raw.trim() === '' ? null : raw;
      nilai[f.key] = v;
      if (f.required && v === null) salah[f.key] = `${f.label} wajib diisi.`;
      else if (v !== null && f.maxLength && v.length > f.maxLength) salah[f.key] = `${f.label} maksimal ${f.maxLength} karakter.`;
      else if (v !== null && (f.inputKind ?? f.kind) === 'select') {
        const pilihan = typeof f.inputChoices === 'function'
          ? f.inputChoices({ ...inputRowValues, ...draftRef.current }) : (f.inputChoices ?? f.choices ?? []);
        if (!pilihan.some((p) => p.value === v)) salah[f.key] = `Pilihan ${f.label} tidak tersedia.`;
      }
      if (!salah[f.key] && v !== null && f.validate) {
        const hasil = f.validate(v);
        if (hasil) salah[f.key] = hasil;
      }
    }
    setGalat(salah);
    if (Object.keys(salah).length) {
      setPesan(Object.values(salah).join(' '));
      setGenerasi((v) => v + 1);
      return;
    }
    kunciSimpan.current = true;
    setMenyimpan(true);
    const sesiSimpan = sesi.current;
    try {
      await onCreateRow(nilai);
      if (sesi.current !== sesiSimpan) return;
      draftRef.current = {};
      setDraft({});
      setPesan('Data berhasil ditambahkan.');
      setGenerasi((v) => v + 1);
    } catch (e) {
      if (sesi.current === sesiSimpan) setPesan(errorMessage(e));
    } finally {
      if (sesi.current === sesiSimpan) {
        kunciSimpan.current = false;
        setMenyimpan(false);
      }
    }
  };
  const pertamaSalah = Object.keys(galat).find((key) => galat[key]);
  const state: BarisInputV2State | undefined = aktif && boleh ? {
    nilai: { ...inputRowValues, ...draft }, galat, menyimpan: menyimpan || loading,
    generasi, focusKey: pertamaSalah ?? fields.find(bisaInput)?.key, ubah, simpan, batal,
  } : undefined;
  return {
    state, pesan, menyimpan,
    mulai: () => { if (boleh && !loading && !kunciSimpan.current) { setAktif(true); setPesan(''); setGenerasi((v) => v + 1); } },
  };
}
