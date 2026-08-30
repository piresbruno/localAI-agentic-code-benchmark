// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  it('renders all three variants with their classes', () => {
    const { rerender } = render(<Button variant="primary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('btn--primary');

    rerender(<Button variant="secondary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('btn--secondary');

    rerender(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('btn--danger');
  });

  it('shows a spinner, disables itself and announces busy while loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status', { name: 'In progress' })).toBeInTheDocument();
  });

  it('does not fire clicks while loading (double-submit safety)', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires clicks and respects disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
