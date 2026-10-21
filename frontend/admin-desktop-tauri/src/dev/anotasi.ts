/** Anotasi UI mode dev — kontrak data dan pembacaan konteks elemen. */

export interface Anotasi {
  id: string;
  dibuat: string;
  rute: string;
  selector: string;
  tag: string;
  teks: string;
  komponen: string[];
  sumber: string | null;
  instruksi: string;
}

export interface KonteksElemen {
  selector: string;
  tag: string;
  teks: string;
  komponen: string[];
  sumber: string | null;
}

interface SumberDebug {
  fileName?: string;
  lineNumber?: number;
}

interface FiberDebug {
  type?: unknown;
  return?: FiberDebug | null;
  _debugSource?: SumberDebug | null;
  _debugOwner?: FiberDebug | null;
}

/** `src/pages/Foo.tsx:42` — jalur pendek yang langsung bisa dibuka agen. */
export function rapikanSumber(fileName: string, lineNumber?: number): string {
  const normal = fileName.replaceAll('\\', '/');
  const idx = normal.lastIndexOf('/src/');
  const pendek = idx >= 0 ? normal.slice(idx + 1) : normal;
  return lineNumber ? `${pendek}:${lineNumber}` : pendek;
}

/** Selector unik: id/data-testid bila ada, selain itu jalur `body > …`. */
export function buatSelector(root: Element): string {
  if (root === document.documentElement) return 'html';
  if (root === document.body) return 'body';

  const id = root.getAttribute('id');
  if (id) {
    const selector = `#${escapeCss(id)}`;
    if (document.querySelectorAll(selector).length === 1) return selector;
  }

  const testid = root.getAttribute('data-testid');
  if (testid) {
    const selector = `[data-testid="${testid.replaceAll('"', '\\"')}"]`;
    if (document.querySelectorAll(selector).length === 1) return selector;
  }

  const bagian: string[] = [];
  let node: Element | null = root;

  while (node && node !== document.body && node !== document.documentElement) {
    const tag = node.tagName.toLowerCase();
    const induk: Element | null = node.parentElement;
    let segmen = tag;

    if (induk) {
      const sejenis = Array.from(induk.children).filter((anak) => anak.tagName === node!.tagName);
      if (sejenis.length > 1) segmen += `:nth-of-type(${sejenis.indexOf(node) + 1})`;
    }

    bagian.unshift(segmen);
    node = induk;
  }

  return ['body', ...bagian].join(' > ');
}

function escapeCss(nilai: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(nilai);
  return nilai.replace(/([^\w-])/g, '\\$1');
}

/** Teks yang paling membantu agen mengenali elemen yang ditandai. */
export function teksElemen(el: Element): string {
  const nilai = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
    ? el.value || el.getAttribute('placeholder') || ''
    : el.textContent || el.getAttribute('aria-label') || '';

  return nilai.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function namaKomponen(tipe: unknown): string | null {
  if (typeof tipe === 'function') {
    const fungsi = tipe as { displayName?: string; name?: string };
    return fungsi.displayName || fungsi.name || null;
  }

  if (tipe && typeof tipe === 'object') {
    const objek = tipe as {
      displayName?: string;
      render?: { displayName?: string; name?: string };
      type?: unknown;
    };
    return objek.displayName
      || objek.render?.displayName
      || objek.render?.name
      || (typeof objek.type === 'function' ? namaKomponen(objek.type) : null);
  }

  return null;
}

function ambilFiber(el: Element): FiberDebug | null {
  for (const kunci of Object.getOwnPropertyNames(el)) {
    if (kunci.startsWith('__reactFiber$') || kunci.startsWith('__reactInternalInstance$')) {
      return (el as unknown as Record<string, FiberDebug | undefined>)[kunci] ?? null;
    }
  }
  return null;
}

/** Nama komponen (induk → anak) dan lokasi sumber dari fiber React mode dev. */
export function bacaKonteksReact(el: Element): { komponen: string[]; sumber: string | null } {
  let fiber = ambilFiber(el);
  const nama: string[] = [];
  let sumber: string | null = null;
  let langkah = 0;

  while (fiber && langkah < 100) {
    const komponen = namaKomponen(fiber.type);
    if (komponen && nama[nama.length - 1] !== komponen) nama.push(komponen);

    const debug = fiber._debugSource ?? fiber._debugOwner?._debugSource;
    if (!sumber && debug?.fileName) sumber = rapikanSumber(debug.fileName, debug.lineNumber);

    fiber = fiber.return ?? null;
    langkah += 1;
  }

  return { komponen: nama.reverse().slice(-8), sumber };
}

export function bacaKonteks(el: Element): KonteksElemen {
  const { komponen, sumber } = bacaKonteksReact(el);

  return {
    selector: buatSelector(el),
    tag: el.tagName.toLowerCase(),
    teks: teksElemen(el),
    komponen,
    sumber,
  };
}

export function buatId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `anotasi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function minta<T>(jalur: string, init?: RequestInit): Promise<T> {
  const res = await fetch(jalur, init);
  if (!res.ok) throw new Error(`Permintaan anotasi gagal (HTTP ${res.status}).`);
  return res.json() as Promise<T>;
}

export async function muatAnotasi(): Promise<Anotasi[]> {
  const data = await minta<{ anotasi?: Anotasi[] }>('/__anotasi');
  return Array.isArray(data.anotasi) ? data.anotasi : [];
}

export async function simpanAnotasi(anotasi: Anotasi): Promise<Anotasi> {
  return minta<Anotasi>('/__anotasi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(anotasi),
  });
}

export async function hapusAnotasi(id: string): Promise<void> {
  const res = await fetch(`/__anotasi?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Permintaan hapus anotasi gagal (HTTP ${res.status}).`);
}
