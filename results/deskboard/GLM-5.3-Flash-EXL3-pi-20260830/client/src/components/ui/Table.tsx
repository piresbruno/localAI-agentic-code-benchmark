/** Table — zebra/hover rows with a built-in empty-state row. */
export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  caption?: string;
}

export function Table<T>({ columns, rows, rowKey, emptyMessage = 'Nothing to show yet', caption }: TableProps<T>) {
  return (
    <table className="data-table">
      {caption && <caption className="muted">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col">
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="data-table__empty">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key}>{c.render(row)}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
