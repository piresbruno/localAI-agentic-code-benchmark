import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginSchema, registerSchema, formatZodErrors } from 'shared';
import type { ZodError } from 'zod';
import { authApi } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';

type Mode = 'login' | 'register';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const switchMode = (next: Mode) => {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const registerResult =
      mode === 'register' ? registerSchema.safeParse({ name, email, password }) : null;
    const loginResult = mode === 'login' ? loginSchema.safeParse({ email, password }) : null;
    const errorZod = registerResult ? registerResult.error : loginResult?.error;
    if (errorZod) {
      setFieldErrors(formatZodErrors(errorZod as ZodError));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register' && registerResult?.success) {
        const result = await authApi.register(registerResult.data);
        login(result.token, result.user);
      } else if (mode === 'login' && loginResult?.success) {
        const result = await authApi.login(loginResult.data);
        login(result.token, result.user);
      }
      toast.push('success', mode === 'register' ? 'Account created — welcome!' : 'Welcome back!');
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setFormError(message);
      toast.push('error', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <h1 className="auth-title">DeskBoard</h1>
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab ${mode === 'login' ? 'auth-tab-active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab ${mode === 'register' ? 'auth-tab-active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Register
          </button>
        </div>

        {mode === 'register' ? (
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            autoComplete="name"
          />
        ) : null}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          autoComplete="email"
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint={mode === 'register' ? 'At least 8 characters' : undefined}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        />

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <Button type="submit" loading={submitting} className="auth-submit">
          {mode === 'register' ? 'Create account' : 'Log in'}
        </Button>
        <p className="hint auth-hint">
          {mode === 'register'
            ? 'You get an employee account. Admins are seeded.'
            : 'Seeded admin: admin@deskboard.local / admin123'}
        </p>
      </form>
    </div>
  );
}
