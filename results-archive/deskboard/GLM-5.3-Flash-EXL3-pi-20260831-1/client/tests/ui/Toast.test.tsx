import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '../../src/components/ui/Toast';

function Trigger() {
  const { push } = useToast();
  return (
    <button type="button" onClick={() => push('Booking created')}>
      push success
    </button>
  );
}

function ErrorTrigger() {
  const { push } = useToast();
  return (
    <button type="button" onClick={() => push('Room is already booked', 'error')}>
      push error
    </button>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a pushed toast in the aria-live region with success styling', async () => {
    const { container } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    const region = container.querySelector('.toasts') as HTMLElement;
    expect(region).toHaveAttribute('aria-live', 'polite');
    await act(async () => {
      screen.getByRole('button', { name: 'push success' }).click();
    });
    expect(screen.getByTestId('toast')).toHaveTextContent('Booking created');
    expect(screen.getByTestId('toast')).toHaveClass('toast--success');
  });

  it('renders error toasts with error styling', async () => {
    render(
      <ToastProvider>
        <ErrorTrigger />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByRole('button', { name: 'push error' }).click();
    });
    expect(screen.getByTestId('toast')).toHaveClass('toast--error');
  });

  it('auto-dismisses after the timeout', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await act(async () => {
      screen.getByRole('button', { name: 'push success' }).click();
    });
    expect(screen.getByTestId('toast')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(4200);
    });
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });
});
