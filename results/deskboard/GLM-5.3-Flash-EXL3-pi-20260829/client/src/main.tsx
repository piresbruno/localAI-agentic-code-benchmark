import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/app.css';
import './styles/components.css';
import { AppShell } from './components/AppShell.js';
import { AuthProvider } from './hooks/useAuth.js';
import { ToastProvider } from './components/ui/Toast.js';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);
