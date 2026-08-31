import { useState, type FormEvent } from 'react';
import { registerSchema, loginSchema } from '@deskboard/shared';
import { ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { apiDetailErrors, schemaFieldErrors, type FieldErrors } from '../lib/validate';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { useToast } from '../components/ui/Toast';

/** Login + registration on one page (spec §6); token handled by useAuth. */
export function Login() {
  const { login, register } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const values = { name, email, password };
    const clientErrors =
      mode === 'register' ? schemaFieldErrors(registerSchema, values) : schemaFieldErrors(loginSchema, values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;
    setPending(true);
    try {
      if (mode === 'register') await register(name, email, password);
      else await login(email, password);
    } catch (err) {
      if (err instanceof ApiError && err.details.length > 0) {
        setErrors(apiDetailErrors(err.details));
      } else {
        setErrors({ _form: err instanceof ApiError ? err.message : 'Unexpected error. Please try again.' });
      }
      toast.push(err instanceof ApiError ? err.message : 'Unexpected error.', 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 className="page-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="page-subtitle">
        {mode === 'login' ? 'Sign in to book meeting rooms.' : 'Register as an employee to start booking.'}
      </p>
      {errors['_form'] && (
        <p className="field__error" role="alert">
          ⚠ {errors['_form']}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate>
        {mode === 'register' && (
          <TextField
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors['name']}
            autoComplete="name"
          />
        )}
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors['email']}
          autoComplete="email"
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors['password']}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        <div className="form-actions">
          <Button type="submit" loading={pending}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setErrors({});
            }}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
          </Button>
        </div>
      </form>
    </div>
  );
}
