import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { SortDirection } from '../../hooks/useTableControls';

export type SortableThProps = {
  columnKey: string;
  label: string;
  activeKey: string | null;
  direction: SortDirection;
  align?: 'left' | 'right' | 'center';
  onSort: (key: string) => void;
};

export const SortableTh = ({
  columnKey,
  label,
  activeKey,
  direction,
  align = 'left',
  onSort,
}: SortableThProps) => {
  const isActive = activeKey === columnKey;
  const Icon = isActive ? (direction === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;

  return (
    <th
      className={`ui-th-sort${align === 'left' ? '' : ` ui-th-sort--${align}`}`}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className="ui-th-sort__btn" onClick={() => onSort(columnKey)}>
        {label}
        <Icon
          className={`ui-th-sort__icon${isActive ? ' ui-th-sort__icon--active' : ''}`}
          size={14}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
    </th>
  );
};
