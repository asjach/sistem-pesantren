import { useMemo } from 'react';
import type { Lembaga } from '@/api/master';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Format tanggal ISO (`YYYY-MM-DD`, boleh berekor waktu) ke Indonesia.
 *  Tak valid → tampil mentah agar tak ada data yang hilang. */
export function formatTanggalLembaga(v: string | null | undefined): string | null {
  const t = (v ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return (v ?? '').trim() || null;
  const [th, bl, hr] = t.split('-').map(Number);
  const dt = new Date(Date.UTC(th, bl - 1, hr));
  if (Number.isNaN(dt.getTime())) return t;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
}

const LABEL_STATUS: Record<string, string> = { negeri: 'Negeri', swasta: 'Swasta' };
const LABEL_WAKTU: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', pagi_siang: 'Pagi dan siang' };
const LABEL_RAPOR: Record<string, string> = { terpisah: 'Terpisah', digabung: 'Digabung' };
const LABEL_KELOMPOK: Record<string, string> = { combo_mi_md: 'Combo MI-MD', eksklusif: 'Eksklusif' };

function teks(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function Baris({ label, children, kosong }: { label: string; children: React.ReactNode; kosong?: boolean }) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-4 px-3 py-2 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 break-words font-medium', kosong && 'font-normal text-muted-foreground')}>
        {children}
      </dd>
    </div>
  );
}

function Nilai({ value, tanggal }: { value: unknown; tanggal?: boolean }) {
  let v = teks(value);
  if (v != null && tanggal) v = formatTanggalLembaga(v) ?? v;
  if (v == null) return <span>—</span>;
  return <span>{v}</span>;
}

function Seksi({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section aria-label={judul}>
      <h3 className="px-1 pb-1 text-xs font-semibold">{judul}</h3>
      <dl className="divide-y rounded-lg border bg-card">{children}</dl>
    </section>
  );
}

export interface DialogLihatLembagaProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lembaga: Lembaga | null;
  /** Bila diisi (punya izin ubah): tombol "Ubah" di footer melompat ke dialog ubah. */
  onUbah?: () => void;
}

/** Dialog Lihat Lembaga: SELURUH field dikelompokkan per seksi seperti dialog
 *  Ubah (Identitas, Legalitas & Akreditasi, Alamat & Kontak, Operasional &
 *  PSB), nilai kode diterjemahkan ke Bahasa Indonesia, kosong tampil "—". */
