import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../components/ui/Button.js';
import { TextField } from '../components/ui/TextField.js';
import { ApiError } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../components/ui/Toast.js';

/** Login/Register page: one form, two modes, inline errors from the API contract. */
export function LoginPage() {
  const { login, register } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created — welcome!');
    } catch (err) {
      if (err instanceof ApiError) {
        const clientFieldErrors: Record<string, string> = {};
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          const first = messages[0];
          if (first) clientFieldErrors[field] = first;
        }
        setFieldErrors(clientFieldErrors);
        setFormError(err.message);
      } else {
        setFormError('Something went wrong — please try again');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container">
      <div className="auth-page">
        <h1 className="page-title">
          {mode === 'login' ? 'Sign in to DeskBoard' : 'Create your account'}
        </h1>
        <p className="muted">
          Book meeting rooms for your team. {mode === 'login' ? 'New here?' : 'Already registered?'}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setFormError(null);
              setFieldErrors({});
            }}
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>

        <form className="form-stack" onSubmit={onSubmit} noValidate>
          {mode === 'register' && (
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              autoComplete="name"
            />
          )}
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
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <Button type="submit" loading={submitting}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
