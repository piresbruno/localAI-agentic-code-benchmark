import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../../src/components/ui/Button';

describe('Button', () => {
  it('renders the three variants', () => {
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('btn--primary');
    rerender(<Button variant="secondary">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('btn--secondary');
    rerender(<Button variant="danger">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('btn--danger');
  });

  it('fires onClick on click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Book</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Book' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('loading state disables the button and shows a spinner (double-submit safe)', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Book
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /Book/ });
    expect(btn).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Working' })).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('honours the disabled prop', () => {
    render(<Button disabled>Book</Button>);
    expect(screen.getByRole('button', { name: 'Book' })).toBeDisabled();
  });
});
