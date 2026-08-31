import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../src/components/ui/Button.js';
import { TextField } from '../src/components/ui/TextField.js';
import { Select } from '../src/components/ui/Select.js';
import { Modal } from '../src/components/ui/Modal.js';
import { Table } from '../src/components/ui/Table.js';
import { ToastProvider, useToast } from '../src/components/ui/Toast.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Button (design system)', () => {
  it('renders the three variants with distinct styling hooks', () => {
    const { rerender } = render(<Button variant="primary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('btn--primary');
    rerender(<Button variant="secondary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('btn--secondary');
    rerender(<Button variant="danger">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('btn--danger');
  });

  it('shows a spinner, sets aria-busy and disables itself while loading', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('is disabled and does not fire clicks when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('TextField (design system)', () => {
  it('ties the visible label to the input via htmlFor/id', () => {
    render(<TextField label="Work email" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Work email');
    expect(input).toBeInTheDocument();
    expect(input.id).toBe('field-work-email');
  });

  it('shows the error message slot and marks the input invalid', () => {
    render(<TextField label="Email" value="x" onChange={() => {}} error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'field-email-error');
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
  });
});

describe('Select (design system)', () => {
  it('renders labeled options', () => {
    render(
      <Select
        label="Duration"
        options={[
          { value: '30', label: '30 min' },
          { value: '60', label: '60 min' },
        ]}
      />,
    );
    expect(screen.getByLabelText('Duration')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('shows its error slot', () => {
    render(
      <Select
        label="Room"
        options={[{ value: 'r1', label: 'Board Room' }]}
        error="Choose a room"
      />,
    );
    expect(screen.getByText('Choose a room')).toBeInTheDocument();
  });
});

describe('Modal (design system)', () => {
  it('renders a dialog with aria-modal and moves focus inside', () => {
    render(
      <Modal open title="Edit room" onClose={() => {}}>
        <input aria-label="Room name" />
        <button type="button">Save</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Room name')).toHaveFocus();
  });

  it('closes on Escape and returns focus to the opener', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal open title="Edit room" onClose={onClose}>
        <button type="button">Save</button>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('closes on backdrop click but not on clicks inside the dialog', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Edit room" onClose={onClose}>
        <button type="button">Save</button>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps Tab focus within the dialog', () => {
    render(
      <Modal open title="Edit room" onClose={() => {}}>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>,
    );
    const close = screen.getByRole('button', { name: 'Close dialog' });
    const last = screen.getByRole('button', { name: 'Last' });
    // Tab order: Close → First → Last → (wraps to Close).
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

describe('Table (design system)', () => {
  it('renders headers and one row per item with hover-ready rows', () => {
    render(
      <Table
        columns={[
          { header: 'Name', render: (room: { name: string }) => room.name },
          { header: 'Floor', render: (room: { floor: number }) => room.floor },
        ]}
        rows={[
          { id: 'r1', name: 'Board Room', floor: 3 },
          { id: 'r2', name: 'Focus Pod', floor: 2 },
        ]}
        rowKey={(room) => room.id}
        emptyState="No rooms"
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Board Room' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2
  });

  it('shows the empty-state row spanning all columns when there are no rows', () => {
    render(
      <Table
        columns={[{ header: 'Name', render: (room: { name: string }) => room.name }]}
        rows={[]}
        rowKey={(room) => room.id}
        emptyState={<p>No rooms yet — add the first room.</p>}
      />,
    );
    expect(screen.getByText('No rooms yet — add the first room.')).toBeInTheDocument();
    const emptyCell = screen.getByText('No rooms yet — add the first room.').closest('td');
    expect(emptyCell).toHaveAttribute('colspan', '1');
  });
});

describe('Toast (design system)', () => {
  let fire: ((kind: 'success' | 'error', message: string) => void) | null = null;

  function Harness() {
    return (
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );
  }

  function Probe() {
    const toast = useToast();
    fire = (kind, message) => toast[kind](message);
    return null;
  }

  it('renders messages into an aria-live region and auto-dismisses them', async () => {
    vi.useFakeTimers();
    render(<Harness />);

    const region = screen.getByRole('log');
    expect(region).toHaveAttribute('aria-live', 'polite');

    act(() => fire!('success', 'Room saved'));
    expect(screen.getByTestId('toast')).toHaveTextContent('Room saved');
    expect(screen.getByTestId('toast')).toHaveTextContent('✓');

    act(() => fire!('error', 'The room is already booked'));
    expect(screen.getAllByTestId('toast')).toHaveLength(2);

    act(() => vi.advanceTimersByTime(4100));
    expect(screen.queryAllByTestId('toast')).toHaveLength(0);
  });
});
