import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { CargoOption } from '../../hooks/useTableControls';

export type TableToolbarProps = {
  /** Unique per instance — three toolbars can be on screen at once. */
  id: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  cargo: string;
  onCargoChange: (value: string) => void;
  cargoOptions: CargoOption[];
  children?: ReactNode;
};

export const TableToolbar = ({
  id,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar por nome ou matrícula...',
  cargo,
  onCargoChange,
  cargoOptions,
  children,
}: TableToolbarProps) => (
  <div className="ui-toolbar">
    {children}
    <div className="ui-toolbar__search">
      <label className="visually-hidden" htmlFor={`${id}-search`}>
        Buscar servidor
      </label>
      <div className="ui-search">
        <Search className="ui-search__icon" size={15} strokeWidth={1.9} aria-hidden="true" />
        <input
          id={`${id}-search`}
          type="search"
          className="input ui-search__input"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
    </div>
    <div className="ui-toolbar__select">
      <label className="visually-hidden" htmlFor={`${id}-cargo`}>
        Filtrar por cargo
      </label>
      <select
        id={`${id}-cargo`}
        className="input"
        value={cargo}
        onChange={(event) => onCargoChange(event.target.value)}
      >
        <option value="">Todos os cargos</option>
        {cargoOptions.map((option) => (
          <option key={option.codigo} value={option.codigo}>
            {option.nome}
          </option>
        ))}
      </select>
    </div>
  </div>
);
