import { PROPERTI_STYLE, type StyleElemen } from './anotasiData';

/** Snapshot computed style browser; tidak menebak rule CSS atau style parent. */
export function bacaStyleElemen(elemen: Element): StyleElemen | undefined {
  if (!elemen.isConnected) return undefined;
  try {
    const computed = elemen.ownerDocument.defaultView?.getComputedStyle(elemen);
    if (!computed) return undefined;
    const hasil: StyleElemen = {};
    for (const properti of PROPERTI_STYLE) {
      const nilai = computed.getPropertyValue(properti).trim();
      if (nilai) hasil[properti] = nilai;
    }
    return hasil;
  } catch {
    return undefined;
  }
}

export function teksStyleElemen(style: StyleElemen): string {
  return PROPERTI_STYLE.flatMap((properti) => {
    const nilai = style[properti];
    return nilai ? [`${properti}: ${nilai};`] : [];
  }).join('\n');
}
