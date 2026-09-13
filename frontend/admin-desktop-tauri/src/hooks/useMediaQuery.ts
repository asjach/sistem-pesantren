import * as React from 'react';

/** Cocokkan media query (mis. lebar layar) dan ikut berubah saat ukuran berubah. */
export function useMediaQuery(query: string): boolean {
  const [cocok, setCocok] = React.useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const ubah = (e: MediaQueryListEvent) => setCocok(e.matches);
    setCocok(mq.matches);
    mq.addEventListener('change', ubah);
    return () => mq.removeEventListener('change', ubah);
  }, [query]);

  return cocok;
}
