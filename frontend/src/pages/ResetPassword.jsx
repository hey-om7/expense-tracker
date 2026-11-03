import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../services/api';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      setLoading(true);
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(err.message || 'Reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-headline font-bold text-on-surface tracking-tight">Vestor</h1>
          <p className="text-on-surface-variant text-sm mt-1 font-inter">Choose a new password</p>
        </div>

        <div className="bg-surface-container-low/80 backdrop-blur-xl border border-outline-variant/30 rounded-2xl p-8 shadow-2xl">
          {done ? (
            <div className="text-center">
              <span className="material-symbols-outlined text-tertiary text-4xl mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <h2 className="text-xl font-headline font-bold text-on-surface mb-2">Password updated</h2>
              <p className="text-on-surface-variant text-sm mb-6">You can now sign in with your new password. Redirecting…</p>
              <Link to="/login" className="text-primary-container font-semibold hover:underline">Go to sign in</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-headline font-bold text-on-surface mb-1">Reset password</h2>
              <p className="text-on-surface-variant text-sm mb-6">Enter a new password for your account.</p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative group">
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=" "
                    className="peer w-full bg-surface-container/60 border border-outline-variant/40 rounded-xl px-4 pt-5 pb-2 pr-12 text-on-surface text-sm font-inter focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/50 transition-all duration-200 placeholder-transparent"
                    autoComplete="new-password"
                  />
                  <label htmlFor="reset-password" className="absolute left-4 top-2 text-[11px] font-medium text-on-surface-variant peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant/60 peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary-container transition-all duration-200 pointer-events-none">New Password</label>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface transition-colors" tabIndex={-1}>
                    <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>

                <div className="relative group">
                  <input
                    id="reset-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder=" "
                    className="peer w-full bg-surface-container/60 border border-outline-variant/40 rounded-xl px-4 pt-5 pb-2 text-on-surface text-sm font-inter focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/50 transition-all duration-200 placeholder-transparent"
                    autoComplete="new-password"
                  />
                  <label htmlFor="reset-confirm-password" className="absolute left-4 top-2 text-[11px] font-medium text-on-surface-variant peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-on-surface-variant/60 peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-primary-container transition-all duration-200 pointer-events-none">Confirm Password</label>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-error-container/20 border border-error/20 rounded-xl px-4 py-3">
                    <span className="material-symbols-outlined text-error text-lg">error</span>
                    <p className="text-error text-sm font-inter">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-container text-on-primary-container font-headline font-bold text-sm py-3.5 rounded-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Updating…' : 'Reset password'}
                </button>
              </form>
              <p className="text-center text-on-surface-variant text-sm mt-6 font-inter">
                <Link to="/login" className="text-primary-container font-semibold hover:underline">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
