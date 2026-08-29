/** Modal accessibility: focus trap, Esc to close, backdrop click. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../src/components/ui/Modal.js';
import { TextField } from '../src/components/ui/TextField.js';

afterEach(cleanup);

function renderModal(onClose = vi.fn()) {
  render(
    <Modal open title="New booking" onClose={onClose}>
      <TextField label="Title" value="" onChange={() => {}} />
    </Modal>,
  );
  return onClose;
}

describe('Modal', () => {
  it('sets role=dialog + aria-modal and focuses the first focusable element', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'New booking' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.activeElement?.tagName).toBe('INPUT');
  });

  it('closes on Escape', async () => {
    const onClose = renderModal();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on backdrop click but not on dialog click', async () => {
    const onClose = renderModal();
    await userEvent.click(screen.getByRole('dialog', { name: 'New booking' }));
    expect(onClose).not.toHaveBeenCalled();
    // Click the backdrop itself (the overlay div).
    await userEvent.click(document.querySelector('.modal-backdrop')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('traps Tab focus inside the dialog', async () => {
    renderModal();
    const focusable = document.querySelectorAll<HTMLElement>(
      '.modal button, .modal input',
    );
    // Tab from the last element wraps to the first.
    focusable[focusable.length - 1].focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(focusable[0]);
  });
});
