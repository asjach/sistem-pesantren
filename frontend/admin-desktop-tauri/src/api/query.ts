export type ScalarOrArray<T extends string | number> = T | readonly T[];

export function appendQueryParam<T extends string | number>(
  params: URLSearchParams,
  key: string,
  value: ScalarOrArray<T> | null | undefined,
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item == null || item === '') continue;
      params.append(`${key}[]`, String(item));
    }
    return;
  }

  if (value == null || value === '') return;
  params.set(key, String(value));
}
