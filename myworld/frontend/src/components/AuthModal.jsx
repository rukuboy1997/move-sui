import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth.jsx';

function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
  );
}

function PasswordInput({ value, onChange, placeholder, autoComplete, required, minLength, className }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

export default function AuthModal() {
  const {
    authModalOpen, authModalMode, closeAuthModal,
    signIn, signUp, openAuthModal,
    requestPasswordReset, resetPassword,
  } = useAuth();

  const [mode, setMode] = useState(authModalMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setMode(authModalMode); }, [authModalMode, authModalOpen]);
  useEffect(() => {
    if (!authModalOpen) {
      setError(null); setInfo(null);
      setUsername(''); setEmail(''); setPassword('');
      setCode(''); setNewPassword('');
    }
  }, [authModalOpen]);

  if (!authModalOpen) return null;

  const goTo = (next) => { setMode(next); setError(null); setInfo(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setInfo(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUp({ username: username.trim(), email: email.trim() || undefined, password });
      } else if (mode === 'signin') {
        await signIn({ username: username.trim(), password });
      } else if (mode === 'forgot') {
        await requestPasswordReset({ email: email.trim() });
        setInfo(`If an account exists for ${email.trim()}, a verification code has been sent. Check your inbox.`);
        setMode('reset');
      } else if (mode === 'reset') {
        await resetPassword({ email: email.trim(), code: code.trim(), newPassword });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const titles = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password', reset: 'Enter your code' };
  const submitLabels = { signin: 'Sign in', signup: 'Create account', forgot: 'Send code', reset: 'Reset password' };
  const inputCls = 'w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={closeAuthModal}>
      <div className="w-full max-w-md glass-panel border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">{titles[mode]}</h2>
          <button onClick={closeAuthModal} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="p-3 bg-destructive/20 border border-destructive/40 rounded-xl text-sm text-destructive-foreground">{error}</div>}
          {info && <div className="p-3 bg-primary/15 border border-primary/30 rounded-xl text-sm">{info}</div>}

          {mode === 'forgot' && <p className="text-sm text-muted-foreground -mt-2">Enter the email associated with your account and we'll send you a 6-digit verification code.</p>}
          {mode === 'reset' && <p className="text-sm text-muted-foreground -mt-2">Enter the code we sent to <strong className="text-foreground">{email || 'your email'}</strong> and choose a new password.</p>}

          {(mode === 'signin' || mode === 'signup') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="your_handle" autoComplete="username" required minLength={3}
                className={inputCls} />
            </div>
          )}

          {(mode === 'signup' || mode === 'forgot' || mode === 'reset') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Email {mode === 'signup' && <span className="opacity-60 font-normal normal-case">(needed for password recovery)</span>}
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" required
                disabled={mode === 'reset'}
                className={`${inputCls} disabled:opacity-60`} />
            </div>
          )}

          {mode === 'reset' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Verification code</label>
              <input type="text" inputMode="numeric" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456" required
                className={`${inputCls} text-center text-2xl font-mono tracking-[0.5em]`} />
            </div>
          )}

          {(mode === 'signin' || mode === 'signup') && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
                {mode === 'signin' && (
                  <button type="button" onClick={() => goTo('forgot')} className="text-xs text-primary hover:underline font-medium">Forgot?</button>
                )}
              </div>
              <PasswordInput
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required minLength={6} className={inputCls}
              />
            </div>
          )}

          {mode === 'reset' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New password</label>
              <PasswordInput
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters" autoComplete="new-password"
                required minLength={6} className={inputCls}
              />
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="bg-primary text-primary-foreground rounded-full py-3 font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors mt-2">
            {submitting ? 'Please wait...' : submitLabels[mode]}
          </button>

          {mode === 'signin' && (
            <p className="text-sm text-center text-muted-foreground">
              Don't have an account?{' '}
              <button type="button" onClick={() => openAuthModal('signup')} className="text-primary font-bold hover:underline">Sign up</button>
            </p>
          )}
          {mode === 'signup' && (
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <button type="button" onClick={() => openAuthModal('signin')} className="text-primary font-bold hover:underline">Sign in</button>
            </p>
          )}
          {(mode === 'forgot' || mode === 'reset') && (
            <p className="text-sm text-center text-muted-foreground">
              <button type="button" onClick={() => goTo('signin')} className="text-primary font-bold hover:underline">← Back to sign in</button>
              {mode === 'reset' && <>{' · '}<button type="button" onClick={() => goTo('forgot')} className="hover:underline">Resend code</button></>}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
