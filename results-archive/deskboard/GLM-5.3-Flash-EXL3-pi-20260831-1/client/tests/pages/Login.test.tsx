import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, api } from '../../src/api/client';
import { AuthProvider } from '../../src/hooks/useAuth';
import { ToastProvider } from '../../src/components/ui/Toast';
import { Login } from '../../src/pages/Login';

vi.mock('../../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      login: vi.fn(),
      register: vi.fn(),
      me: vi.fn(),
    },
  };
});

function renderLogin() {
  return render(
    <AuthProvider>
      <ToastProvider>
        <Login />
      </ToastProvider>
    </AuthProvider>,
  );
}

describe('Login', () => {
  it('submits credentials to the API on sign in', async () => {
    vi.mocked(api.login).mockResolvedValue({
      token: 't',
      user: { id: 'u1', name: 'Nina', email: 'nina@test.local', role: 'employee' },
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'nina@test.local');
    await userEvent.type(screen.getByLabelText('Password'), 'password-123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(api.login).toHaveBeenCalledWith({ email: 'nina@test.local', password: 'password-123' });
  });

  it('shows the API error message on failed sign in', async () => {
    vi.mocked(api.login).mockRejectedValue(
      new ApiError('INVALID_CREDENTIALS', 401, 'Invalid email or password.'),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'nina@test.local');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('pre-validates client-side and blocks submission on invalid email', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'password-123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(api.login).not.toHaveBeenCalled();
    expect(await screen.findAllByRole('alert').then((els) => els.length)).toBeGreaterThan(0);
  });

  it('switches to registration mode and submits name too', async () => {
    vi.mocked(api.register).mockResolvedValue({
      token: 't',
      user: { id: 'u1', name: 'Nina', email: 'nina@test.local', role: 'employee' },
    });
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Need an account? Register' }));
    await userEvent.type(screen.getByLabelText('Full name'), 'Nina');
    await userEvent.type(screen.getByLabelText('Email'), 'nina@test.local');
    await userEvent.type(screen.getByLabelText('Password'), 'password-123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(api.register).toHaveBeenCalledWith({
      name: 'Nina',
      email: 'nina@test.local',
      password: 'password-123',
    });
  });
});
