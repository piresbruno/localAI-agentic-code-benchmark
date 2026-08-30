/** Login/Register page — token handled by the auth hook, errors inline. */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/ui/Button.js';
import { TextField } from '../components/ui/TextField.js';
import { ApiError } from '../api/client.js';

export function LoginPage({ onDone }: { onDone: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors: Record<string, string> = {};
        const details = err.details as
          | { fieldErrors?: Record<string, string[] | undefined> }
          | undefined;
        if (details?.fieldErrors) {
          for (const [field, messages] of Object.entries(details.fieldErrors)) {
            if (messages?.length) fieldErrors[field === 'password' ? 'password' : field] = messages[0];
          }
        }
        setErrors({ form: err.message, ...fieldErrors });
      } else {
        setErrors({ form: 'Could not reach the server. Is it running?' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-section auth-card">
      <h1>{mode === 'login' ? 'Sign in to DeskBoard' : 'Create your account'}</h1>
      {errors.form && (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {errors.form}
        </p>
      )}
      <form onSubmit={submit} noValidate>
        <div className="stack">
          {mode === 'register' && (
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              autoComplete="name"
            />
          )}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint={mode === 'register' ? 'At least 8 characters' : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <Button type="submit" loading={busy}>
            {mode === 'login' ? 'Sign in' : 'Register'}
          </Button>
        </div>
      </form>
      <p className="auth-card__switch">
        {mode === 'login' ? (
          <>
            No account yet?{' '}
            <a
              href="#register"
              onClick={(e) => {
                e.preventDefault();
                setMode('register');
                setErrors({});
              }}
            >
              Register
            </a>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <a
              href="#login"
              onClick={(e) => {
                e.preventDefault();
                setMode('login');
                setErrors({});
              }}
            >
              Sign in
            </a>
          </>
        )}
      </p>
    </div>
  );
}
