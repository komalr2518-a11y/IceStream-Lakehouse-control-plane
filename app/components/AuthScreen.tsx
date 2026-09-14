'use client';

import { FormEvent, useEffect, useState } from 'react';

type Credentials = {
  username: string;
  user_id: string;
  password: string;
};

type Registration = Credentials & {
  display_name: string;
};

type AuthMode = 'login' | 'register';

type PasswordCredentialConstructor = new (data: {
  id: string;
  name?: string;
  password: string;
}) => Credential;

const SAVED_IDENTITY_KEY = 'icestream.saved-identity';

function readSavedIdentity(): { username: string; user_id: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVED_IDENTITY_KEY) ?? 'null') as unknown;
    if (!value || typeof value !== 'object') return null;
    const identity = value as { username?: unknown; user_id?: unknown };
    if (typeof identity.username !== 'string' || typeof identity.user_id !== 'string') return null;
    return { username: identity.username, user_id: identity.user_id };
  } catch {
    return null;
  }
}

async function requestBrowserPasswordSave(username: string, password: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const passwordCredential = (window as Window & { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential;
  if (!passwordCredential || !navigator.credentials?.store) return;
  try {
    await navigator.credentials.store(new passwordCredential({ id: username, name: username, password }));
  } catch {
    // Some embedded browsers do not expose a password vault; autocomplete still remains available.
  }
}

export function AuthScreen({
  checking = false,
  busy = false,
  error = '',
  backendOffline = false,
  onLogin,
  onRegister,
  onRetry,
}: {
  checking?: boolean;
  busy?: boolean;
  error?: string;
  backendOffline?: boolean;
  onLogin?: (credentials: Credentials) => Promise<boolean>;
  onRegister?: (details: Registration) => Promise<boolean>;
  onRetry?: () => Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('axlero.operator');
  const [userId, setUserId] = useState('AXL-IS-001');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savePassword, setSavePassword] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      const savedIdentity = readSavedIdentity();
      if (!savedIdentity) return;
      setUsername(savedIdentity.username);
      setUserId(savedIdentity.user_id);
      setSavePassword(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError('');
    setPassword('');
    setConfirmPassword('');
    if (nextMode === 'register') {
      setDisplayName('');
      setUsername('');
      setUserId('');
    } else {
      const savedIdentity = readSavedIdentity();
      setUsername(savedIdentity?.username ?? 'axlero.operator');
      setUserId(savedIdentity?.user_id ?? 'AXL-IS-001');
      setSavePassword(Boolean(savedIdentity));
    }
  };

  const applyPasswordPreference = async () => {
    if (!savePassword) {
      window.localStorage.removeItem(SAVED_IDENTITY_KEY);
      return;
    }
    window.localStorage.setItem(SAVED_IDENTITY_KEY, JSON.stringify({ username, user_id: userId }));
    await requestBrowserPasswordSave(username, password);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      const registered = await onRegister?.({ display_name: displayName, username, user_id: userId, password });
      if (registered) await applyPasswordPreference();
      return;
    }
    const signedIn = await onLogin?.({ username, user_id: userId, password });
    if (signedIn) await applyPasswordPreference();
  };

  const visibleError = localError || error;
  const title = mode === 'login' ? 'Sign in to IceStream' : 'Create your operator account';

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="IceStream authentication overview">
        <div className="auth-brand"><span className="brand-mark">IS</span><strong>IceStream</strong></div>
        <div className="auth-story-copy">
          <p className="eyebrow">GOVERNED ACCESS</p>
          <h1>Operate the lakehouse control plane with accountable access.</h1>
          <p>Sign in to monitor quality, quarantine unsafe records, inspect incidents, and recover the serving path.</p>
        </div>
        <div className="auth-proof">
          <span>01</span><p><strong>Identity-bound session</strong><small>Username and user ID identify the operator.</small></p>
          <span>02</span><p><strong>Protected controls</strong><small>Dashboard actions require an active session.</small></p>
          <span>03</span><p><strong>Explicit sign out</strong><small>The session token is revoked immediately.</small></p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-head">
            <span className="auth-lock" aria-hidden="true">⌁</span>
            <p className="eyebrow">OPERATOR ACCESS</p>
            <h2>{checking ? 'Checking your session' : title}</h2>
            <p>{checking ? 'Confirming local access…' : mode === 'login' ? 'Use an existing account or create a new one.' : 'Register once, then use this account whenever you run the project.'}</p>
          </div>

          {checking ? (
            <div className="auth-loading" role="status"><i /><span>Connecting securely</span></div>
          ) : (
            <>
              <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
                <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Sign in</button>
                <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Create account</button>
              </div>

              <form onSubmit={submit} autoComplete="on">
                {mode === 'register' && (
                  <label>
                    <span>Full name</span>
                    <input name="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required autoFocus />
                  </label>
                )}
                <label>
                  <span>Username</span>
                  <input name="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]+" required />
                </label>
                <label>
                  <span>User ID</span>
                  <input name="user_id" value={userId} onChange={(event) => setUserId(event.target.value)} autoComplete="off" minLength={4} maxLength={32} pattern="[A-Za-z0-9-]+" required />
                </label>
                <label>
                  <span>Password</span>
                  <div className="password-field">
                    <input name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 10 : undefined} required autoFocus={mode === 'login'} />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
                  </div>
                </label>
                {mode === 'register' && (
                  <>
                    <label>
                      <span>Confirm password</span>
                      <input name="confirm_password" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={10} required />
                    </label>
                    <p className="password-rules">10+ characters with uppercase, lowercase, number, and symbol.</p>
                  </>
                )}
                <label className="auth-save-option">
                  <input name="save_password" type="checkbox" checked={savePassword} onChange={(event) => setSavePassword(event.target.checked)} />
                  <span><strong>Save password</strong><small>Store it with this browser’s password manager.</small></span>
                </label>
                {visibleError && <p className={`auth-error ${backendOffline ? 'offline' : ''}`} role="alert">{visibleError}</p>}
                {backendOffline && <button className="auth-retry" type="button" onClick={() => onRetry?.()} disabled={busy}>{busy ? 'Checking…' : 'Retry backend connection'}</button>}
                <button className="auth-submit" type="submit" disabled={busy || backendOffline}>{busy ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign in' : 'Create account')}</button>
              </form>
            </>
          )}

          <div className="auth-note"><i />Local accounts are saved in SQLite. Passwords are stored as salted hashes.</div>
        </div>
      </section>
    </main>
  );
}
