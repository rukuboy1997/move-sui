import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyEmail } from '../lib/api.js';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('No verification token found in this link.'); return; }
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(err => { setStatus('error'); setErrorMsg(err.message); });
  }, [token]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground items-center justify-center p-6">
      <div className="w-full max-w-md glass-panel border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center gap-5">
        <Link to="/" className="flex items-center gap-2 mb-2">
          <img src="/logo.png" alt="myWorld" className="w-8 h-8 rounded-full" />
          <span className="font-bold text-xl tracking-tight">myWorld</span>
        </Link>

        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Verifying your email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">Email Verified!</h2>
              <p className="text-muted-foreground text-sm mt-1">Your email has been confirmed. Your account is now fully secured.</p>
            </div>
            <Link to="/feed" className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-bold hover:bg-primary/90 transition-colors text-sm">
              Go to Feed
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">Verification Failed</h2>
              <p className="text-muted-foreground text-sm mt-1">{errorMsg}</p>
            </div>
            <Link to="/feed" className="bg-secondary border border-white/10 px-6 py-3 rounded-full font-bold hover:bg-secondary/80 transition-colors text-sm">
              Go to Feed
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
