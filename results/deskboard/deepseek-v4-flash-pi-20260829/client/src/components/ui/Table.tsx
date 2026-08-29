import type { ReactNode } from 'react';
import { Children } from 'react';
import './ui.css';

export interface TableProps {
  headers: string[];
  children?: ReactNode;
  /** Shown as a full-width row when the body is empty. */
  emptyMessage?: string;
  caption?: string;
}

/** Simple table: header, optional caption, zebra/hover rows, empty-state row. */
export function Table({ headers, children, emptyMessage, caption }: TableProps) {
  return (
    <div className="table-wrap">
      <table className="table">
        {caption ? <caption className="table-caption">{caption}</caption> : null}
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
          {emptyMessage && !hasRows(children) ? (
            <tr>
              <td colSpan={headers.length} className="table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function hasRows(children: ReactNode): boolean {
  return Children.count(children) > 0;
}
