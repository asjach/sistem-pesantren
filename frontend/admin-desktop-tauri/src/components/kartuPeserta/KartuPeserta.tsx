import { useRef, type CSSProperties, type PointerEvent as PointerEventReact } from 'react';
import type { ElemenKartuPeserta } from '@/api/penilaian';
import { cn } from '@/lib/utils';
import {
  nilaiElemenKartu, pindahkanElemenKartu, ubahUkuranElemenKartu,
  type DesainKartuPeserta, type KonteksKartuPeserta,
} from '@/lib/desainKartuPeserta';

/** 1mm = 3,7795px CSS (96dpi) — dipakai agar ukuran cetak sama dengan ukuran fisik. */
export const PX_PER_MM = 3.779527559;

interface Props {
  desain: DesainKartuPeserta;
  konteks: KonteksKartuPeserta;
  lebarMm: number;
  tinggiMm: number;
  skala: number;
  fotoUrl?: string | null;
  latarUrl?: string | null;
  interaktif?: boolean;
  terpilih?: string | null;
  onPilih?: (id: string | null) => void;
  onUbah?: (id: string, ubah: (elemen: ElemenKartuPeserta) => ElemenKartuPeserta) => void;
}

export default function KartuPeserta({
  desain, konteks, lebarMm, tinggiMm, skala, fotoUrl, latarUrl,
  interaktif = false, terpilih = null, onPilih, onUbah,
}: Props) {
  const skalaFont = skala / PX_PER_MM;
  const lebarPx = lebarMm * skala;
  const tinggiPx = tinggiMm * skala;

  return (
    <div
      className="relative overflow-hidden bg-white text-black"
      style={{ width: lebarPx, height: tinggiPx }}
      onPointerDown={interaktif ? () => onPilih?.(null) : undefined}
    >
      <LatarKartu desain={desain} latarUrl={latarUrl} />
      {desain.elemen.map((elemen) => (
        <ElemenKartu
          key={elemen.id}
          elemen={elemen}
          konteks={konteks}
          fotoUrl={fotoUrl}
          skalaFont={skalaFont}
          interaktif={interaktif}
          terpilih={interaktif && terpilih === elemen.id}
          onPilih={onPilih}
          onUbah={onUbah}
        />
      ))}
    </div>
  );
}

function LatarKartu({ desain, latarUrl }: { desain: DesainKartuPeserta; latarUrl?: string | null }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ backgroundColor: desain.warna_latar }}
    >
      {latarUrl && <img src={latarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {desain.gaya_latar === 'klasik' && (
        <>
          <span className="absolute inset-[2%] border-2 border-[#14532d]" />
          <span className="absolute inset-[3.6%] border border-[#14532d]" />
        </>
      )}
      {desain.gaya_latar === 'modern' && (
        <>
          <span className="absolute left-0 top-0 h-full w-[3.5%] bg-[#065f46]" />
          <span
            className="absolute bottom-0 right-0 h-[42%] w-[48%]"
            style={{ background: 'linear-gradient(135deg, transparent 42%, rgba(6,95,70,0.22) 42%)' }}
          />
        </>
      )}
      {desain.gaya_latar === 'foto' && latarUrl && <span className="absolute inset-0 bg-white/10" />}
    </div>
  );
}

function ElemenKartu({
  elemen, konteks, fotoUrl, skalaFont, interaktif, terpilih, onPilih, onUbah,
}: {
  elemen: ElemenKartuPeserta;
  konteks: KonteksKartuPeserta;
  fotoUrl?: string | null;
  skalaFont: number;
  interaktif: boolean;
  terpilih: boolean;
  onPilih?: (id: string | null) => void;
  onUbah?: (id: string, ubah: (elemen: ElemenKartuPeserta) => ElemenKartuPeserta) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const mulaiGeser = (e: PointerEventReact<HTMLDivElement>) => {
    if (!interaktif) return;
    e.preventDefault();
    e.stopPropagation();
    onPilih?.(elemen.id);
    const kanvas = ref.current?.parentElement;
    if (!kanvas) return;
    const kotak = kanvas.getBoundingClientRect();
    const { clientX, clientY } = e;
    const { x: xAwal, y: yAwal } = elemen;

    const gerak = (ev: PointerEvent) => {
      const dx = ((ev.clientX - clientX) / kotak.width) * 100;
      const dy = ((ev.clientY - clientY) / kotak.height) * 100;
      onUbah?.(elemen.id, (item) => pindahkanElemenKartu(item, xAwal + dx, yAwal + dy));
    };
    const selesai = () => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', selesai);
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', selesai);
  };

  const mulaiUbahUkuran = (e: PointerEventReact<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onPilih?.(elemen.id);
    const kanvas = ref.current?.parentElement;
    if (!kanvas) return;
    const kotak = kanvas.getBoundingClientRect();
    const { clientX, clientY } = e;
    const { lebar: lebarAwal, tinggi: tinggiAwal } = elemen;

    const gerak = (ev: PointerEvent) => {
      const dx = ((ev.clientX - clientX) / kotak.width) * 100;
      const dy = ((ev.clientY - clientY) / kotak.height) * 100;
      onUbah?.(elemen.id, (item) => ubahUkuranElemenKartu(item, lebarAwal + dx, tinggiAwal + dy));
    };
    const selesai = () => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', selesai);
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', selesai);
  };

  const gaya: CSSProperties = {
    left: `${elemen.x}%`,
    top: `${elemen.y}%`,
    width: `${elemen.lebar}%`,
    height: `${elemen.tinggi}%`,
    fontSize: `${elemen.ukuran_font * skalaFont}px`,
    color: elemen.warna,
    fontWeight: elemen.tebal ? 700 : 400,
    textAlign: elemen.rata,
  };

  return (
    <div
      ref={ref}
      data-elemen-kartu={elemen.id}
      className={cn(
        'absolute select-none overflow-hidden leading-[1.1]',
        interaktif && 'cursor-move touch-none',
        terpilih && 'outline outline-2 outline-offset-0 outline-primary',
      )}
      style={gaya}
      onPointerDown={mulaiGeser}
    >
      {elemen.tipe === 'foto' ? (
        fotoUrl ? (
          <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <SiluetFoto jk={konteks.peserta.jk} />
        )
      ) : (
        <span className="block h-full w-full whitespace-pre-wrap break-words">
          {nilaiElemenKartu(elemen, konteks)}
        </span>
      )}
      {terpilih && (
        <span
          role="presentation"
          className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize border border-white bg-primary"
          onPointerDown={mulaiUbahUkuran}
        />
      )}
    </div>
  );
}

function SiluetFoto({ jk }: { jk: string | null }) {
  const perempuan = jk === 'P';
  return (
    <span className="block h-full w-full bg-[#e5e7eb]">
      <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden="true" focusable="false">
        {perempuan ? (
          <g fill="#9ca3af">
            <circle cx="50" cy="32" r="17" />
            <path d="M27 120 L34 63 Q50 52 66 63 L73 120 Z" />
            <path d="M33 63 L25 108 L38 100 Z" />
            <path d="M67 63 L75 108 L62 100 Z" />
          </g>
        ) : (
          <g fill="#9ca3af">
            <circle cx="50" cy="32" r="17" />
            <path d="M24 120 L31 66 Q50 53 69 66 L76 120 Z" />
          </g>
        )}
      </svg>
    </span>
  );
}
