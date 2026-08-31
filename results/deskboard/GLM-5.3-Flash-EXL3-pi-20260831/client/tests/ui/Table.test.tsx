import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table } from '../../src/components/ui/Table';
import { Spinner } from '../../src/components/ui/Spinner';

describe('Table', () => {
  it('renders headers and rows with hover-ready tbody', () => {
    render(
      <Table
        headers={['Name', 'Capacity']}
        rows={[
          <tr key="r1">
            <td>Fjord</td>
            <td>8</td>
          </tr>,
        ]}
        empty="No rooms"
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Fjord' })).toBeInTheDocument();
  });

  it('shows the empty-state row spanning all columns when there are no rows', () => {
    render(<Table headers={['Name', 'Capacity']} rows={null} empty="No rooms yet — add one" />);
    const empty = screen.getByText('No rooms yet — add one');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveAttribute('colspan', '2');
  });
});

describe('Spinner', () => {
  it('exposes a status role for assistive tech', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
