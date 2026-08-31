import { FormEvent, useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { useToast } from '../components/ui/Toast';

/** Login + registration in one view; both paths issue a JWT via the API. */
export function Login() {
  const { login, register } = useAuth();
  const showToast = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (mode === 'login') {
        await login(email, password);
        showToast('Welcome back!');
      } else {
        await register(name, email, password);
        showToast(`Welcome, ${name || 'colleague'}!`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.details ?? {});
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="auth-heading">
      <h1 id="auth-heading">{mode === 'login' ? 'Sign in to DeskBoard' : 'Create your account'}</h1>
      <p className="muted">
        Book meeting rooms for your team. {mode === 'login' ? 'No account yet?' : 'Already registered?'}{' '}
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setFormError(null);
            setFieldErrors({});
          }}
        >
          {mode === 'login' ? 'Register here' : 'Sign in instead'}
        </button>
      </p>

      <form onSubmit={onSubmit} noValidate>
        {mode === 'register' && (
          <TextField
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name?.[0]}
            autoComplete="name"
          />
        )}
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email?.[0]}
          autoComplete="email"
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password?.[0]}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        {formError && (
          <p className="form-error" role="alert">
            ⚠ {formError}
          </p>
        )}
        <Button type="submit" loading={busy} disabled={busy}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
    </section>
  );
}
