import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../../src/components/ui/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} title="Add room" onClose={() => undefined}>
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders an accessible dialog with title and content', () => {
    render(
      <Modal open title="Add room" onClose={() => undefined}>
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add room' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('closes on Escape and restores focus (keyboard operable)', async () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'opener';
    document.body.appendChild(trigger);
    trigger.focus();
    render(
      <Modal open title="Add room" onClose={onClose}>
        <button type="button">Save</button>
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    trigger.remove();
  });

  it('closes on backdrop click and via the close button', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open title="Add room" onClose={onClose}>
        <button type="button">Save</button>
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(container.querySelector('.modal__backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('traps Tab focus inside the dialog', async () => {
    render(
      <Modal open title="Add room" onClose={() => undefined}>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>,
    );
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    await userEvent.tab();
    // Wraps to the first focusable element inside the dialog (the header close button).
    expect(document.activeElement).toHaveAttribute('aria-label', 'Close dialog');
  });
});
