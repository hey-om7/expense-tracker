import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { verifyEmail } from '../services/api';
import { useAuth } from '../context/AuthContext';

const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setSessionUser } = useAuth();
  const [status, setStatus] = useState('loading'); // loading | done | error
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // The token is single-use; guard against React StrictMode's double effect run.
    if (started.current) return;
    started.current = true;
    verifyEmail(token)
      .then((res) => {
        setSessionUser(res.user);
        setStatus('done');
        setTimeout(() => navigate('/', { replace: true }), 1500);
      })
      .catch((err) => {
        setError(err.message || 'Verification link is invalid or has expired.');
        setStatus('error');
      });
  }, [token, navigate, setSessionUser]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container-low/80 backdrop-blur-xl border border-outline-variant/30 rounded-2xl p-8 shadow-2xl text-center">
        <h1 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-6">Vestor</h1>
        {status === 'loading' && <p className="text-on-surface-variant text-sm">Verifying your email…</p>}
        {status === 'done' && (
          <>
            <span className="material-symbols-outlined text-tertiary text-4xl mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <h2 className="text-xl font-headline font-bold text-on-surface mb-2">Email verified</h2>
            <p className="text-on-surface-variant text-sm">Signing you in…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <span className="material-symbols-outlined text-error text-4xl mb-3">error</span>
            <p className="text-error text-sm mb-6">{error}</p>
            <Link to="/login" className="text-primary-container font-semibold hover:underline">Go to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