export default function DialogLihatLembaga({ open, onOpenChange, lembaga: l, onUbah }: DialogLihatLembagaProps) {
  const rtRw = useMemo(() => {
    const rt = teks(l?.rt);
    const rw = teks(l?.rw);
    if (rt == null && rw == null) return null;
    return `${rt ?? '—'} / ${rw ?? '—'}`;
  }, [l]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle id="dialog_lihat_lembaga_judul">
            {l ? `Lembaga: ${l.nama}` : 'Lembaga'}
          </DialogTitle>
          <DialogDescription>Detail data lembaga (baca-saja).</DialogDescription>
        </DialogHeader>
        {l == null ? (
          <p className="text-xs text-muted-foreground">Tidak ada data.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Ringkasan status">
              <Badge variant="outline">Jenjang {l.jenjang}</Badge>
              {l.is_active == null ? null : l.is_active
                ? <Badge variant="default">Aktif</Badge>
                : <Badge variant="destructive">Nonaktif</Badge>}
              {l.status ? <Badge variant="secondary">{LABEL_STATUS[l.status] ?? l.status}</Badge> : null}
              {l.akreditasi ? <Badge variant="secondary">Akreditasi {l.akreditasi === 'belum' ? 'Belum' : l.akreditasi}</Badge> : null}
            </div>
            <Seksi judul="Identitas">
              <Baris label="Jenjang">{l.jenjang}</Baris>
              <Baris label="Nama">{l.nama}</Baris>
              <Baris label="Nama singkat" kosong={teks(l.nama_singkat) == null}>
                <Nilai value={l.nama_singkat} />
              </Baris>
              <Baris label="Mudir / Kepala" kosong={teks(l.mudir_am) == null}>
                <Nilai value={l.mudir_am} />
              </Baris>
              <Baris label="Status" kosong={l.status == null}>
                <Nilai value={l.status ? (LABEL_STATUS[l.status] ?? l.status) : null} />
              </Baris>
              <Baris label="Aktif" kosong={l.is_active == null}>
                <Nilai value={l.is_active == null ? null : (l.is_active ? 'Ya' : 'Tidak')} />
              </Baris>
            </Seksi>
            <Seksi judul="Legalitas & Akreditasi">
              <Baris label="NPSN" kosong={teks(l.npsn) == null}><Nilai value={l.npsn} /></Baris>
              <Baris label="NSM" kosong={teks(l.nsm) == null}><Nilai value={l.nsm} /></Baris>
              <Baris label="NPWP" kosong={teks(l.npwp) == null}><Nilai value={l.npwp} /></Baris>
              <Baris label="No. izin operasional" kosong={teks(l.no_izin_operasional) == null}>
                <Nilai value={l.no_izin_operasional} />
              </Baris>
              <Baris label="Tgl. izin" kosong={teks(l.tgl_izin) == null}>
                <Nilai value={l.tgl_izin} tanggal />
              </Baris>
              <Baris label="No. SK pendirian" kosong={teks(l.no_sk_pendirian) == null}>
                <Nilai value={l.no_sk_pendirian} />
              </Baris>
              <Baris label="Tgl. SK pendirian" kosong={teks(l.tgl_sk_pendirian) == null}>
                <Nilai value={l.tgl_sk_pendirian} tanggal />
              </Baris>
              <Baris label="Tahun berdiri" kosong={l.tahun_berdiri == null}>
                <Nilai value={l.tahun_berdiri} />
              </Baris>
              <Baris label="No. SK Kemenkumham" kosong={teks(l.no_sk_kemenkumham) == null}>
                <Nilai value={l.no_sk_kemenkumham} />
              </Baris>
              <Baris label="Akreditasi" kosong={l.akreditasi == null}>
                <Nilai value={l.akreditasi === 'belum' ? 'Belum' : l.akreditasi} />
              </Baris>
              <Baris label="Tgl. akreditasi" kosong={teks(l.tgl_akreditasi) == null}>
                <Nilai value={l.tgl_akreditasi} tanggal />
              </Baris>
              <Baris label="Penyelenggara" kosong={teks(l.penyelenggara) == null}>
                <Nilai value={l.penyelenggara} />
              </Baris>
            </Seksi>
            <Seksi judul="Alamat & Kontak">
              <Baris label="Alamat" kosong={teks(l.alamat) == null}><Nilai value={l.alamat} /></Baris>
              <Baris label="Desa" kosong={teks(l.desa) == null}><Nilai value={l.desa} /></Baris>
              <Baris label="Kecamatan" kosong={teks(l.kecamatan) == null}><Nilai value={l.kecamatan} /></Baris>
              <Baris label="Kab/Kota" kosong={teks(l.kab_kota) == null}><Nilai value={l.kab_kota} /></Baris>
              <Baris label="Provinsi" kosong={teks(l.provinsi) == null}><Nilai value={l.provinsi} /></Baris>
              <Baris label="RT / RW" kosong={rtRw == null}><Nilai value={rtRw} /></Baris>
              <Baris label="Kode pos" kosong={teks(l.kode_pos) == null}><Nilai value={l.kode_pos} /></Baris>
              <Baris label="Lintang" kosong={l.lintang == null}><Nilai value={l.lintang} /></Baris>
              <Baris label="Bujur" kosong={l.bujur == null}><Nilai value={l.bujur} /></Baris>
              <Baris label="Telepon" kosong={teks(l.telepon) == null}><Nilai value={l.telepon} /></Baris>
              <Baris label="Email" kosong={teks(l.email) == null}><Nilai value={l.email} /></Baris>
              <Baris label="Website" kosong={teks(l.website) == null}><Nilai value={l.website} /></Baris>
              <Baris label="Logo URL" kosong={teks(l.logo_url) == null}><Nilai value={l.logo_url} /></Baris>
            </Seksi>
            <Seksi judul="Operasional & PSB">
              <Baris label="Waktu belajar" kosong={l.waktu_belajar == null}>
                <Nilai value={l.waktu_belajar ? (LABEL_WAKTU[l.waktu_belajar] ?? l.waktu_belajar) : null} />
              </Baris>
              <Baris label="Mode rapor" kosong={l.mode_rapor == null}>
                <Nilai value={l.mode_rapor ? (LABEL_RAPOR[l.mode_rapor] ?? l.mode_rapor) : null} />
              </Baris>
              <Baris label="Template rapor" kosong={teks(l.template_rapor) == null}>
                <Nilai value={l.template_rapor} />
              </Baris>
              <Baris label="Kelompok PSB">
                <Nilai value={l.kelompok_psb ? (LABEL_KELOMPOK[l.kelompok_psb] ?? l.kelompok_psb) : 'Eksklusif'} />
              </Baris>
              <Baris label="Butuh seleksi">{l.is_seleksi ? 'Ya' : 'Tidak'}</Baris>
            </Seksi>
          </div>
        )}
        <DialogFooter>
          {onUbah && l ? (
            <Button id="btn_dari_lihat_ke_ubah_lembaga" type="button" onClick={onUbah}>
              Ubah
            </Button>
          ) : null}
          <Button id="btn_tutup_lihat_lembaga" type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
