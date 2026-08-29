/** Design-system component tests (spec §7.2: ≥4 components with RTL tests). */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../src/components/ui/Button.js';
import { TextField } from '../src/components/ui/TextField.js';
import { Select } from '../src/components/ui/Select.js';
import { Badge, FeatureTag, StatusBadge } from '../src/components/ui/Badge.js';
import { Table } from '../src/components/ui/Table.js';
import { Spinner, Skeleton } from '../src/components/ui/Spinner.js';

describe('Button', () => {
  it('renders variants and handles clicks', async () => {
    const onClick = vi.fn();
    render(<Button variant="danger" onClick={onClick}>Delete</Button>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.className).toContain('btn--danger');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows a loading state and disables double submits', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: /Save/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('ties the label via htmlFor and shows the error slot', async () => {
    const onChange = vi.fn();
    render(<TextField label="Email" value="" onChange={onChange} error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
    await userEvent.type(input, 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('is disableable', () => {
    render(<TextField label="Name" value="x" onChange={() => {}} disabled />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });
});

describe('Select', () => {
  it('renders options and reports selection', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Duration"
        value="60"
        onChange={onChange}
        options={[
          { value: '30', label: '30 min' },
          { value: '60', label: '60 min' },
        ]}
      />,
    );
    const select = screen.getByLabelText('Duration');
    await userEvent.selectOptions(select, '30');
    expect(onChange).toHaveBeenCalledWith('30');
  });

  it('shows the error state', () => {
    render(
      <Select
        label="Room"
        value=""
        onChange={() => {}}
        options={[{ value: 'r1', label: 'Room 1' }]}
        error="Room is required"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Room is required');
  });
});

describe('Badge', () => {
  it('conveys status with text, never color alone', () => {
    render(<StatusBadge status="confirmed" />);
    expect(screen.getByText(/Confirmed/)).toBeInTheDocument();
  });

  it('renders cancelled and completed statuses with their marker', () => {
    render(
      <>
        <StatusBadge status="cancelled" />
        <StatusBadge status="completed" />
      </>,
    );
    expect(screen.getByText(/Cancelled/)).toBeInTheDocument();
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
  });

  it('renders feature tags', () => {
    render(<FeatureTag feature="screen" />);
    expect(screen.getByText(/screen/)).toBeInTheDocument();
  });
});

describe('Table', () => {
  it('renders headers, rows, and an empty state row', () => {
    const { rerender } = render(
      <Table columns={['Name', 'Floor']}>
        <tr>
          <td>Boardroom</td>
          <td>5</td>
        </tr>
      </Table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Boardroom')).toBeInTheDocument();

    rerender(<Table columns={['Name', 'Floor']} emptyMessage="No rooms yet.">
      <></>
    </Table>);
    expect(screen.getByText('No rooms yet.')).toBeInTheDocument();
  });
});

describe('Spinner / Skeleton', () => {
  it('exposes loading status to assistive tech', () => {
    render(
      <>
        <Spinner label="Loading rooms" />
        <Skeleton />
      </>,
    );
    expect(screen.getByRole('status', { name: 'Loading rooms' })).toBeInTheDocument();
  });
});
