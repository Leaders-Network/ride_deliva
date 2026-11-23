import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * List filters live in the URL so a filtered view can be refreshed, bookmarked
 * or pasted to a colleague. Changing any filter resets to page 1.
 */
export function useListParams<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const v = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>;
    return { ...v, page: Number(params.get('page') ?? 1) || 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const set = useCallback(
    (key: K | 'page', value: string | number) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === '' || value === undefined) next.delete(key);
          else next.set(key, String(value));
          if (key !== 'page') next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const selected = params.get('id') ?? undefined;
  const select = useCallback(
    (id?: string) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('id', id);
        else next.delete('id');
        return next;
      }),
    [setParams]
  );

  return { values, set, selected, select };
}
