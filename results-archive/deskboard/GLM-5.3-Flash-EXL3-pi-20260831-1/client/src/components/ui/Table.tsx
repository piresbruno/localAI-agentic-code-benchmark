import type { ReactNode } from 'react';

interface TableProps {
  headers: string[];
  /** Row cells; render nothing (or pass rows=null) to show the empty state. */
  rows: ReactNode[] | null;
  /** Human message + call to action shown when there are no rows (spec §7.3). */
  empty: ReactNode;
}

/** Standard table: header row, hover rows, and a col-spanned empty-state row. */
export function Table({ headers, rows, empty }: TableProps) {
  return (
    <table className="table">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows && rows.length > 0 ? (
          rows
        ) : (
          <tr>
            <td className="table__empty" colSpan={headers.length}>
              {empty}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
