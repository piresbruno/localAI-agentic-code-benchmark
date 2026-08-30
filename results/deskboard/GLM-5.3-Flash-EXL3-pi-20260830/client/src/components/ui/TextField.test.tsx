// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField.js';

describe('TextField', () => {
  it('associates the visible label with the input via htmlFor', () => {
    render(<TextField label="Email address" />);
    const input = screen.getByLabelText('Email address');
    expect(input).toBeInTheDocument();
  });

  it('shows an error message tied to the input via aria-describedby', () => {
    render(<TextField label="Email address" error="Email is required" />);
    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Email is required');
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
  });

  it('shows the hint only when there is no error', () => {
    const { rerender } = render(<TextField label="Password" hint="At least 8 characters" />);
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();

    rerender(<TextField label="Password" hint="At least 8 characters" error="Too short" />);
    expect(screen.queryByText('At least 8 characters')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
  });

  it('passes disabled through', () => {
    render(<TextField label="Title" disabled />);
    expect(screen.getByLabelText('Title')).toBeDisabled();
  });
});
