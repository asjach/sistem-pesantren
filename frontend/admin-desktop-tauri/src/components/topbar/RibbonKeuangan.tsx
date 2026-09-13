import { ReceiptText, ScrollText, Wallet } from '@/icons';
import { RibbonBtn, RibbonGroup, pathAktif } from './primitives';

export function RibbonKeuangan({ pathname }: { pathname: string }) {
  return (
    <RibbonGroup label="Keuangan">
      <RibbonBtn id="nav_pos" to="/pos" icon={Wallet} label="Pos" aktif={pathAktif(pathname, '/pos')} />
      <RibbonBtn id="nav_tarif" to="/tarif" icon={ReceiptText} label="Tarif" aktif={pathAktif(pathname, '/tarif')} />
      <RibbonBtn id="nav_keuangan" to="/keuangan" icon={ScrollText} label="Tagihan & Bayar" aktif={pathAktif(pathname, '/keuangan')} />
    </RibbonGroup>
  );
}
