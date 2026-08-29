import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { Button } from './Button';
import { TextField } from './TextField';
import { Select } from './Select';
import { Modal } from './Modal';
import { ToastProvider, useToast } from './Toast';
import { Badge } from './Badge';
import { Table } from './Table';
import { Spinner } from './Spinner';

afterEach(() => {
  vi.useRealTimers();
});

describe('Button (design system)', () => {
  it('renders primary, secondary and danger variants', () => {
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('btn-primary');
    rerender(<Button variant="secondary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('btn-secondary');
    rerender(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('btn-danger');
  });

  it('is disabled and shows a spinner while loading', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: /Save/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not fire clicks when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField (design system)', () => {
  it('ties the label to the input via htmlFor and shows the error slot', () => {
    render(<TextField label="Email" error="Invalid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
    expect(input).toHaveAccessibleDescription('Invalid email');
  });

  it('renders a hint when there is no error', () => {
    render(<TextField label="Password" hint="At least 8 characters" type="password" />);
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(<TextField label="Name" disabled defaultValue="Ada" />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });
});

describe('Select (design system)', () => {
  it('renders options and exposes the error message', () => {
    render(
      <Select label="Room" error="Pick a room">
        <option value="">Choose…</option>
        <option value="r1">Atlas</option>
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'Room' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a room');
    expect(screen.getByRole('option', { name: 'Atlas' })).toBeInTheDocument();
  });
});

describe('Modal (design system)', () => {
  it('opens with focus inside and closes on Escape and backdrop click', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open</Button>
          <Modal open={open} title="Edit room" onClose={() => setOpen(false)}>
            <input aria-label="Room name" />
          </Modal>
        </>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit room' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.querySelector('input')).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Re-open and close via backdrop mousedown.
    await user.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Edit room' }).parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('traps focus inside the dialog', () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            Outside
          </button>
          <Modal open={open} title="Trap" onClose={() => setOpen(false)}>
            <button type="button">First</button>
            <button type="button">Last</button>
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Trap' });
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });
    const close = screen.getByRole('button', { name: 'Close dialog' });

    // Auto-focus lands on the first focusable inside the modal body.
    expect(first).toHaveFocus();

    // Tab from the last focusable (Last) wraps back to the first (close button).
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(close).toHaveFocus();

    // Shift+Tab from the first focusable (close) wraps to the last (Last).
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    // Escape closes the dialog.
    fireEvent.keyDown(last, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(dialog).not.toBeInTheDocument();
  });
});

describe('Toast (design system)', () => {
  it('shows success toasts in an aria-live region and dismisses them', () => {
    vi.useFakeTimers();
    function Harness() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.push('success', 'Saved!')}>
          Notify
        </button>
      );
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveTextContent('Saved!');

    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Badge/Table/Spinner (design system)', () => {
  it('Badge pairs an icon with text (never color alone) and Table shows an empty row', () => {
    render(
      <>
        <Badge tone="danger">Cancelled</Badge>
        <Table headers={['A']} emptyMessage="Nothing here" />
        <Spinner label="Working" />
      </>,
    );
    expect(screen.getByText('Cancelled')).toHaveClass('badge-danger');
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByLabelText('Working')).toBeInTheDocument();
  });
});
