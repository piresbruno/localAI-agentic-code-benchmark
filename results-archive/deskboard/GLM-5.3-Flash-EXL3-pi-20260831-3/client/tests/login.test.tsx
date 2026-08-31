import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/api/client.js', () => {
  class ApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
      readonly details?: unknown,
    ) {
      super(message);
    }
    get fieldErrors(): Record<string, string[]> {
      return typeof this.details === 'object' && this.details !== null
        ? (this.details as Record<string, string[]>)
        : {};
    }
  }
  return {
    ApiError,
    setAuthToken: vi.fn(),
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() },
  };
});

const loginMock = vi.fn();
const registerMock = vi.fn();
vi.mock('../src/hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: null,
    login: loginMock,
    register: registerMock,
    logout: vi.fn(),
  }),
}));

import { api } from '../src/api/client.js';
import { LoginPage } from '../src/pages/LoginPage.js';
import { ToastProvider } from '../src/components/ui/Toast.js';

const mockApi = vi.mocked(api, true);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <ToastProvider>
      <LoginPage />
    </ToastProvider>,
  );
}

describe('LoginPage', () => {
  it('submits login credentials to the auth hook', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue(undefined);
    renderPage();

    await user.type(screen.getByLabelText('Email'), 'ana@office.local');
    await user.type(screen.getByLabelText('Password'), 'longenough1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('ana@office.local', 'longenough1'));
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('toggles to registration mode and submits name+email+password', async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValue(undefined);
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Ana');
    await user.type(screen.getByLabelText('Email'), 'ana@office.local');
    await user.type(screen.getByLabelText('Password'), 'longenough1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith('Ana', 'ana@office.local', 'longenough1'),
    );
  });

  it('maps validation field errors from the API contract onto the fields', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../src/api/client.js');
    loginMock.mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', {
        password: ['Password must be at least 8 characters'],
      }),
    );
    renderPage();

    await user.type(screen.getByLabelText('Email'), 'ana@office.local');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(mockApi.post).not.toHaveBeenCalled();
  });
});
