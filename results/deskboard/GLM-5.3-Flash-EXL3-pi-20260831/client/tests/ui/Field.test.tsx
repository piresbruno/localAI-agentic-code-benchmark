import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextField } from '../../src/components/ui/TextField';
import { Select } from '../../src/components/ui/Select';

describe('TextField', () => {
  it('ties the visible label to the input via htmlFor/id', () => {
    render(<TextField label="Title" />);
    const input = screen.getByLabelText('Title');
    expect(input).toBeInTheDocument();
    const label = screen.getByText('Title');
    expect(label).toHaveAttribute('for', input.id);
  });

  it('shows the error slot with role=alert and aria-invalid', () => {
    render(<TextField label="Title" error="Title is required" />);
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Title is required');
    expect(screen.getByLabelText('Title')).toBeInvalid();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
  });

  it('supports disabled state', () => {
    render(<TextField label="Title" disabled />);
    expect(screen.getByLabelText('Title')).toBeDisabled();
  });
});

describe('Select', () => {
  it('renders options with a tied label', () => {
    render(
      <Select label="Duration">
        <option value="60">60 minutes</option>
        <option value="90">90 minutes</option>
      </Select>,
    );
    const select = screen.getByLabelText('Duration');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('60');
  });

  it('shows field errors', () => {
    render(
      <Select label="Duration" error="Pick a duration">
        <option>30</option>
      </Select>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a duration');
  });
});
