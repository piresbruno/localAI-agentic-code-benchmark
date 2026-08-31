import { ReactNode } from 'react';

export interface TableProps {
  headers: string[];
  /** Number of data rows; when 0 (and emptyMessage given) an empty-state row renders. */
  count: number;
  emptyMessage?: string;
  children: ReactNode;
}

/** Data table with sticky header, hover rows and an empty-state row. */
export function Table({ headers, count, emptyMessage, children }: TableProps) {
  return (
    <table className="table">
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {count === 0 && emptyMessage ? (
          <tr className="table-empty-row">
            <td colSpan={headers.length}>{emptyMessage}</td>
          </tr>
        ) : (
          children
        )}
      </tbody>
    </table>
  );
}
