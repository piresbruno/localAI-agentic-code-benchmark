// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from './Badge.js';
import { Table, type TableColumn } from './Table.js';
import { ToastProvider, useToast } from './Toast.jsx';

describe('Badge', () => {
  it('renders variants with visible text (status never color-only)', () => {
    render(<Badge variant="success">confirmed</Badge>);
    const badge = screen.getByText('confirmed');
    expect(badge).toHaveClass('badge--success');
    expect(badge).toHaveTextContent('confirmed');
  });
});

interface Row {
  id: string;
  name: string;
}

describe('Table', () => {
  const columns: TableColumn<Row>[] = [
    { key: 'name', header: 'Name', render: (r) => r.name }
  ];

  it('renders header and rows', () => {
    render(
      <Table columns={columns} rows={[{ id: '1', name: 'Kiwi' }]} rowKey={(r) => r.id} />
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Kiwi' })).toBeInTheDocument();
  });

  it('renders the empty-state row spanning all columns', () => {
    render(
      <Table
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="No bookings yet — pick a room"
      />
    );
    const cell = screen.getByText('No bookings yet — pick a room');
    expect(cell).toHaveAttribute('colspan', '1');
  });
});

function ToastDemo() {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast('success', 'Booking created')}>trigger</button>
  );
}

describe('Toast', () => {
  it('shows a toast inside an aria-live region and auto-dismisses', async () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <ToastDemo />
        </ToastProvider>
      );
      const region = document.querySelector('.toast-region');
      expect(region).toHaveAttribute('aria-live', 'polite');

      fireEvent.click(screen.getByRole('button', { name: 'trigger' }));
      expect(screen.getByText('Booking created')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByText('Booking created')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
