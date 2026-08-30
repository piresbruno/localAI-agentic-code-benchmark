// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal.js';
import { TextField } from './TextField.js';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} title="Hidden" onClose={() => {}}>
        <p>content</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a dialog with role=dialog, aria-modal and the title', () => {
    render(
      <Modal open title="Edit room" onClose={() => {}}>
        <TextField label="Name" />
      </Modal>
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit room' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on Escape and moves focus back', async () => {
    const onClose = vi.fn();
    render(
      <>
        <button>Outside</button>
        <Modal open title="Edit room" onClose={onClose}>
          <TextField label="Name" />
        </Modal>
      </>
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on backdrop click but not on dialog clicks', async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Edit room" onClose={onClose}>
        <TextField label="Name" />
      </Modal>
    );
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();

    onClose.mockClear();
    await userEvent.click(screen.getByLabelText('Name'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps Tab focus within the dialog', async () => {
    render(
      <Modal open title="Edit room" onClose={() => {}}>
        <TextField label="Name" />
        <button>First</button>
        <button>Last</button>
      </Modal>
    );
    const last = screen.getByRole('button', { name: 'Last' });
    const close = screen.getByRole('button', { name: 'Close dialog' });
    last.focus();
    await userEvent.keyboard('{Tab}');
    // Wrapped around to the first focusable element (close button)
    expect(close).toHaveFocus();
  });
});
