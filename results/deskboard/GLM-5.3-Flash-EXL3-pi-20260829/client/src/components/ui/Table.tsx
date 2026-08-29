/** Table — header, zebra/hover rows, empty-state row. */
import type { ReactNode } from 'react';

interface TableProps {
  columns: string[];
  /** Rendered when there is no data (empty-state row). */
  emptyMessage?: string;
  children: ReactNode;
}

export function Table({ columns, emptyMessage, children }: TableProps) {
  const isEmpty = emptyMessage !== undefined && columns.length > 0;
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
      {isEmpty && (
        <tfoot>
          <tr>
            <td className="table__empty" colSpan={columns.length}>
              {emptyMessage}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
