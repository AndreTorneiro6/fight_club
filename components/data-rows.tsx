"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

/** Share TanStack filtering and pagination while preserving each table's markup. */
export default function DataRows<T>({
  data,
  searchText,
  children,
  label = "tabela",
  compact = false,
}: {
  data: T[];
  searchText: (row: T) => string;
  children: (rows: T[]) => ReactNode;
  label?: string;
  compact?: boolean;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const columns = useMemo(
    () => [{ id: "search", accessorFn: searchText }],
    [searchText],
  );
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
    autoResetPageIndex: false,
  });
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  useEffect(() => {
    if (pageIndex >= pageCount && pageIndex > 0)
      table.setPageIndex(Math.max(0, pageCount - 1));
  }, [pageIndex, pageCount, table]);
  return (
    <>
      {!compact && (
        <div className="row wrap data-table-controls">
          <label>
            Filtrar {label}
            <input
              type="search"
              value={globalFilter}
              onChange={(event) => {
                table.setGlobalFilter(event.target.value);
                table.setPageIndex(0);
              }}
              placeholder="Pesquisar…"
            />
          </label>
          <label>
            Linhas por página
            <select
              value={pageSize}
              onChange={(event) =>
                table.setPageSize(Number(event.target.value))
              }
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {children(table.getRowModel().rows.map((row) => row.original))}
      {!compact && (
        <div
          className="row between wrap data-table-controls"
          aria-label={`Paginação: ${label}`}
        >
          <small role="status">
            {total ? pageIndex * pageSize + 1 : 0}–
            {Math.min((pageIndex + 1) * pageSize, total)} de {total} linhas
            {globalFilter && ` (${data.length} no total)`}
          </small>
          <div className="row">
            <button
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Anterior
            </button>
            <span>
              Página {pageIndex + 1} de {Math.max(1, table.getPageCount())}
            </span>
            <button
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Seguinte
            </button>
          </div>
        </div>
      )}
    </>
  );
}
