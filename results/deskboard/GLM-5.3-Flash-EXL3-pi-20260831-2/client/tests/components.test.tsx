// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../src/components/ui/Button';
import { Modal } from '../src/components/ui/Modal';
import { Select } from '../src/components/ui/Select';
import { Spinner } from '../src/components/ui/Spinner';
import { Table } from '../src/components/ui/Table';
import { TextField } from '../src/components/ui/TextField';
import { ToastProvider, useToast } from '../src/components/ui/Toast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Button', () => {
  it('renders the required variants', () => {
    for (const variant of ['primary', 'secondary', 'danger'] as const) {
      render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole('button', { name: variant })).toHaveClass(`btn-${variant}`);
    }
  });

  it('disables itself and announces busy while loading (double-submit safe)', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('respects the disabled prop', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        No
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('ties the label to the input and shows the error message slot', () => {
    render(<TextField label="Title" error="Title is required" />);
    const input = screen.getByLabelText('Title');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
  });

  it('renders without an error slot when valid and supports disabled', () => {
    render(<TextField label="Title" disabled />);
    expect(screen.getByLabelText('Title')).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Select', () => {
  it('ties the label and renders options', () => {
    render(
      <Select label="Duration">
        <option value={60}>60 minutes</option>
        <option value={90}>90 minutes</option>
      </Select>,
    );
    expect(screen.getByLabelText('Duration')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '90 minutes' })).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('closes on Escape and on backdrop click, and traps focus', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Add room">
        <TextField label="Name" />
        <button type="button">Save</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add room' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // focus trap: Tab from the last focusable wraps to the first
    screen.getByRole('button', { name: 'Save' }).focus();
    await userEvent.tab();
    expect(document.activeElement).toHaveAttribute('aria-label', 'Close dialog');

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'), { target: screen.getByTestId('modal-backdrop') });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => undefined} title="Hidden">
        <p>content</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Toast', () => {
  function ToastTrigger({ message, variant }: { message: string; variant?: 'success' | 'error' }) {
    const showToast = useToast();
    return (
      <button type="button" onClick={() => showToast(message, variant)}>
        show
      </button>
    );
  }

  it('shows success and error toasts in an aria-live region and auto-dismisses', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastTrigger message="Booking created" />
        <ToastTrigger message="Room conflict" variant="error" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'show' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'show' })[1]);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Booking created')).toBeInTheDocument();
    expect(screen.getByText('Room conflict')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByText('Booking created')).not.toBeInTheDocument();
  });
});

describe('Table', () => {
  it('renders headers and rows, and an empty-state row when there is no data', () => {
    const { rerender } = render(
      <Table headers={['Name', 'Capacity']} count={1}>
        <tr>
          <td>Hudson</td>
          <td>8</td>
        </tr>
      </Table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Hudson' })).toBeInTheDocument();

    rerender(
      <Table headers={['Name', 'Capacity']} count={0} emptyMessage="No rooms yet — add one">
        <></>
      </Table>,
    );
    expect(screen.getByText('No rooms yet — add one')).toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('is exposed to assistive tech', () => {
    render(<Spinner label="Loading rooms" />);
    expect(screen.getByRole('status', { name: 'Loading rooms' })).toBeInTheDocument();
  });
});
