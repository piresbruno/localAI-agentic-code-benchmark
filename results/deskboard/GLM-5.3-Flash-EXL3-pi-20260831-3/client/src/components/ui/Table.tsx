import type { ReactNode } from 'react';

interface TableColumn<T> {
  header: string;
  /** Render a cell for the row. */
  render: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  rows: T[];
  /** `row.id` is used as the React key. */
  rowKey: (row: T) => string;
  /** Message + call to action rendered as a full-width empty-state row. */
  emptyState: ReactNode;
}

/** Table with header, hover rows, and an empty-state row (colSpan). */
export function Table<T>({ columns, rows, rowKey, emptyState }: TableProps<T>) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="data-table-empty">
                {emptyState}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.header}>{column.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
