import { useEffect, useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export type CargoOption = { codigo: string; nome: string };

export type Comparators<T> = Record<string, (a: T, b: T) => number>;

export type TableControls<T> = {
  search: string;
  setSearch: (value: string) => void;
  cargo: string;
  setCargo: (value: string) => void;
  cargoOptions: CargoOption[];
  sortKey: string | null;
  sortDirection: SortDirection;
  toggleSort: (key: string) => void;
  /** Everything matching search + cargo, across all pages. */
  filtered: T[];
  /** The current page slice. */
  pageItems: T[];
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  /** True when the source list itself is empty (vs. filtered to nothing). */
  isSourceEmpty: boolean;
  hasActiveFilter: boolean;
};

export type UseTableControlsOptions<T> = {
  items: T[];
  /** Strings the free-text search runs against. */
  searchable: (item: T) => (string | null | undefined)[];
  cargoOf: (item: T) => CargoOption | null | undefined;
  comparators: Comparators<T>;
  defaultSortKey?: string | null;
  pageSize?: number;
};

/**
 * Search + cargo filter + sort + pagination for the three tables of the
 * "Solicitar Compra" screen, which used to duplicate this logic verbatim.
 */
export function useTableControls<T>({
  items,
  searchable,
  cargoOf,
  comparators,
  defaultSortKey = null,
  pageSize = 24,
}: UseTableControlsOptions<T>): TableControls<T> {
  const [search, setSearch] = useState('');
  const [cargo, setCargo] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);

  const cargoOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      const option = cargoOf(item);
      if (option?.codigo) map.set(option.codigo, option.nome);
    });
    return Array.from(map, ([codigo, nome]) => ({ codigo, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !term ||
        searchable(item).some((value) => (value ?? '').toLowerCase().includes(term));
      const matchesCargo = !cargo || cargoOf(item)?.codigo === cargo;
      return matchesSearch && matchesCargo;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, cargo]);

  const sorted = useMemo(() => {
    const comparator = sortKey ? comparators[sortKey] : undefined;
    if (!comparator) return filtered;
    const result = [...filtered].sort(comparator);
    return sortDirection === 'asc' ? result : result.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDirection]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  // Filters that shrink the result set must never leave the user on a blank page.
  useEffect(() => {
    setPage(1);
  }, [search, cargo]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageItems = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  return {
    search,
    setSearch,
    cargo,
    setCargo,
    cargoOptions,
    sortKey,
    sortDirection,
    toggleSort: (key: string) => {
      if (sortKey === key) {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDirection('asc');
      }
    },
    filtered: sorted,
    pageItems,
    page: safePage,
    setPage,
    totalPages,
    rangeStart: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(safePage * pageSize, total),
    total,
    isSourceEmpty: items.length === 0,
    hasActiveFilter: search.trim().length > 0 || cargo.length > 0,
  };
}
