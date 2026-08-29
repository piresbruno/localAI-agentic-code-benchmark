/** Login/Register page — one form, two modes, inline API error display. */
import { useState, type FormEvent } from 'react';
import { ApiClientError } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';
import { Button } from '../components/ui/Button.js';
import { TextField } from '../components/ui/TextField.js';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        const details = err.details as Array<{ field: string; message: string }> | undefined;
        if (Array.isArray(details)) {
          const map: Record<string, string> = {};
          for (const d of details) map[d.field] = d.message;
          setFieldErrors(map);
        }
      } else {
        setError('Unexpected error. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <main className="app-main" style={{ maxWidth: 420, paddingTop: 'var(--space-7)' }}>
        <h1 className="page-title">DeskBoard</h1>
        <p className="page-subtitle">Book meeting rooms for your office.</p>
        <form className="form" onSubmit={handleSubmit} aria-label={mode === 'login' ? 'Log in' : 'Register'}>
          {mode === 'register' && (
            <TextField
              label="Full name"
              name="name"
              value={name}
              onChange={setName}
              required
              error={fieldErrors.name}
            />
          )}
          <TextField
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
            required
            error={fieldErrors.email}
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            required
            error={fieldErrors.password}
          />
          {error && (
            <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', margin: 0 }}>
              {error}
            </p>
          )}
          <Button type="submit" loading={busy}>
            {mode === 'login' ? 'Log in' : 'Create account'}
          </Button>
        </form>
        <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
          {mode === 'login' ? (
            <>
              No account yet?{' '}
              <a
                href="#register"
                onClick={(e) => {
                  e.preventDefault();
                  setMode('register');
                  setError(null);
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
                  setError(null);
                }}
              >
                Log in
              </a>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
