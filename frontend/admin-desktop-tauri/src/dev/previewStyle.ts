import { PROPERTI_PREVIEW, type PreviewElemen, type PropertiStyle, type StyleElemen } from './anotasiData';
import { bacaStyleElemen } from './styleAnotasi';

interface SesiPreview {
  atributAwal: string | null;
  inlineAwal: CSSStyleDeclaration;
  sebelum: StyleElemen;
  perubahan: StyleElemen;
  inlineTerapan: string;
  berubahDiLuarPreview: boolean;
  terapan: Map<PropertiStyle, { nilai: string; priority: string }>;
}

function inlineStyle(elemen: Element): CSSStyleDeclaration {
  const style = (elemen as HTMLElement | SVGElement).style;
  if (!style) throw new Error('Elemen ini tidak mendukung preview style.');
  return style;
}

/** Satu pemilik seluruh preview, tetap hidup saat editor disembunyikan untuk memilih tujuan. */
export class PengelolaPreviewStyle {
  private readonly sesi = new Map<Element, SesiPreview>();

  terapkan(elemen: Element, properti: PropertiStyle, input: string): void {
    const nilai = input.trim();
    if (!elemen.isConnected) throw new Error('Elemen sudah tidak tersedia. Pilih kembali elemen.');
    if (!PROPERTI_PREVIEW.includes(properti) || !nilai || nilai.length > 256) {
      throw new Error('Pilih properti yang didukung dan isi nilai CSS maksimal 256 karakter.');
    }
    const style = inlineStyle(elemen);
    const dokumen = elemen.ownerDocument;
    const uji = dokumen.createElement('span').style;
    const supports = dokumen.defaultView?.CSS?.supports;
    if (supports && !dokumen.defaultView!.CSS.supports(properti, nilai)) {
      throw new Error('Nilai CSS tidak valid untuk properti ini.');
    }
    uji.setProperty(properti, nilai);
    if (!uji.getPropertyValue(properti)) throw new Error('Nilai CSS tidak valid untuk properti ini.');

    let sesi = this.sesi.get(elemen);
    if (!sesi) {
      const sebelum = bacaStyleElemen(elemen);
      if (!sebelum) throw new Error('Style awal tidak dapat dibaca. Preview belum diterapkan.');
      const inlineAwal = dokumen.createElement('span').style;
      inlineAwal.cssText = style.cssText;
      sesi = {
        atributAwal: elemen.getAttribute('style'), inlineAwal, sebelum,
        perubahan: {}, inlineTerapan: style.cssText, berubahDiLuarPreview: false, terapan: new Map(),
      };
      this.sesi.set(elemen, sesi);
    }

    if (style.cssText !== sesi.inlineTerapan) sesi.berubahDiLuarPreview = true;
    // Priority ini hanya untuk preview; Reset mengembalikan priority semula.
    style.setProperty(properti, nilai, 'important');
    sesi.perubahan[properti] = nilai;
    sesi.terapan.set(properti, { nilai: style.getPropertyValue(properti), priority: style.getPropertyPriority(properti) });
    sesi.inlineTerapan = style.cssText;
  }

  snapshot(elemen: Element): PreviewElemen | undefined {
    const sesi = this.sesi.get(elemen);
    if (!sesi) return undefined;
    const sesudah = bacaStyleElemen(elemen);
    if (!sesudah) return undefined;
    return { sebelum: { ...sesi.sebelum }, sesudah, perubahan: { ...sesi.perubahan } };
  }

  reset(elemen: Element): void {
    const sesi = this.sesi.get(elemen);
    if (!sesi) return;
    const style = inlineStyle(elemen);
    if (!sesi.berubahDiLuarPreview && style.cssText === sesi.inlineTerapan) {
      if (sesi.atributAwal === null) elemen.removeAttribute('style');
      else elemen.setAttribute('style', sesi.atributAwal);
    } else {
      // Pertahankan perubahan runtime yang bukan milik preview ini.
      for (const [properti, terapan] of sesi.terapan) {
        if (style.getPropertyValue(properti) !== terapan.nilai || style.getPropertyPriority(properti) !== terapan.priority) continue;
        const awal = sesi.inlineAwal.getPropertyValue(properti);
        if (awal) style.setProperty(properti, awal, sesi.inlineAwal.getPropertyPriority(properti));
        else style.removeProperty(properti);
      }
      if (sesi.atributAwal === null && !style.cssText) elemen.removeAttribute('style');
    }
    this.sesi.delete(elemen);
  }

  resetSemua(): void {
    for (const elemen of this.sesi.keys()) this.reset(elemen);
  }
}
